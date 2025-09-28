/**
 * Comprehensive tenant isolation tests
 * Tests CRUD operations, cross-tenant access prevention, and performance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DrizzleStorage } from '../storage';
import { db } from '../db';
import { leads, users, events, jobs, tenants } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Tenant Isolation Tests', () => {
  let storage: DrizzleStorage;
  
  const TENANT_A = 'test-tenant-a';
  const TENANT_B = 'test-tenant-b';
  
  const USER_A = '11111111-1111-1111-1111-111111111111';
  const USER_B = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    storage = new DrizzleStorage();
    
    // Create test tenants
    await db.insert(tenants).values([
      { id: TENANT_A, name: 'Test Tenant A', slug: 'test-a' },
      { id: TENANT_B, name: 'Test Tenant B', slug: 'test-b' }
    ]).onConflictDoNothing();
    
    // Create test users
    await db.insert(users).values([
      {
        id: USER_A,
        tenantId: TENANT_A,
        email: 'user-a@test.com',
        firstName: 'User',
        lastName: 'A',
        role: 'user'
      },
      {
        id: USER_B,
        tenantId: TENANT_B,
        email: 'user-b@test.com', 
        firstName: 'User',
        lastName: 'B',
        role: 'user'
      }
    ]).onConflictDoNothing();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(leads).where(
      and(
        eq(leads.tenantId, TENANT_A)
      )
    );
    await db.delete(leads).where(
      and(
        eq(leads.tenantId, TENANT_B) 
      )
    );
    await db.delete(events).where(
      and(
        eq(events.tenantId, TENANT_A)
      )
    );
    await db.delete(events).where(
      and(
        eq(events.tenantId, TENANT_B)
      )
    );
  });

  afterAll(async () => {
    // Clean up test tenants and users
    await db.delete(users).where(eq(users.id, USER_A));
    await db.delete(users).where(eq(users.id, USER_B));
    await db.delete(tenants).where(eq(tenants.id, TENANT_A));
    await db.delete(tenants).where(eq(tenants.id, TENANT_B));
  });

  describe('CRUD Operations Tenant Requirements', () => {
    it('should reject lead creation without tenantId', async () => {
      await expect(
        storage.createLead({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          source: 'website'
        } as any, undefined)
      ).rejects.toThrow();
    });

    it('should require tenantId for lead queries', async () => {
      // Create test leads in both tenants
      const leadA = await storage.createLead({
        email: 'lead-a@test.com',
        firstName: 'Lead',
        lastName: 'A',
        source: 'website'
      }, TENANT_A);

      const leadB = await storage.createLead({
        email: 'lead-b@test.com', 
        firstName: 'Lead',
        lastName: 'B',
        source: 'website'
      }, TENANT_B);

      // Tenant A should only see Lead A
      const leadsA = await storage.getLeads(TENANT_A);
      expect(leadsA).toHaveLength(1);
      expect(leadsA[0].email).toBe('lead-a@test.com');

      // Tenant B should only see Lead B
      const leadsB = await storage.getLeads(TENANT_B);
      expect(leadsB).toHaveLength(1);
      expect(leadsB[0].email).toBe('lead-b@test.com');
    });

    it('should prevent cross-tenant data access', async () => {
      // Create lead in Tenant A
      const leadA = await storage.createLead({
        email: 'secret-lead@tenant-a.com',
        firstName: 'Secret',
        lastName: 'Lead',
        source: 'website'
      }, TENANT_A);

      // Tenant B should not be able to access Tenant A's lead
      const leadFromTenantB = await storage.getLead(leadA.id, TENANT_B);
      expect(leadFromTenantB).toBeUndefined();

      // Tenant A should be able to access its own lead
      const leadFromTenantA = await storage.getLead(leadA.id, TENANT_A);
      expect(leadFromTenantA).toBeDefined();
      expect(leadFromTenantA?.email).toBe('secret-lead@tenant-a.com');
    });
  });

  describe('Background Jobs Tenant Isolation', () => {
    it('should require tenantId for job creation', async () => {
      await expect(
        storage.createJob({
          type: 'test-job',
          payload: { test: 'data' },
          priority: 'normal'
        } as any, undefined)
      ).rejects.toThrow();
    });

    it('should isolate jobs by tenant', async () => {
      // Create jobs in both tenants
      const jobA = await storage.createJob({
        type: 'tenant-a-job',
        payload: { tenant: 'A' },
        priority: 'normal',
        tenantId: TENANT_A
      }, TENANT_A);

      const jobB = await storage.createJob({
        type: 'tenant-b-job', 
        payload: { tenant: 'B' },
        priority: 'normal',
        tenantId: TENANT_B
      }, TENANT_B);

      // Each tenant should only see their own jobs
      const jobsA = await storage.getJobs(TENANT_A);
      expect(jobsA.some(j => j.id === jobA.id)).toBe(true);
      expect(jobsA.some(j => j.id === jobB.id)).toBe(false);

      const jobsB = await storage.getJobs(TENANT_B);
      expect(jobsB.some(j => j.id === jobB.id)).toBe(true);
      expect(jobsB.some(j => j.id === jobA.id)).toBe(false);
    });
  });

  describe('Events Calendar Isolation', () => {
    it('should prevent cross-tenant event access', async () => {
      // Create events in both tenants
      const eventA = await storage.createEvent({
        title: 'Tenant A Meeting',
        startTime: new Date('2025-01-01T10:00:00Z'),
        endTime: new Date('2025-01-01T11:00:00Z'),
        tenantId: TENANT_A
      }, TENANT_A);

      const eventB = await storage.createEvent({
        title: 'Tenant B Conference',
        startTime: new Date('2025-01-01T14:00:00Z'), 
        endTime: new Date('2025-01-01T15:00:00Z'),
        tenantId: TENANT_B
      }, TENANT_B);

      // Verify tenant isolation
      const eventsA = await storage.getEvents(TENANT_A);
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0].title).toBe('Tenant A Meeting');

      const eventsB = await storage.getEvents(TENANT_B);
      expect(eventsB).toHaveLength(1);
      expect(eventsB[0].title).toBe('Tenant B Conference');

      // Cross-tenant access should fail
      const eventFromWrongTenant = await storage.getEvent(eventA.id, TENANT_B);
      expect(eventFromWrongTenant).toBeUndefined();
    });
  });

  describe('Performance with Tenant Indexes', () => {
    it('should use tenant_id indexes for efficient queries', async () => {
      // Create multiple leads to test index usage
      const leadPromises = [];
      for (let i = 0; i < 10; i++) {
        leadPromises.push(
          storage.createLead({
            email: `perf-test-${i}@tenant-a.com`,
            firstName: `Test${i}`,
            lastName: 'User',
            source: 'website'
          }, TENANT_A)
        );
      }
      await Promise.all(leadPromises);

      // Measure query performance
      const startTime = Date.now();
      const results = await storage.getLeads(TENANT_A);
      const queryTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(queryTime).toBeLessThan(100); // Should be fast with indexes
    });
  });

  describe('Audit Trail Isolation', () => {
    it('should isolate admin audit logs by tenant', async () => {
      // Create audit logs for both tenants
      const auditA = await storage.createAdminAuditLog({
        adminUserId: USER_A,
        action: 'test_action_a',
        tenantId: TENANT_A,
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      }, TENANT_A);

      const auditB = await storage.createAdminAuditLog({
        adminUserId: USER_B,
        action: 'test_action_b', 
        tenantId: TENANT_B,
        ipAddress: '127.0.0.1',
        userAgent: 'test'
      }, TENANT_B);

      // Each tenant should only see their own audit logs
      const logsA = await storage.getAdminAuditLogs(undefined, undefined, TENANT_A);
      expect(logsA.some(log => log.id === auditA.id)).toBe(true);
      expect(logsA.some(log => log.id === auditB.id)).toBe(false);

      const logsB = await storage.getAdminAuditLogs(undefined, undefined, TENANT_B);
      expect(logsB.some(log => log.id === auditB.id)).toBe(true);
      expect(logsB.some(log => log.id === auditA.id)).toBe(false);
    });
  });
});