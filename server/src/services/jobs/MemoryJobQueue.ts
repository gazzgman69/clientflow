/**
 * In-Memory Job Queue Implementation
 * 
 * A simple, efficient job queue that runs in memory using timers and
 * priority queues. Suitable for single-instance applications.
 * 
 * Features:
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
import { randomUUID } from 'crypto';

export class MemoryJobQueue implements IJobQueue {
  private jobs = new Map<string, Job>();
  private executions = new Map<string, JobExecution>();
  private handlers = new Map<string, JobHandler>();
  private pendingJobs: Job[] = [];
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
    } = {}
  ): Promise<string> {
    const jobId = randomUUID();
    const now = new Date();

    const job: Job = {
      id: jobId,
      type,
      payload,
      priority: options.priority || 'normal',
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      delay: options.delay,
      schedule: options.schedule,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);

    // Handle delayed execution
    if (options.delay && options.delay > 0) {
      setTimeout(() => {
        this.addToPendingQueue(job);
      }, options.delay);
    } 
    // Handle recurring jobs
    else if (options.schedule) {
      this.scheduleRecurringJob(job);
    } 
    // Immediate execution
    else {
      this.addToPendingQueue(job);
    }

    console.log(`📋 Job enqueued: ${type} (${jobId}) priority:${job.priority}`);
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

    // Start job processing loop
    this.processingInterval = setInterval(() => {
      this.processJobs().catch(console.error);
    }, 1000); // Check for jobs every second

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(console.error);
    }, this.config.cleanupInterval);

    console.log('📋 Job queue started');
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

    console.log(`📋 Job queue stopped (${this.runningJobs.size} jobs still running)`);
  }

  async getStats(): Promise<JobStatistics> {
    const allJobs = Array.from(this.jobs.values());
    const allExecutions = Array.from(this.executions.values());

    const pending = this.pendingJobs.length;
    const running = this.runningJobs.size;

    // Get latest execution status for each job
    const latestExecutions = new Map<string, JobExecution>();
    for (const execution of allExecutions) {
      const existing = latestExecutions.get(execution.jobId);
      if (!existing || execution.startedAt > existing.startedAt) {
        latestExecutions.set(execution.jobId, execution);
      }
    }
    
    const jobStatuses = new Map<string, JobStatus>();
    for (const [jobId, execution] of latestExecutions) {
      jobStatuses.set(jobId, execution.status);
    }

    const completed = Array.from(jobStatuses.values()).filter(s => s === 'completed').length;
    const failed = Array.from(jobStatuses.values()).filter(s => s === 'failed').length;
    const retrying = Array.from(jobStatuses.values()).filter(s => s === 'retrying').length;

    return {
      total: allJobs.length,
      pending,
      running,
      completed,
      failed,
      retrying,
    };
  }

  async getJob(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }

  async cancelJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }

    // Remove from pending queue
    const index = this.pendingJobs.findIndex(j => j.id === id);
    if (index >= 0) {
      this.pendingJobs.splice(index, 1);
    }

    // Cancel scheduled timeout
    const timeout = this.scheduledJobs.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledJobs.delete(id);
    }

    // Create cancelled execution
    const execution: JobExecution = {
      id: randomUUID(),
      jobId: id,
      status: 'cancelled',
      startedAt: new Date(),
      completedAt: new Date(),
      attempt: 0,
    };
    this.executions.set(execution.id, execution);

    console.log(`📋 Job cancelled: ${job.type} (${id})`);
    return true;
  }

  async retryJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) {
      return false;
    }

    // Reset job and add back to queue
    job.updatedAt = new Date();
    this.addToPendingQueue(job);

    console.log(`📋 Job retried: ${job.type} (${id})`);
    return true;
  }

  async getRecentExecutions(limit: number = 50): Promise<JobExecution[]> {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  async cleanup(): Promise<number> {
    const cutoffDate = new Date(Date.now() - this.config.maxJobAge);
    let cleanedCount = 0;

    // Clean up old executions
    for (const [id, execution] of this.executions.entries()) {
      if (execution.completedAt && execution.completedAt < cutoffDate) {
        this.executions.delete(id);
        cleanedCount++;
      }
    }

    // Clean up old jobs that are completed and have no recent executions
    for (const [id, job] of this.jobs.entries()) {
      if (job.createdAt < cutoffDate) {
        const hasRecentExecution = Array.from(this.executions.values())
          .some(exec => exec.jobId === id && exec.startedAt > cutoffDate);
        
        if (!hasRecentExecution && !this.runningJobs.has(id)) {
          this.jobs.delete(id);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`📋 Cleaned up ${cleanedCount} old jobs and executions`);
    }

    return cleanedCount;
  }

  private addToPendingQueue(job: Job): void {
    // Add to pending queue in priority order
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const jobPriority = priorityOrder[job.priority];

    let insertIndex = this.pendingJobs.length;
    for (let i = 0; i < this.pendingJobs.length; i++) {
      const existingPriority = priorityOrder[this.pendingJobs[i].priority];
      if (jobPriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    this.pendingJobs.splice(insertIndex, 0, job);
  }

  private scheduleRecurringJob(job: Job): void {
    if (!job.schedule) return;

    const scheduleNextRun = () => {
      if (!this.isStarted) return;

      // Add job to pending queue for execution
      this.addToPendingQueue({ ...job, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() });

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

  private async processJobs(): Promise<void> {
    // Process jobs up to the concurrent limit
    while (
      this.pendingJobs.length > 0 && 
      this.runningJobs.size < this.config.maxConcurrentJobs
    ) {
      const job = this.pendingJobs.shift();
      if (job) {
        this.executeJob(job).catch(console.error);
      }
    }
  }

  private async executeJob(job: Job): Promise<void> {
    const executionId = randomUUID();
    this.runningJobs.add(job.id);

    const execution: JobExecution = {
      id: executionId,
      jobId: job.id,
      status: 'running',
      startedAt: new Date(),
      attempt: 1, // Will be updated based on previous attempts
    };

    // Count previous attempts
    const previousAttempts = Array.from(this.executions.values())
      .filter(e => e.jobId === job.id);
    execution.attempt = previousAttempts.length + 1;

    this.executions.set(executionId, execution);

    try {
      console.log(`📋 Executing job: ${job.type} (${job.id}) attempt ${execution.attempt}`);

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
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.result = result;

      console.log(`📋 Job completed: ${job.type} (${job.id})`);

    } catch (error: any) {
      console.error(`📋 Job failed: ${job.type} (${job.id})`, error);

      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.error = error.message;

      // Handle retries
      const shouldRetry = error instanceof JobError ? error.shouldRetry : true;
      if (shouldRetry && execution.attempt < job.maxRetries) {
        execution.status = 'retrying';
        
        // Schedule retry with exponential backoff
        const retryDelay = this.config.retryDelay * Math.pow(2, execution.attempt - 1);
        setTimeout(() => {
          this.addToPendingQueue(job);
        }, retryDelay);

        console.log(`📋 Job will retry in ${retryDelay}ms: ${job.type} (${job.id})`);
      }
    } finally {
      this.runningJobs.delete(job.id);
      this.executions.set(executionId, execution);
    }
  }
}