/**
 * Migration: Add missing columns to venues and projects tables
 * Safe to run multiple times — uses IF NOT EXISTS / checks before adding
 */
import { pool } from '../server/db';

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to database tables...\n');

  const alterStatements = [
    // Venues table — parking/load-in fields added in code but missing from DB
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_details TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS load_in_details TEXT`,
    // Venues table — other potentially missing columns
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS booked_count INTEGER DEFAULT 0`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS normalized_name TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS normalized_address TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_name TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_phone TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_email TEXT`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS preferred BOOLEAN DEFAULT false`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS tags TEXT[]`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_rating DECIMAL(3,2)`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_reviews_count INTEGER`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS opening_hours JSONB`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ`,
    `ALTER TABLE venues ADD COLUMN IF NOT EXISTS enrichment_source TEXT`,

    // Projects table — venue/event day fields
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS venue_address TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS parking_details TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS load_in_details TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_time TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_time TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS dress_code TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS accommodation TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS meal_details TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS backline_production TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS second_contact_name TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS second_contact_phone TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS day_of_contact_name TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS day_of_contact_phone TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS referral_source TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_manual_status_at TIMESTAMPTZ`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS migrated_from_lead_id VARCHAR`,
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const sql of alterStatements) {
    try {
      await pool.query(sql);
      // Extract column name from statement for readable output
      const match = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/);
      const col = match ? match[1] : sql;
      console.log(`  ✅ ${col}`);
      successCount++;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        skipCount++;
      } else {
        console.error(`  ❌ Failed: ${sql}`);
        console.error(`     Error: ${error.message}`);
      }
    }
  }

  console.log(`\n✅ Done: ${successCount} columns added/verified, ${skipCount} already existed`);

  // Also fix the createVenue retry logic to strip these new fields if they cause issues
  console.log('\n🔍 Verifying venues table columns...');
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'venues'
    ORDER BY ordinal_position
  `);
  console.log('Venues columns:', result.rows.map(r => r.column_name).join(', '));

  const projResult = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'projects'
    ORDER BY ordinal_position
  `);
  console.log('Projects columns:', projResult.rows.map(r => r.column_name).join(', '));

  process.exit(0);
}

addMissingColumns().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
