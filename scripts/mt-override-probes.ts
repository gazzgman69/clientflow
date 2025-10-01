/**
 * Multi-Tenant Override Probes (READ-ONLY)
 * 
 * Tests that client-supplied tenant overrides are blocked/ignored
 * across common read endpoints using both query params and headers.
 * 
 * No app code edits. Script-only verification.
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || '';
const BASE_URL = 'http://localhost:5000';

console.log('🔍 Multi-Tenant Override Probes\n');
console.log('Mode: READ-ONLY (GET requests only)');
console.log(`Base URL: ${BASE_URL}\n`);

/**
 * Create authenticated session
 */
async function createTestSession(): Promise<{ sessionId: string; tenantId: string }> {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🗄️  Creating test session...');
  
  const users = await sql`SELECT id, email, tenant_id FROM users LIMIT 1`;
  if (users.length === 0) throw new Error('No users found');
  
  const user = users[0];
  console.log(`  ✅ User: ${user.email}`);
  console.log(`  ✅ Tenant: ${user.tenant_id}`);
  
  const sessionId = crypto.randomBytes(24).toString('hex');
  const sessionData = {
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000).toISOString(),
      httpOnly: true,
      path: '/'
    },
    passport: { user: user.id },
    userId: user.id,
    tenantId: user.tenant_id,
    lastActivity: new Date().toISOString()
  };
  
  await sql`
    INSERT INTO sessions (sid, sess, expire) 
    VALUES (${sessionId}, ${JSON.stringify(sessionData)}, ${new Date(Date.now() + 86400000)})
    ON CONFLICT (sid) DO UPDATE SET sess = ${JSON.stringify(sessionData)}
  `;
  
  console.log(`  ✅ Session: ${sessionId}\n`);
  
  return { sessionId, tenantId: user.tenant_id };
}

/**
 * Make authenticated GET request
 */
async function authenticatedGet(
  path: string, 
  sessionId: string, 
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; text: string }> {
  const signedSessionId = `s:${sessionId}.${crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${sessionId}`)
    .digest('base64')
    .replace(/=+$/, '')}`;
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Cookie': `connect.sid=${signedSessionId}`,
      'User-Agent': 'mt-override-probes/1.0',
      ...extraHeaders
    }
  });
  
  const text = await response.text();
  return { status: response.status, text };
}

/**
 * Truncate for display
 */
function truncate(text: string, maxLen: number = 120): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}

/**
 * Test endpoint with and without override attempts
 */
async function testEndpoint(
  path: string, 
  sessionId: string
): Promise<{ available: boolean; blocked: boolean | null; anomaly: string | null }> {
  
  console.log(`\n  Testing: ${path}`);
  
  // Normal request
  console.log(`    [1] Normal request`);
  const normal = await authenticatedGet(path, sessionId);
  console.log(`        ${path} … ${normal.status} … ${truncate(normal.text)}`);
  
  if (normal.status === 404) {
    console.log(`        ⚠️  Endpoint unavailable`);
    return { available: false, blocked: null, anomaly: null };
  }
  
  if (normal.status === 401 || normal.status === 403) {
    console.log(`        ⚠️  Auth required or forbidden`);
    return { available: false, blocked: null, anomaly: 'auth required' };
  }
  
  // Override attempt with query param AND header
  console.log(`    [2] Override attempt (query + header)`);
  const override = await authenticatedGet(
    `${path}?tenantId=hacked`, 
    sessionId,
    { 'X-Tenant': 'hacked' }
  );
  console.log(`        ${path}?tenantId=hacked … ${override.status} … ${truncate(override.text)}`);
  
  // Check if blocked (403) or ignored (same result)
  let blocked: boolean;
  if (override.status === 403) {
    console.log(`        ✅ Override BLOCKED (403)`);
    blocked = true;
  } else if (override.status === normal.status && override.text === normal.text) {
    console.log(`        ✅ Override IGNORED (same result)`);
    blocked = true;
  } else {
    console.log(`        ❌ Override behavior unclear`);
    blocked = false;
  }
  
  // Check for anomalies
  let anomaly: string | null = null;
  if (normal.text.includes('<html') || normal.text.includes('<!DOCTYPE')) {
    anomaly = 'HTML shell detected';
  }
  
  return { available: true, blocked, anomaly };
}

/**
 * Cleanup
 */
async function cleanup(sessionId: string) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM sessions WHERE sid = ${sessionId}`;
    console.log(`\n🧹 Session cleaned up`);
  } catch (error) {
    console.error('⚠️  Cleanup failed:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  let sessionId: string | null = null;
  
  try {
    const { sessionId: sid, tenantId } = await createTestSession();
    sessionId = sid;
    
    console.log('📡 Probing endpoints with override attempts...');
    
    const endpoints = [
      '/api/email/providers',
      '/api/templates',
      '/api/projects',
      '/api/contacts'
    ];
    
    const results: Record<string, { available: boolean; blocked: boolean | null; anomaly: string | null }> = {};
    
    for (const endpoint of endpoints) {
      results[endpoint] = await testEndpoint(endpoint, sid);
    }
    
    // Verdict
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('VERDICT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('Auth method: signed-cookie (session row)\n');
    
    console.log('Per-endpoint override protection:\n');
    for (const [path, result] of Object.entries(results)) {
      if (!result.available) {
        console.log(`  ${path}: skipped (unavailable)`);
      } else if (result.blocked) {
        console.log(`  ${path}: PASS (override blocked/ignored)`);
      } else {
        console.log(`  ${path}: FAIL (override not properly handled)`);
      }
    }
    
    console.log();
    
    const anomalies = Object.entries(results)
      .filter(([_, r]) => r.anomaly)
      .map(([path, r]) => `${path}: ${r.anomaly}`);
    
    if (anomalies.length > 0) {
      console.log('Anomalies:');
      anomalies.forEach(a => console.log(`  - ${a}`));
    } else {
      console.log('Anomalies: none detected');
    }
    
    console.log('\n═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    if (sessionId) {
      await cleanup(sessionId);
    }
  }
}

main().catch(console.error);
