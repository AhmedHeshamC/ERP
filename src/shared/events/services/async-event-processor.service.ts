import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobService, JobProcessor } from '../../queue/job.service';
import { IEventBus } from '../interfaces/event-bus.interface';
import { IEventMiddleware } from '../interfaces/event-handler.interface';
import { IDomainEvent } from '../types/event.types';

/**
 * Async Event Processor Service
 * Handles asynchronous event processing using the existing JobService
 * Implements enterprise-grade async event handling with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles async event processing only
 * - Open/Closed: Extensible through event processors
 * - Interface Segregation: Focused on async processing operations
 * - Dependency Inversion: Depends on abstractions (IEventBus, IEventMiddleware)
 */
@Injectable()
export class AsyncEventProcessorService implements OnModuleInit {
  private readonly logger = new Logger(AsyncEventProcessorService.name);
  private readonly EVENT_JOB_TYPE = 'event_processing';

  constructor(
    private readonly jobService: JobService,
    private readonly eventBus: IEventBus,
    private readonly middlewareService: IEventMiddleware,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing async event processor');

    // Register event processor with the job service
    this.jobService.registerProcessor({
      type: this.EVENT_JOB_TYPE,
      handler: this.processEventJob.bind(this),
      options: {
        concurrency: 10, // Process up to 10 events concurrently
        retryDelay: 5000,
        backoffMultiplier: 2
      }
    });

    this.logger.log('Async event processor initialized');
  }

  /**
   * Publish an event asynchronously
   * @param event The domain event to publish
   * @param options Async publishing options
   * @returns Job ID for tracking
   */
  async publishAsync(
    event: IDomainEvent,
    options: AsyncPublishOptions = {}
  ): Promise<string> {
    this.logger.debug(`Publishing event async: ${event.type} with ID: ${event.id}`);

    const jobData: EventJobData = {
      event,
      options,
      correlationId: event.correlationId,
      scheduledAt: options.scheduledAt
    };

    const jobId = await this.jobService.addJob(
      `ProcessEvent-${event.type}`,
      this.EVENT_JOB_TYPE,
      jobData,
      {
        priority: options.priority || 0,
        delay: options.delay,
        maxAttempts: options.maxRetries || 3,
        scheduledAt: options.scheduledAt
      }
    );

    this.logger.debug(`Event job created: ${jobId} for event: ${event.type}`);
    return jobId;
  }

  /**
   * Publish multiple events asynchronously as a batch
   * @param events Array of domain events to publish
   * @param options Batch publishing options
   * @returns Array of job IDs for tracking
   */
  async publishBatchAsync(
    events: IDomainEvent[],
    options: BatchPublishOptions = {}
  ): Promise<string[]> {
    this.logger.debug(`Publishing ${events.length} events async as batch`);

    const jobIds: string[] = [];

    if (options.atomic) {
      // Process all events in a single job
      const jobData: BatchEventJobData = {
        events,
        options,
        correlationId: options.correlationId
      };

      const jobId = await this.jobService.addJob(
        `ProcessBatch-${events.length}events`,
        'batch_event_processing',
        jobData,
        {
          priority: options.priority || 0,
          delay: options.delay,
          maxAttempts: options.maxRetries || 1 // Batches typically don't retry
        }
      );

      jobIds.push(jobId);
    } else {
      // Process each event individually
      for (const event of events) {
        const jobId = await this.publishAsync(event, {
          ...options,
          correlationId: options.correlationId || event.correlationId
        });
        jobIds.push(jobId);
      }
    }

    this.logger.debug(`Created ${jobIds.length} async jobs for batch processing`);
    return jobIds;
  }

  /**
   * Schedule an event for future processing
   * @param event The domain event to schedule
   * @param scheduledAt When to process the event
   * @param options Scheduling options
   * @returns Job ID for tracking
   */
  async scheduleEvent(
    event: IDomainEvent,
    scheduledAt: Date,
    options: AsyncPublishOptions = {}
  ): Promise<string> {
    this.logger.debug(`Scheduling event: ${event.type} for: ${scheduledAt.toISOString()}`);

    return this.publishAsync(event, {
      ...options,
      scheduledAt
    });
  }

