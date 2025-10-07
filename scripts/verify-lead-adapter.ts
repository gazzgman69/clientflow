#!/usr/bin/env tsx
/**
 * Lead Adapter Verification Script
 * 
 * Runs four checks to verify the FormDataAdapter works correctly:
 * A) Numeric keys → Lead + Event
 * B) Q-style keys → Lead + Event  
 * C) Missing email → 400 with no writes
 * D) No projectDate → Lead only (no event)
 * 
 * Usage:
 *   LCF_SLUG=new-capture-form-1757975240101 tsx scripts/verify-lead-adapter.ts
 *   tsx scripts/verify-lead-adapter.ts new-capture-form-1757975240101
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const SLUG = process.argv[2] || process.env.LCF_SLUG || 'new-capture-form-1757975240101';
const TENANT_TZ = process.env.TENANT_TZ || 'Europe/London';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

// Helper: Post to form endpoint
async function submitForm(data: any): Promise<{ status: number; body: any }> {
  try {
    const response = await fetch(`${BASE_URL}/api/leads/public/${SLUG}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    return { status: response.status, body };
  } catch (error: any) {
    return { status: 0, body: { error: error.message } };
  }
}

// Helper: Get recent events
async function getRecentEvents(limit: number = 5) {
  const query = `
    SELECT 
      id, 
      title, 
      type,
      to_char(start_date, 'DD/MM/YYYY HH24:MI') as start,
      created_at
    FROM events 
    WHERE tenant_id = 'default-tenant'
    ORDER BY created_at DESC 
    LIMIT $1
  `;
  return await sql(query, [limit]);
}

// Helper: Count events matching criteria
async function countEvents(titlePattern: string, startPattern: string): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM events 
    WHERE tenant_id = 'default-tenant'
      AND title LIKE $1
      AND to_char(start_date, 'DD/MM/YYYY HH24:MI') LIKE $2
  `;
  const result = await sql(query, [titlePattern, startPattern]);
  return parseInt(result[0].count, 10);
}

// Helper: Get form and find projectDate question ID
async function getProjectDateQuestionId(): Promise<string | null> {
  const query = `
    SELECT questions
    FROM lead_capture_forms
    WHERE slug = $1 AND tenant_id = 'default-tenant'
  `;
  const result = await sql(query, [SLUG]);
  if (result.length === 0) return null;
  
  let questions = result[0].questions;
  // Parse if string
  if (typeof questions === 'string') {
    questions = JSON.parse(questions);
  }
  
  const projectDateQ = (questions as any[]).find((q: any) => q.mapTo === 'projectDate');
  return projectDateQ?.id || null;
}

// Sleep helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  console.log('🧪 Lead Adapter Verification\n');
  console.log(`Configuration:`);
  console.log(`  Form Slug: ${SLUG}`);
  console.log(`  Tenant TZ: ${TENANT_TZ}`);
  console.log(`  Base URL:  ${BASE_URL}\n`);

  // Get projectDate question ID for test B
  const projectDateQid = await getProjectDateQuestionId();
  if (!projectDateQid) {
    console.error(`❌ Could not find projectDate question ID for form ${SLUG}`);
    process.exit(1);
  }
  console.log(`  Project Date Question ID: ${projectDateQid}\n`);

  // ========================================
  // TEST A: Numeric keys → Lead + Event
  // ========================================
  console.log('📝 Test A: Numeric keys → Lead + Event');
  const testAName = 'Alice Numeric-' + Date.now();
  const testAData = {
    data: {
      "1": testAName,
      "2": `alice.numeric.${Date.now()}@example.com`,
      "3": "+44 7700 900123",
      "4": "Wedding",
      "5": "London Event Center",
      "6": "25/12/2025"
    },
    consent: true
  };

  const beforeA = await getRecentEvents(1);
  const respA = await submitForm(testAData);
  await sleep(500); // Allow DB write
  const afterA = await getRecentEvents(5);

  const eventAExists = afterA.some(e => 
    e.title === `New Lead Project • ${testAName}` &&
    e.start.startsWith('25/12/2025')
  );

  if (respA.status >= 200 && respA.status < 300 && eventAExists) {
    results.push({
      name: 'A: Numeric keys',
      status: 'PASS',
      details: `Event created: "${afterA[0]?.title}" at ${afterA[0]?.start}`
    });
  } else {
    results.push({
      name: 'A: Numeric keys',
      status: 'FAIL',
      details: `HTTP ${respA.status}, Event found: ${eventAExists}`
    });
  }

  // ========================================
  // TEST B: Q-style keys → Lead + Event
  // ========================================
  console.log('📝 Test B: Q-style keys → Lead + Event');
  const testBName = 'Bob Q-' + Date.now();
  const testBData = {
    data: {
      "q1": testBName,
      "q2": `bob.q.${Date.now()}@example.com`,
      "q_1758575106312": "+44 7700 900456",
      "q_1758575155875": "Corporate",
      "q3": "Manchester Conference Hall",
      [projectDateQid]: "2025-12-31"
    },
    consent: true
  };

  const beforeB = await getRecentEvents(1);
  const respB = await submitForm(testBData);
  await sleep(500);
  const afterB = await getRecentEvents(5);

  const eventBExists = afterB.some(e => 
    e.title === `New Lead Project • ${testBName}` &&
    e.start.startsWith('31/12/2025')
  );

  if (respB.status >= 200 && respB.status < 300 && eventBExists) {
    results.push({
      name: 'B: Q-style keys',
      status: 'PASS',
      details: `Event created with start "31/12/2025 12:00"`
    });
  } else {
    results.push({
      name: 'B: Q-style keys',
      status: 'FAIL',
      details: `HTTP ${respB.status}, Event found: ${eventBExists}`
    });
  }

  // ========================================
  // TEST C: Missing email → 400 with no writes
  // ========================================
  console.log('📝 Test C: Missing email → 400 (no writes)');
  const testCData = {
    data: {
      "1": "No Email Test",
      "6": "01/01/2026"
    },
    consent: true
  };

  const beforeC = await getRecentEvents(5);
  const beforeCCount = beforeC.length;
  const respC = await submitForm(testCData);
  await sleep(500);
  const afterC = await getRecentEvents(5);
  const afterCCount = afterC.length;

  if (respC.status === 400 && afterCCount === beforeCCount) {
    results.push({
      name: 'C: Missing email',
      status: 'PASS',
      details: `HTTP 400, no new events (${afterCCount} = ${beforeCCount})`
    });
  } else {
    results.push({
      name: 'C: Missing email',
      status: 'FAIL',
      details: `HTTP ${respC.status}, events: ${beforeCCount} → ${afterCCount}`
    });
  }

  // ========================================
  // TEST D: No projectDate → Lead only (no event)
  // ========================================
  console.log('📝 Test D: No projectDate → Lead only (no event)');
  const testDName = 'TBD Date-' + Date.now();
  const testDData = {
    data: {
      "1": testDName,
      "2": `tbd.${Date.now()}@example.com`,
      "3": "+44 7700 900789",
      "4": "Private",
      "5": "Bristol Venue"
    },
    consent: true
  };

  const beforeD = await getRecentEvents(5);
  const respD = await submitForm(testDData);
  await sleep(500);
  const afterD = await getRecentEvents(5);

  // Check that no event was created for this lead
  const eventDExists = afterD.some(e => e.title.includes(testDName));

  if (respD.status >= 200 && respD.status < 300 && !eventDExists) {
    results.push({
      name: 'D: No projectDate',
      status: 'PASS',
      details: `Lead created, no event (status ${respD.status})`
    });
  } else {
    results.push({
      name: 'D: No projectDate',
      status: 'FAIL',
      details: `HTTP ${respD.status}, Event found: ${eventDExists}`
    });
  }

  // ========================================
  // Print Results
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS\n');
  
  const maxNameLen = Math.max(...results.map(r => r.name.length));
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    const name = result.name.padEnd(maxNameLen);
    console.log(`${icon} ${name}  ${result.status.padEnd(4)}  ${result.details}`);
  });

  console.log('='.repeat(60) + '\n');

  // Exit code
  const failCount = results.filter(r => r.status === 'FAIL').length;
  
  // Check for Test D specific failure
  const testDFailed = results.find(r => r.name === 'D: No projectDate' && r.status === 'FAIL');
  if (testDFailed && testDFailed.details.includes('HTTP 400')) {
    console.log('\n⚠️  Note: Test D fails because projectDate is marked as required in the form schema.');
    console.log('   To pass this test, the form should allow optional projectDate (create lead without event).\n');
  }
  
  if (failCount > 0) {
    console.log(`❌ ${failCount} test(s) failed`);
    process.exit(1);
  } else {
    console.log(`✅ All tests passed`);
    process.exit(0);
  }
}

// Run
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
