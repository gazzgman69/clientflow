/**
 * PostgreSQL Job Queue Implementation
 * 
 * A persistent job queue that stores jobs and executions in PostgreSQL.
 * Provides the same interface as MemoryJobQueue but with persistence
 * to survive server restarts and crashes.
 * 
 * Features:
 * - Persistent job storage in PostgreSQL
 * - Priority-based job execution
 * - Automatic retry with exponential backoff
 * - Recurring job scheduling
 * - Job timeout handling
 * - Statistics and monitoring
 * - Cleanup of old jobs
 */

import {
  IJobQueue,
  Job,
  JobExecution,
  JobHandler,
  JobQueueConfig,
  JobStatistics,
  JobStatus,
  JobPriority,
  JobSchedule,
  JobError,
  JobTimeoutError,
  JobNotFoundError,
} from '../../interfaces/jobs';
import crypto from 'crypto';
import { db } from '../../../db';
import { jobs, jobExecutions } from '@shared/schema';
import { eq, and, or, sql, lt, desc, asc, isNotNull, ne, inArray } from 'drizzle-orm';

export class PostgreSQLJobQueue implements IJobQueue {
  private handlers = new Map<string, JobHandler>();
  private runningJobs = new Set<string>();
  private isStarted = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  private config: JobQueueConfig = {
    maxConcurrentJobs: 5,
    defaultMaxRetries: 3,
    retryDelay: 1000,
    jobTimeout: 30000, // 30 seconds
    cleanupInterval: 300000, // 5 minutes
    maxJobAge: 86400000, // 24 hours
  };