  /**
   * Get status of async event processing jobs
   * @param filter Optional filter for job status
   * @returns Processing statistics
   */
  getAsyncProcessingStats(filter?: {
    eventType?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed';
  }): AsyncProcessingStats {
    const jobs = this.jobService.getJobs({
      type: this.EVENT_JOB_TYPE,
      status: filter?.status
    });

    // Filter by event type if specified
    const filteredJobs = filter?.eventType
      ? jobs.filter(job => (job.data as EventJobData).event.type === filter.eventType)
      : jobs;

    const stats = this.jobService.getQueueStats();

    return {
      total: filteredJobs.length,
      pending: filteredJobs.filter(job => job.status === 'pending').length,
      running: filteredJobs.filter(job => job.status === 'running').length,
      completed: filteredJobs.filter(job => job.status === 'completed').length,
      failed: filteredJobs.filter(job => job.status === 'failed').length,
      processingRate: stats.processingRate,
      averageProcessingTime: stats.averageProcessingTime,
      eventTypes: this.getEventTypeStats(filteredJobs)
    };
  }

  /**
   * Cancel pending async event processing
   * @param jobId The job ID to cancel
   * @returns True if cancelled successfully
   */
  async cancelAsyncProcessing(jobId: string): Promise<boolean> {
    this.logger.debug(`Cancelling async event processing: ${jobId}`);
    return this.jobService.cancelJob(jobId);
  }

  /**
   * Retry failed async event processing
   * @param jobId The job ID to retry
   * @returns True if retry initiated successfully
   */
  async retryAsyncProcessing(jobId: string): Promise<boolean> {
    this.logger.debug(`Retrying async event processing: ${jobId}`);
    return this.jobService.retryJob(jobId);
  }

  /**
   * Process event job (executed by JobService)
   * @param job The job definition
   */
  private async processEventJob(job: any): Promise<void> {
    const jobData = job.data as EventJobData;
    const { event, options } = jobData;

    this.logger.debug(`Processing event job: ${job.id} for event: ${event.type}`);

    try {
      // Process event through middleware first
      const processedEvent = await this.middlewareService.process(event);

      // Publish the processed event
      await this.eventBus.publish(processedEvent, {
        timeout: options.timeout,
        priority: options.priority
      });

      this.logger.debug(`Event job completed: ${job.id} for event: ${event.type}`);
    } catch (error) {
      this.logger.error(`Event job failed: ${job.id} for event: ${event.type}`, error);
      throw error; // Re-throw to let JobService handle retries
    }
  }

  /**
   * Get event type statistics from jobs
   * @param jobs Array of job definitions
   * @returns Event type statistics
   */
  private getEventTypeStats(jobs: any[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const job of jobs) {
      const eventType = (job.data as EventJobData).event.type;
      stats[eventType] = (stats[eventType] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get job details for async event processing
   * @param jobId The job ID
   * @returns Job details with event information
   */
  getAsyncJobDetails(jobId: string): AsyncJobDetails | null {
    const job = this.jobService.getJob(jobId);
    if (!job || job.type !== this.EVENT_JOB_TYPE) {
      return null;
    }

    const jobData = job.data as EventJobData;

    return {
      id: job.id,
      name: job.name,
      status: job.status,
      eventType: jobData.event.type,
      eventId: jobData.event.id,
      aggregateId: jobData.event.aggregateId,
      correlationId: jobData.correlationId,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      scheduledAt: job.scheduledAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      error: job.error,
      processingDuration: job.startedAt && job.completedAt
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : undefined
    };
  }

  /**
   * Cleanup completed async event processing jobs
   * @param olderThan Remove jobs older than this date
   * @returns Number of jobs cleaned up
   */
  cleanupCompletedJobs(olderThan?: Date): number {
    this.logger.debug('Cleaning up completed async event processing jobs');
    return this.jobService.clearCompletedJobs(olderThan);
  }
}

/**
 * Async publishing options
 */
export interface AsyncPublishOptions {
  /** Job priority (higher = more priority) */
  priority?: number;
  /** Delay before processing */
  delay?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Processing timeout in milliseconds */
  timeout?: number;
  /** Schedule processing for specific time */
  scheduledAt?: Date;
  /** Custom headers for job */
  headers?: Record<string, string>;
}

/**
 * Batch publishing options
 */
export interface BatchPublishOptions extends AsyncPublishOptions {
  /** Process all events atomically in a single job */
  atomic?: boolean;
  /** Correlation ID for the entire batch */
  correlationId?: string;
}

/**
 * Event job data structure
 */
interface EventJobData {
  event: IDomainEvent;
  options: AsyncPublishOptions;
  correlationId?: string;
  scheduledAt?: Date;
}

/**
 * Batch event job data structure
 */
interface BatchEventJobData {
  events: IDomainEvent[];
  options: BatchPublishOptions;
  correlationId?: string;
}

/**
 * Async processing statistics
 */
export interface AsyncProcessingStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  processingRate: number;
  averageProcessingTime: number;
  eventTypes: Record<string, number>;
}

/**
 * Async job details
 */
export interface AsyncJobDetails {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  eventType: string;
  eventId: string;
  aggregateId: string;
  correlationId?: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  processingDuration?: number;
}