/**
 * Cleanup script: Remove Google Calendar events that were imported into the CRM.
 *
 * Targets events that:
 * - Were imported from Google (not CRM-created)
 * - Are NOT linked to any lead or project (i.e. personal calendar events)
 *
 * Safe: CRM-created events (lead events, project events) are always preserved.
 */

import { pool } from '../server/db';

async function cleanup() {
  console.log('🔍 Scanning for imported Google Calendar events...\n');

  // First, count what we're dealing with
  const countResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE source = 'google' OR source = 'ical') as imported_count,
      COUNT(*) FILTER (WHERE source = 'crm' OR source IS NULL) as crm_count,
      COUNT(*) FILTER (WHERE lead_id IS NOT NULL OR project_id IS NOT NULL) as linked_count,
      COUNT(*) as total_count
    FROM events
  `);

  const counts = countResult.rows[0];
  console.log(`Total events: ${counts.total_count}`);
  console.log(`CRM-created events: ${counts.crm_count}`);
  console.log(`Imported events (Google/iCal): ${counts.imported_count}`);
  console.log(`Events linked to leads/projects: ${counts.linked_count}`);
  console.log('');

  // Find imported events that are NOT linked to any lead or project
  const toDeleteResult = await pool.query(`
    SELECT id, title, start_date, source, lead_id, project_id, contact_id
    FROM events
    WHERE (source = 'google' OR source = 'ical' OR (source != 'crm' AND source IS NOT NULL))
      AND lead_id IS NULL
      AND project_id IS NULL
    ORDER BY start_date DESC
  `);

  if (toDeleteResult.rows.length === 0) {
    console.log('✅ No imported events to clean up!');
    await pool.end();
    return;
  }

  console.log(`Found ${toDeleteResult.rows.length} imported events to remove:\n`);

  // Show first 10 as a sample
  const sample = toDeleteResult.rows.slice(0, 10);
  for (const event of sample) {
    const date = new Date(event.start_date).toLocaleDateString('en-GB');
    console.log(`  - "${event.title}" (${date}) [source: ${event.source}]`);
  }
  if (toDeleteResult.rows.length > 10) {
    console.log(`  ... and ${toDeleteResult.rows.length - 10} more`);
  }

  console.log('');

  // Delete them
  const deleteResult = await pool.query(`
    DELETE FROM events
    WHERE (source = 'google' OR source = 'ical' OR (source != 'crm' AND source IS NOT NULL))
      AND lead_id IS NULL
      AND project_id IS NULL
  `);

  console.log(`✅ Deleted ${deleteResult.rowCount} imported events.`);

  // Show what's left
  const remainingResult = await pool.query(`
    SELECT COUNT(*) as remaining FROM events
  `);
  console.log(`📊 Remaining events: ${remainingResult.rows[0].remaining}`);

  await pool.end();
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
