/**
 * Background Jobs Abstraction Interface
 * 
 * Provides a centralized interface for background job processing with
 * scheduling, retry logic, priority handling, and observability.
 */

export interface Job {
  id: string;
  type: string;
  payload: Record<string, any>;
  priority: JobPriority;
  maxRetries: number;
  delay?: number; // Delay in milliseconds before execution
  schedule?: JobSchedule; // For recurring jobs
  createdAt: Date;
  updatedAt: Date;
}

export interface JobExecution {
  id: string;
  jobId: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
  attempt: number;
}

export interface JobSchedule {
  type: 'interval'; // Only interval supported currently
  value: number; // Interval in milliseconds
  nextRun?: Date;
}

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface JobHandler {
  (payload: any): Promise<any>;
}

export interface JobResult {
  success: boolean;
  result?: any;
  error?: string;
  shouldRetry?: boolean;
}

export interface JobQueueConfig {
  maxConcurrentJobs: number;
  defaultMaxRetries: number;
  retryDelay: number; // Base delay between retries in ms
  jobTimeout: number; // Max execution time per job in ms
  cleanupInterval: number; // How often to clean up old jobs in ms
  maxJobAge: number; // Max age of completed jobs before cleanup in ms
}

export interface JobStatistics {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  retrying: number;
}

/**
 * Main interface for job queue operations
 */
export interface IJobQueue {
  /**
   * Add a job to the queue
   */
  enqueue(type: string, payload: any, options?: {
    priority?: JobPriority;
    maxRetries?: number;
    delay?: number;
    schedule?: JobSchedule;
  }): Promise<string>;

  /**
   * Register a job handler for a specific job type
   */
  registerHandler(type: string, handler: JobHandler): void;

  /**
   * Start the job queue processing
   */
  start(): Promise<void>;

  /**
   * Stop the job queue processing
   */
  stop(): Promise<void>;

  /**
   * Get job statistics
   */
  getStats(): Promise<JobStatistics>;

  /**
   * Get job by ID
   */
  getJob(id: string): Promise<Job | null>;

  /**
   * Cancel a job
   */
  cancelJob(id: string): Promise<boolean>;

  /**
   * Retry a failed job
   */
  retryJob(id: string): Promise<boolean>;

  /**
   * Get recent job executions
   */
  getRecentExecutions(limit?: number): Promise<JobExecution[]>;

  /**
   * Clean up old completed jobs
   */
  cleanup(): Promise<number>;
}

/**
 * Job processing errors
 */
export class JobError extends Error {
  constructor(
    message: string,
    public code: string,
    public shouldRetry: boolean = true
  ) {
    super(message);
    this.name = 'JobError';
  }
}

export class JobTimeoutError extends JobError {
  constructor(jobId: string, timeout: number) {
    super(`Job ${jobId} timed out after ${timeout}ms`, 'JOB_TIMEOUT', false);
  }
}

export class JobNotFoundError extends JobError {
  constructor(jobId: string) {
    super(`Job ${jobId} not found`, 'JOB_NOT_FOUND', false);
  }
}