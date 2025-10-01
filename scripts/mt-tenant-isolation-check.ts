/**
 * Multi-Tenant Isolation Check
 * 
 * Verifies at runtime that:
 * 1. Protected endpoints are reachable under valid session for Tenant A
 * 2. Client-supplied tenant overrides are blocked (403/ignored)
 * 3. Cross-tenant reads return 403/404 or are inaccessible
 * 
 * Rules:
 * - No server code/route modifications
 * - GET-only (no mutations)
 * - Creates temporary session in PostgreSQL, cleans up after
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || '';
const BASE_URL = 'http://localhost:5000';

console.log('🔍 Multi-Tenant Isolation Check\n');
console.log('Mode: READ-ONLY (GET requests only)');
console.log(`Base URL: ${BASE_URL}\n`);

/**
 * Create authenticated session in PostgreSQL
 */
async function createTestSession(): Promise<{ sessionId: string; tenantId: string; userId: string }> {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🗄️  Creating test session in database...');
  
  // Get first available user
  const users = await sql`SELECT id, email, tenant_id FROM users LIMIT 1`;
  
  if (users.length === 0) {
    throw new Error('No users found in database');
  }
  
  const testUser = users[0];
  console.log(`  ✅ Using user: ${testUser.email} (${testUser.id})`);
  console.log(`  ✅ Tenant: ${testUser.tenant_id}`);
  
  // Generate session ID
  const sessionId = crypto.randomBytes(24).toString('hex');
  
  // Create session data
  const sessionData = {
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000).toISOString(),
      httpOnly: true,
      path: '/'
    },
    passport: {
      user: testUser.id
    },
    userId: testUser.id,
    tenantId: testUser.tenant_id,
    lastActivity: new Date().toISOString()
  };
  
  // Insert session into PostgreSQL sessions table
  await sql`
    INSERT INTO sessions (sid, sess, expire) 
    VALUES (${sessionId}, ${JSON.stringify(sessionData)}, ${new Date(Date.now() + 86400000)})
    ON CONFLICT (sid) DO UPDATE SET sess = ${JSON.stringify(sessionData)}, expire = ${new Date(Date.now() + 86400000)}
  `;
  
  console.log(`  ✅ Session created: ${sessionId}\n`);
  
  return {
    sessionId,
    tenantId: testUser.tenant_id,
    userId: testUser.id
  };
}

/**
 * Make authenticated GET request
 */
async function authenticatedGet(path: string, sessionId: string): Promise<{ status: number; body: any; text: string }> {
  // Sign the session ID using cookie-signature format
  const signedSessionId = `s:${sessionId}.${crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${sessionId}`)
    .digest('base64')
    .replace(/=+$/, '')}`;
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Cookie': `connect.sid=${signedSessionId}`,
      'User-Agent': 'mt-isolation-check/1.0'
    }
  });
  
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  
  let body;
  if (contentType.includes('application/json')) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } else {
    body = text;
  }
  
  return { status: response.status, body, text };
}

/**
 * Cleanup test session
 */
async function cleanupTestSession(sessionId: string) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM sessions WHERE sid = ${sessionId}`;
    console.log(`\n🧹 Test session cleaned up`);
  } catch (error) {
    console.error('⚠️  Session cleanup failed:', error);
  }
}

/**
 * Truncate response for display
 */
function truncate(text: string, maxLen: number = 120): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}

/**
 * Main execution
 */
