import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DrizzleStorage } from '../storage';
import { userPrefs, messageThreads, quoteItems } from '@shared/schema';

describe('Tenant Enforcement Integration Tests', () => {
  let storage: DrizzleStorage;
  
  beforeEach(() => {
    storage = new DrizzleStorage();
  });

  describe('UserPrefs Service Security', () => {
    it('should isolate user preferences by tenant', async () => {
      const userPrefsService = (storage as any).userPrefsService || new (await import('../src/services/userPrefs')).UserPrefsService();
      
      // Create preferences for two different tenants
      await userPrefsService.setUserPref('user1', 'tenant-a', 'theme', 'dark');
      await userPrefsService.setUserPref('user1', 'tenant-b', 'theme', 'light');
      
      // Verify tenant isolation
      const tenantAPrefs = await userPrefsService.getUserPrefs('user1', 'tenant-a');
      const tenantBPrefs = await userPrefsService.getUserPrefs('user1', 'tenant-b');
      
      expect(tenantAPrefs.theme).toBe('dark');
      expect(tenantBPrefs.theme).toBe('light');
      
      // Verify no cross-tenant data leakage
      expect(tenantAPrefs.theme).not.toBe(tenantBPrefs.theme);
    });
    
    it('should prevent cross-tenant preference access', async () => {
      const userPrefsService = (storage as any).userPrefsService || new (await import('../src/services/userPrefs')).UserPrefsService();
      
      await userPrefsService.setUserPref('user1', 'tenant-a', 'secret', 'tenant-a-data');
      
      // Attempt to access from different tenant should return empty
      const wrongTenantPrefs = await userPrefsService.getUserPrefs('user1', 'tenant-b');
      expect(wrongTenantPrefs.secret).toBeUndefined();
    });
  });

  describe('Message Threads Security', () => {
    it('should enforce tenant isolation in message thread operations', async () => {
      const thread1Data = {
        tenantId: 'tenant-a',
        subject: 'Secret Discussion A',
        participants: ['user@tenant-a.com'],
        leadId: null,
        contactId: null,
        clientId: null,
        projectId: null,
        lastMessageAt: null
      };
      
      const thread2Data = {
        tenantId: 'tenant-b', 
        subject: 'Secret Discussion B',
        participants: ['user@tenant-b.com'],
        leadId: null,
        contactId: null,
        clientId: null,
        projectId: null,
        lastMessageAt: null
      };
      
      // Create threads for different tenants
      const thread1 = await storage.createMessageThread(thread1Data);
      const thread2 = await storage.createMessageThread(thread2Data);
      
      // Verify tenant-scoped retrieval
      const tenantAThreads = await storage.getMessageThreads('tenant-a');
      const tenantBThreads = await storage.getMessageThreads('tenant-b');
      
      expect(tenantAThreads).toHaveLength(1);
      expect(tenantBThreads).toHaveLength(1);
      expect(tenantAThreads[0].subject).toBe('Secret Discussion A');
      expect(tenantBThreads[0].subject).toBe('Secret Discussion B');
      
      // Verify cross-tenant access prevention
      const threadFromWrongTenant = await storage.getMessageThread(thread1.id, 'tenant-b');
      expect(threadFromWrongTenant).toBeUndefined();
    });
    
    it('should require tenantId for message thread creation', async () => {
      const invalidThreadData = {
        subject: 'Missing Tenant',
        participants: ['user@example.com'],
        leadId: null,
        contactId: null,
        clientId: null,
        projectId: null,
        lastMessageAt: null
        // Missing tenantId
      };
      
      await expect(storage.createMessageThread(invalidThreadData as any))
        .rejects.toThrow('tenantId is required for message thread creation');
    });
  });

  describe('Quote Items Security', () => {
    it('should isolate quote items by tenant', async () => {
      // First create mock quotes (assuming quotes exist)
      const quote1Id = 'quote-tenant-a';
      const quote2Id = 'quote-tenant-b';
      
      const item1Data = {
        tenantId: 'tenant-a',
        quoteId: quote1Id,
        type: 'package',
        packageId: null,
        addonId: null,
        name: 'Premium Package A',
        description: 'Tenant A Package',
        quantity: 1,
        unitPrice: '1000.00',
        vatRate: '0.20',
        lineTotal: '1200.00'
      };
      
      const item2Data = {
        tenantId: 'tenant-b',
        quoteId: quote2Id,
        type: 'package', 
        packageId: null,
        addonId: null,
        name: 'Premium Package B',
        description: 'Tenant B Package',
        quantity: 1,
        unitPrice: '2000.00',
        vatRate: '0.20',
        lineTotal: '2400.00'
      };
      
      // Create quote items for different tenants
      const item1 = await storage.createQuoteItem(item1Data);
      const item2 = await storage.createQuoteItem(item2Data);
      
      // Verify tenant-scoped retrieval
      const tenantAItems = await storage.getQuoteItems(quote1Id, 'tenant-a');
      const tenantBItems = await storage.getQuoteItems(quote2Id, 'tenant-b');
      
      expect(tenantAItems).toHaveLength(1);
      expect(tenantBItems).toHaveLength(1);
      expect(tenantAItems[0].name).toBe('Premium Package A');
      expect(tenantBItems[0].name).toBe('Premium Package B');
      
      // Verify cross-tenant access prevention
      const wrongTenantItems = await storage.getQuoteItems(quote1Id, 'tenant-b');
      expect(wrongTenantItems).toHaveLength(0);
    });
    
    it('should require tenantId for quote item creation', async () => {
      const invalidItemData = {
        quoteId: 'some-quote',
        type: 'package',
        name: 'Missing Tenant Item',
        description: 'This should fail',
        quantity: 1,
        unitPrice: '100.00',
        vatRate: '0.20',
        lineTotal: '120.00'
        // Missing tenantId
      };
      
      await expect(storage.createQuoteItem(invalidItemData as any))
        .rejects.toThrow('tenantId is required for quote item creation');
    });
  });

  describe('Tenant-Scoped Storage Wrapper', () => {
    it('should provide tenant-scoped operations', async () => {
      const tenantScopedStorage = storage.withTenant('tenant-test');
      
      // All operations through this instance should be automatically scoped
      expect(tenantScopedStorage).toBeDefined();
      expect((tenantScopedStorage as any).tenantId).toBe('tenant-test');
    });
  });
});