import { storage } from '../../storage';
import { emailSyncService } from './emailSync';
import { log } from '../../vite';

/**
 * Auto-sync service for Gmail email synchronization across all users with Google integrations
 * This service periodically syncs emails for all users who have active Google calendar integrations
 */
export class EmailAutoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds
  private isRunning = false;
  private inProgressByUser = new Set<string>();

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
   * Perform auto-sync for all users with active Google integrations
   * This method is now public so job handlers can call it safely
   */
  async performAutoSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Email auto-sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      log('🔄 Starting email auto-sync...');
      
      // Get all active Google calendar integrations (which contain the OAuth tokens we need)
      const integrations = await storage.getCalendarIntegrations();
      const activeGoogleIntegrations = integrations.filter(integration => 
        integration.provider === 'google' && 
        integration.isActive && 
        integration.accessToken &&
        integration.userId // Ensure userId is present
      );

      if (activeGoogleIntegrations.length === 0) {
        log('📭 No active Google integrations found for email auto-sync');
        return;
      }

      // Get unique user IDs to sync
      const userIdSet = new Set<string>();
      activeGoogleIntegrations.forEach(i => {
        if (i.userId) {
          userIdSet.add(i.userId);
        }
      });
      const uniqueUserIds = Array.from(userIdSet);
      console.log(`🎯 Found ${uniqueUserIds.length} unique users with Google integrations to sync emails for`);

      let successCount = 0;
      let errorCount = 0;

      // Sync emails for each user
      for (const userId of uniqueUserIds) {
        // Skip if this user's sync is already in progress
        if (this.inProgressByUser.has(userId)) {
          console.log(`⚠️  Email sync already in progress for user ${userId}, skipping...`);
          continue;
        }

        try {
          this.inProgressByUser.add(userId);
          console.log(`🔄 Auto-syncing emails for user: ${userId}`);
          
          const result = await emailSyncService.syncGmailThreadsToDatabase(userId);
          
          if (result.synced > 0 || result.skipped > 0) {
            console.log(`✅ Email sync completed for user ${userId}: ${result.synced} synced, ${result.skipped} skipped`);
            
            // Update lastSyncAt and clear errors for all of this user's Google integrations
            const userGoogleIntegrations = activeGoogleIntegrations.filter(i => i.userId === userId);
            for (const integration of userGoogleIntegrations) {
              await storage.updateCalendarIntegration(integration.id, {
                lastSyncAt: new Date(),
                syncErrors: null
              });
            }
            
            successCount++;
          } else if (result.errors.length > 0) {
            throw new Error(result.errors.join('; '));
          }
          
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to auto-sync emails for user ${userId}:`, errorMessage);
          
          // Update syncErrors for all of this user's Google integrations
          const userGoogleIntegrations = activeGoogleIntegrations.filter(i => i.userId === userId);
          const errorWithTimestamp = `${new Date().toISOString()}: ${errorMessage}`;
          
          for (const integration of userGoogleIntegrations) {
            await storage.updateCalendarIntegration(integration.id, {
              syncErrors: errorWithTimestamp
            });
          }
        } finally {
          this.inProgressByUser.delete(userId);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Email auto-sync completed in ${duration}ms - Success: ${successCount}, Errors: ${errorCount}`);
      
    } catch (error) {
      console.error('❌ Email auto-sync service encountered an error:', error);
    } finally {
      this.isRunning = false;
    }
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
      
      const { emailSyncService } = await import('./emailSync');
      return await emailSyncService.syncGmailThreadsToDatabase(userId);
      
    } finally {
      this.inProgressByUser.delete(userId);
    }
  }
}

// Create singleton instance
export const emailAutoSyncService = new EmailAutoSyncService();