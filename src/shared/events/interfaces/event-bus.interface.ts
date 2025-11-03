import { IDomainEvent, IEventSubscription, IEventStatistics, IEventFilter } from '../types/event.types';

/**
 * Event Bus Interface
 * Defines the contract for event publishing and subscription
 * Follows SOLID principles with single responsibility for event distribution
 */
export interface IEventBus {
  /**
   * Publish an event to all subscribers
   * @param event The domain event to publish
   * @param options Optional publishing options
   */
  publish(event: IDomainEvent, options?: IPublishOptions): Promise<void>;

  /**
   * Subscribe to events of a specific type
   * @param eventType The event type to subscribe to
   * @param handler The event handler function
   * @param filter Optional filter for events
   * @returns Subscription ID that can be used to unsubscribe
   */
  subscribe(eventType: string, handler: EventHandler, filter?: IEventFilter): Promise<string>;

  /**
   * Unsubscribe from events
   * @param subscriptionId The subscription ID to unsubscribe
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Replay events from the event store
   * @param eventType Optional event type filter
   * @param aggregateId Optional aggregate ID filter
   * @param fromVersion Optional starting version
   */
  replayEvents(eventType?: string, aggregateId?: string, fromVersion?: number): Promise<void>;

  /**
   * Get event statistics
   * @returns Event processing statistics
   */
  getStatistics(): Promise<IEventStatistics>;

  /**
   * Register error handler for event processing errors
   * @param event The error event type ('error')
   * @param handler The error handler function
   */
  on(event: 'error', handler: ErrorHandler): Promise<void>;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: IDomainEvent) => Promise<void>;

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, event?: IDomainEvent) => Promise<void>;

/**
 * Event publishing options
 */
export interface IPublishOptions {
  /**
   * Whether to process event asynchronously
   */
  async?: boolean;

  /**
   * Priority for event processing (higher = more priority)
   */
  priority?: number;

  /**
   * Custom headers for event transport
   */
  headers?: Record<string, string>;

  /**
   * Timeout for event processing in milliseconds
   */
  timeout?: number;
}