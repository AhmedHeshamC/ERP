import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

export interface JobDefinition {
  id: string;
  name: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface JobProcessor {
  type: string;
  handler: (job: JobDefinition) => Promise<any>;
  options?: {
    concurrency?: number;
    retryDelay?: number;
    backoffMultiplier?: number;
  };
}

export interface QueueStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  processingRate: number;
  averageProcessingTime: number;
}

/**
 * Enterprise-Grade Background Job Processing Service
 *
 * Implements comprehensive job queue management with:
 * - Priority-based job scheduling
 * - Retry mechanisms with exponential backoff
 * - Concurrent job processing
 * - Job monitoring and statistics
 * - Graceful shutdown handling
 * - Job persistence options
 */
@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);

  // Job storage (in production, use persistent storage like Redis or database)
  private jobs: Map<string, JobDefinition> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private runningJobs: Set<string> = new Set();

  // Configuration
  private readonly maxConcurrency: number;
  private readonly defaultRetryDelay: number;
  private readonly defaultMaxAttempts: number;
  private readonly cleanupInterval: number;

  // Processing control
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load configuration with defaults
    this.maxConcurrency = 5;
    this.defaultRetryDelay = 5000;
    this.defaultMaxAttempts = 3;
    this.cleanupInterval = 60000;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing job processing service');

    // Start job processing
    this.startProcessing();
    this.startCleanupProcess();

    this.logger.log(`Job processing service initialized with max concurrency: ${this.maxConcurrency}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down job processing service');

    // Stop processing
    this.stopProcessing();

    // Wait for running jobs to complete or timeout
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.runningJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
      this.logger.log(`Waiting for ${this.runningJobs.size} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.runningJobs.size > 0) {
      this.logger.warn(`Shutdown timeout: ${this.runningJobs.size} jobs still running`);
    }

    this.logger.log('Job processing service shut down');
  }

  /**
   * Register a job processor
   */
  registerProcessor(processor: JobProcessor): void {
    this.processors.set(processor.type, processor);
    this.logger.log(`Registered processor for job type: ${processor.type}`);
  }

  /**
   * Unregister a job processor
   */
  unregisterProcessor(type: string): void {
    this.processors.delete(type);
    this.logger.log(`Unregistered processor for job type: ${type}`);
  }

  /**
   * Add a new job to the queue
   */
  async addJob(
    name: string,
    type: string,
    data: any,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
      scheduledAt?: Date;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    const now = new Date();

    const job: JobDefinition = {
      id: jobId,
      name,
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.defaultMaxAttempts,
      delay: options.delay,
      createdAt: now,
      scheduledAt: options.scheduledAt || new Date(now.getTime() + (options.delay || 0)),
      status: 'pending',
    };

    this.jobs.set(jobId, job);

    // Emit job added event
    
    this.logger.debug(`Job added: ${name} (${type}) with ID: ${jobId}`);
    return jobId;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): JobDefinition | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: {
    type?: string;
    status?: JobDefinition['status'];
    limit?: number;
    offset?: number;
  }): JobDefinition[] {
    let jobs = Array.from(this.jobs.values());

    // Apply filters
    if (filter?.type) {
      jobs = jobs.filter(job => job.type === filter.type);
    }

    if (filter?.status) {
      jobs = jobs.filter(job => job.status === filter.status);
    }

    // Sort by priority (descending) and creation time (ascending)
    jobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Apply pagination
    if (filter?.offset) {
      jobs = jobs.slice(filter.offset);
    }

    if (filter?.limit) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): QueueStats {
    const jobs = Array.from(this.jobs.values());
    const completedJobs = jobs.filter(job => job.status === 'completed');
    const runningJobs = jobs.filter(job => job.status === 'running');

    const total = jobs.length;
    const pending = jobs.filter(job => job.status === 'pending').length;
    const running = runningJobs.length;
    const completed = completedJobs.length;
    const failed = jobs.filter(job => job.status === 'failed').length;

    // Calculate processing rate (jobs per minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCompleted = completedJobs.filter(job =>
      job.completedAt && job.completedAt >= oneMinuteAgo
    ).length;
    const processingRate = recentCompleted;

    // Calculate average processing time
    const processingTimes = completedJobs
      .filter(job => job.startedAt && job.completedAt)
      .map(job => job.completedAt!.getTime() - job.startedAt!.getTime());

    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      total,
      pending,
      running,
      completed,
      failed,
      processingRate,
      averageProcessingTime,
    };
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      this.logger.warn(`Cannot cancel running job: ${jobId}`);
      return false;
    }

    job.status = 'cancelled';
    
    this.logger.log(`Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') {
      return false;
    }

    // Reset job for retry
    job.status = 'pending';
    job.attempts = 0;
    job.error = undefined;
    job.failedAt = undefined;
    job.scheduledAt = new Date();

    
    this.logger.log(`Job retried: ${jobId}`);
    return true;
  }

  /**
   * Clear completed jobs
   */
  clearCompletedJobs(olderThan?: Date): number {
    const cutoff = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default 24 hours
    let cleared = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' && job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(jobId);
        cleared++;
      }
    }

    this.logger.log(`Cleared ${cleared} completed jobs`);
    return cleared;
  }

  /**
   * Start job processing
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 1000); // Process every second

    this.logger.log('Job processing started');
  }

  /**
   * Stop job processing
   */
  private stopProcessing(): void {
    this.isProcessing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.logger.log('Job processing stopped');
  }

  /**
   * Process available jobs
   */
  private async processJobs(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    // Check if we've reached max concurrency
    if (this.runningJobs.size >= this.maxConcurrency) {
      return;
    }

    // Get available jobs
    const availableJobs = this.getAvailableJobs();
    const slotsAvailable = this.maxConcurrency - this.runningJobs.size;

    // Process jobs up to concurrency limit
    for (let i = 0; i < Math.min(availableJobs.length, slotsAvailable); i++) {
      const job = availableJobs[i];
      this.processJob(job);
    }
  }

  /**
   * Get available jobs for processing
   */
  private getAvailableJobs(): JobDefinition[] {
    const now = new Date();

    return Array.from(this.jobs.values())
      .filter(job =>
        job.status === 'pending' &&
        job.scheduledAt &&
        job.scheduledAt <= now
      )
      .sort((a, b) => {
        // Sort by priority (descending) and scheduled time (ascending)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.scheduledAt!.getTime() - b.scheduledAt!.getTime();
      });
  }

  /**
   * Process a single job
   */
  private async processJob(job: JobDefinition): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      this.logger.error(`No processor found for job type: ${job.type}`);
      job.status = 'failed';
      job.error = 'No processor found';
      job.failedAt = new Date();
            return;
    }

    // Update job status
    job.status = 'running';
    job.startedAt = new Date();
    job.attempts++;
    this.runningJobs.add(job.id);

        this.logger.debug(`Processing job: ${job.name} (${job.id})`);

    try {
      // Process the job
      await processor.handler(job);

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();

            this.logger.debug(`Job completed: ${job.name} (${job.id})`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Job failed: ${job.name} (${job.id}) - ${errorMessage}`);

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached, mark as failed
        job.status = 'failed';
        job.error = errorMessage;
        job.failedAt = new Date();

              } else {
        // Schedule retry with exponential backoff
        const retryDelay = this.calculateRetryDelay(job.attempts, processor.options);
        job.status = 'pending';
        job.scheduledAt = new Date(Date.now() + retryDelay);
        job.error = errorMessage;

                this.logger.debug(`Job retry scheduled: ${job.name} (${job.id}) in ${retryDelay}ms`);
      }
    } finally {
      // Remove from running jobs
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, options?: JobProcessor['options']): number {
    const baseDelay = options?.retryDelay || this.defaultRetryDelay;
    const multiplier = options?.backoffMultiplier || 2;

    // Exponential backoff: delay = baseDelay * (multiplier ^ (attempt - 1))
    const delay = baseDelay * Math.pow(multiplier, attempt - 1);

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;

    return Math.min(delay + jitter, 300000); // Max 5 minutes
  }

  /**
   * Start cleanup process for old jobs
   */
  private startCleanupProcess(): void {
    setInterval(() => {
      this.cleanupOldJobs();
    }, this.cleanupInterval);
  }

  /**
   * Clean up old jobs
   */
  private cleanupOldJobs(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      const jobAge = now - job.createdAt.getTime();

      if (jobAge > maxAge && (job.status === 'completed' || job.status === 'failed')) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old jobs`);
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}