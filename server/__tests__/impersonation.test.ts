import request from 'supertest';
import { storage } from '../storage';
import { insertAdminAuditLogSchema, insertWebhookEventSchema } from '@shared/schema';

// Mock the storage layer
const mockStorage = {
  getUserGlobal: jest.fn(),
  getAllTenants: jest.fn(),
  getWebhookEventByProviderAndEventId: jest.fn(),
  updateWebhookEvent: jest.fn(),
  createAdminAuditLog: jest.fn(),
  withTenant: jest.fn().mockReturnValue({
    updateWebhookEvent: jest.fn(),
  }),
};

// Mock imports
jest.mock('../storage', () => ({
  storage: mockStorage
}));

describe('SUPERADMIN Impersonation & Webhook Replay', () => {
  let app: any;
  let agent: any;
  
  beforeAll(async () => {
    // Import app after mocking
    const { registerRoutes } = await import('../routes');
    const express = await import('express');
    app = express.default();
    app.use(express.default.json());
    
    // Register routes without CSRF for testing
    await registerRoutes(app, null);
    agent = request.agent(app);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Impersonation Status Endpoint', () => {
    it('should return impersonation status for SUPERADMIN', async () => {
      // Mock SUPERADMIN user verification
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@test.com',
        role: 'super_admin'
      });
      
      const response = await agent
        .get('/api/admin/impersonate/status')
        .set('Cookie', 'connect.sid=mock-session')
        .expect(200);
      
      expect(response.body).toHaveProperty('isImpersonating');
    });
    
    it('should deny access to non-SUPERADMIN users', async () => {
      // Mock regular user
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'user-123',
        email: 'user@test.com',
        role: 'user'
      });
      
      await agent
        .get('/api/admin/impersonate/status')
        .set('Cookie', 'connect.sid=mock-session')
        .expect(403);
    });
  });

  describe('Webhook Replay Endpoint', () => {
    it('should successfully replay webhook for SUPERADMIN', async () => {
      // Mock SUPERADMIN user verification
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@test.com', 
        role: 'super_admin'
      });
      
      // Mock tenant lookup
      mockStorage.getAllTenants.mockResolvedValue([
        { id: 'tenant-1', name: 'Test Tenant', slug: 'test' }
      ]);
      
      // Mock webhook event exists but not processed
      mockStorage.getWebhookEventByProviderAndEventId.mockResolvedValue({
        id: 'webhook-123',
        provider: 'stripe',
        eventId: 'evt_test',
        eventType: 'payment_intent.succeeded',
        processed: false,
        payload: '{"id":"evt_test","type":"payment_intent.succeeded"}',
        tenantId: 'tenant-1'
      });
      
      mockStorage.updateWebhookEvent.mockResolvedValue(true);
      mockStorage.createAdminAuditLog.mockResolvedValue(true);
      
      const response = await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          provider: 'stripe',
          eventId: 'evt_test'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('replayed');
      expect(mockStorage.createAdminAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'webhook_replay_success'
        })
      );
    });
    
    it('should return idempotent response for already processed webhook', async () => {
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'admin-123',
        role: 'super_admin'
      });
      
      mockStorage.getAllTenants.mockResolvedValue([
        { id: 'tenant-1', name: 'Test Tenant' }
      ]);
      
      // Mock webhook event already processed
      mockStorage.getWebhookEventByProviderAndEventId.mockResolvedValue({
        id: 'webhook-123',
        provider: 'stripe', 
        eventId: 'evt_test',
        eventType: 'payment_intent.succeeded',
        processed: true,
        processedAt: new Date(),
        tenantId: 'tenant-1'
      });
      
      const response = await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          provider: 'stripe',
          eventId: 'evt_test'
        })
        .expect(200);
      
      expect(response.body.status).toBe('already_processed');
      expect(mockStorage.createAdminAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'webhook_replay_already_processed'
        })
      );
    });
    
    it('should return 404 for non-existent webhook', async () => {
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'admin-123',
        role: 'super_admin'
      });
      
      mockStorage.getAllTenants.mockResolvedValue([{ id: 'tenant-1' }]);
      mockStorage.getWebhookEventByProviderAndEventId.mockResolvedValue(null);
      
      await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          provider: 'stripe',
          eventId: 'nonexistent'
        })
        .expect(404);
        
      expect(mockStorage.createAdminAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'webhook_replay_not_found'
        })
      );
    });
    
    it('should deny access to non-SUPERADMIN users', async () => {
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'user-123',
        role: 'user'
      });
      
      await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          provider: 'stripe',
          eventId: 'evt_test'
        })
        .expect(403);
    });
    
    it('should validate input parameters', async () => {
      mockStorage.getUserGlobal.mockResolvedValue({
        id: 'admin-123',
        role: 'super_admin'
      });
      
      // Test missing provider
      await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          eventId: 'evt_test'
        })
        .expect(400); // Zod validation error should return 400
      
      // Test missing eventId
      await agent
        .post('/api/admin/webhook/replay')
        .set('Cookie', 'connect.sid=mock-session')
        .send({
          provider: 'stripe'
        })
        .expect(400); // Zod validation error should return 400
    });
  });
});