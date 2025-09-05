import { storage } from '../storage';
import { googleOAuthService } from './google-oauth';
import { icalService } from './ical';

/**
 * Auto-sync service for calendar integrations
 * Runs every 5 minutes to keep calendar data synchronized
 */
export class CalendarAutoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private isRunning = false;

  /**
   * Start the auto-sync service
   */
  start(): void {
    if (this.intervalId) {
      console.log('📅 Calendar auto-sync service is already running');
      return;
    }

    console.log('🚀 Starting calendar auto-sync service (every 5 minutes)');
    
    // Run initial sync after 30 seconds to let the server fully initialize
    setTimeout(() => {
      this.performAutoSync();
    }, 30000);

    // Set up recurring sync every 5 minutes
    this.intervalId = setInterval(() => {
      this.performAutoSync();
    }, this.SYNC_INTERVAL);

    console.log('✅ Calendar auto-sync service started successfully');
  }

  /**
   * Stop the auto-sync service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️  Calendar auto-sync service stopped');
    }
  }

  /**
   * Perform auto-sync for all active integrations
   */
  private async performAutoSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Auto-sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('🔄 Starting calendar auto-sync...');
      
      // Get all active calendar integrations
      const integrations = await storage.getCalendarIntegrations();
      const activeIntegrations = integrations.filter(integration => 
        integration.isActive && 
        (integration.provider === 'google' || integration.provider === 'ical')
      );

      if (activeIntegrations.length === 0) {
        console.log('📭 No active calendar integrations found for auto-sync');
        return;
      }

      console.log(`🎯 Found ${activeIntegrations.length} active integrations to sync`);

      let successCount = 0;
      let errorCount = 0;

      // Sync each integration
      for (const integration of activeIntegrations) {
        try {
          console.log(`🔄 Auto-syncing ${integration.provider} integration: ${integration.calendarName}`);
          
          let result;
          if (integration.provider === 'google') {
            result = await googleOAuthService.syncFromGoogle(integration);
          } else if (integration.provider === 'ical') {
            // For iCal, we need to get a userId. Since this is auto-sync, we'll use the integration's userId
            result = await icalService.syncFromICal(integration);
          }

          // Update last sync time
          await storage.updateCalendarIntegration(integration.id, {
            lastSyncAt: new Date(),
            syncErrors: null // Clear any previous errors
          });

          successCount++;
          console.log(`✅ Successfully auto-synced ${integration.calendarName}`);
          
        } catch (error: any) {
          errorCount++;
          const errorMessage = error.message || 'Unknown error occurred during auto-sync';
          console.error(`❌ Auto-sync failed for ${integration.calendarName}:`, errorMessage);
          
          // Log the error to the integration
          await storage.updateCalendarIntegration(integration.id, {
            syncErrors: JSON.stringify({ 
              error: errorMessage, 
              timestamp: new Date(),
              type: 'auto-sync'
            })
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Calendar auto-sync completed in ${duration}ms - Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error: any) {
      console.error('💥 Critical error in calendar auto-sync service:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current status of the auto-sync service
   */
  getStatus(): { running: boolean; intervalMs: number; syncInProgress: boolean } {
    return {
      running: this.intervalId !== null,
      intervalMs: this.SYNC_INTERVAL,
      syncInProgress: this.isRunning
    };
  }
}

// Export singleton instance
export const calendarAutoSyncService = new CalendarAutoSyncService();