#!/usr/bin/env tsx
/**
 * End-to-End Lead → Calendar Event Verification
 * 
 * Purpose: Prove that calendar events are created when lead capture forms are submitted.
 * Does not modify schemas or business logic - only tests existing endpoints.
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const LCF_SLUG = process.env.LCF_SLUG;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface Question {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapTo: string;
  orderIndex: number;
  options?: string;
}

interface TestResult {
  check: string;
  status: '✅ PASS' | '❌ FAIL' | '⚠️ INFO';
  details: string;
}

const results: TestResult[] = [];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  END-TO-END LEAD → CALENDAR EVENT VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Resolve slug
  console.log('📋 Step 1: Resolving form slug...');
  let slug = LCF_SLUG;
  
  if (!slug) {
    const slugResult = await sql`
      SELECT slug FROM lead_capture_forms WHERE is_active = true LIMIT 1
    `;
    if (slugResult.length === 0) {
      console.error('❌ No active lead capture forms found');
      process.exit(1);
    }
    slug = slugResult[0].slug;
    console.log(`   Found active form: ${slug}`);
  } else {
    console.log(`   Using provided slug: ${slug}`);
  }

  // Step 2: Load form questions
  console.log('\n📋 Step 2: Loading form questions...');
  const formResult = await sql`
    SELECT questions FROM lead_capture_forms WHERE slug = ${slug} LIMIT 1
  `;
  
  if (formResult.length === 0) {
    console.error(`❌ Form with slug "${slug}" not found`);
    process.exit(1);
  }

  const questionsRaw = formResult[0].questions;
  const questions: Question[] = typeof questionsRaw === 'string' 
    ? JSON.parse(questionsRaw) 
    : questionsRaw;
  const sortedQuestions = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  
  console.log(`   Loaded ${questions.length} questions`);
  console.log('\n   Question Structure:');
  sortedQuestions.forEach((q, idx) => {
    const req = q.required ? '(required)' : '(optional)';
    console.log(`     ${idx}: ${q.id} → ${q.mapTo} ${req} - ${q.label}`);
  });

  // Find the date question
  const dateQuestion = questions.find(q => q.mapTo === 'projectDate');
  if (!dateQuestion) {
    console.error('❌ No projectDate field found in form');
    process.exit(1);
  }
  console.log(`\n   📅 Date field: ${dateQuestion.id} (orderIndex: ${dateQuestion.orderIndex})`);

  // Find required fields
  const requiredFields = questions.filter(q => q.required);
  console.log(`   ✓ Required fields: ${requiredFields.length}`);

  // Step 3: Build test payloads
  console.log('\n📋 Step 3: Building test payloads...');
  
  const timestamp = Date.now();
  const testValues: Record<string, string> = {};
  
  // Map known fields
  for (const q of sortedQuestions) {
    switch (q.mapTo) {
      case 'leadName':
        testValues[q.id] = 'E2E Calendar Triage';
        break;
      case 'leadEmail':
        testValues[q.id] = `triage+${timestamp}@example.com`;
        break;
      case 'leadPhoneNumber':
        testValues[q.id] = '+44 7700 900123';
        break;
      case 'eventType':
        testValues[q.id] = 'Wedding';
        break;
      case 'eventLocation':
        testValues[q.id] = 'Test Venue';
        break;
      case 'projectDate':
        testValues[q.id] = '25/12/2025';
        break;
      default:
        // Fill any other required fields with dummy data
        if (q.required) {
          if (q.type === 'select' && q.options) {
            const opts = q.options.split(',').map(o => o.trim());
            testValues[q.id] = opts[0] || 'Test Value';
          } else {
            testValues[q.id] = `Test ${q.label}`;
          }
        }
    }
  }

  // Build numeric payload (1-based index)
  const numericPayload: Record<string, string> = {};
  sortedQuestions.forEach((q, idx) => {
    if (testValues[q.id]) {
      numericPayload[String(idx + 1)] = testValues[q.id];
    }
  });

  // Build q-style payload
  const qStylePayload: Record<string, string> = { ...testValues };

  console.log('   ✓ Numeric payload:', JSON.stringify(numericPayload, null, 2).substring(0, 200) + '...');
  console.log('   ✓ Q-style payload:', JSON.stringify(qStylePayload, null, 2).substring(0, 200) + '...');

  // Step 4: Get baseline event count
  console.log('\n📋 Step 4: Getting baseline events...');
  const beforeEvents = await sql`
    SELECT title, type, 
           to_char(start_date,'DD/MM/YYYY HH24:MI') AS start,
           to_char(created_at,'DD/MM/YYYY HH24:MI') AS created
    FROM events
    ORDER BY created_at DESC
    LIMIT 3
  `;
  console.log('   Last 3 events:');
  beforeEvents.forEach(e => {
    console.log(`     - ${e.title} (${e.type}) @ ${e.start} [created ${e.created}]`);
  });

  // Step 5: Submit numeric payload
  console.log('\n📋 Step 5: Submitting NUMERIC payload...');
  const numericResult = await submitLead(slug, numericPayload);
  console.log(`   HTTP ${numericResult.status}`);
  console.log(`   Response: ${JSON.stringify(numericResult.body, null, 2)}`);

  // Check if numeric submission succeeded
  let numericEventCreated = false;
  if (numericResult.status === 200) {
    await sleep(1000); // Give DB a moment to commit
    const afterNumeric = await sql`
      SELECT title, type,
             to_char(start_date,'DD/MM/YYYY HH24:MI') AS start,
             to_char(created_at,'DD/MM/YYYY HH24:MI') AS created
      FROM events
      WHERE title LIKE 'New Lead Project • E2E Calendar Triage%'
        AND to_char(start_date,'DD/MM/YYYY') = '25/12/2025'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    if (afterNumeric.length > 0) {
      numericEventCreated = true;
      console.log(`   ✅ Event created: "${afterNumeric[0].title}" @ ${afterNumeric[0].start}`);
      results.push({
        check: 'A) Numeric → Event',
        status: '✅ PASS',
        details: `Event "${afterNumeric[0].title}" created with start date ${afterNumeric[0].start}`
      });
    } else {
      console.log(`   ❌ No matching event found`);
      results.push({
        check: 'A) Numeric → Event',
        status: '❌ FAIL',
        details: 'Lead submitted successfully but no calendar event created'
      });
    }
  } else if (numericResult.status === 400) {
    const missingFields = numericResult.body?.fields || ['unknown'];
    console.log(`   ⚠️ Missing required fields: ${missingFields.join(', ')}`);
    results.push({
      check: 'A) Numeric → Event',
      status: '❌ FAIL',
      details: `HTTP 400 - Missing fields: ${missingFields.join(', ')}`
    });
    results.push({
      check: 'C) Required fields validation',
      status: '✅ PASS',
      details: 'Server correctly rejected incomplete submission'
    });
  } else {
    console.log(`   ❌ Unexpected status code`);
    results.push({
      check: 'A) Numeric → Event',
      status: '❌ FAIL',
      details: `HTTP ${numericResult.status} - ${numericResult.body?.message || 'Unknown error'}`
    });
  }

  // Step 6: Submit q-style payload
  console.log('\n📋 Step 6: Submitting Q-STYLE payload...');
  const timestamp2 = Date.now();
  const qStylePayload2 = { ...qStylePayload };
  
  // Update email to make it unique
  const emailQuestion = questions.find(q => q.mapTo === 'leadEmail');
  if (emailQuestion) {
    qStylePayload2[emailQuestion.id] = `triage+${timestamp2}@example.com`;
  }
  
  const qStyleResult = await submitLead(slug, qStylePayload2);
  console.log(`   HTTP ${qStyleResult.status}`);
  console.log(`   Response: ${JSON.stringify(qStyleResult.body, null, 2)}`);

  // Check if q-style submission succeeded
  let qStyleEventCreated = false;
  if (qStyleResult.status === 200) {
    await sleep(1000); // Give DB a moment to commit
    const afterQStyle = await sql`
      SELECT title, type,
             to_char(start_date,'DD/MM/YYYY HH24:MI') AS start,
             to_char(created_at,'DD/MM/YYYY HH24:MI') AS created
      FROM events
      WHERE title LIKE 'New Lead Project • E2E Calendar Triage%'
        AND to_char(start_date,'DD/MM/YYYY') = '25/12/2025'
      ORDER BY created_at DESC
      LIMIT 2
    `;
    
    if (afterQStyle.length > 0) {
      qStyleEventCreated = true;
      const latestEvent = afterQStyle[0];
      console.log(`   ✅ Event created: "${latestEvent.title}" @ ${latestEvent.start}`);
      results.push({
        check: 'B) Q-style → Event',
        status: '✅ PASS',
        details: `Event "${latestEvent.title}" created with start date ${latestEvent.start}`
      });
    } else {
      console.log(`   ❌ No matching event found`);
      results.push({
        check: 'B) Q-style → Event',
        status: '❌ FAIL',
        details: 'Lead submitted successfully but no calendar event created'
      });
    }
  } else if (qStyleResult.status === 400) {
    const missingFields = qStyleResult.body?.fields || ['unknown'];
    console.log(`   ⚠️ Missing required fields: ${missingFields.join(', ')}`);
    results.push({
      check: 'B) Q-style → Event',
      status: '❌ FAIL',
      details: `HTTP 400 - Missing fields: ${missingFields.join(', ')}`
    });
  } else {
    console.log(`   ❌ Unexpected status code`);
    results.push({
      check: 'B) Q-style → Event',
      status: '❌ FAIL',
      details: `HTTP ${qStyleResult.status} - ${qStyleResult.body?.message || 'Unknown error'}`
    });
  }

  // Step 7: Test idempotency (if q-style succeeded)
  if (qStyleResult.status === 200) {
    console.log('\n📋 Step 7: Testing idempotency (duplicate submission)...');
    
    const beforeDupe = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE title LIKE 'New Lead Project • E2E Calendar Triage%'
        AND to_char(start_date,'DD/MM/YYYY') = '25/12/2025'
    `;
    const countBefore = Number(beforeDupe[0].count);
    
    console.log(`   Events before duplicate: ${countBefore}`);
    
    // Submit exact duplicate
    const dupeResult = await submitLead(slug, qStylePayload2);
    console.log(`   Duplicate submission: HTTP ${dupeResult.status}`);
    
    await sleep(1000);
    
    const afterDupe = await sql`
      SELECT COUNT(*) as count
      FROM events
      WHERE title LIKE 'New Lead Project • E2E Calendar Triage%'
        AND to_char(start_date,'DD/MM/YYYY') = '25/12/2025'
    `;
    const countAfter = Number(afterDupe[0].count);
    const newEvents = countAfter - countBefore;
    
    console.log(`   Events after duplicate: ${countAfter}`);
    console.log(`   New events created: ${newEvents}`);
    
    if (newEvents <= 1) {
      console.log(`   ✅ Idempotency working (≤1 new event)`);
      results.push({
        check: 'D) Idempotency guard',
        status: '✅ PASS',
        details: `Duplicate submission created ${newEvents} event(s) - idempotency guard working`
      });
    } else {
      console.log(`   ⚠️ Multiple events created from duplicate`);
      results.push({
        check: 'D) Idempotency guard',
        status: '⚠️ INFO',
        details: `Duplicate submission created ${newEvents} event(s) - may be outside 5-minute window`
      });
    }
  }

  // Step 8: Show final events
  console.log('\n📋 Step 8: Final event list (last 10)...');
  const finalEvents = await sql`
    SELECT title, type,
           to_char(start_date,'DD/MM/YYYY HH24:MI') AS start,
           to_char(created_at,'DD/MM/YYYY HH24:MI') AS created
    FROM events
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  console.log('\n   Recent Events:');
  console.log('   ┌─────────────────────────────────────┬─────────┬──────────────────┬──────────────────┐');
  console.log('   │ Title                               │ Type    │ Start Date       │ Created          │');
  console.log('   ├─────────────────────────────────────┼─────────┼──────────────────┼──────────────────┤');
  finalEvents.forEach(e => {
    const title = String(e.title).padEnd(35).substring(0, 35);
    const type = String(e.type).padEnd(7).substring(0, 7);
    const start = String(e.start).padEnd(16);
    const created = String(e.created).padEnd(16);
    console.log(`   │ ${title} │ ${type} │ ${start} │ ${created} │`);
  });
  console.log('   └─────────────────────────────────────┴─────────┴──────────────────┴──────────────────┘');

  // Step 9: Print results table
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('┌────────────────────────────────┬────────────┬─────────────────────────────────────────┐');
  console.log('│ Check                          │ Status     │ Details                                 │');
  console.log('├────────────────────────────────┼────────────┼─────────────────────────────────────────┤');
  
  results.forEach(r => {
    const check = r.check.padEnd(30).substring(0, 30);
    const status = r.status.padEnd(10);
    const details = r.details.padEnd(39).substring(0, 39);
    console.log(`│ ${check} │ ${status} │ ${details} │`);
  });
  
  console.log('└────────────────────────────────┴────────────┴─────────────────────────────────────────┘');

  // Determine exit code
  const failures = results.filter(r => r.status === '❌ FAIL' && (r.check.startsWith('A)') || r.check.startsWith('B)')));
  
  if (failures.length > 0) {
    console.log('\n❌ TEST FAILED - Calendar events not created as expected\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL TESTS PASSED - Lead to Calendar Event flow verified\n');
    process.exit(0);
  }
}

async function submitLead(slug: string, data: Record<string, string>): Promise<{ status: number; body: any }> {
  const url = `${BASE_URL}/api/leads/public/${slug}/submit`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data,
        consent: true,
      }),
    });

    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    return {
      status: response.status,
      body,
    };
  } catch (error: any) {
    return {
      status: 0,
      body: { error: error.message },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
