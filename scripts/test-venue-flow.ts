/**
 * TEST: Reproduce the EXACT venue creation flow from form submission.
 * This imports the actual venuesService and calls findOrCreateVenue
 * with realistic data to capture the precise error.
 *
 * Run on Replit: npx tsx scripts/test-venue-flow.ts
 */

import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

// Must import AFTER neonConfig is set
import { storage } from '../server/storage';
import { pool } from '../server/db';

const TENANT_ID = '96aecd01-65bc-4c55-a375-b1758d107276'; // Test Pass's Business

async function testVenueFlow() {
  console.log('=== VENUE CREATION FLOW TEST ===\n');

  // Step 1: Check if normalized columns exist
  console.log('--- STEP 1: Check venue table columns ---');
  try {
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'venues' ORDER BY ordinal_position
    `);
    const colNames = cols.rows.map((r: any) => r.column_name);
    console.log('Columns:', colNames.join(', '));
    console.log('Has normalized_name:', colNames.includes('normalized_name'));
    console.log('Has normalized_address:', colNames.includes('normalized_address'));
    console.log('Has tenant_id:', colNames.includes('tenant_id'));
    console.log('Has use_count:', colNames.includes('use_count'));
    console.log('Has last_used_at:', colNames.includes('last_used_at'));
    console.log('Has country:', colNames.includes('country'));
    console.log('Has latitude:', colNames.includes('latitude'));
    console.log('Has place_id:', colNames.includes('place_id'));
  } catch (err) {
    console.error('Column check failed:', err);
  }

  // Step 2: Test the neon() query that findExactVenueMatch uses
  console.log('\n--- STEP 2: Test raw neon query for normalized fields ---');
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    const result = await sql`
      SELECT * FROM venues
      WHERE tenant_id = ${TENANT_ID}
        AND normalized_name = ${'test'}
        AND normalized_address = ${'test'}
      LIMIT 1
    `;
    console.log('✅ Neon normalized query works. Result count:', result.length);
  } catch (err: any) {
    console.error('❌ Neon normalized query FAILED:', err.message);
    console.error('   This is likely why venues never get created!');
  }

  // Step 3: Test storage.createVenue directly with Drizzle
  console.log('\n--- STEP 3: Test storage.createVenue (Drizzle insert) ---');
  let testVenueId: string | null = null;
  try {
    const testVenue = await storage.createVenue({
      name: 'Flow Test Venue',
      address: '123 Test Street',
      city: 'London',
      state: 'England',
      zipCode: 'SW1A 1AA',
      country: 'GB',
      tenantId: TENANT_ID,
      useCount: 1,
      lastUsedAt: new Date(),
    } as any);
    testVenueId = testVenue.id;
    console.log('✅ storage.createVenue succeeded:', { id: testVenue.id, name: testVenue.name });
  } catch (err: any) {
    console.error('❌ storage.createVenue FAILED:', err.message);
    console.error('   Stack:', err.stack?.split('\n').slice(0, 5).join('\n'));
  }

  // Step 4: Test storage.createVenue WITH normalized fields
  console.log('\n--- STEP 4: Test storage.createVenue WITH normalized fields ---');
  let testVenue2Id: string | null = null;
  try {
    const testVenue2 = await storage.createVenue({
      name: 'Flow Test Venue 2',
      address: '456 Test Avenue',
      city: 'Manchester',
      state: 'England',
      zipCode: 'M1 1AA',
      country: 'GB',
      tenantId: TENANT_ID,
      useCount: 1,
      lastUsedAt: new Date(),
      normalizedName: 'flow test venue 2',
      normalizedAddress: '456 test avenue',
    } as any);
    testVenue2Id = testVenue2.id;
    console.log('✅ storage.createVenue with normalized fields succeeded:', { id: testVenue2.id, name: testVenue2.name });
  } catch (err: any) {
    console.error('❌ storage.createVenue WITH normalized fields FAILED:', err.message);
    console.error('   This means normalized columns do not exist in the DB!');
    console.error('   Run: npx tsx scripts/add-venue-columns.ts');
  }

  // Step 5: Test the full venuesService.findOrCreateVenue flow
  console.log('\n--- STEP 5: Test venuesService.findOrCreateVenue ---');
  let testVenue3Id: string | null = null;
  try {
    // Dynamic import to avoid circular dependency issues
    const { venuesService } = await import('../server/src/services/venues');
    const testVenue3 = await venuesService.findOrCreateVenue({
      name: 'Flow Test Venue 3',
      address: '789 Test Road, London, England',
      city: 'London',
      state: 'England',
      zipCode: 'EC1A 1BB',
      country: 'GB',
      tenantId: TENANT_ID,
      useCount: 1,
      lastUsedAt: new Date(),
    } as any, TENANT_ID);
    testVenue3Id = testVenue3.id;
    console.log('✅ venuesService.findOrCreateVenue succeeded:', {
      id: testVenue3.id,
      name: testVenue3.name,
      address: testVenue3.address
    });
  } catch (err: any) {
    console.error('❌ venuesService.findOrCreateVenue FAILED:', err.message);
    console.error('   FULL STACK:', err.stack);
    console.error('\n   THIS IS THE EXACT ERROR that silently kills venue creation during form submission!');
  }

  // Step 6: Test the getVenues flow (used by findByPlaceId and fallback dedup)
  console.log('\n--- STEP 6: Test venuesService.getVenues ---');
  try {
    const { venuesService } = await import('../server/src/services/venues');
    const venues = await venuesService.getVenues(TENANT_ID);
    console.log('✅ getVenues returned', venues.length, 'venues for tenant');
    if (venues.length > 0) {
      console.log('   First venue:', { id: venues[0].id, name: venues[0].name, address: venues[0].address });
    }
  } catch (err: any) {
    console.error('❌ getVenues FAILED:', err.message);
  }

  // Cleanup: remove test venues
  console.log('\n--- CLEANUP ---');
  for (const id of [testVenueId, testVenue2Id, testVenue3Id].filter(Boolean)) {
    try {
      await pool.query('DELETE FROM venues WHERE id = $1', [id]);
      console.log(`  Deleted test venue ${id}`);
    } catch (err: any) {
      console.warn(`  Could not delete ${id}: ${err.message}`);
    }
  }

  // Step 7: Check if /tmp/venue-errors.log exists (from the file-based error logging)
  console.log('\n--- STEP 7: Check /tmp/venue-errors.log ---');
  try {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/venue-errors.log')) {
      const content = fs.readFileSync('/tmp/venue-errors.log', 'utf-8');
      console.log('Venue error log contents:');
      console.log(content);
    } else {
      console.log('No /tmp/venue-errors.log file exists.');
      console.log('This means either the server was not restarted, or venue code path is not reached.');
    }
  } catch (err: any) {
    console.log('Could not read error log:', err.message);
  }

  console.log('\n=== TEST COMPLETE ===');
  await pool.end();
  process.exit(0);
}

testVenueFlow().catch(err => {
  console.error('Script crashed:', err);
  process.exit(1);
});
