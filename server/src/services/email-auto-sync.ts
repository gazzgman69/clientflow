import { storage } from '../../storage';
import { emailSyncService } from './emailSync';
import { log } from '../../vite';
import { db } from '../../db';
import { and, eq } from 'drizzle-orm';

/**
 * Auto-sync service for Gmail email synchronization across all tenants
 * This service enumerates all active tenants and processes email sync per tenant
 * with proper isolation, jitter/backoff, and feature flag support
 */
export class EmailAutoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds
  private isRunning = false;
  private inProgressByUser = new Set<string>();
  private lastSyncByTenant = new Map<string, number>();
  private retryCountByTenant = new Map<string, number>();
  private readonly MAX_RETRIES = 3;
  private readonly BASE_BACKOFF_MS = 5000; // 5 seconds base backoff

  /**
   * Start the auto-sync service
   */
  start(): void {
    if (this.intervalId) {
      console.log('📧 Email auto-sync service is already running');
      return;
    }

    console.log('🚀 Starting email auto-sync service (every 3 minutes)');
    
    // Run initial sync after 30 seconds to let the server fully initialize
    setTimeout(() => {
      log('⏱️ Initial email sync timer fired');
      this.performAutoSync().catch(err => log('❌ Initial email sync error:', err));
    }, 30000);

    // Set up recurring sync every 3 minutes
    this.intervalId = setInterval(() => {
      log('⏱️ Scheduled email sync timer fired');
      this.performAutoSync().catch(err => log('❌ Scheduled email sync error:', err));
    }, this.SYNC_INTERVAL);

    console.log('✅ Email auto-sync service started successfully');
  }

  /**
   * Stop the auto-sync service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  Email auto-sync service stopped');
    }
  }

  /**
   * Perform auto-sync for all tenants with proper isolation and feature flags
   * This method enumerates all active tenants and processes each with tenant-scoped storage
   */
  async performAutoSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Email auto-sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      // Get active tenants and process per tenant to ensure isolation
      const activeTenants = await storage.getActiveTenants();

      if (activeTenants.length === 0) {
        return;
      }
      
      let totalSuccessCount = 0;
      let totalErrorCount = 0;

      // Process each tenant with proper isolation
      for (const tenant of activeTenants) {
        try {
          const tenantStorage = storage.withTenant(tenant.id);
          
          // Check if email sync is enabled for this tenant via feature flag
          const { userPrefsService } = await import('./userPrefs');
          const emailSyncEnabled = await userPrefsService.getUserPref(tenant.id, 'emailSyncEnabled');
          if (emailSyncEnabled === 'false') {
            log(`📭 Email sync disabled for tenant ${tenant.id} via feature flag`);
            continue;
          }
          
          // Apply backoff if tenant had recent failures
          const retryCount = this.retryCountByTenant.get(tenant.id) || 0;
          if (retryCount > 0) {
            const backoffMs = this.BASE_BACKOFF_MS * Math.pow(2, retryCount - 1);
            const lastSync = this.lastSyncByTenant.get(tenant.id) || 0;
            const timeSinceLastSync = Date.now() - lastSync;
            
            if (timeSinceLastSync < backoffMs) {
              log(`⏳ Tenant ${tenant.id} in backoff (${Math.round((backoffMs - timeSinceLastSync) / 1000)}s remaining)`);
              continue;
            }
          }
          
          // Process tenant email sync
          
          // Get Gmail OAuth connections from email_accounts for this tenant only
          const { emailAccounts: emailAccountsTable } = await import('@shared/schema');
          const gmailAccounts = await db
            .select()
            .from(emailAccountsTable)
            .where(
              and(
                eq(emailAccountsTable.tenantId, tenant.id),
                eq(emailAccountsTable.providerKey, 'google'),
                eq(emailAccountsTable.status, 'connected')
              )
            );
          
          if (gmailAccounts.length === 0) {
            log(`📭 No active Gmail OAuth connections for tenant ${tenant.id}`);
            continue;
          }
          
          // Get unique user IDs for this tenant
          const userIds = [...new Set(gmailAccounts.map(account => account.userId).filter(Boolean))];
          // Process each user's Gmail sync
          
          let tenantSuccessCount = 0;
          let tenantErrorCount = 0;
          
          // Add jitter to avoid thundering herd
          const jitterMs = Math.random() * 2000; // 0-2 seconds jitter
          await new Promise(resolve => setTimeout(resolve, jitterMs));
          
          // Process each user with tenant context
          for (const userId of userIds) {
            if (this.inProgressByUser.has(userId)) {
              console.log(`⚠️  Email sync already in progress for user ${userId}, skipping...`);
              continue;
            }
            
            try {
              this.inProgressByUser.add(userId);
              console.log(`🔄 Syncing emails for user ${userId} in tenant ${tenant.id}`);
              
              // Use tenant-scoped email sync
              const result = await this.syncEmailsForTenant(userId, tenant.id);
              
              if (result.synced > 0 || result.skipped > 0) {
                console.log(`✅ Tenant ${tenant.id} user ${userId}: ${result.synced} synced, ${result.skipped} skipped`);
                
                // Update last sync time for email accounts
                const userAccounts = gmailAccounts.filter(account => account.userId === userId);
                const { emailAccounts: emailAccountsTable } = await import('@shared/schema');
                for (const account of userAccounts) {
                  await db
                    .update(emailAccountsTable)
                    .set({ lastSyncedAt: new Date() })
                    .where(eq(emailAccountsTable.id, account.id));
                }
                
                tenantSuccessCount++;
              } else if (result.errors.length > 0) {
                throw new Error(result.errors.join('; '));
              }
              
            } catch (error) {
              tenantErrorCount++;
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`❌ Failed to sync emails for user ${userId} in tenant ${tenant.id}:`, errorMessage);
              
              // Log errors for email accounts (we don't update account status on sync errors)
              console.log(`📝 Email sync error logged for user ${userId}: ${errorMessage}`);
            } finally {
              this.inProgressByUser.delete(userId);
            }
          }
          
          // Update tenant sync tracking
          this.lastSyncByTenant.set(tenant.id, Date.now());
          
          if (tenantErrorCount > 0) {
            // Increment retry count for backoff
            const currentRetries = this.retryCountByTenant.get(tenant.id) || 0;
            this.retryCountByTenant.set(tenant.id, Math.min(currentRetries + 1, this.MAX_RETRIES));
          } else {
            // Reset retry count on success
            this.retryCountByTenant.set(tenant.id, 0);
          }
          
          totalSuccessCount += tenantSuccessCount;
          totalErrorCount += tenantErrorCount;
          
          console.log(`🏢 Tenant ${tenant.id} sync completed: ${tenantSuccessCount} success, ${tenantErrorCount} errors`);
          
        } catch (error) {
          console.error(`❌ Failed to process tenant ${tenant.id}:`, error);
          totalErrorCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Multi-tenant email sync completed in ${duration}ms - Success: ${totalSuccessCount}, Errors: ${totalErrorCount}`);
      
    } catch (error) {
      console.error('❌ Email auto-sync service encountered an error:', error);
    } finally {
      this.isRunning = false;
    }
  }
  
  /**
   * Sync emails for a specific user within a tenant context
   */
  private async syncEmailsForTenant(userId: string, tenantId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const { EmailSyncService } = await import('./emailSync');
    // Instantiate EmailSyncService with tenant context
    const emailSyncService = new EmailSyncService(tenantId);
    return await emailSyncService.syncGmailThreadsToDatabase(userId);
  }

  /**
   * Sync emails for a specific user (safe for job handlers)
   */
  async syncEmailsForUser(userId: string): Promise<{ synced: number; skipped: number; errors: string[] }> {
    if (this.inProgressByUser.has(userId)) {
      throw new Error(`Email sync already in progress for user ${userId}`);
    }

    try {
      this.inProgressByUser.add(userId);
      console.log(`🔄 Job-triggered email sync for user: ${userId}`);
      
      // We need to get the user's tenant to provide proper context
      const user = await storage.getUserGlobal(userId);
      if (!user || !user.tenantId) {
        throw new Error(`Cannot find tenant context for user ${userId}`);
      }
      
      const { EmailSyncService } = await import('./emailSync');
      const emailSyncService = new EmailSyncService(user.tenantId);
      return await emailSyncService.syncGmailThreadsToDatabase(userId);
      
    } finally {
      this.inProgressByUser.delete(userId);
    }
  }
}

// Create singleton instance
export const emailAutoSyncService = new EmailAutoSyncService();