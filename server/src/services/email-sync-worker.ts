import { storage } from '../../storage';
import { GmailEmailProvider } from './email-provider-gmail';
import { MicrosoftEmailProvider } from './email-provider-microsoft';

export class EmailSyncWorker {
  private gmailProvider: GmailEmailProvider;
  private microsoftProvider: MicrosoftEmailProvider;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.gmailProvider = new GmailEmailProvider();
    this.microsoftProvider = new MicrosoftEmailProvider();
  }

  /**
   * Start the sync worker with specified interval
   * @param intervalMinutes - How often to sync (default: 5 minutes)
   */
  start(intervalMinutes: number = 5) {
    if (this.isRunning) {
      console.log('📬 Email sync worker already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`📬 Starting email sync worker (interval: ${intervalMinutes} minutes)`);

    // Run immediately on start
    this.syncAll().catch(error => {
      console.error('❌ Initial email sync failed:', error);
    });

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.syncAll().catch(error => {
        console.error('❌ Scheduled email sync failed:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop the sync worker
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('📬 Email sync worker stopped');
  }

  /**
   * Sync emails for all active integrations
   */
  private async syncAll() {
    try {
      console.log(JSON.stringify({
        event: 'email_sync_started',
        timestamp: new Date().toISOString()
      }));

      // Get all active email provider integrations
      const integrations = await storage.getAllActiveEmailIntegrations();

      if (integrations.length === 0) {
        console.log('📬 No active email integrations to sync');
        return;
      }

      console.log(`📬 Syncing ${integrations.length} email integration(s)`);

      let totalIngested = 0;
      let totalSkipped = 0;

      for (const integration of integrations) {
        try {
          let result;

          if (integration.provider === 'google') {
            result = await this.gmailProvider.syncContactsOnly({
              tenantId: integration.tenantId,
              userId: integration.userId,
              integration
            });
          } else if (integration.provider === 'microsoft') {
            result = await this.microsoftProvider.syncContactsOnly({
              tenantId: integration.tenantId,
              userId: integration.userId,
              integration
            });
          } else {
            console.warn(`⚠️ Unknown provider: ${integration.provider}`);
            continue;
          }

          totalIngested += result.ingested;
          totalSkipped += result.skipped;

          // Update last synced timestamp
          await storage.updateEmailIntegrationLastSync(
            integration.userId,
            integration.tenantId,
            integration.provider
          );

          console.log(JSON.stringify({
            event: 'email_sync_completed',
            provider: integration.provider,
            tenantId: integration.tenantId,
            userId: integration.userId,
            ingested: result.ingested,
            skipped: result.skipped,
            timestamp: new Date().toISOString()
          }));
        } catch (error: any) {
          console.error(JSON.stringify({
            event: 'email_sync_error',
            provider: integration.provider,
            tenantId: integration.tenantId,
            userId: integration.userId,
            error: error.message,
            timestamp: new Date().toISOString()
          }));

          // Mark integration as error status if sync fails
          await storage.updateEmailIntegrationStatus(
            integration.userId,
            integration.tenantId,
            integration.provider,
            'error'
          );
        }
      }

      console.log(JSON.stringify({
        event: 'email_sync_batch_completed',
        totalIntegrations: integrations.length,
        totalIngested,
        totalSkipped,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      console.error('❌ Email sync worker error:', error);
    }
  }

  /**
   * Manually trigger a sync for a specific user
   */
  async syncUser(userId: string, tenantId: string) {
    try {
      console.log(`📬 Manual sync requested for user ${userId}`);

      // Get Google integration
      const googleIntegration = await storage.getEmailProviderIntegration(
        userId,
        tenantId,
        'google'
      );

      if (googleIntegration && googleIntegration.status === 'connected') {
        const result = await this.gmailProvider.syncContactsOnly({
          tenantId,
          userId,
          integration: googleIntegration
        });

        await storage.updateEmailIntegrationLastSync(
          userId,
          tenantId,
          'google'
        );

        console.log(`📬 Gmail sync: ingested ${result.ingested}, skipped ${result.skipped}`);
      }

      // Get Microsoft integration
      const microsoftIntegration = await storage.getEmailProviderIntegration(
        userId,
        tenantId,
        'microsoft'
      );

      if (microsoftIntegration && microsoftIntegration.status === 'connected') {
        const result = await this.microsoftProvider.syncContactsOnly({
          tenantId,
          userId,
          integration: microsoftIntegration
        });

        await storage.updateEmailIntegrationLastSync(
          userId,
          tenantId,
          'microsoft'
        );

        console.log(`📬 Microsoft sync: ingested ${result.ingested}, skipped ${result.skipped}`);
      }
    } catch (error: any) {
      console.error(`❌ Manual sync failed for user ${userId}:`, error);
      throw error;
    }
  }
}

// Export singleton
export const emailSyncWorker = new EmailSyncWorker();
