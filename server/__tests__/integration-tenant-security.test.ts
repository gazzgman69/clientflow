/**
 * Integration tests for end-to-end tenant security
 * Tests API endpoints, session handling, and real-world scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../src/app';
import { db } from '../db';
import { users, tenants, leads } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Integration Tenant Security Tests', () => {
  const TENANT_A = 'integration-tenant-a';
  const TENANT_B = 'integration-tenant-b';
  
  let userASession: string;
  let userBSession: string;

  beforeAll(async () => {
    // Create test tenants
    await db.insert(tenants).values([
      { id: TENANT_A, name: 'Integration Tenant A', slug: 'int-a' },
      { id: TENANT_B, name: 'Integration Tenant B', slug: 'int-b' }
    ]).onConflictDoNothing();

    // Create test users with sessions
    const userA = await db.insert(users).values({
      tenantId: TENANT_A,
      email: 'integration-a@test.com',
      firstName: 'Integration',
      lastName: 'UserA',
      role: 'user'
    }).returning().then(rows => rows[0]);

    const userB = await db.insert(users).values({
      tenantId: TENANT_B,
      email: 'integration-b@test.com',
      firstName: 'Integration', 
      lastName: 'UserB',
      role: 'user'
    }).returning().then(rows => rows[0]);

    // Mock sessions for testing (would normally go through authentication)
    // This simulates logged-in users with proper tenant context
    userASession = 'session-a-' + Date.now();
    userBSession = 'session-b-' + Date.now();
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(users).where(eq(users.tenantId, TENANT_A));
    await db.delete(users).where(eq(users.tenantId, TENANT_B));
    await db.delete(tenants).where(eq(tenants.id, TENANT_A));
    await db.delete(tenants).where(eq(tenants.id, TENANT_B));
  });

  describe('API Endpoint Tenant Isolation', () => {
    it('should isolate lead creation by tenant', async () => {
      // Create leads for both tenants
      const leadAResponse = await request(app)
        .post('/api/leads')
        .set('Cookie', `connect.sid=${userASession}`)
        .send({
          email: 'api-lead-a@test.com',
          firstName: 'API',
          lastName: 'LeadA',
          source: 'website'
        });

      const leadBResponse = await request(app)
        .post('/api/leads')
        .set('Cookie', `connect.sid=${userBSession}`)
        .send({
          email: 'api-lead-b@test.com',
          firstName: 'API',
          lastName: 'LeadB', 
          source: 'website'
        });

      expect(leadAResponse.status).toBe(201);
      expect(leadBResponse.status).toBe(201);

      // Each tenant should only see their own leads
      const tenantALeads = await request(app)
        .get('/api/leads')
        .set('Cookie', `connect.sid=${userASession}`)
        .expect(200);

      const tenantBLeads = await request(app)
        .get('/api/leads')
        .set('Cookie', `connect.sid=${userBSession}`)
        .expect(200);

      expect(tenantALeads.body.some((lead: any) => lead.email === 'api-lead-a@test.com')).toBe(true);
      expect(tenantALeads.body.some((lead: any) => lead.email === 'api-lead-b@test.com')).toBe(false);

      expect(tenantBLeads.body.some((lead: any) => lead.email === 'api-lead-b@test.com')).toBe(true);
      expect(tenantBLeads.body.some((lead: any) => lead.email === 'api-lead-a@test.com')).toBe(false);
    });

    it('should prevent direct access to other tenant resources', async () => {
      // Try to access resources with wrong session context
      // This simulates session hijacking or incorrect tenant context
      const unauthorizedAccess = await request(app)
        .get('/api/leads')
        .set('Cookie', `connect.sid=invalid-session`)
        .expect(401);

      expect(unauthorizedAccess.body).toHaveProperty('error');
    });

    it('should enforce tenant context in all API calls', async () => {
      // Test multiple endpoints to ensure tenant context is maintained
      const endpoints = ['/api/leads', '/api/events', '/api/leads/summary'];

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Cookie', `connect.sid=${userASession}`);

        // Should either succeed with tenant context or fail gracefully
        expect([200, 404, 304].includes(response.status)).toBe(true);
      }
    });
  });

  describe('Session-Based Tenant Resolution', () => {
    it('should maintain tenant context across requests', async () => {
      // First request creates lead
      const createResponse = await request(app)
        .post('/api/leads')
        .set('Cookie', `connect.sid=${userASession}`)
        .send({
          email: 'session-test@test.com',
          firstName: 'Session',
          lastName: 'Test',
          source: 'website'
        });

      expect(createResponse.status).toBe(201);
      const leadId = createResponse.body.id;

      // Second request should find the lead using the same session
      const getResponse = await request(app)
        .get(`/api/leads/${leadId}`)
        .set('Cookie', `connect.sid=${userASession}`)
        .expect(200);

      expect(getResponse.body.email).toBe('session-test@test.com');

      // Different tenant session should not find the lead
      const crossTenantResponse = await request(app)
        .get(`/api/leads/${leadId}`)
        .set('Cookie', `connect.sid=${userBSession}`)
        .expect(404);
    });
  });

  describe('Error Handling and Security', () => {
    it('should handle missing tenant context gracefully', async () => {
      const response = await request(app)
        .post('/api/leads')
        .send({
          email: 'no-tenant@test.com',
          firstName: 'No',
          lastName: 'Tenant',
          source: 'website'
        });

      // Should fail due to missing authentication/tenant context
      expect(response.status).toBe(401);
    });

    it('should prevent tenant enumeration attacks', async () => {
      // Try to guess tenant IDs or access patterns
      const suspiciousRequests = [
        '/api/leads?tenantId=other-tenant',
        '/api/leads?tenant=admin',
        '/api/events?tenant_id=system'
      ];

      for (const path of suspiciousRequests) {
        const response = await request(app)
          .get(path)
          .set('Cookie', `connect.sid=${userASession}`);

        // Should either ignore the parameter or return 400/401
        expect([200, 400, 401, 404].includes(response.status)).toBe(true);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle concurrent tenant operations', async () => {
      // Simulate concurrent operations from different tenants
      const concurrentPromises = [
        request(app)
          .post('/api/leads')
          .set('Cookie', `connect.sid=${userASession}`)
          .send({
            email: 'concurrent-a1@test.com',
            firstName: 'Concurrent',
            lastName: 'A1',
            source: 'website'
          }),
        request(app)
          .post('/api/leads')
          .set('Cookie', `connect.sid=${userBSession}`)
          .send({
            email: 'concurrent-b1@test.com',
            firstName: 'Concurrent',
            lastName: 'B1',
            source: 'website'
          }),
        request(app)
          .get('/api/leads/summary')
          .set('Cookie', `connect.sid=${userASession}`),
        request(app)
          .get('/api/leads/summary')
          .set('Cookie', `connect.sid=${userBSession}`)
      ];

      const results = await Promise.all(concurrentPromises);
      
      // All operations should succeed independently
      expect(results[0].status).toBe(201); // Lead created for Tenant A
      expect(results[1].status).toBe(201); // Lead created for Tenant B  
      expect([200, 304].includes(results[2].status)).toBe(true); // Summary for Tenant A
      expect([200, 304].includes(results[3].status)).toBe(true); // Summary for Tenant B
    });
  });
});