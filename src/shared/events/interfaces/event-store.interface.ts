import { IDomainEvent, IEventEnvelope, IEventStream, IEventStatistics } from '../types/event.types';

/**
 * Event Store Interface
 * Defines the contract for event persistence and retrieval
 * Follows SOLID principles with single responsibility for event storage
 */
export interface IEventStore {
  /**
   * Save an event to the event store
   * @param event The domain event to save
   * @param streamId The stream identifier
   * @param expectedVersion The expected version for optimistic concurrency
   * @returns Event envelope with metadata
   */
  saveEvent(event: IDomainEvent, streamId: string, expectedVersion: number): Promise<IEventEnvelope>;

  /**
   * Get events from the event store
   * @param eventType Optional event type filter
   * @param streamId Optional stream ID filter
   * @param page Page number for pagination (default: 1)
   * @param limit Number of events per page (default: 100)
   * @param fromVersion Optional starting version
   * @returns Array of domain events
   */
  getEvents(
    eventType?: string,
    streamId?: string,
    page?: number,
    limit?: number,
    fromVersion?: number
  ): Promise<IDomainEvent[]>;

  /**
   * Get event stream for an aggregate
   * @param streamId The stream identifier
   * @returns Event stream with all events and metadata
   */
  getEventStream(streamId: string): Promise<IEventStream>;

  /**
   * Update retry count for failed events
   * @param eventId The event ID
   * @param retryCount The new retry count
   */
  updateRetryCount(eventId: string, retryCount: number): Promise<void>;

  /**
   * Get event processing statistics
   * @returns Event statistics
   */
  getStatistics(): Promise<IEventStatistics>;

  /**
   * Cleanup old events based on retention policy
   * @param cutoffDate Events before this date will be deleted
   * @returns Number of deleted events
   */
  cleanupOldEvents(cutoffDate: Date): Promise<number>;

  /**
   * Get events for replay
   * @param eventType Optional event type filter
   * @param fromVersion Optional starting version
   * @param batchSize Batch size for processing
   * @returns Async iterator for events
   */
  getEventsForReplay(
    eventType?: string,
    fromVersion?: number,
    batchSize?: number
  ): Promise<AsyncIterable<IDomainEvent[]>>;

  /**
   * Save multiple events atomically
   * @param events Array of events to save
   * @param streamId The stream identifier
   * @param expectedVersion The expected version
   * @returns Array of event envelopes
   */
  saveEvents(events: IDomainEvent[], streamId: string, expectedVersion: number): Promise<IEventEnvelope[]>;
}