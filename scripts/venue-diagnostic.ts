/**
 * Venue Diagnostic Script v2
 * Run from Replit Shell: npx tsx scripts/venue-diagnostic.ts
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
    // 1. Find ALL tenants
    const tenants = await pool.query('SELECT id, name, slug FROM tenants ORDER BY created_at');
    console.log('\n=== TENANTS ===');
    for (const t of tenants.rows as any[]) {
      console.log(`  ${t.id} | ${t.name} | slug: "${t.slug}"`);
    }

    // Check ALL non-system tenants
    for (const tenant of tenants.rows as any[]) {
      if (tenant.id === 'system') continue;

      const tenantId = tenant.id;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`TENANT: ${tenant.name} (${tenantId}) slug="${tenant.slug}"`);
      console.log('='.repeat(70));

      // 2. Check venues
      const venues = await pool.query(
        'SELECT id, name, address, city, created_at, use_count FROM venues WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5',
        [tenantId]
      );
      console.log(`\n  VENUES (${venues.rows.length} found):`);
      for (const v of venues.rows as any[]) {
        console.log(`    ${v.id.slice(0,8)}... | ${v.name} | addr: ${v.address || 'NULL'} | city: ${v.city || 'NULL'} | uses: ${v.use_count}`);
      }

      // 3. Check recent projects
      const projects = await pool.query(`
        SELECT p.id, p.name, p.venue_id, p.status, p.created_at,
               v.name as venue_name
        FROM projects p
        LEFT JOIN venues v ON p.venue_id = v.id
        WHERE p.tenant_id = $1
        ORDER BY p.created_at DESC
        LIMIT 5
      `, [tenantId]);
      console.log(`\n  PROJECTS (${projects.rows.length} found):`);
      for (const p of projects.rows as any[]) {
        const icon = p.venue_id ? '✅' : '❌';
        console.log(`    ${icon} ${p.name} | venue_id: ${p.venue_id || 'NULL'} | venue: ${p.venue_name || 'NONE'} | status: ${p.status}`);
      }

      // 4. Check leads
      const leads = await pool.query(`
        SELECT id, full_name, email, event_location, event_type, created_at
        FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5
      `, [tenantId]);
      console.log(`\n  LEADS (${leads.rows.length} found):`);
      for (const l of leads.rows as any[]) {
        const icon = l.event_location ? '✅' : '❌';
        console.log(`    ${icon} ${l.full_name} | location: ${l.event_location || 'NULL'} | type: ${l.event_type || 'NULL'}`);
      }

      // 5. Check form questions — SHOW RAW DATA
      const forms = await pool.query(`
        SELECT id, name, slug, questions
        FROM lead_capture_forms
        WHERE tenant_id = $1
        LIMIT 5
      `, [tenantId]);
      console.log(`\n  FORMS (${forms.rows.length} found):`);
      for (const f of forms.rows as any[]) {
        console.log(`\n    Form: "${f.name}" (slug: ${f.slug})`);
        try {
          const raw = f.questions;
          if (!raw) {
            console.log(`      ⚠️ questions field is NULL/empty`);
            continue;
          }
          const questions = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!Array.isArray(questions) || questions.length === 0) {
            console.log(`      ⚠️ questions is empty array or not an array. Raw type: ${typeof raw}`);
            console.log(`      Raw value (first 200 chars): ${JSON.stringify(raw).slice(0, 200)}`);
            continue;
          }
          console.log(`      ${questions.length} questions:`);
          for (const q of questions) {
            const mapIcon = q.mapTo === 'eventLocation' ? '🎯' : (q.mapTo ? '  ' : '⚠️');
            console.log(`        ${mapIcon} [${q.id}] "${q.label}" → mapTo: "${q.mapTo || 'NONE'}" (type: ${q.type})`);
          }
          const hasLocationMapping = questions.some((q: any) => q.mapTo === 'eventLocation');
          if (!hasLocationMapping) {
            console.log(`      🔴 NO question mapped to "eventLocation" — venues will NEVER be created from this form!`);
          }
        } catch (e) {
          console.log(`      ⚠️ Could not parse questions: ${e}`);
          console.log(`      Raw (first 300 chars): ${JSON.stringify(f.questions).slice(0, 300)}`);
        }
      }
    }

    // 6. Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('DIAGNOSIS SUMMARY');
    console.log('='.repeat(70));

    // Check all forms across all tenants for the mapping
    const allForms = await pool.query(`SELECT id, name, slug, tenant_id, questions FROM lead_capture_forms`);
    let formsWithMapping = 0;
    let formsWithoutMapping = 0;
    for (const f of allForms.rows as any[]) {
      try {
        const qs = typeof f.questions === 'string' ? JSON.parse(f.questions || '[]') : (f.questions || []);
        if (Array.isArray(qs) && qs.some((q: any) => q.mapTo === 'eventLocation')) {
          formsWithMapping++;
        } else {
          formsWithoutMapping++;
          console.log(`  🔴 Form "${f.name}" (tenant: ${f.tenant_id.slice(0,8)}...) is MISSING eventLocation mapping`);
        }
      } catch { formsWithoutMapping++; }
    }
    console.log(`\n  Forms with eventLocation mapping: ${formsWithMapping}`);
    console.log(`  Forms WITHOUT eventLocation mapping: ${formsWithoutMapping}`);

    if (formsWithoutMapping > 0) {
      console.log(`\n  🔧 FIX NEEDED: Update form questions to include a question with mapTo="eventLocation"`);
    }

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    await pool.end();
  }
}

runDiagnostics();
