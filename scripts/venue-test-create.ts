/**
 * Venue Creation Test Script
 * Simulates what happens during form submission venue creation
 * Run: npx tsx scripts/venue-test-create.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function testVenueCreation() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tenantId = '96aecd01-65bc-4c55-a375-b1758d107276';

  try {
    console.log('=== VENUE CREATION TEST ===\n');

    // Step 1: Check if we can insert a venue directly
    console.log('Step 1: Direct venue INSERT...');
    try {
      const result = await pool.query(`
        INSERT INTO venues (id, tenant_id, name, address, city, state, zip_code, country, use_count, last_used_at, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, 'Test Venue Direct', 'Test Address', 'Test City', 'Test State', 'TE1 1ST', 'GB', 1, NOW(), NOW(), NOW())
        RETURNING id, tenant_id, name
      `, [tenantId]);
      console.log('  ✅ Direct INSERT succeeded:', result.rows[0]);

      // Clean up
      await pool.query('DELETE FROM venues WHERE id = $1', [result.rows[0].id]);
      console.log('  🧹 Cleaned up test venue');
    } catch (err: any) {
      console.log('  ❌ Direct INSERT FAILED:', err.message);
    }

    // Step 2: Check what the Drizzle ORM does with venue creation
    console.log('\nStep 2: Check venues table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'venues'
      ORDER BY ordinal_position
    `);
    console.log('  Venue columns:');
    for (const col of columns.rows as any[]) {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`    ${col.column_name} (${col.data_type}) ${nullable} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    }

    // Step 3: Check foreign key constraints
    console.log('\nStep 3: Check FK constraints on venues...');
    const fks = await pool.query(`
      SELECT
        tc.constraint_name, tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'venues'
    `);
    if (fks.rows.length === 0) {
      console.log('  No FK constraints on venues table');
    } else {
      for (const fk of fks.rows as any[]) {
        console.log(`  ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column} (${fk.constraint_name})`);
      }
    }

    // Step 4: Check if the form's userId (createdBy) is valid
    console.log('\nStep 4: Check form ownership and userId...');
    const formResult = await pool.query(`
      SELECT f.id, f.created_by, u.id as user_id, u.email, u.tenant_id as user_tenant
      FROM lead_capture_forms f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.tenant_id = $1
    `, [tenantId]);
    for (const f of formResult.rows as any[]) {
      console.log(`  Form ${f.id.slice(0,8)}... | createdBy: ${f.created_by} | user exists: ${!!f.user_id} | user tenant: ${f.user_tenant}`);
      if (f.user_tenant && f.user_tenant !== tenantId) {
        console.log(`  ⚠️ USER TENANT MISMATCH: user belongs to ${f.user_tenant} but form is in ${tenantId}`);
      }
    }

    // Step 5: Test the exact contact creation that form submission does
    console.log('\nStep 5: Test contact INSERT for this tenant...');
    const userId = formResult.rows[0]?.created_by;
    try {
      const contactResult = await pool.query(`
        INSERT INTO contacts (id, tenant_id, user_id, first_name, last_name, email, venue_address, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'Test', 'Contact', 'test-venue-diag@example.com', 'Test Venue Address', NOW(), NOW())
        RETURNING id, tenant_id
      `, [tenantId, userId]);
      console.log('  ✅ Contact INSERT succeeded:', contactResult.rows[0]);

      // Test project creation with venue
      console.log('\nStep 6: Test project INSERT with venue_id...');
      const venueInsert = await pool.query(`
        INSERT INTO venues (id, tenant_id, name, address, city, country, use_count, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, 'Diag Test Venue', '123 Test St', 'Test City', 'GB', 1, NOW(), NOW())
        RETURNING id
      `, [tenantId]);
      const venueId = venueInsert.rows[0].id;
      console.log('  ✅ Venue created:', venueId);

      const projectResult = await pool.query(`
        INSERT INTO projects (id, tenant_id, user_id, name, contact_id, venue_id, status, progress, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'Diag Test Project', $3, $4, 'new', 0, NOW(), NOW())
        RETURNING id, venue_id
      `, [tenantId, userId, contactResult.rows[0].id, venueId]);
      console.log('  ✅ Project INSERT with venue_id succeeded:', projectResult.rows[0]);

      // Clean up
      await pool.query('DELETE FROM projects WHERE id = $1', [projectResult.rows[0].id]);
      await pool.query('DELETE FROM contacts WHERE id = $1', [contactResult.rows[0].id]);
      await pool.query('DELETE FROM venues WHERE id = $1', [venueId]);
      console.log('  🧹 Cleaned up test data');

    } catch (err: any) {
      console.log('  ❌ Contact/Project INSERT FAILED:', err.message);
      console.log('  Full error:', err);
    }

    // Step 7: Check if there's a user_id FK constraint issue
    console.log('\nStep 7: Check if userId from form belongs to this tenant...');
    const userCheck = await pool.query(`
      SELECT id, email, tenant_id FROM users WHERE id = $1
    `, [userId]);
    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0] as any;
      console.log(`  User ${user.id.slice(0,8)}... | email: ${user.email} | tenant: ${user.tenant_id}`);
      if (user.tenant_id !== tenantId) {
        console.log(`  🔴 MISMATCH: User belongs to tenant ${user.tenant_id} but form/data belongs to ${tenantId}`);
        console.log(`  This could cause issues with tenant-scoped queries!`);
      }
    } else {
      console.log(`  ❌ User ${userId} NOT FOUND in database!`);
    }

    console.log('\n=== TEST COMPLETE ===');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await pool.end();
  }
}

testVenueCreation();
