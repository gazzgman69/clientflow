import { storage } from '../../storage';
import { googleOAuthService } from './google-oauth';
import { icalService } from './ical';

/**
 * Auto-sync service for calendar integrations
 * Runs every 3 minutes to keep calendar data synchronized
 */
export class CalendarAutoSyncService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds
  private isRunning = false;

  /**
   * Start the auto-sync service
   */
  start(): void {
    if (this.intervalId) {
      console.log('📅 Calendar auto-sync service is already running');
      return;
    }

    console.log('🚀 Starting calendar auto-sync service (every 3 minutes)');
    
    // Run initial sync after 30 seconds to let the server fully initialize
    setTimeout(() => {
      this.performAutoSync().catch(err => console.error('❌ Initial calendar sync error:', err));
    }, 30000);

    // Set up recurring sync every 3 minutes
    this.intervalId = setInterval(() => {
      this.performAutoSync().catch(err => console.error('❌ Scheduled calendar sync error:', err));
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
   * This method is now public so job handlers can call it safely
   */
  async performAutoSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Auto-sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // CRITICAL FIX: Get active tenants and process per tenant to ensure isolation
      const activeTenants = await storage.getActiveTenants();

      if (activeTenants.length === 0) {
        return;
      }

      let allActiveIntegrations: any[] = [];

      // Collect integrations from all tenants
      for (const tenant of activeTenants) {
        const tenantIntegrations = await storage.getCalendarIntegrationsByTenant(tenant.id);
        const activeTenantIntegrations = tenantIntegrations.filter(integration =>
          integration.isActive &&
          (integration.provider === 'google' || integration.provider === 'ical')
        );

        // Add tenant context to each integration for later use
        const integrationsWithTenant = activeTenantIntegrations.map(integration => ({
          ...integration,
          _tenantContext: tenant.id
        }));

        allActiveIntegrations.push(...integrationsWithTenant);
      }

      const activeIntegrations = allActiveIntegrations;

      if (activeIntegrations.length === 0) {
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      // Sync each integration
      for (const integration of activeIntegrations) {
        try {
          let result;
          if (integration.provider === 'google') {
            // One-way export: push CRM events to Google Calendar only
            // Google → CRM import is disabled to keep personal calendar events out of ClientFlow
            result = await googleOAuthService.syncToGoogleAll(integration);
          } else if (integration.provider === 'ical') {
            // For iCal, we need to get a userId. Since this is auto-sync, we'll use the integration's userId
            result = await icalService.syncFromICal(integration);
          }

          // Update last sync time
          await storage.updateCalendarIntegration(integration.id, {
            lastSyncAt: new Date(),
            syncErrors: null // Clear any previous errors
          }, integration.tenantId);

          successCount++;

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
          }, integration.tenantId);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`🎉 Calendar auto-sync completed in ${duration}ms`);

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