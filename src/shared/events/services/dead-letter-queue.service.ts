import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IDomainEvent } from '../types/event.types';

/**
 * Dead Letter Queue Service
 * Handles failed events with enterprise-grade persistence and recovery with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles dead letter events only
 * - Open/Closed: Extensible through recovery strategies
 * - Interface Segregation: Focused on DLQ operations only
 * - Dependency Inversion: Depends on PrismaService abstraction
 */
@Injectable()
export class DeadLetterQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private readonly DEFAULT_RETRY_LIMIT = 3;
  private readonly RETRY_DELAY_BASE = 5000; // 5 seconds
  private readonly MAX_RETRY_DELAY = 300000; // 5 minutes
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour

  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Dead Letter Queue service');

    // Start cleanup process
    this.startCleanupProcess();

    this.logger.log('Dead Letter Queue service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Dead Letter Queue service');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.log('Dead Letter Queue service shut down');
  }

  /**
   * Add a failed event to the dead letter queue
   * @param event The failed domain event
   * @param error The error that caused the failure
   * @param context Additional context about the failure
   * @param options DLQ options
   */
  async addFailedEvent(
    event: IDomainEvent,
    error: Error,
    context: FailureContext,
    options: DLQOptions = {}
  ): Promise<string> {
    this.logger.debug(`Adding failed event to DLQ: ${event.type} (${event.id})`);

    const dlqId = this.generateDLQId();

    await this.prisma.deadLetterEvent.create({
      data: {
        id: dlqId,
        eventId: event.id,
        eventType: event.type,
        eventData: JSON.stringify(event),
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        errorType: error.constructor.name,
        errorMessage: error.message,
        errorStack: error.stack,
        handlerName: context.handlerName,
        retryCount: context.retryCount || 0,
        maxRetries: options.maxRetries || this.DEFAULT_RETRY_LIMIT,
        retryAfter: this.calculateRetryAfter(context.retryCount || 0),
        failureContext: JSON.stringify(context),
        metadata: JSON.stringify(options.metadata || {}),
        severity: this.determineSeverity(error, context),
        status: 'pending'
      }
    });

    this.logger.debug(`Failed event added to DLQ with ID: ${dlqId}`);
    return dlqId;
  }

  /**
   * Get failed events from the dead letter queue
   * @param filter Optional filter criteria
   * @param pagination Pagination options
   * @returns Array of failed events
   */
  async getFailedEvents(
    filter?: DLQFilter,
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<FailedEvent[]> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter) {
      if (filter.eventType) {
        where.eventType = filter.eventType;
      }

      if (filter.aggregateId) {
        where.aggregateId = filter.aggregateId;
      }

      if (filter.severity) {
        where.severity = filter.severity;
      }

      if (filter.status) {
        where.status = filter.status;
      }

      if (filter.dateFrom) {
        where.createdAt = { ...where.createdAt, gte: filter.dateFrom };
      }

      if (filter.dateTo) {
        where.createdAt = { ...where.createdAt, lte: filter.dateTo };
      }
    }

    const failedEvents = await this.prisma.deadLetterEvent.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit
    });

    return failedEvents.map((event: any) => this.mapToFailedEvent(event));
  }

  /**
   * Retry a failed event
   * @param dlqId The DLQ record ID
   * @param options Retry options
   * @returns True if retry initiated successfully
   */
  async retryFailedEvent(dlqId: string, options: RetryOptions = {}): Promise<boolean> {
    this.logger.debug(`Retrying failed event: ${dlqId}`);

    const dlqRecord = await this.prisma.deadLetterEvent.findUnique({
      where: { id: dlqId }
    });

    if (!dlqRecord) {
      this.logger.warn(`DLQ record not found: ${dlqId}`);
      return false;
    }

    if (dlqRecord.status !== 'pending') {
      this.logger.warn(`DLQ record ${dlqId} is not in pending status: ${dlqRecord.status}`);
      return false;
    }

    // Check if we've exceeded max retries
    if (dlqRecord.retryCount >= dlqRecord.maxRetries) {
      this.logger.warn(`Max retries exceeded for DLQ record: ${dlqId}`);
      await this.updateDLQStatus(dlqId, 'exhausted');
      return false;
    }

    // Update retry count and schedule next retry
    const newRetryCount = dlqRecord.retryCount + 1;
    const retryAfter = this.calculateRetryAfter(newRetryCount);

    await this.prisma.deadLetterEvent.update({
      where: { id: dlqId },
      data: {
        retryCount: newRetryCount,
        retryAfter,
        lastRetryAt: new Date(),
        status: 'retrying'
      }
    });

    // If immediate retry is requested, publish the event
    if (options.immediate) {
      await this.publishEventForRetry(dlqRecord);
    }

    this.logger.debug(`Failed event retry scheduled: ${dlqId} (attempt ${newRetryCount})`);
    return true;
  }

  /**
   * Batch retry multiple failed events
   * @param dlqIds Array of DLQ record IDs
   * @param options Batch retry options
   * @returns Results of batch retry operation
   */
  async retryBatch(
    dlqIds: string[],
    options: BatchRetryOptions = {}
  ): Promise<BatchRetryResult> {
    this.logger.debug(`Retrying batch of ${dlqIds.length} failed events`);

    const results: BatchRetryResult = {
      total: dlqIds.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const dlqId of dlqIds) {
      try {
        const success = await this.retryFailedEvent(dlqId, { immediate: options.immediate });
        if (success) {
          results.successful++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          dlqId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    this.logger.debug(`Batch retry completed: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`);
    return results;
  }

  /**
   * Permanently remove a failed event from the DLQ
   * @param dlqId The DLQ record ID
   * @param reason Reason for removal
   * @returns True if removed successfully
   */
  async removeFailedEvent(dlqId: string, reason?: string): Promise<boolean> {
    this.logger.debug(`Removing failed event from DLQ: ${dlqId}`);

    try {
      await this.prisma.deadLetterEvent.update({
        where: { id: dlqId },
        data: {
          status: 'removed',
          removedAt: new Date(),
          removalReason: reason || 'Manually removed'
        }
      });

      this.logger.debug(`Failed event removed from DLQ: ${dlqId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove event from DLQ: ${dlqId}`, error);
      return false;
    }
  }

  /**
   * Get DLQ statistics
   * @returns DLQ statistics
   */
  async getStatistics(): Promise<DLQStatistics> {
    const [
      total,
      pending,
      retrying,
      exhausted,
      removed,
      resolved,
      severityStats,
      eventTypeStats
    ] = await Promise.all([
      this.prisma.deadLetterEvent.count(),
      this.prisma.deadLetterEvent.count({ where: { status: 'pending' } }),
      this.prisma.deadLetterEvent.count({ where: { status: 'retrying' } }),
      this.prisma.deadLetterEvent.count({ where: { status: 'exhausted' } }),
      this.prisma.deadLetterEvent.count({ where: { status: 'removed' } }),
      this.prisma.deadLetterEvent.count({ where: { status: 'resolved' } }),
      this.prisma.deadLetterEvent.groupBy({
        by: ['severity'],
        _count: { severity: true }
      }),
      this.prisma.deadLetterEvent.groupBy({
        by: ['eventType'],
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
        take: 10
      })
    ]);

    // Transform statistics
    const severityBreakdown: Record<string, number> = {};
    severityStats.forEach(stat => {
      severityBreakdown[stat.severity] = stat._count.severity;
    });

    const eventTypeBreakdown: Record<string, number> = {};
    eventTypeStats.forEach(stat => {
      eventTypeBreakdown[stat.eventType] = stat._count.eventType;
    });

    // Get average retry count
    const avgRetryCountResult = await this.prisma.deadLetterEvent.aggregate({
      _avg: { retryCount: true }
    });

    return {
      total,
      pending,
      retrying,
      exhausted,
      removed,
      resolved,
      severityBreakdown,
      eventTypeBreakdown,
      averageRetryCount: avgRetryCountResult._avg.retryCount || 0,
      oldestFailure: await this.getOldestFailure(),
      newestFailure: await this.getNewestFailure()
    };
  }

  /**
   * Process events that are ready for retry
   * @returns Number of events processed
   */
  async processRetries(): Promise<number> {
    this.logger.debug('Processing DLQ retries');

    const readyForRetry = await this.prisma.deadLetterEvent.findMany({
      where: {
        status: 'retrying',
        retryAfter: { lte: new Date() }
      },
      take: 100 // Process in batches
    });

    let processed = 0;

    for (const dlqRecord of readyForRetry) {
      try {
        await this.publishEventForRetry(dlqRecord);
        await this.updateDLQStatus(dlqRecord.id, 'resolved');
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process retry for ${dlqRecord.id}:`, error);
        await this.updateDLQStatus(dlqRecord.id, 'pending');
      }
    }

    if (processed > 0) {
      this.logger.debug(`Processed ${processed} DLQ retries`);
    }

    return processed;
  }

  /**
   * Update DLQ record status
   * @param dlqId The DLQ record ID
   * @param status New status
   */
  private async updateDLQStatus(dlqId: string, status: string): Promise<void> {
    await this.prisma.deadLetterEvent.update({
      where: { id: dlqId },
      data: { status }
    });
  }

  /**
   * Publish event for retry (this would integrate with the event bus)
   * @param dlqRecord The DLQ record
   */
  private async publishEventForRetry(dlqRecord: any): Promise<void> {
    const event = JSON.parse(dlqRecord.eventData);

    // In a real implementation, this would publish the event back to the event bus
    // For now, we'll just log the action
    this.logger.debug(`Publishing event for retry: ${event.type} (${event.id})`);

    // TODO: Integrate with EventBusService
    // await this.eventBus.publish(event, { priority: 1 }); // Higher priority for retries
  }

  /**
   * Calculate retry after timestamp with exponential backoff
   * @param retryCount Current retry count
   * @returns Timestamp for next retry
   */
  private calculateRetryAfter(retryCount: number): Date {
    const delay = Math.min(
      this.RETRY_DELAY_BASE * Math.pow(2, retryCount),
      this.MAX_RETRY_DELAY
    );

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    const totalDelay = delay + jitter;

    return new Date(Date.now() + totalDelay);
  }

  /**
   * Determine failure severity based on error and context
   * @param error The error that occurred
   * @param context Failure context
   * @returns Severity level
   */
  private determineSeverity(error: Error, _context: FailureContext): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'critical';
    }

    // High severity errors
    if (error.message.includes('timeout') || error.message.includes('permission')) {
      return 'high';
    }

    // Medium severity errors
    if (error.message.includes('validation') || error.message.includes('not found')) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  /**
   * Generate unique DLQ ID
   */
  private generateDLQId(): string {
    return `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map database record to FailedEvent object
   */
  private mapToFailedEvent(record: any): FailedEvent {
    return {
      id: record.id,
      eventId: record.eventId,
      eventType: record.eventType,
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType,
      errorType: record.errorType,
      errorMessage: record.errorMessage,
      errorStack: record.errorStack,
      handlerName: record.handlerName,
      retryCount: record.retryCount,
      maxRetries: record.maxRetries,
      retryAfter: record.retryAfter,
      lastRetryAt: record.lastRetryAt,
      failureContext: JSON.parse(record.failureContext),
      metadata: JSON.parse(record.metadata),
      severity: record.severity,
      status: record.status,
      createdAt: record.createdAt,
      removedAt: record.removedAt
    };
  }

  /**
   * Get oldest failure timestamp
   */
  private async getOldestFailure(): Promise<Date | null> {
    const oldest = await this.prisma.deadLetterEvent.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });
    return oldest?.createdAt || null;
  }

  /**
   * Get newest failure timestamp
   */
  private async getNewestFailure(): Promise<Date | null> {
    const newest = await this.prisma.deadLetterEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    return newest?.createdAt || null;
  }

  /**
   * Start cleanup process for old resolved events
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupOldResolvedEvents();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up old resolved events
   */
  private async cleanupOldResolvedEvents(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep for 7 days

    try {
      const result = await this.prisma.deadLetterEvent.deleteMany({
        where: {
          status: 'resolved',
          updatedAt: { lt: cutoffDate }
        }
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} old resolved DLQ events`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old resolved DLQ events:', error);
    }
  }
}

// Type definitions for the DLQ service

export interface FailureContext {
  handlerName: string;
  retryCount?: number;
  additionalInfo?: Record<string, any>;
}

export interface DLQOptions {
  maxRetries?: number;
  metadata?: Record<string, any>;
}

export interface DLQFilter {
  eventType?: string;
  aggregateId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'pending' | 'retrying' | 'exhausted' | 'removed' | 'resolved';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface RetryOptions {
  immediate?: boolean;
}

export interface BatchRetryOptions {
  immediate?: boolean;
  maxConcurrent?: number;
}

export interface BatchRetryResult {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ dlqId: string; error: string }>;
}

export interface FailedEvent {
  id: string;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  handlerName: string;
  retryCount: number;
  maxRetries: number;
  retryAfter: Date;
  lastRetryAt?: Date;
  failureContext: FailureContext;
  metadata: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'retrying' | 'exhausted' | 'removed' | 'resolved';
  createdAt: Date;
  removedAt?: Date;
}

export interface DLQStatistics {
  total: number;
  pending: number;
  retrying: number;
  exhausted: number;
  removed: number;
  resolved: number;
  severityBreakdown: Record<string, number>;
  eventTypeBreakdown: Record<string, number>;
  averageRetryCount: number;
  oldestFailure: Date | null;
  newestFailure: Date | null;
}