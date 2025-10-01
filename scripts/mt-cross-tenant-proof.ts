/**
 * Cross-Tenant Denial Proof (Seed & Cleanup)
 * 
 * Proves runtime cross-tenant read isolation by:
 * 1. Seeding a template for Tenant B
 * 2. Authenticating as Tenant A
 * 3. Attempting to GET Tenant B's template (expect 403/404)
 * 4. Cleaning up all seeded data
 * 
 * No server code edits, no schema changes.
 */

import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || '';
const BASE_URL = 'http://localhost:5000';

console.log('🔍 Cross-Tenant Denial Proof\n');
console.log('Mode: Seed → Test → Cleanup\n');

interface SeededData {
  tenantBId: string | null;
  templateBId: string | null;
  createdTenant: boolean;
}

const seeded: SeededData = {
  tenantBId: null,
  templateBId: null,
  createdTenant: false
};

/**
 * Find or create Tenant B
 */
async function setupTenantB(excludeTenantId: string): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🏢 Setting up Tenant B...');
  
  // Try to find existing tenant that's not Tenant A
  const existingTenants = await sql`
    SELECT id, name FROM tenants 
    WHERE id != ${excludeTenantId}
    LIMIT 1
  `;
  
  if (existingTenants.length > 0) {
    const tenant = existingTenants[0];
    console.log(`  ✅ Using existing Tenant B: ${tenant.name} (${tenant.id})`);
    seeded.tenantBId = tenant.id;
    seeded.createdTenant = false;
    return tenant.id;
  }
  
  // Create new Tenant B
  const newTenantId = crypto.randomUUID();
  await sql`
    INSERT INTO tenants (id, name, slug, plan, settings)
    VALUES (
      ${newTenantId},
      'TEST-TENANT-B (auto)',
      'test-tenant-b-auto',
      'free',
      '{}'::jsonb
    )
  `;
  
  console.log(`  ✅ Created Tenant B: TEST-TENANT-B (auto) (${newTenantId})`);
  seeded.tenantBId = newTenantId;
  seeded.createdTenant = true;
  return newTenantId;
}

/**
 * Seed template for Tenant B
 */
async function seedTemplateB(tenantBId: string, createdBy: string): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('📄 Seeding template for Tenant B...');
  
  const templateId = crypto.randomUUID();
  await sql`
    INSERT INTO message_templates (id, tenant_id, name, type, subject, body, created_by)
    VALUES (
      ${templateId},
      ${tenantBId},
      'TEST-TEMPLATE-B (auto)',
      'email',
      'Test Subject',
      'Test content',
      ${createdBy}
    )
  `;
  
  console.log(`  ✅ Created template: TEST-TEMPLATE-B (auto) (${templateId})`);
  seeded.templateBId = templateId;
  return templateId;
}

/**
 * Create session for Tenant A
 */
async function createTenantASession(): Promise<{ sessionId: string; tenantId: string; userId: string }> {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('🔑 Creating Tenant A session...');
  
  const users = await sql`SELECT id, email, tenant_id FROM users LIMIT 1`;
  if (users.length === 0) throw new Error('No users found');
  
  const user = users[0];
  console.log(`  ✅ User: ${user.email}`);
  console.log(`  ✅ Tenant A: ${user.tenant_id}`);
  
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
  
  return { sessionId, tenantId: user.tenant_id, userId: user.id };
}

/**
 * Make authenticated GET request
 */
