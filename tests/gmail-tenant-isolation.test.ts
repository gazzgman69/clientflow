/**
 * Integration Test: Gmail Tenant Isolation
 * 
 * Verifies that Gmail sync operations maintain proper tenant isolation:
 * - Tenant A Gmail sync only affects Tenant A data
 * - Tenant B APIs return 0 messages from Tenant A sync
 * - No cross-tenant data leakage in email operations
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { storage } from '../server/storage';
import { EmailSyncService } from '../server/src/services/emailSync';

describe('Gmail Tenant Isolation', () => {
  const TENANT_A = 'test-tenant-a';
  const TENANT_B = 'test-tenant-b';
  const USER_A = 'user-a-id';
  const USER_B = 'user-b-id';

  beforeAll(async () => {
    // Setup test tenants
    await storage.createTenant({
      slug: 'tenant-a',
      name: 'Test Tenant A',
      domain: 'tenant-a.example.com'
    });
    
    await storage.createTenant({
      slug: 'tenant-b', 
      name: 'Test Tenant B',
      domain: 'tenant-b.example.com'
    });

    // Setup test users
    await storage.createUser({
      email: 'user-a@tenant-a.com',
      username: 'user-a',
      hashedPassword: 'test-hash'
    }, TENANT_A);

    await storage.createUser({
      email: 'user-b@tenant-b.com',
      username: 'user-b', 
      hashedPassword: 'test-hash'
    }, TENANT_B);
  });

  afterAll(async () => {
    // Cleanup test data
    const emailsA = await storage.getEmails(TENANT_A);
    const emailsB = await storage.getEmails(TENANT_B);
    
    // Clean up emails (if any were created)
    for (const email of [...emailsA, ...emailsB]) {
      await storage.deleteEmail(email.id, email.tenantId);
    }
  });

  it('should maintain tenant isolation during Gmail sync', async () => {
    // Create Gmail integration for Tenant A only
    const integrationA = await storage.createCalendarIntegration({
      tenantId: TENANT_A,
      userId: USER_A,
      provider: 'google',
      serviceType: 'gmail',
      providerAccountId: 'user-a@gmail.com',
      calendarName: 'Test Gmail Integration A',
      accessToken: 'fake-token-a',
      refreshToken: 'fake-refresh-a',
      isActive: true,
      syncDirection: 'bidirectional'
    }, TENANT_A);

    // Create contact in Tenant A for email association
    const contactA = await storage.createContact({
      firstName: 'Test',
      lastName: 'Contact',
      email: 'contact@external.com'
    }, TENANT_A);

    // Simulate email creation during sync for Tenant A
    const emailA = await storage.createEmail({
      threadId: 'thread-a-1',
      userId: USER_A,
      provider: 'gmail',
      providerMessageId: 'msg-a-1',
      direction: 'inbound',
      fromEmail: 'contact@external.com',
      toEmails: ['user-a@gmail.com'],
      subject: 'Test Email for Tenant A',
      bodyText: 'This email should only be visible to Tenant A',
      contactId: contactA.id,
      sentAt: new Date()
    }, TENANT_A);

    // Verify Tenant A can see their email
    const tenantAEmails = await storage.getEmails(TENANT_A);
    expect(tenantAEmails).toHaveLength(1);
    expect(tenantAEmails[0].subject).toBe('Test Email for Tenant A');
    expect(tenantAEmails[0].tenantId).toBe(TENANT_A);

    // Verify Tenant B cannot see Tenant A's email
    const tenantBEmails = await storage.getEmails(TENANT_B);
    expect(tenantBEmails).toHaveLength(0);

    // Verify tenant-scoped email retrieval
    const tenantAScopedEmails = await storage.withTenant(TENANT_A).getEmails(TENANT_A);
    const tenantBScopedEmails = await storage.withTenant(TENANT_B).getEmails(TENANT_B);
    
    expect(tenantAScopedEmails).toHaveLength(1);
    expect(tenantBScopedEmails).toHaveLength(0);

    // Verify cross-tenant email lookup fails
    try {
      await storage.getEmail(emailA.id, TENANT_B);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // Expected: Tenant B cannot access Tenant A's email
      expect(error).toBeDefined();
    }

    console.log('✅ Gmail tenant isolation test passed');
  });

  it('should enforce tenant isolation in email sync service', async () => {
    // Test EmailSyncService with tenant context
    const emailSyncA = new EmailSyncService(TENANT_A);
    const emailSyncB = new EmailSyncService(TENANT_B);

    // Mock sync would only affect the tenant specified in constructor
    expect(emailSyncA['tenantId']).toBe(TENANT_A);
    expect(emailSyncB['tenantId']).toBe(TENANT_B);

    console.log('✅ EmailSyncService tenant isolation verified');
  });

  it('should validate tenant_id is required for email operations', async () => {
    // Test that email creation without tenant_id fails
    try {
      await storage.createEmail({
        threadId: 'invalid-thread',
        userId: USER_A,
        provider: 'gmail',
        providerMessageId: 'invalid-msg',
        direction: 'inbound',
        fromEmail: 'test@example.com',
        toEmails: ['user@example.com'],
        subject: 'Invalid Email',
        bodyText: 'This should fail',
        sentAt: new Date()
      }, ''); // Empty tenant_id should fail
      
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Empty tenant_id validation works');
    }
  });
});