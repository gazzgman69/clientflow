/**
 * Global Jobs Service
 * 
 * Provides a simple `jobs.enqueue()` wrapper for background job processing.
 * This service abstracts the job queue implementation and provides a clean
 * interface for enqueueing background tasks throughout the application.
 */

import { PostgreSQLJobQueue } from './jobs/PostgreSQLJobQueue';
import { IJobQueue, JobPriority, JobSchedule } from '../interfaces/jobs';

/**
 * Singleton job queue instance - now with persistent storage
 */
export const jobQueue: IJobQueue = new PostgreSQLJobQueue({
  maxConcurrentJobs: 3, // Conservative for CRM workload
  defaultMaxRetries: 3,
  retryDelay: 2000, // 2 seconds base retry delay
  jobTimeout: 180000, // 3 minutes timeout for jobs (increased for email sync)
  cleanupInterval: 300000, // 5 minutes cleanup interval
  maxJobAge: 86400000, // 24 hours max job age
});

/**
 * Simple jobs service wrapper providing clean enqueue interface
 */
class JobsService {
  /**
   * Enqueue a background job for processing
   * @param type Job type (e.g., 'email-sync', 'calendar-sync', 'send-email')
   * @param payload Job data
   * @param options Job options including tenantId for isolation
   * @returns Job ID
   */
  async enqueue(
    type: string,
    payload: any,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      delay?: number; // Delay in milliseconds
      schedule?: JobSchedule; // For recurring jobs
      tenantId?: string; // SECURITY: Required for tenant isolation
    } = {}
  ): Promise<string> {
    return await jobQueue.enqueue(type, payload, options);
  }

  /**
   * Enqueue a high-priority job
   */
  async enqueueHigh(type: string, payload: any, options: any = {}): Promise<string> {
    return this.enqueue(type, payload, { ...options, priority: 'high' });
  }

  /**
   * Enqueue a low-priority job
   */
  async enqueueLow(type: string, payload: any, options: any = {}): Promise<string> {
    return this.enqueue(type, payload, { ...options, priority: 'low' });
  }

  /**
   * Enqueue a delayed job
   */
  async enqueueDelayed(
    type: string,
    payload: any,
    delayMs: number,
    options: any = {}
  ): Promise<string> {
    return this.enqueue(type, payload, { ...options, delay: delayMs });
  }

  /**
   * Enqueue a recurring job
   */
  async enqueueRecurring(
    type: string,
    payload: any,
    intervalMs: number,
    options: any = {}
  ): Promise<string> {
    return this.enqueue(type, payload, {
      ...options,
      schedule: { type: 'interval', value: intervalMs },
    });
  }

  /**
   * Get job queue statistics
   */
  async getStats() {
    return await jobQueue.getStats();
  }

  /**
   * Get recent job executions for monitoring
   */
  async getRecentExecutions(limit?: number) {
    return await jobQueue.getRecentExecutions(limit);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return await jobQueue.cancelJob(jobId);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    return await jobQueue.retryJob(jobId);
  }

  /**
   * Register a job handler
   */
  registerHandler(type: string, handler: (payload: any) => Promise<any>): void {
    jobQueue.registerHandler(type, handler);
  }

  /**
   * Initialize the jobs service
   */
  async initialize(): Promise<void> {
    console.log('📋 INIT STEP 1: Initializing jobs service...');
    
    // Register built-in job handlers
    console.log('📋 INIT STEP 2: Registering built-in handlers...');
    this.registerBuiltInHandlers();
    
    // Start the job queue
    console.log('📋 INIT STEP 3: Starting job queue...');
    await jobQueue.start();
    
    console.log('✅ INIT COMPLETE: Jobs service initialized successfully');
  }

  /**
   * Shutdown the jobs service
   */
  async shutdown(): Promise<void> {
    console.log('📋 Shutting down jobs service...');
    await jobQueue.stop();
    console.log('✅ Jobs service shutdown complete');
  }

  /**
   * Register handlers for common job types
   */
  private registerBuiltInHandlers(): void {
    // Email sync job handler
    this.registerHandler('email-sync', async (payload) => {
      // Email sync job starting
      
      // Import email sync service dynamically to avoid circular dependencies
      const { emailAutoSyncService } = await import('./email-auto-sync');
      
      if (payload.userId) {
        // Sync for specific user
        await emailAutoSyncService.syncEmailsForUser(payload.userId);
      } else {
        // Sync for all users
        await emailAutoSyncService.performAutoSync();
      }
      
      return { synced: true, timestamp: new Date().toISOString() };
    });

    // Calendar sync job handler
    this.registerHandler('calendar-sync', async (payload) => {
      // Calendar sync job starting
      
      // Import calendar service dynamically
      const { calendarAutoSyncService } = await import('./calendar-auto-sync');
      
      await calendarAutoSyncService.performAutoSync();
      
      return { synced: true, timestamp: new Date().toISOString() };
    });

    // Lead automation job handler
    this.registerHandler('lead-automation', async (payload) => {
      console.log('🤖 Processing lead automation job:', payload);
      
      // Import lead automation service dynamically
      const { leadAutomationService } = await import('./lead-automation');
      
      await leadAutomationService.runTick(payload.timestamp ? new Date(payload.timestamp) : undefined);
      
      return { processed: true, timestamp: new Date().toISOString() };
    });

    // Generic email sending job handler
    this.registerHandler('send-email', async (payload) => {
      console.log('📧 Processing send email job:', payload);
      
      // Import Gmail service for sending
      const { gmailService } = await import('./gmail');
      
      const result = await gmailService.sendEmail(
        payload.userId,
        payload.to,
        payload.subject,
        payload.body,
        payload.options || {}
      );
      
      return { sent: result.success, messageId: result.messageId };
    });

    // File cleanup job handler
    this.registerHandler('file-cleanup', async (payload) => {
      console.log('🗄️ Processing file cleanup job:', payload);
      
      // Import attachments service for cleanup
      const { attachmentsService } = await import('./attachments');
      
      const cleanedCount = await attachmentsService.cleanupOldAttachments(payload.daysOld || 30);
      
      return { cleanedCount, timestamp: new Date().toISOString() };
    });

    // Booking reminder job handler — runs every hour, sends reminders for upcoming bookings
    this.registerHandler('booking-reminders', async (_payload) => {
      console.log('📅 Processing booking reminder job');

      const { storage } = await import('../../storage');
      const { emailDispatcher } = await import('./email-dispatcher');

      // Get all tenants
      const tenants = await storage.getActiveTenants();
      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          const bookings = await storage.getBookings(tenant.id);
          const now = new Date();

          for (const booking of bookings) {
            // Only confirmed/pending bookings that haven't had a reminder sent
            if (booking.status === 'cancelled' || booking.status === 'completed') continue;
            if (booking.reminderSentAt) continue;
            if (!booking.clientEmail) continue;

            // Get the service to find reminderDaysBefore
            const service = await storage.getBookableService(booking.serviceId, tenant.id);
            const reminderDaysBefore = (service as any)?.reminderDaysBefore ?? 1;

            // Calculate reminder window: send reminder if booking is within reminderDaysBefore days
            const bookingDate = new Date(booking.bookingDate);
            const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            const hoursWindow = reminderDaysBefore * 24;

            // Send if within the reminder window (and at least 1 hour away)
            if (hoursUntilBooking > 1 && hoursUntilBooking <= hoursWindow) {
              const serviceName = service?.name || 'your appointment';
              const dateStr = bookingDate.toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              });

              // Use custom template if configured
              let subject = `Reminder: ${serviceName} tomorrow`;
              let html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Booking Reminder</h2>
                  <p>Hi ${booking.clientName},</p>
                  <p>This is a friendly reminder about your upcoming booking:</p>
                  <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
                    <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Service</strong></td>
                        <td style="padding:8px; border:1px solid #e5e7eb;">${serviceName}</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Date</strong></td>
                        <td style="padding:8px; border:1px solid #e5e7eb;">${dateStr}</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Time</strong></td>
                        <td style="padding:8px; border:1px solid #e5e7eb;">${booking.bookingTime}</td></tr>
                    ${service?.location ? `<tr><td style="padding:8px; border:1px solid #e5e7eb;"><strong>Location</strong></td>
                        <td style="padding:8px; border:1px solid #e5e7eb;">${service.location}${(service as any).locationDetails ? ` — ${(service as any).locationDetails}` : ''}</td></tr>` : ''}
                  </table>
                  <p style="color:#6b7280; font-size:14px;">If you need to make any changes, please get in touch as soon as possible.</p>
                </div>
              `;

              if ((service as any)?.reminderMessageTemplateId) {
                const template = await storage.getMessageTemplate(
                  (service as any).reminderMessageTemplateId,
                  tenant.id
                );
                if (template) {
                  subject = (template as any).subject || subject;
                  const vars: Record<string, string> = {
                    '{{clientName}}': booking.clientName || '',
                    '{{serviceName}}': serviceName,
                    '{{bookingDate}}': dateStr,
                    '{{bookingTime}}': booking.bookingTime || '',
                  };
                  let body = (template as any).bodyHtml || html;
                  for (const [k, v] of Object.entries(vars)) {
                    body = body.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v);
                  }
                  html = body;
                }
              }

              const result = await emailDispatcher.sendEmail({
                tenantId: tenant.id,
                to: booking.clientEmail,
                subject,
                html,
              });

              if (result.success) {
                await storage.updateBooking(booking.id, { reminderSentAt: new Date() }, tenant.id);
                totalSent++;
                console.log(`📅 Reminder sent for booking ${booking.id} to ${booking.clientEmail}`);
              }
            }
          }
        } catch (tenantErr) {
          console.error(`❌ Booking reminder error for tenant ${tenant.id}:`, tenantErr);
        }
      }

      return { remindersSent: totalSent, timestamp: new Date().toISOString() };
    });

    // Daily encrypted database backup job handler
    this.registerHandler('daily-backup', async (payload) => {
      console.log('💾 Processing daily backup job:', payload);
      
      // Import backup service
      const { backupService } = await import('./backupService');
      
      const result = await backupService.createBackup();
      
      if (!result.success) {
        throw new Error(`Backup failed: ${result.error}`);
      }
      
      return { 
        success: true, 
        backupPath: result.backupPath,
        timestamp: new Date().toISOString() 
      };
    });

    console.log('📋 Built-in job handlers registered');
  }
}

// Export singleton instance
export const jobs = new JobsService();

/**
 * Initialize the jobs service
 * This should be called during application startup
 */
export async function initializeJobsService(): Promise<void> {
  try {
    await jobs.initialize();
  } catch (error) {
    console.error('❌ Failed to initialize jobs service:', error);
    throw error;
  }
}

/**
 * Shutdown the jobs service gracefully
 * This should be called during application shutdown
 */
export async function shutdownJobsService(): Promise<void> {
  try {
    await jobs.shutdown();
  } catch (error) {
    console.error('❌ Failed to shutdown jobs service:', error);
  }
}