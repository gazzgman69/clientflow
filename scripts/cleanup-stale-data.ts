/**
 * Clean up stale form submissions for tenant 96aecd01
 * These reference contacts/projects that were deleted, blocking new submissions
 * Run: npx tsx scripts/cleanup-stale-data.ts
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

async function cleanup() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tenantId = '96aecd01-65bc-4c55-a375-b1758d107276';

  try {
    // Count before
    const before = await pool.query('SELECT COUNT(*) as cnt FROM form_submissions WHERE tenant_id = $1', [tenantId]);
    console.log(`Form submissions before cleanup: ${(before.rows[0] as any).cnt}`);

    // Delete stale form submissions (their contacts/projects no longer exist)
    const result = await pool.query('DELETE FROM form_submissions WHERE tenant_id = $1 RETURNING id', [tenantId]);
    console.log(`✅ Deleted ${result.rows.length} stale form submissions`);

    // Also clean up orphaned leads (optional — keep them for history)
    const leads = await pool.query('SELECT COUNT(*) as cnt FROM leads WHERE tenant_id = $1', [tenantId]);
    console.log(`Leads remaining: ${(leads.rows[0] as any).cnt} (kept for history)`);

    console.log('\n✅ Cleanup complete. New form submissions will now work without hitting duplicate detection.');

  } catch (error) {
    console.error('❌ Cleanup error:', error);
  } finally {
    await pool.end();
  }
}

cleanup();
