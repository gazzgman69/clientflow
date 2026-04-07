/**
 * Venue Diagnostic Script
 * Run from Replit Shell: npx tsx scripts/venue-diagnostic.ts
 *
 * Checks the database for:
 * 1. Whether venues exist for this tenant
 * 2. Whether projects have venue_id set
 * 3. Whether form questions are mapped to eventLocation
 * 4. Whether leads have event_location set
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function runDiagnostics() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Find the tenant
    const tenants = await pool.query('SELECT id, name, slug FROM tenants LIMIT 5');
    console.log('\n=== TENANTS ===');
    for (const t of tenants.rows) {
      console.log(`  ${t.id} | ${t.name} | slug: ${t.slug}`);
    }

    const tenantId = tenants.rows[0]?.id;
    if (!tenantId) {
      console.error('❌ No tenants found');
      return;
    }
    console.log(`\nUsing tenant: ${tenantId}\n`);

    // 2. Check venues
    const venues = await pool.query(
      'SELECT id, name, address, city, created_at, use_count FROM venues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10',
      [tenantId]
    );
    console.log(`=== VENUES (${venues.rows.length} found) ===`);
    for (const v of venues.rows as any[]) {
      console.log(`  ${v.id} | ${v.name} | ${v.address} | ${v.city} | created: ${v.created_at} | uses: ${v.use_count}`);
    }

    // 3. Check recent projects and their venue_id
    const projects = await pool.query(`
      SELECT p.id, p.name, p.venue_id, p.status, p.created_at,
             v.name as venue_name, v.address as venue_address
      FROM projects p
      LEFT JOIN venues v ON p.venue_id = v.id
      WHERE p.tenant_id = $1
      ORDER BY p.created_at DESC
      LIMIT 10
    `, [tenantId]);
    console.log(`\n=== PROJECTS (${projects.rows.length} found) ===`);
    for (const p of projects.rows as any[]) {
      const hasVenue = p.venue_id ? '✅' : '❌';
      console.log(`  ${hasVenue} ${p.id.slice(0,8)}... | ${p.name} | venue_id: ${p.venue_id || 'NULL'} | venue_name: ${p.venue_name || 'NULL'} | status: ${p.status} | created: ${p.created_at}`);
    }

    // 4. Check leads for event_location
    const leads = await pool.query(`
      SELECT id, full_name, email, event_location, event_type, created_at
      FROM leads
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [tenantId]);
    console.log(`\n=== LEADS (${leads.rows.length} found) ===`);
    for (const l of leads.rows as any[]) {
      const hasLocation = l.event_location ? '✅' : '❌';
      console.log(`  ${hasLocation} ${l.id.slice(0,8)}... | ${l.full_name} | ${l.email} | event_location: ${l.event_location || 'NULL'} | event_type: ${l.event_type || 'NULL'}`);
    }

    // 5. Check form questions for eventLocation mapping
    const forms = await pool.query(`
      SELECT id, name, slug, questions
      FROM lead_capture_forms
      WHERE tenant_id = $1
      LIMIT 5
    `, [tenantId]);
    console.log(`\n=== FORM QUESTIONS (eventLocation mapping check) ===`);
    for (const f of forms.rows as any[]) {
      console.log(`  Form: ${f.name} (${f.slug})`);
      try {
        const questions = JSON.parse(f.questions || '[]');
        for (const q of questions) {
          if (q.mapTo === 'eventLocation' || q.label?.toLowerCase().includes('venue') || q.label?.toLowerCase().includes('location')) {
            console.log(`    ✅ Question "${q.label}" → mapTo: "${q.mapTo}" (type: ${q.type}, id: ${q.id})`);
          }
        }
        const hasLocationQ = questions.some((q: any) => q.mapTo === 'eventLocation');
        if (!hasLocationQ) {
          console.log(`    ❌ NO question mapped to "eventLocation"!`);
          console.log(`    All mappings: ${questions.map((q: any) => `${q.label}→${q.mapTo}`).join(', ')}`);
        }
      } catch (e) {
        console.log(`    ⚠️ Could not parse questions: ${e}`);
      }
    }

    // 6. Check form submissions for venue data
    const submissions = await pool.query(`
      SELECT id, form_id, data, metadata, created_at
      FROM form_submissions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 3
    `, [tenantId]);
    console.log(`\n=== RECENT FORM SUBMISSIONS (${submissions.rows.length} found) ===`);
    for (const s of submissions.rows as any[]) {
      console.log(`  Submission ${s.id.slice(0,8)}... | form: ${s.form_id?.slice(0,8) || 'N/A'} | created: ${s.created_at}`);
      try {
        const data = typeof s.data === 'string' ? JSON.parse(s.data) : s.data;
        const meta = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata;
        console.log(`    Data keys: ${Object.keys(data || {}).join(', ')}`);
        console.log(`    Metadata: projectId=${meta?.projectId || 'N/A'}, contactId=${meta?.contactId || 'N/A'}, venueId=${meta?.venueId || 'N/A'}`);
      } catch (e) {
        console.log(`    ⚠️ Could not parse data/metadata`);
      }
    }

    console.log('\n=== DIAGNOSIS SUMMARY ===');
    const venueCount = venues.rows.length;
    const projectsWithVenue = (projects.rows as any[]).filter(p => p.venue_id).length;
    const leadsWithLocation = (leads.rows as any[]).filter(l => l.event_location).length;

    console.log(`  Venues in DB: ${venueCount}`);
    console.log(`  Projects with venue_id: ${projectsWithVenue}/${projects.rows.length}`);
    console.log(`  Leads with event_location: ${leadsWithLocation}/${leads.rows.length}`);

    if (venueCount === 0) {
      console.log('\n  🔴 ROOT CAUSE: No venues exist in the database!');
      console.log('  This means venue creation during form submission is failing silently.');
    }
    if (projectsWithVenue === 0 && venueCount > 0) {
      console.log('\n  🔴 ROOT CAUSE: Venues exist but projects don\'t link to them!');
      console.log('  The venueId is not being set on the project during creation.');
    }
    if (leadsWithLocation === 0) {
      console.log('\n  🔴 ROOT CAUSE: Leads have no event_location!');
      console.log('  The form question is likely not mapped to "eventLocation".');
    }

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    await pool.end();
  }
}

runDiagnostics();
