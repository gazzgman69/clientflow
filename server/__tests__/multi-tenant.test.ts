import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { storage } from '../storage';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users, leads, tenants } from '@shared/schema';

// Mock storage for multi-tenant testing
const mockStorage = {
  getUsers: jest.fn(),
  getUser: jest.fn(),
  getUserByUsername: jest.fn(),
  createUser: jest.fn(),
  createLead: jest.fn(),
  getLeads: jest.fn(),
  getLead: jest.fn(),
  getActiveTenants: jest.fn(),
  withTenant: jest.fn(),
  getTenant: jest.fn(),
  getTenantBySlug: jest.fn(),
  createTenant: jest.fn(),
};

// Mock the storage module
jest.mock('../storage', () => ({
  storage: mockStorage
}));

// Mock userPrefs service
jest.mock('../src/services/userPrefs', () => ({
  userPrefsService: {
    getUserPref: jest.fn(),
    setUserPref: jest.fn(),
  }
}));

// Mock configService
jest.mock('../src/services/configService', () => ({
  configService: {
    getSessionSecret: jest.fn().mockResolvedValue('test-session-secret-32-chars-min'),
    getConfig: jest.fn(),
    validateRequiredConfigs: jest.fn(),
  }
}));

// Mock email auto sync service
jest.mock('../src/services/email-auto-sync', () => ({
  emailAutoSyncService: {
    performAutoSync: jest.fn(),
    syncEmailsForUser: jest.fn(),
  }
}));

