/**
 * Add missing venue columns that the schema defines but the initial migration doesn't include.
 * Safe to run multiple times — uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 * Run: npx tsx scripts/add-venue-columns.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function addVenueColumns() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('=== ADD MISSING VENUE COLUMNS ===\n');

    // Check which columns currently exist
    const existing = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'venues'
    `);
    const existingCols = new Set(existing.rows.map((r: any) => r.column_name));
    console.log('Existing columns:', [...existingCols].sort().join(', '));

    // All columns the schema defines that the initial migration might be missing
    const columnsToAdd: Array<{ name: string; sql: string }> = [
      { name: 'tenant_id', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS tenant_id VARCHAR REFERENCES tenants(id)` },
      { name: 'user_id', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id)` },
      { name: 'address2', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS address2 TEXT` },
      { name: 'country', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS country TEXT` },
      { name: 'country_code', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS country_code TEXT` },
      { name: 'latitude', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8)` },
      { name: 'longitude', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8)` },
      { name: 'place_id', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS place_id TEXT` },
      { name: 'website', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS website TEXT` },
      { name: 'restrictions', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS restrictions TEXT` },
      { name: 'access_notes', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS access_notes TEXT` },
      { name: 'manager_name', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_name TEXT` },
      { name: 'manager_phone', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_phone TEXT` },
      { name: 'manager_email', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS manager_email TEXT` },
      { name: 'preferred', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS preferred BOOLEAN DEFAULT FALSE` },
      { name: 'use_count', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0` },
      { name: 'last_used_at', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP` },
      { name: 'tags', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS tags TEXT[]` },
      { name: 'meta', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS meta TEXT` },
      { name: 'normalized_name', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS normalized_name TEXT` },
      { name: 'normalized_address', sql: `ALTER TABLE venues ADD COLUMN IF NOT EXISTS normalized_address TEXT` },
    ];

    let added = 0;
    for (const col of columnsToAdd) {
      if (!existingCols.has(col.name)) {
        try {
          await pool.query(col.sql);
          console.log(`  ✅ Added column: ${col.name}`);
          added++;
        } catch (err: any) {
          console.log(`  ⚠️ Could not add ${col.name}: ${err.message}`);
        }
      }
    }

    // Add indexes for deduplication if they don't exist
    try {
      await pool.query(`CREATE INDEX IF NOT EXISTS venues_tenant_id_idx ON venues(tenant_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS venues_user_id_idx ON venues(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS venues_tenant_created_idx ON venues(tenant_id, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS venues_tenant_name_idx ON venues(tenant_id, name)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS venues_tenant_normalized_name_idx ON venues(tenant_id, normalized_name)`);
      console.log('  ✅ Indexes ensured');
    } catch (err: any) {
      console.log(`  ⚠️ Index creation issue: ${err.message}`);
    }

    // Verify final state
    const final = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'venues'
      ORDER BY ordinal_position
    `);
    console.log(`\nFinal venue columns (${final.rows.length} total):`);
    for (const col of final.rows as any[]) {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }

    console.log(`\n✅ Done. Added ${added} new column(s).`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addVenueColumns();
