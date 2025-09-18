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
   * @param options Job options
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
    console.log('📋 Initializing jobs service...');
    
    // Register built-in job handlers
    this.registerBuiltInHandlers();
    
    // Start the job queue
    await jobQueue.start();
    
    console.log('✅ Jobs service initialized successfully');
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
      console.log('📧 Processing email sync job:', payload);
      
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
      console.log('📅 Processing calendar sync job:', payload);
      
      // Import calendar service dynamically
      const { calendarAutoSyncService } = await import('../../services/calendar-auto-sync');
      
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