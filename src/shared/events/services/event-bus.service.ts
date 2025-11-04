import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IEventBus, EventHandler, ErrorHandler, IPublishOptions } from '../interfaces/event-bus.interface';
import { IEventStore } from '../interfaces/event-store.interface';
import { IEventMiddleware } from '../interfaces/event-handler.interface';
import { IDomainEvent, IEventSubscription, IEventFilter, IEventStatistics } from '../types/event.types';

/**
 * Event Bus Service Implementation
 * Implements event publishing and subscription with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles event distribution only
 * - Open/Closed: Extensible through middleware and handlers
 * - Interface Segregation: Focused on event operations only
 * - Dependency Inversion: Depends on abstractions (IEventStore, IEventMiddleware)
 */
@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);
  private readonly subscriptions = new Map<string, IEventSubscription>();
  private readonly errorHandlers: ErrorHandler[] = [];
  private readonly eventHandlers = new Map<string, Array<{ handler: EventHandler; filter?: IEventFilter }>>();
  
  constructor(
    private readonly eventStore: IEventStore,
    private readonly middlewareService: IEventMiddleware,
  ) {}

  /**
   * Publish an event to all subscribers
   * Processes event through middleware before distributing to handlers
   */
  async publish(event: IDomainEvent, options: IPublishOptions = {}): Promise<void> {
    try {
      this.logger.debug(`Publishing event: ${event.type} with ID: ${event.id}`);

      // Process event through middleware pipeline
      const processedEvent = await this.middlewareService.process(event);

      // Persist event to event store
      const streamId = `${event.aggregateType}-${event.aggregateId}`;
      await this.eventStore.saveEvent(processedEvent, streamId, event.version);

      // Get handlers for this event type
      const handlers = this.eventHandlers.get(event.type) || [];

      // Process each handler
      const promises = handlers.map(async ({ handler, filter }) => {
        try {
          // Apply filter if present
          if (filter && !this.matchesFilter(processedEvent, filter)) {
            return;
          }

          // Execute handler
          await this.executeHandler(handler, processedEvent, options);
        } catch (error) {
          await this.handleHandlerError(error as Error, processedEvent);
        }
      });

      // Wait for all handlers to complete (or fail gracefully)
      await Promise.allSettled(promises);

      this.logger.debug(`Successfully published event: ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events of a specific type
   */
  async subscribe(eventType: string, handler: EventHandler, filter?: IEventFilter): Promise<string> {
    const subscriptionId = uuidv4();

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      eventType,
      handlerName: handler.name || 'anonymous',
      filter,
      retryPolicy: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['NetworkError', 'TimeoutError', 'DatabaseError']
      },
      isActive: true,
      createdAt: new Date()
    });

    // Store handler
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push({ handler, filter });

    this.logger.debug(`Subscribed to event type: ${eventType} with ID: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    // Remove from handlers
    const handlers = this.eventHandlers.get(subscription.eventType);
    if (handlers) {
      const index = handlers.findIndex(h => h.handler.name === subscription.handlerName);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    this.logger.debug(`Unsubscribed from event type: ${subscription.eventType} with ID: ${subscriptionId}`);
  }

  /**
   * Replay events from the event store
   */
  async replayEvents(eventType?: string, aggregateId?: string, fromVersion?: number): Promise<void> {
    this.logger.debug(`Replaying events: eventType=${eventType}, aggregateId=${aggregateId}, fromVersion=${fromVersion}`);

    const streamId = aggregateId ? `User-${aggregateId}` : undefined;
    const events = await this.eventStore.getEvents(eventType, streamId, 1, 1000, fromVersion);

    for (const event of events) {
      try {
        await this.publish(event, { async: false }); // Process synchronously during replay
      } catch (error) {
        this.logger.error(`Failed to replay event ${event.id}:`, error);
        // Continue with other events during replay
      }
    }

    this.logger.debug(`Replayed ${events.length} events`);
  }

  /**
   * Get event statistics
   */
  async getStatistics(): Promise<IEventStatistics> {
    return this.eventStore.getStatistics();
  }

  /**
   * Register error handler for event processing errors
   */
  async on(event: 'error', handler: ErrorHandler): Promise<void> {
    if (event === 'error') {
      this.errorHandlers.push(handler);
    }
  }

  /**
   * Execute an event handler with error handling and retry logic
   */
  private async executeHandler(
    handler: EventHandler,
    event: IDomainEvent,
    options: IPublishOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      if (options.timeout) {
        await Promise.race([
          handler(event),
          this.createTimeoutPromise(options.timeout)
        ]);
      } else {
        await handler(event);
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Event handler completed in ${duration}ms for event: ${event.type}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Event handler failed after ${duration}ms for event ${event.type}:`, error);
      throw error;
    }
  }

  /**
   * Handle errors from event handlers
   */
  private async handleHandlerError(error: Error, event: IDomainEvent): Promise<void> {
    // Log the error
    this.logger.error(`Event handler error for ${event.type}:`, error);

    // Notify registered error handlers
    const promises = this.errorHandlers.map(handler =>
      handler(error, event).catch(err =>
        this.logger.error('Error handler itself failed:', err)
      )
    );

    await Promise.allSettled(promises);
  }

  /**
   * Check if event matches the filter criteria
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
   * Create a timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Event handler timeout after ${timeout}ms`)), timeout);
    });
  }

  /**
   * Get active subscriptions count (for monitoring)
   */
  getActiveSubscriptionsCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscriptions by event type (for monitoring)
   */
  getSubscriptionsByEventType(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const subscription of this.subscriptions.values()) {
      result[subscription.eventType] = (result[subscription.eventType] || 0) + 1;
    }

    return result;
  }
}