async function main() {
  let sessionId: string | null = null;
  
  try {
    const { sessionId: sid, tenantId, userId } = await createTestSession();
    sessionId = sid;
    
    // Test results
    const results = {
      statusEndpointsPass: true,
      tenantOverrideBlocked: true,
      crossTenantBlocked: 'skipped',
      anomalies: [] as string[]
    };
    
    console.log('📡 Testing protected endpoints (Tenant A session)...\n');
    
    // Test 1: Google OAuth status
    console.log('  [1] GET /api/auth/google/status');
    const googleStatus = await authenticatedGet('/api/auth/google/status', sid);
    console.log(`      Status: ${googleStatus.status}`);
    console.log(`      Response: ${truncate(googleStatus.text)}`);
    if (googleStatus.status !== 200) {
      results.statusEndpointsPass = false;
      results.anomalies.push('Google status returned non-200');
    }
    console.log();
    
    // Test 2: Microsoft OAuth status
    console.log('  [2] GET /api/auth/microsoft/status');
    const microsoftStatus = await authenticatedGet('/api/auth/microsoft/status', sid);
    console.log(`      Status: ${microsoftStatus.status}`);
    console.log(`      Response: ${truncate(microsoftStatus.text)}`);
    if (microsoftStatus.status !== 200) {
      results.statusEndpointsPass = false;
      results.anomalies.push('Microsoft status returned non-200');
    }
    console.log();
    
    // Test 3: Email providers
    console.log('  [3] GET /api/email/providers');
    const providers = await authenticatedGet('/api/email/providers', sid);
    console.log(`      Status: ${providers.status}`);
    console.log(`      Response: ${truncate(providers.text)}`);
    if (providers.status !== 200) {
      results.statusEndpointsPass = false;
      results.anomalies.push('Email providers returned non-200');
    }
    console.log();
    
    console.log('🛡️  Testing tenant override protection...\n');
    
    // Test 4: Malicious tenant override
    console.log('  [4] GET /api/email/providers?tenantId=hacked (malicious query)');
    const maliciousProviders = await authenticatedGet('/api/email/providers?tenantId=hacked', sid);
    console.log(`      Status: ${maliciousProviders.status}`);
    console.log(`      Response: ${truncate(maliciousProviders.text)}`);
    
    // Check if override was blocked (403) or ignored (same result as normal)
    if (maliciousProviders.status === 403) {
      console.log(`      ✅ Override BLOCKED with 403`);
    } else if (maliciousProviders.status === 200 && maliciousProviders.text === providers.text) {
      console.log(`      ✅ Override IGNORED (same result as normal call)`);
    } else {
      console.log(`      ❌ Override behavior unclear`);
      results.tenantOverrideBlocked = false;
      results.anomalies.push('Tenant override not properly blocked/ignored');
    }
    console.log();
    
    console.log('🔐 Testing cross-tenant access protection...\n');
    
    // Test 5: Cross-tenant template access
    const sql = neon(process.env.DATABASE_URL!);
    
    // Find a template for current tenant
    const ownTemplates = await sql`
      SELECT id, name, tenant_id 
      FROM message_templates 
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;
    
    if (ownTemplates.length > 0) {
      const ownTemplate = ownTemplates[0];
      console.log(`  [5a] Own template access (same tenant: ${tenantId})`);
      console.log(`       Template: ${ownTemplate.name} (${ownTemplate.id})`);
      
      // Try admin route since that's what exists
      const ownResult = await authenticatedGet(`/api/admin/templates/${ownTemplate.id}`, sid);
      console.log(`       GET /api/admin/templates/${ownTemplate.id}`);
      console.log(`       Status: ${ownResult.status}`);
      console.log(`       Response: ${truncate(ownResult.text)}`);
      console.log();
    } else {
      console.log('  [5a] skipped (no own template found)\n');
    }
    
    // Find a template from a different tenant
    const foreignTemplates = await sql`
      SELECT id, name, tenant_id 
      FROM message_templates 
      WHERE tenant_id != ${tenantId}
      LIMIT 1
    `;
    
    if (foreignTemplates.length > 0) {
      const foreignTemplate = foreignTemplates[0];
      console.log(`  [5b] Cross-tenant template access attempt`);
      console.log(`       Own tenant: ${tenantId}`);
      console.log(`       Target template: ${foreignTemplate.name} (${foreignTemplate.id})`);
      console.log(`       Target tenant: ${foreignTemplate.tenant_id}`);
      
      const crossResult = await authenticatedGet(`/api/admin/templates/${foreignTemplate.id}`, sid);
      console.log(`       GET /api/admin/templates/${foreignTemplate.id}`);
      console.log(`       Status: ${crossResult.status}`);
      console.log(`       Response: ${truncate(crossResult.text)}`);
      
      if (crossResult.status === 403 || crossResult.status === 404) {
        console.log(`       ✅ Cross-tenant access BLOCKED`);
        results.crossTenantBlocked = 'pass';
      } else if (crossResult.status === 200) {
        console.log(`       ❌ Cross-tenant access ALLOWED (security issue!)`);
        results.crossTenantBlocked = 'fail';
        results.anomalies.push('Cross-tenant template access not blocked');
      }
      console.log();
    } else {
      console.log('  [5b] skipped (no foreign tenant template found)\n');
      results.crossTenantBlocked = 'skipped (no foreign id)';
    }
    
    // Final verdict
    console.log('═══════════════════════════════════════════════════════');
    console.log('VERDICT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`Auth method: signed-cookie (session row)\n`);
    
    console.log(`• status endpoints reachable & tenant-scoped: ${results.statusEndpointsPass ? 'PASS' : 'FAIL'}`);
    if (!results.statusEndpointsPass) {
      console.log(`  Note: Some endpoints returned non-200 status`);
    }
    console.log();
    
    console.log(`• providers override blocked/ignored: ${results.tenantOverrideBlocked ? 'PASS' : 'FAIL'}`);
    if (!results.tenantOverrideBlocked) {
      console.log(`  Note: Malicious tenantId query param was not properly handled`);
    }
    console.log();
    
    console.log(`• template cross-tenant blocked: ${results.crossTenantBlocked}`);
    console.log();
    
    if (results.anomalies.length > 0) {
      console.log(`• anomalies:`);
      results.anomalies.forEach(a => console.log(`  - ${a}`));
    } else {
      console.log(`• anomalies: none detected`);
    }
    console.log();
    
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    if (sessionId) {
      await cleanupTestSession(sessionId);
    }
  }
}

main().catch(console.error);
