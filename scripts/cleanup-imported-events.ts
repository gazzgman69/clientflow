/**
 * Cleanup script: Remove Google Calendar events that were imported into the CRM.
 *
 * Identifies imported events by: has an external_event_id (Google Calendar ID)
 * but NOT linked to any lead or project. CRM-created events that were pushed
 * to Google will always have a lead_id or project_id, so they're safe.
 */

import { pool } from '../server/db';

async function cleanup() {
  console.log('🔍 Scanning for imported Google Calendar events...\n');

  // First, count what we're dealing with
  const countResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE external_event_id IS NOT NULL) as has_google_id,
      COUNT(*) FILTER (WHERE lead_id IS NOT NULL OR project_id IS NOT NULL) as linked_to_crm,
      COUNT(*) FILTER (WHERE external_event_id IS NOT NULL AND lead_id IS NULL AND project_id IS NULL) as imported_personal,
      COUNT(*) as total_count
    FROM events
  `);

  const counts = countResult.rows[0];
  console.log(`Total events: ${counts.total_count}`);
  console.log(`Events with Google Calendar ID: ${counts.has_google_id}`);
  console.log(`Events linked to leads/projects (CRM): ${counts.linked_to_crm}`);
  console.log(`Imported personal events (to delete): ${counts.imported_personal}`);
  console.log('');

  // Find imported events: have external_event_id but no lead_id/project_id
  const toDeleteResult = await pool.query(`
    SELECT id, title, start_date, source, external_event_id
    FROM events
    WHERE external_event_id IS NOT NULL
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

  // Show first 15 as a sample
  const sample = toDeleteResult.rows.slice(0, 15);
  for (const event of sample) {
    const date = new Date(event.start_date).toLocaleDateString('en-GB');
    console.log(`  - "${event.title}" (${date})`);
  }
  if (toDeleteResult.rows.length > 15) {
    console.log(`  ... and ${toDeleteResult.rows.length - 15} more`);
  }

  console.log('\n🗑️  Deleting...');

  // Delete them
  const deleteResult = await pool.query(`
    DELETE FROM events
    WHERE external_event_id IS NOT NULL
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