  constructor(config?: Partial<JobQueueConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async enqueue(
    type: string,
    payload: any,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      delay?: number;
      schedule?: JobSchedule;
      tenantId?: string;
    } = {}
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    const now = new Date();

    // SECURITY: Require tenantId for multi-tenant isolation
    if (!options.tenantId) {
      throw new JobError('tenantId is required for job enqueueing', 'MISSING_TENANT_ID', false);
    }

    // Calculate next run time
    let nextRunAt = now;
    if (options.delay && options.delay > 0) {
      nextRunAt = new Date(now.getTime() + options.delay);
    }

    // Insert job into database with tenant isolation
    await db.insert(jobs).values({
      id: jobId,
      type,
      payload: JSON.stringify(payload),
      priority: options.priority || 'normal',
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      delay: options.delay,
      schedule: options.schedule ? JSON.stringify(options.schedule) : null,
      status: 'pending',
      nextRunAt,
      tenantId: options.tenantId, // SECURITY: Add tenant isolation
      createdAt: now,
      updatedAt: now,
    });

    // Handle recurring jobs
    if (options.schedule) {
      this.scheduleRecurringJob({
        id: jobId,
        type,
        payload,
        priority: options.priority || 'normal',
        maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
        delay: options.delay,
        schedule: options.schedule,
        tenantId: options.tenantId, // SECURITY: Preserve tenant context for recurring jobs
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log(`📋 Job enqueued: ${type} (${jobId}) priority:${options.priority || 'normal'}`);
    return jobId;
  }

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    console.log(`📋 Handler registered for job type: ${type}`);
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      console.log('📋 Job queue is already running');
      return;
    }

    this.isStarted = true;

    // Restore scheduled jobs from database on startup
    await this.restoreScheduledJobs();

    // Start job processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(console.error);
    }, 1000); // Check for jobs every second

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.config.cleanupInterval);

    console.log('📋 PostgreSQL Job queue started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;

    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear scheduled jobs
    for (const timeout of this.scheduledJobs.values()) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();

    // Wait for running jobs to complete (with timeout)
    const waitStart = Date.now();
    const maxWait = 30000; // 30 seconds

    while (this.runningJobs.size > 0 && (Date.now() - waitStart) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📋 PostgreSQL Job queue stopped (${this.runningJobs.size} jobs still running)`);
  }

  async getStats(): Promise<JobStatistics> {
    // Get job counts by status
    const statusCounts = await db
      .select({
        status: jobs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .groupBy(jobs.status);

    // Initialize counts
    const stats = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
    };

    // Sum up the counts
    for (const row of statusCounts) {
      stats.total += row.count;
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'running') stats.running = row.count;
      else if (row.status === 'completed') stats.completed = row.count;
      else if (row.status === 'failed') stats.failed = row.count;
      else if (row.status === 'retrying') stats.retrying = row.count;
    }

    return stats;
  }

  async getJob(id: string): Promise<Job | null> {
    const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (result.length === 0) return null;

    const row = result[0];
    return this.transformDatabaseJobToInterface(row);
  }

  async cancelJob(id: string): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) {
      return false;
    }

    // Update job status to cancelled
    await db.update(jobs)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(jobs.id, id));

    // Cancel scheduled timeout
    const timeout = this.scheduledJobs.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(id);
    }

    // Create cancelled execution
    await db.insert(jobExecutions).values({
      jobId: id,
      status: 'cancelled',
      startedAt: new Date(),
      completedAt: new Date(),
      attempt: 0,
    });

    console.log(`📋 Job cancelled: ${job.type} (${id})`);
    return true;
  }

  async retryJob(id: string): Promise<boolean> {
    const job = await this.getJob(id);
    if (!job) {
      return false;
    }

    // Reset job status and update timestamp
    await db.update(jobs)
      .set({ 
        status: 'pending', 
        nextRunAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(jobs.id, id));

    console.log(`📋 Job retried: ${job.type} (${id})`);
    return true;
  }

  async getRecentExecutions(limit: number = 50): Promise<JobExecution[]> {
    const results = await db
      .select()
      .from(jobExecutions)
      .orderBy(desc(jobExecutions.startedAt))
      .limit(limit);

    return results.map(row => this.transformDatabaseExecutionToInterface(row));
  }

  async cleanup(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.config.maxJobAge);
    let cleanedCount = 0;

    // First, identify old jobs to clean
    const oldJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          lt(jobs.createdAt, cutoffDate),
          or(
            eq(jobs.status, 'completed'),
            eq(jobs.status, 'failed'),
            eq(jobs.status, 'cancelled')
          )
        )
      );

    if (oldJobs.length === 0) {
      return 0;
    }

    const oldJobIds = oldJobs.map(j => j.id);

    // Delete all executions for these jobs first (to avoid foreign key constraint violation)
    const deletedExecutions = await db
      .delete(jobExecutions)
      .where(inArray(jobExecutions.jobId, oldJobIds));

    // Now safely delete the jobs
    const deletedJobs = await db
      .delete(jobs)
      .where(inArray(jobs.id, oldJobIds));

    cleanedCount = (deletedExecutions.rowCount || 0) + (deletedJobs.rowCount || 0);

    if (cleanedCount > 0) {
      console.log(`📋 Cleaned up ${cleanedCount} old jobs and executions`);
    }

    return cleanedCount;
  }

  private async processJobs(): Promise<void> {
    if (!this.isStarted) return;

    // Get pending jobs that are ready to run
    const availableSlots = this.config.maxConcurrentJobs - this.runningJobs.size;
    if (availableSlots <= 0) return;

    // SECURITY: Only process jobs that have a tenantId (skip orphaned jobs)
    const pendingJobs = await db
      .select()
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'pending'),
          isNotNull(jobs.tenantId), // SECURITY: Only process jobs with valid tenant
          or(
            eq(jobs.nextRunAt, null),
            lt(jobs.nextRunAt, new Date())
          )
        )
      )
      .orderBy(
        // Priority order: critical=0, high=1, normal=2, low=3
        sql`CASE 
          WHEN priority = 'critical' THEN 0
          WHEN priority = 'high' THEN 1  
          WHEN priority = 'normal' THEN 2
          WHEN priority = 'low' THEN 3
          ELSE 4
        END`,
        asc(jobs.createdAt)
      )
      .limit(availableSlots);

    // Execute jobs
    for (const jobRow of pendingJobs) {
      const job = this.transformDatabaseJobToInterface(jobRow);
      this.executeJob(job).catch(console.error);
    }
  }

  private async executeJob(job: Job): Promise<void> {
    const executionId = crypto.randomUUID();
    this.runningJobs.add(job.id);

    // Mark job as running
    await db.update(jobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    // Count previous attempts
    const previousAttempts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobExecutions)
      .where(eq(jobExecutions.jobId, job.id));

    const attempt = (previousAttempts[0]?.count || 0) + 1;

    // Create execution record with tenant isolation
    await db.insert(jobExecutions).values({
      id: executionId,
      jobId: job.id,
      status: 'running',
      startedAt: new Date(),
      attempt,
      tenantId: job.tenantId, // SECURITY: Maintain tenant isolation in executions
    });

    try {
      console.log(`📋 Executing job: ${job.type} (${job.id}) attempt ${attempt}`);

      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new JobError(`No handler registered for job type: ${job.type}`, 'NO_HANDLER', false);
      }

      // Execute with timeout
      let timeoutId: NodeJS.Timeout | null = null;
      const result = await Promise.race([
        handler(job.payload),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new JobTimeoutError(job.id, this.config.jobTimeout)), this.config.jobTimeout);
        }),
      ]);
      
      // Clear timeout if job completed before timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Job completed successfully
      await Promise.all([
        db.update(jobs)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(jobs.id, job.id)),
        db.update(jobExecutions)
          .set({ 
            status: 'completed',
            completedAt: new Date(),
            result: result ? JSON.stringify(result) : null 
          })
          .where(eq(jobExecutions.id, executionId))
      ]);

      console.log(`📋 Job completed: ${job.type} (${job.id})`);

    } catch (error: any) {
      console.error(`📋 Job failed: ${job.type} (${job.id})`, error);

      // Update execution with error
      await db.update(jobExecutions)
        .set({ 
          status: 'failed',
          completedAt: new Date(),
          error: error.message 
        })
        .where(eq(jobExecutions.id, executionId));

      // Handle retries
      const shouldRetry = error instanceof JobError ? error.shouldRetry : true;
      if (shouldRetry && attempt < job.maxRetries) {
        // Schedule retry with exponential backoff
        const retryDelay = this.config.retryDelay * Math.pow(2, attempt - 1);
        const nextRunAt = new Date(Date.now() + retryDelay);

        await Promise.all([
          db.update(jobs)
            .set({ 
              status: 'pending',
              nextRunAt,
              updatedAt: new Date() 
            })
            .where(eq(jobs.id, job.id)),
          db.update(jobExecutions)
            .set({ status: 'retrying' })
            .where(eq(jobExecutions.id, executionId))
        ]);

        console.log(`📋 Job will retry in ${retryDelay}ms: ${job.type} (${job.id})`);
      } else {
        // Mark job as permanently failed
        await db.update(jobs)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(jobs.id, job.id));
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  private scheduleRecurringJob(job: Job): void {
    if (!job.schedule) return;

    const scheduleNextRun = () => {
      if (!this.isStarted) return;

      // Create new job instance for execution with tenant isolation
      this.enqueue(job.type, job.payload, {
        priority: job.priority,
        maxRetries: job.maxRetries,
        tenantId: job.tenantId, // Pass tenantId for multi-tenant isolation
      }).catch(console.error);

      // Schedule next run
      if (job.schedule?.type === 'interval' && typeof job.schedule.value === 'number') {
        const timeout = setTimeout(scheduleNextRun, job.schedule.value);
        this.scheduledJobs.set(job.id, timeout);
      }
    };

    // Schedule first run
    if (job.schedule.type === 'interval' && typeof job.schedule.value === 'number') {
      const timeout = setTimeout(scheduleNextRun, job.schedule.value);
      this.scheduledJobs.set(job.id, timeout);
    }
  }

  private async restoreScheduledJobs(): Promise<void> {
    // Get all recurring jobs from database
    const recurringJobs = await db
      .select()
      .from(jobs)
      .where(and(
        isNotNull(jobs.schedule),
        eq(jobs.status, 'pending')
      ));

    for (const jobRow of recurringJobs) {
      const job = this.transformDatabaseJobToInterface(jobRow);
      if (job.schedule) {
        this.scheduleRecurringJob(job);
      }
    }

    console.log(`📋 Restored ${recurringJobs.length} scheduled jobs`);
  }

  private transformDatabaseJobToInterface(row: any): Job {
    return {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      priority: row.priority as JobPriority,
      maxRetries: row.maxRetries,
      delay: row.delay,
      schedule: row.schedule ? JSON.parse(row.schedule) : undefined,
      tenantId: row.tenantId, // Include tenantId for multi-tenant isolation
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private transformDatabaseExecutionToInterface(row: any): JobExecution {
    return {
      id: row.id,
      jobId: row.jobId,
      status: row.status as JobStatus,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      error: row.error,
      result: row.result ? JSON.parse(row.result) : undefined,
      attempt: row.attempt,
    };
  }
}