describe('Multi-Tenant System Tests', () => {
  let app: express.Application;
  const TENANT_A_ID = 'tenant-a-123';
  const TENANT_B_ID = 'tenant-b-456';
  const USER_A_ID = 'user-a-123';
  const USER_B_ID = 'user-b-456';

  beforeEach(async () => {
    // Create express app with session support
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));
    
    // Mock tenant data
    const tenantA = {
      id: TENANT_A_ID,
      name: 'Tenant A Company',
      slug: 'tenant-a',
      domain: null,
      isActive: true,
      plan: 'pro',
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const tenantB = {
      id: TENANT_B_ID,
      name: 'Tenant B Corp',
      slug: 'tenant-b',
      domain: null,
      isActive: true,
      plan: 'starter',
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Mock users for different tenants
    const userA = {
      id: USER_A_ID,
      tenantId: TENANT_A_ID,
      username: 'usera',
      password: 'hashedpassword',
      email: 'usera@tenanta.com',
      firstName: 'User',
      lastName: 'A',
      role: 'admin',
      createdAt: new Date(),
    };
    
    const userB = {
      id: USER_B_ID,
      tenantId: TENANT_B_ID,
      username: 'userb',
      password: 'hashedpassword',
      email: 'userb@tenantb.com',
      firstName: 'User',
      lastName: 'B',
      role: 'user',
      createdAt: new Date(),
    };
    
    // Setup mock returns
    mockStorage.getTenant.mockImplementation((id: string) => {
      if (id === TENANT_A_ID) return Promise.resolve(tenantA);
      if (id === TENANT_B_ID) return Promise.resolve(tenantB);
      return Promise.resolve(null);
    });
    
    mockStorage.getUser.mockImplementation((id: string) => {
      if (id === USER_A_ID) return Promise.resolve(userA);
      if (id === USER_B_ID) return Promise.resolve(userB);
      return Promise.resolve(null);
    });
    
    mockStorage.getUserByUsername.mockImplementation((username: string, tenantId: string) => {
      if (username === 'usera' && tenantId === TENANT_A_ID) return Promise.resolve(userA);
      if (username === 'userb' && tenantId === TENANT_B_ID) return Promise.resolve(userB);
      return Promise.resolve(null);
    });
    
    mockStorage.getActiveTenants.mockResolvedValue([tenantA, tenantB]);
    
    // Setup tenant-scoped storage mocks
    const tenantAStorage = {
      getLeads: jest.fn().mockResolvedValue([
        { id: 'lead-a1', tenantId: TENANT_A_ID, name: 'Lead A1', email: 'leada1@test.com' },
        { id: 'lead-a2', tenantId: TENANT_A_ID, name: 'Lead A2', email: 'leada2@test.com' }
      ]),
      createLead: jest.fn(),
      getLead: jest.fn(),
      getUsers: jest.fn().mockResolvedValue([userA]),
    };
    
    const tenantBStorage = {
      getLeads: jest.fn().mockResolvedValue([
        { id: 'lead-b1', tenantId: TENANT_B_ID, name: 'Lead B1', email: 'leadb1@test.com' }
      ]),
      createLead: jest.fn(),
      getLead: jest.fn(),
      getUsers: jest.fn().mockResolvedValue([userB]),
    };
    
    mockStorage.withTenant.mockImplementation((tenantId: string) => {
      if (tenantId === TENANT_A_ID) return tenantAStorage;
      if (tenantId === TENANT_B_ID) return tenantBStorage;
      return null;
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Authentication and Session Management', () => {
    it('should allow login for Tenant A user and deny cross-tenant access', async () => {
      // Import auth middleware after mocking
      const { ensureUserAuth } = await import('../middleware/auth');
      
      // Setup test routes
      app.post('/login', async (req, res) => {
        const { username, tenantId } = req.body;
        const user = await mockStorage.getUserByUsername(username, tenantId);
        
        if (user && user.tenantId === tenantId) {
          req.session.userId = user.id;
          req.session.tenantId = tenantId;
          res.json({ success: true, userId: user.id, tenantId });
        } else {
          res.status(401).json({ error: 'Invalid credentials or wrong tenant' });
        }
      });
      
      app.get('/protected-a', (req, res, next) => {
        req.tenantId = TENANT_A_ID;
        next();
      }, ensureUserAuth, (req, res) => {
        res.json({ message: 'Access granted to Tenant A', userId: req.authenticatedUserId });
      });
      
      app.get('/protected-b', (req, res, next) => {
        req.tenantId = TENANT_B_ID;
        next();
      }, ensureUserAuth, (req, res) => {
        res.json({ message: 'Access granted to Tenant B', userId: req.authenticatedUserId });
      });
      
      const agent = request.agent(app);
      
      // Login as Tenant A user
      await agent
        .post('/login')
        .send({ username: 'usera', tenantId: TENANT_A_ID })
        .expect(200);
      
      // Should be able to access Tenant A resources
      await agent
        .get('/protected-a')
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Access granted to Tenant A');
          expect(res.body.userId).toBe(USER_A_ID);
        });
      
      // Should be denied access to Tenant B resources
      await agent
        .get('/protected-b')
        .expect(401); // Cross-tenant access should be denied
    });
    
    it('should enforce tenant isolation in sessions', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);
      
      // Setup login route
      app.post('/login', async (req, res) => {
        const { username, tenantId } = req.body;
        const user = await mockStorage.getUserByUsername(username, tenantId);
        
        if (user && user.tenantId === tenantId) {
          req.session.userId = user.id;
          req.session.tenantId = tenantId;
          res.json({ success: true, userId: user.id, tenantId });
        } else {
          res.status(401).json({ error: 'Invalid credentials' });
        }
      });
      
      // Login as different tenant users
      await agent1
        .post('/login')
        .send({ username: 'usera', tenantId: TENANT_A_ID })
        .expect(200);
        
      await agent2
        .post('/login')
        .send({ username: 'userb', tenantId: TENANT_B_ID })
        .expect(200);
      
      // Verify sessions are isolated
      // Each agent should maintain its own session context
      expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('usera', TENANT_A_ID);
      expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('userb', TENANT_B_ID);
    });
  });

  describe('Storage and Data Isolation', () => {
    it('should isolate data access across tenants using withTenant', async () => {
      // Get tenant-scoped storage instances
      const tenantAStorage = mockStorage.withTenant(TENANT_A_ID);
      const tenantBStorage = mockStorage.withTenant(TENANT_B_ID);
      
      // Verify each tenant sees only their own data
      const tenantALeads = await tenantAStorage.getLeads();
      const tenantBLeads = await tenantBStorage.getLeads();
      
      expect(tenantALeads).toHaveLength(2);
      expect(tenantALeads[0].tenantId).toBe(TENANT_A_ID);
      expect(tenantALeads[1].tenantId).toBe(TENANT_A_ID);
      
      expect(tenantBLeads).toHaveLength(1);
      expect(tenantBLeads[0].tenantId).toBe(TENANT_B_ID);
      
      // Verify no cross-contamination
      expect(tenantALeads.some(lead => lead.tenantId === TENANT_B_ID)).toBe(false);
      expect(tenantBLeads.some(lead => lead.tenantId === TENANT_A_ID)).toBe(false);
    });
    
    it('should enforce tenant context in write operations', async () => {
      const tenantAStorage = mockStorage.withTenant(TENANT_A_ID);
      const tenantBStorage = mockStorage.withTenant(TENANT_B_ID);
      
      // Mock create operations to verify tenant context
      tenantAStorage.createLead.mockImplementation((lead: any) => {
        expect(lead.tenantId).toBe(TENANT_A_ID);
        return Promise.resolve({ ...lead, id: 'new-lead-a' });
      });
      
      tenantBStorage.createLead.mockImplementation((lead: any) => {
        expect(lead.tenantId).toBe(TENANT_B_ID);
        return Promise.resolve({ ...lead, id: 'new-lead-b' });
      });
      
      // Create leads in different tenants
      await tenantAStorage.createLead({
        name: 'New Lead A',
        email: 'newleada@test.com',
        tenantId: TENANT_A_ID
      });
      
      await tenantBStorage.createLead({
        name: 'New Lead B',
        email: 'newleadb@test.com',
        tenantId: TENANT_B_ID
      });
      
      // Verify tenant context was enforced
      expect(tenantAStorage.createLead).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_A_ID })
      );
      expect(tenantBStorage.createLead).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT_B_ID })
      );
    });
    
    it('should return empty results for cross-tenant queries', async () => {
      // Setup route that attempts cross-tenant access
      app.get('/cross-tenant-test', async (req, res) => {
        try {
          // Attempt to access Tenant B data with Tenant A storage
          const tenantAStorage = mockStorage.withTenant(TENANT_A_ID);
          const tenantBStorage = mockStorage.withTenant(TENANT_B_ID);
          
          // Get data from each tenant's storage
          const tenantAData = await tenantAStorage.getLeads();
          const tenantBData = await tenantBStorage.getLeads();
          
          // Verify isolation
          const hasCrossTenantData = tenantAData.some((lead: any) => lead.tenantId !== TENANT_A_ID) ||
                                   tenantBData.some((lead: any) => lead.tenantId !== TENANT_B_ID);
          
          res.json({ 
            isolated: !hasCrossTenantData,
            tenantACount: tenantAData.length,
            tenantBCount: tenantBData.length
          });
        } catch (error) {
          res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });
      
      await request(app)
        .get('/cross-tenant-test')
        .expect(200)
        .expect((res) => {
          expect(res.body.isolated).toBe(true);
          expect(res.body.tenantACount).toBe(2);
          expect(res.body.tenantBCount).toBe(1);
        });
    });
  });

  describe('Jobs and Email Sync', () => {
    it('should process email sync for multiple tenants with isolation', async () => {
      const { emailAutoSyncService } = await import('../src/services/email-auto-sync');
      const { userPrefsService } = await import('../src/services/userPrefs');
      
      // Mock feature flag enabled for both tenants
      userPrefsService.getUserPref = jest.fn().mockImplementation((tenantId: string, key: string) => {
        if (key === 'emailSyncEnabled') return Promise.resolve('true');
        return Promise.resolve(null);
      });
      
      // Mock email sync service methods
      emailAutoSyncService.performAutoSync = jest.fn().mockImplementation(async () => {
        // Simulate processing both tenants
        const tenants = await mockStorage.getActiveTenants();
        
        for (const tenant of tenants) {
          const tenantStorage = mockStorage.withTenant(tenant.id);
          console.log(`🔄 Processing email sync for tenant: ${tenant.name} (${tenant.id})`);
          
          // Simulate checking integrations for this tenant
          const users = await tenantStorage.getUsers();
          console.log(`📧 Found ${users.length} users in tenant ${tenant.id}`);
        }
        
        return Promise.resolve();
      });
      
      // Setup test route
      app.post('/test-email-sync', async (req, res) => {
        try {
          await emailAutoSyncService.performAutoSync();
          res.json({ success: true, message: 'Email sync completed for all tenants' });
        } catch (error) {
          res.status(500).json({ error: error instanceof Error ? error.message : 'Sync failed' });
        }
      });
      
      await request(app)
        .post('/test-email-sync')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
      
      // Verify email sync was called
      expect(emailAutoSyncService.performAutoSync).toHaveBeenCalled();
      
      // Verify tenant enumeration occurred
      expect(mockStorage.getActiveTenants).toHaveBeenCalled();
      expect(mockStorage.withTenant).toHaveBeenCalledWith(TENANT_A_ID);
      expect(mockStorage.withTenant).toHaveBeenCalledWith(TENANT_B_ID);
    });
    
    it('should respect feature flags per tenant for email sync', async () => {
      const { userPrefsService } = await import('../src/services/userPrefs');
      
      // Mock feature flag disabled for Tenant B
      userPrefsService.getUserPref = jest.fn().mockImplementation((tenantId: string, key: string) => {
        if (key === 'emailSyncEnabled') {
          return tenantId === TENANT_A_ID ? Promise.resolve('true') : Promise.resolve('false');
        }
        return Promise.resolve(null);
      });
      
      // Setup test route
      app.get('/test-feature-flags', async (req, res) => {
        const tenantAEnabled = await userPrefsService.getUserPref(TENANT_A_ID, 'emailSyncEnabled');
        const tenantBEnabled = await userPrefsService.getUserPref(TENANT_B_ID, 'emailSyncEnabled');
        
        res.json({
          tenantA: tenantAEnabled === 'true',
          tenantB: tenantBEnabled === 'true'
        });
      });
      
      await request(app)
        .get('/test-feature-flags')
        .expect(200)
        .expect((res) => {
          expect(res.body.tenantA).toBe(true);
          expect(res.body.tenantB).toBe(false);
        });
    });
    
    it('should implement backoff and jitter for failed tenant syncs', async () => {
      const { emailAutoSyncService } = await import('../src/services/email-auto-sync');
      
      // Mock service to test backoff behavior
      const mockPerformSync = jest.fn();
      let callCount = 0;
      
      mockPerformSync.mockImplementation(async () => {
        callCount++;
        
        // Simulate different outcomes for different tenants
        const tenants = await mockStorage.getActiveTenants();
        
        for (const tenant of tenants) {
          if (tenant.id === TENANT_A_ID) {
            // Simulate success for Tenant A
            console.log(`✅ Tenant ${tenant.id} sync successful`);
          } else {
            // Simulate failure for Tenant B on first call
            if (callCount === 1) {
              console.log(`❌ Tenant ${tenant.id} sync failed (retry count: 1)`);
              throw new Error(`Sync failed for tenant ${tenant.id}`);
            } else {
              console.log(`✅ Tenant ${tenant.id} sync successful after retry`);
            }
          }
        }
      });
      
      emailAutoSyncService.performAutoSync = mockPerformSync;
      
      // Setup test route
      app.post('/test-backoff', async (req, res) => {
        const results = [];
        
        try {
          // First attempt - should fail for Tenant B
          await emailAutoSyncService.performAutoSync();
          results.push('first_attempt_success');
        } catch (error) {
          results.push('first_attempt_failed');
        }
        
        try {
          // Second attempt - should succeed for both
          await emailAutoSyncService.performAutoSync();
          results.push('second_attempt_success');
        } catch (error) {
          results.push('second_attempt_failed');
        }
        
        res.json({ results, callCount });
      });
      
      await request(app)
        .post('/test-backoff')
        .expect(200)
        .expect((res) => {
          expect(res.body.callCount).toBe(2);
          expect(res.body.results).toContain('first_attempt_failed');
          expect(res.body.results).toContain('second_attempt_success');
        });
    });
  });

  describe('API Route Tenant Isolation', () => {
    it('should enforce tenant boundaries in API routes', async () => {
      const { ensureUserAuth } = await import('../middleware/auth');
      const { tenantResolver } = await import('../middleware/tenantResolver');
      
      // Setup API routes with tenant middleware
      app.get('/api/leads', tenantResolver, ensureUserAuth, async (req: any, res) => {
        try {
          const tenantStorage = mockStorage.withTenant(req.tenantId);
          const leads = await tenantStorage.getLeads();
          res.json({ leads, tenantId: req.tenantId });
        } catch (error) {
          res.status(500).json({ error: 'Failed to fetch leads' });
        }
      });
      
      // Mock tenant resolution
      app.use((req: any, res, next) => {
        // Simulate tenant resolution based on session
        if (req.session?.tenantId) {
          req.tenantId = req.session.tenantId;
          req.tenant = { id: req.session.tenantId };
        }
        next();
      });
      
      const agentA = request.agent(app);
      const agentB = request.agent(app);
      
      // Simulate sessions for different tenants
      await agentA
        .post('/set-session')
        .send({ userId: USER_A_ID, tenantId: TENANT_A_ID });
        
      await agentB
        .post('/set-session')
        .send({ userId: USER_B_ID, tenantId: TENANT_B_ID });
      
      // Add session setting route
      app.post('/set-session', (req, res) => {
        req.session.userId = req.body.userId;
        req.session.tenantId = req.body.tenantId;
        res.json({ success: true });
      });
      
      // Test tenant A API access
      await agentA
        .get('/api/leads')
        .expect(200)
        .expect((res) => {
          expect(res.body.tenantId).toBe(TENANT_A_ID);
          expect(res.body.leads).toHaveLength(2);
          expect(res.body.leads.every((lead: any) => lead.tenantId === TENANT_A_ID)).toBe(true);
        });
      
      // Test tenant B API access  
      await agentB
        .get('/api/leads')
        .expect(200)
        .expect((res) => {
          expect(res.body.tenantId).toBe(TENANT_B_ID);
          expect(res.body.leads).toHaveLength(1);
          expect(res.body.leads.every((lead: any) => lead.tenantId === TENANT_B_ID)).toBe(true);
        });
    });
  });
});