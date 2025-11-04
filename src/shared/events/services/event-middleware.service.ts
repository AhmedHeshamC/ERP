import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IEventBus } from '../interfaces/event-bus.interface';
import { IEventStore } from '../interfaces/event-store.interface';
import { IEventMiddleware, EventMiddlewareFunction, NextFunction, IEventProcessingMetrics } from '../interfaces/event-handler.interface';
import { IDomainEvent, IEventFilter, IRetryPolicy } from '../types/event.types';

/**
 * Event Middleware Service Implementation
 * Implements event processing pipeline with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles event processing pipeline only
 * - Open/Closed: Extensible through middleware registration
 * - Interface Segregation: Focused on middleware operations only
 * - Dependency Inversion: Depends on abstractions (IEventBus, IEventStore)
 */
@Injectable()
export class EventMiddlewareService implements IEventMiddleware {
  private readonly logger = new Logger(EventMiddlewareService.name);
  private readonly middleware = new Map<string, Array<{
    id: string;
    function: EventMiddlewareFunction;
    filter?: IEventFilter;
    retryPolicy?: IRetryPolicy;
  }>>();
  private readonly metrics: IEventProcessingMetrics = {
    totalProcessed: 0,
    successfulProcessed: 0,
    failedProcessed: 0,
    averageProcessingTime: 0,
    middlewareExecutionTimes: {},
    retryCount: 0,
    deadLetterQueueSize: 0
  };
  private readonly deadLetterQueue: Array<{
    event: IDomainEvent;
    error: Error;
    timestamp: Date;
    retryCount: number;
  }> = [];

  constructor(
    private readonly eventBus: IEventBus,
    private readonly eventStore: IEventStore,
  ) {}

