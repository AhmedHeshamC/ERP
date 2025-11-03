import { IDomainEvent, IEventFilter, IRetryPolicy } from '../types/event.types';

/**
 * Event Middleware Interface
 * Defines the contract for event processing middleware
 * Follows SOLID principles with single responsibility for event processing
 */
export interface IEventMiddleware {
  /**
   * Process an event through the middleware pipeline
   * @param event The domain event to process
   * @returns Processed event
   */
  process(event: IDomainEvent): Promise<IDomainEvent>;

  /**
   * Add middleware to the processing pipeline
   * @param eventType Event type this middleware handles
   * @param middleware The middleware function
   * @param filter Optional event filter
   * @param retryPolicy Optional retry policy
   */
  addMiddleware(
    eventType: string,
    middleware: EventMiddlewareFunction,
    filter?: IEventFilter,
    retryPolicy?: IRetryPolicy
  ): Promise<string>;

  /**
   * Remove middleware from the pipeline
   * @param middlewareId The middleware ID to remove
   */
  removeMiddleware(middlewareId: string): Promise<void>;

  /**
   * Move failed event to dead letter queue
   * @param event The failed event
   * @param error The error that caused the failure
   */
  moveToDeadLetterQueue(event: IDomainEvent, error: Error): Promise<void>;

  /**
   * Get processing metrics
   * @returns Processing metrics
   */
  getMetrics(): Promise<IEventProcessingMetrics>;
}

/**
 * Event middleware function type
 */
export type EventMiddlewareFunction = (
  event: IDomainEvent,
  next: NextFunction
) => Promise<IDomainEvent>;

/**
 * Next function for middleware chain
 */
export type NextFunction = (event?: IDomainEvent) => Promise<IDomainEvent>;

/**
 * Event processing metrics
 */
export interface IEventProcessingMetrics {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  averageProcessingTime: number;
  middlewareExecutionTimes: Record<string, number>;
  retryCount: number;
  deadLetterQueueSize: number;
}