async function authenticatedGet(path: string, sessionId: string): Promise<{ status: number; text: string }> {
  const signedSessionId = `s:${sessionId}.${crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${sessionId}`)
    .digest('base64')
    .replace(/=+$/, '')}`;
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Cookie': `connect.sid=${signedSessionId}`,
      'User-Agent': 'mt-cross-tenant-proof/1.0'
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
 * Cleanup seeded data
 */
async function cleanup(sessionId: string | null) {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('\n🧹 Cleanup...');
  
  try {
    // Delete seeded template
    if (seeded.templateBId) {
      await sql`DELETE FROM message_templates WHERE id = ${seeded.templateBId}`;
      console.log(`  ✅ Deleted template: ${seeded.templateBId}`);
    }
    
    // Delete created tenant (only if we created it)
    if (seeded.tenantBId && seeded.createdTenant) {
      await sql`DELETE FROM tenants WHERE id = ${seeded.tenantBId}`;
      console.log(`  ✅ Deleted tenant: ${seeded.tenantBId}`);
    }
    
    // Delete session
    if (sessionId) {
      await sql`DELETE FROM sessions WHERE sid = ${sessionId}`;
      console.log(`  ✅ Deleted session: ${sessionId}`);
    }
    
    console.log('  ✅ Cleanup complete');
  } catch (error) {
    console.error('  ❌ Cleanup error:', error);
  }
}

/**
 * Main execution
 */
async function main() {
  let sessionId: string | null = null;
  
  try {
    // Setup Tenant A session
    const { sessionId: sid, tenantId: tenantAId, userId } = await createTenantASession();
    sessionId = sid;
    
    // Setup Tenant B and seed template
    const tenantBId = await setupTenantB(tenantAId);
    const templateBId = await seedTemplateB(tenantBId, userId);
    
    console.log('📡 Testing cross-tenant isolation...\n');
    
    // Use correct API endpoint path
    const templateEndpoint = '/api/admin/templates';
    
    // Test 1: Try to get own template (Tenant A)
    const sql = neon(process.env.DATABASE_URL!);
    const ownTemplates = await sql`
      SELECT id, name FROM message_templates 
      WHERE tenant_id = ${tenantAId}
      LIMIT 1
    `;
    
    if (ownTemplates.length > 0) {
      const ownTemplate = ownTemplates[0];
      console.log(`  [1] Own template access (Tenant A)`);
      console.log(`      Template: ${ownTemplate.name} (${ownTemplate.id})`);
      
      const ownResult = await authenticatedGet(`${templateEndpoint}/${ownTemplate.id}`, sid);
      console.log(`      GET ${templateEndpoint}/${ownTemplate.id} … ${ownResult.status} … ${truncate(ownResult.text)}`);
      
      if (ownResult.status === 200) {
        console.log(`      ✅ Own template accessible`);
      } else if (ownResult.status === 404) {
        console.log(`      ⚠️  Endpoint unavailable or requires admin`);
      }
      console.log();
    } else {
      console.log(`  [1] skipped (no Tenant A template found)\n`);
    }
    
    // Test 2: Try to get Tenant B's template with Tenant A session
    console.log(`  [2] Cross-tenant template access (Tenant A → Tenant B)`);
    console.log(`      Tenant A session: ${tenantAId}`);
    console.log(`      Target template: TEST-TEMPLATE-B (auto) (${templateBId})`);
    console.log(`      Target tenant: ${tenantBId}`);
    
    const crossResult = await authenticatedGet(`${templateEndpoint}/${templateBId}`, sid);
    console.log(`      GET ${templateEndpoint}/${templateBId} … ${crossResult.status} … ${truncate(crossResult.text)}`);
    
    let crossTenantBlocked: string;
    if (crossResult.status === 403) {
      console.log(`      ✅ Cross-tenant access BLOCKED (403 Forbidden)`);
      crossTenantBlocked = 'PASS';
    } else if (crossResult.status === 404) {
      console.log(`      ✅ Cross-tenant access BLOCKED (404 Not Found)`);
      crossTenantBlocked = 'PASS';
    } else if (crossResult.status === 200) {
      console.log(`      ❌ Cross-tenant access ALLOWED (SECURITY ISSUE!)`);
      crossTenantBlocked = 'FAIL';
    } else {
      console.log(`      ⚠️  Unexpected status`);
      crossTenantBlocked = `unclear (${crossResult.status})`;
    }
    
    // Check for anomalies
    const anomalies: string[] = [];
    if (crossResult.text.includes('<html') || crossResult.text.includes('<!DOCTYPE')) {
      anomalies.push('HTML shell detected');
    }
    
    // Verdict
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('VERDICT');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log(`Seeded data:`);
    console.log(`  - Tenant B ID: ${tenantBId} ${seeded.createdTenant ? '(created)' : '(existing)'}`);
    console.log(`  - Template B ID: ${templateBId}`);
    console.log();
    
    console.log(`Cross-tenant single GET blocked: ${crossTenantBlocked}`);
    console.log();
    
    if (anomalies.length > 0) {
      console.log(`Anomalies:`);
      anomalies.forEach(a => console.log(`  - ${a}`));
    } else {
      console.log(`Anomalies: none detected`);
    }
    console.log();
    
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await cleanup(sessionId);
  }
}

main().catch(console.error);