  /**
   * Process an event through the middleware pipeline
   */
  async process(event: IDomainEvent): Promise<IDomainEvent> {
    const startTime = Date.now();
    this.metrics.totalProcessed++;

    try {
      this.logger.debug(`Processing event: ${event.type} with ID: ${event.id}`);

      // Get middleware for this event type
      const middlewareList = this.middleware.get(event.type) || [];

      if (middlewareList.length === 0) {
        // No middleware for this event type, return as-is
        this.metrics.successfulProcessed++;
        return event;
      }

      // Create middleware pipeline
      const pipeline = this.createPipeline(middlewareList, event);

      // Execute pipeline
      const result = await pipeline(event, async (e?: IDomainEvent) => e || event);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      this.logger.debug(`Successfully processed event: ${event.type} in ${duration}ms`);

      // Publish the processed event to the event bus
      await this.eventBus.publish(result);

      return result;

    } catch (error) {
      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);

      this.logger.error(`Failed to process event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Add middleware to the processing pipeline
   */
  async addMiddleware(
    eventType: string,
    middleware: EventMiddlewareFunction,
    filter?: IEventFilter,
    retryPolicy?: IRetryPolicy
  ): Promise<string> {
    const middlewareId = uuidv4();

    if (!this.middleware.has(eventType)) {
      this.middleware.set(eventType, []);
    }

    this.middleware.get(eventType)!.push({
      id: middlewareId,
      function: middleware,
      filter,
      retryPolicy
    });

    this.logger.debug(`Added middleware ${middlewareId} for event type: ${eventType}`);
    return middlewareId;
  }

  /**
   * Remove middleware from the pipeline
   */
  async removeMiddleware(middlewareId: string): Promise<void> {
    for (const [eventType, middlewareList] of this.middleware.entries()) {
      const index = middlewareList.findIndex(m => m.id === middlewareId);
      if (index !== -1) {
        middlewareList.splice(index, 1);
        this.logger.debug(`Removed middleware ${middlewareId} for event type: ${eventType}`);
        return;
      }
    }

    throw new Error(`Middleware not found: ${middlewareId}`);
  }

  /**
   * Move failed event to dead letter queue
   */
  async moveToDeadLetterQueue(event: IDomainEvent, error: Error): Promise<void> {
    this.logger.debug(`Moving event ${event.id} to dead letter queue`);

    this.deadLetterQueue.push({
      event,
      error,
      timestamp: new Date(),
      retryCount: 0
    });

    this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;

    // Optionally, we could persist this to the event store or a separate dead letter table
    await this.eventStore.updateRetryCount(event.id, -1); // -1 indicates dead letter
  }

  /**
   * Get processing metrics
   */
  async getMetrics(): Promise<IEventProcessingMetrics> {
    return { ...this.metrics };
  }

  /**
   * Create middleware pipeline function
   * Creates proper middleware chain with next() function chaining
   */
  private createPipeline(
    middlewareList: Array<{
      id: string;
      function: EventMiddlewareFunction;
      filter?: IEventFilter;
      retryPolicy?: IRetryPolicy;
    }>,
    originalEvent: IDomainEvent
  ): EventMiddlewareFunction {
    // Build the middleware chain from the inside out
    const buildChain = async (index: number, event: IDomainEvent): Promise<IDomainEvent> => {
      if (index >= middlewareList.length) {
        // End of chain, return the event
        return Promise.resolve(event);
      }

      const middleware = middlewareList[index];

      // Apply filter if present - if filtered out, skip to next middleware
      if (middleware.filter && !this.matchesFilter(event, middleware.filter)) {
        return buildChain(index + 1, event);
      }

      // Execute current middleware with retry policy
      return await this.executeWithRetry(
        middleware.function,
        event,
        middleware.retryPolicy,
        // Create next function that calls the next middleware in chain
        (nextEvent?: IDomainEvent) => buildChain(index + 1, nextEvent || event)
      );
    };

    return async (event: IDomainEvent): Promise<IDomainEvent> => {
      return buildChain(0, event);
    };
  }

  /**
   * Execute middleware function with retry policy
   */
  private async executeWithRetry(
    middleware: EventMiddlewareFunction,
    event: IDomainEvent,
    retryPolicy?: IRetryPolicy,
    nextFunction?: NextFunction
  ): Promise<IDomainEvent> {
    if (!retryPolicy) {
      // No retry policy, execute once
      return await this.executeMiddleware(middleware, event, nextFunction);
    }

    let lastError: Error | null = null;
    let delay = retryPolicy.initialDelay;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        return await this.executeMiddleware(middleware, event, nextFunction);
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(lastError, retryPolicy.retryableErrors)) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === retryPolicy.maxRetries) {
          throw lastError;
        }

        // Wait before retry
        await this.delay(delay);
        delay = Math.min(delay * retryPolicy.backoffMultiplier, retryPolicy.maxDelay);
        this.metrics.retryCount++;
      }
    }

    throw lastError!;
  }

  /**
   * Execute a single middleware function
   */
  private async executeMiddleware(
    middleware: EventMiddlewareFunction,
    event: IDomainEvent,
    nextFunction?: NextFunction
  ): Promise<IDomainEvent> {
    const startTime = Date.now();

    try {
      // Use the provided next function or create a default one
      const next: NextFunction = nextFunction || async (nextEvent?: IDomainEvent): Promise<IDomainEvent> => {
        return nextEvent || event;
      };

      const result = await middleware(event, next);

      const duration = Date.now() - startTime;
      this.updateMiddlewareMetrics(middleware.name || 'anonymous', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Middleware failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Check if error is retryable based on policy
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    return retryableErrors.some(retryableError =>
      error.message.includes(retryableError) ||
      error.constructor.name.includes(retryableError)
    );
  }

  /**
   * Check if event matches filter criteria
   */
  private matchesFilter(event: IDomainEvent, filter: IEventFilter): boolean {
    // Check aggregate type filter
    if (filter.aggregateType && event.aggregateType !== filter.aggregateType) {
      return false;
    }

    // Check version filter
    if (filter.version) {
      if (Array.isArray(filter.version)) {
        if (!filter.version.includes(event.version)) {
          return false;
        }
      } else if (event.version !== filter.version) {
        return false;
      }
    }

    // Check metadata filter
    if (filter.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata[key] !== value) {
          return false;
        }
      }
    }

    // Check custom filter
    if (filter.customFilter && !filter.customFilter(event)) {
      return false;
    }

    return true;
  }

  /**
   * Update processing metrics
   */
  private updateMetrics(duration: number, success: boolean): void {
    if (success) {
      this.metrics.successfulProcessed++;
    } else {
      this.metrics.failedProcessed++;
    }

    // Update average processing time
    const totalProcessed = this.metrics.successfulProcessed + this.metrics.failedProcessed;
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (totalProcessed - 1) + duration) / totalProcessed;
  }

  /**
   * Update middleware execution metrics
   */
  private updateMiddlewareMetrics(middlewareName: string, duration: number): void {
    if (!this.metrics.middlewareExecutionTimes[middlewareName]) {
      this.metrics.middlewareExecutionTimes[middlewareName] = duration;
    } else {
      // Simple moving average
      const current = this.metrics.middlewareExecutionTimes[middlewareName];
      this.metrics.middlewareExecutionTimes[middlewareName] = (current + duration) / 2;
    }
  }

  /**
   * Delay function for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process dead letter queue (for recovery)
   */
  async processDeadLetterQueue(): Promise<void> {
    this.logger.debug(`Processing dead letter queue with ${this.deadLetterQueue.length} items`);

    const itemsToProcess = [...this.deadLetterQueue];
    this.deadLetterQueue.length = 0; // Clear the queue

    for (const item of itemsToProcess) {
      try {
        await this.process(item.event);
        this.logger.debug(`Successfully reprocessed event ${item.event.id} from dead letter queue`);
      } catch (error) {
        this.logger.error(`Failed to reprocess event ${item.event.id} from dead letter queue:`, error);

        // Put it back in the queue with incremented retry count
        item.retryCount++;
        if (item.retryCount < 3) { // Max 3 retries from dead letter
          this.deadLetterQueue.push(item);
        }
      }
    }

    this.metrics.deadLetterQueueSize = this.deadLetterQueue.length;
  }

  /**
   * Get middleware registration info
   */
  getMiddlewareInfo(): Record<string, Array<{ id: string; hasFilter: boolean; hasRetryPolicy: boolean }>> {
    const info: Record<string, Array<{ id: string; hasFilter: boolean; hasRetryPolicy: boolean }>> = {};

    for (const [eventType, middlewareList] of this.middleware.entries()) {
      info[eventType] = middlewareList.map(m => ({
        id: m.id,
        hasFilter: !!m.filter,
        hasRetryPolicy: !!m.retryPolicy
      }));
    }

    return info;
  }
}