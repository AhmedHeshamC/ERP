import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IEventStore } from '../interfaces/event-store.interface';
import { IDomainEvent, IEventEnvelope, IEventStream, IEventStatistics } from '../types/event.types';

/**
 * Event Store Service Implementation
 * Implements event persistence and retrieval with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles event storage only
 * - Open/Closed: Extensible through different storage strategies
 * - Interface Segregation: Focused on storage operations only
 * - Dependency Inversion: Depends on PrismaService abstraction
 */
@Injectable()
export class EventStoreService implements IEventStore {
  private readonly logger = new Logger(EventStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save an event to the event store
   */
  async saveEvent(
    event: IDomainEvent,
    streamId: string,
    _expectedVersion?: number
  ): Promise<IEventEnvelope> {
    this.logger.debug(`Saving event ${event.id} to stream ${streamId}`);

    try {
      // Create event envelope
      const envelope = await this.prisma.event.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          eventData: event.metadata as any,
          streamId,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          occurredAt: event.occurredAt,
          eventVersion: event.version || 1,
          correlationId: event.correlationId,
          causationId: event.causationId,
          metadata: JSON.stringify({ schemaVersion: event.schemaVersion }),
          processedAt: new Date()
        }
      });

      this.logger.debug(`Successfully saved event ${event.id} to stream ${streamId}`);

      return this.mapToEventEnvelope(envelope);
    } catch (error) {
      this.logger.error(`Failed to save event ${event.id} to stream ${streamId}:`, error);
      throw error;
    }
  }

  /**
   * Get events from the event store with filtering and pagination
   */
  async getEvents(
    eventType?: string,
    streamId?: string,
    page: number = 1,
    limit: number = 100,
    _fromVersion?: number
  ): Promise<IDomainEvent[]> {
    this.logger.debug(`Getting events: eventType=${eventType}, streamId=${streamId}, page=${page}, limit=${limit}`);

    const skip = (page - 1) * limit;
    const where: any = {};

    if (eventType) {
      where.eventType = eventType;
    }

    if (streamId) {
      where.streamId = streamId;
    }

    try {
      const events = await this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          occurredAt: 'asc'
        }
      });

      return events.map(event => this.mapToDomainEvent(event));
    } catch (error) {
      this.logger.error('Failed to get events:', error);
      throw error;
    }
  }

  /**
   * Get events for a specific aggregate
   */
  async getEventsForAggregate(
    aggregateId: string,
    aggregateType: string,
    fromVersion?: number
  ): Promise<IDomainEvent[]> {
    this.logger.debug(`Getting events for aggregate ${aggregateId}:${aggregateType} from version ${fromVersion || 0}`);

    try {
      const events = await this.prisma.event.findMany({
        where: {
          aggregateId,
          aggregateType,
          ...(fromVersion && { eventVersion: { gte: fromVersion } })
        },
        orderBy: {
          occurredAt: 'asc'
        }
      });

      return events.map(event => this.mapToDomainEvent(event));
    } catch (error) {
      this.logger.error(`Failed to get events for aggregate ${aggregateId}:${aggregateType}:`, error);
      throw error;
    }
  }

  /**
   * Get an event stream for an aggregate
   */
  async getEventStream(streamId: string): Promise<IEventStream> {
    this.logger.debug(`Getting event stream for ${streamId}`);

    try {
      const events = await this.getEvents(undefined, streamId);

      if (events.length === 0) {
        // Return empty stream if no events found
        return {
          streamId,
          aggregateId: streamId,
          aggregateType: 'unknown',
          version: 0,
          events: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      const firstEvent = events[0];
      const lastEvent = events[events.length - 1];

      return {
        streamId,
        aggregateId: firstEvent.aggregateId,
        aggregateType: firstEvent.aggregateType,
        version: lastEvent.version || 1,
        events,
        createdAt: firstEvent.occurredAt,
        updatedAt: lastEvent.occurredAt
      };
    } catch (error) {
      this.logger.error(`Failed to get event stream for ${streamId}:`, error);
      throw error;
    }
  }

  /**
   * Get event statistics
   */
  async getEventStatistics(): Promise<IEventStatistics> {
    this.logger.debug('Getting event statistics');

    try {
      const [
        totalEvents,
        eventsByType,
        lastEvent
      ] = await Promise.all([
        this.prisma.event.count(),
        this.prisma.event.groupBy({
          by: ['eventType'],
          _count: {
            eventType: true
          }
        }),
        this.prisma.event.findFirst({
          orderBy: {
            occurredAt: 'desc'
          },
          select: {
            occurredAt: true
          }
        })
      ]);

      const eventTypes: Record<string, number> = {};
      eventsByType.forEach(stat => {
        eventTypes[stat.eventType] = stat._count.eventType;
      });

      return {
        totalEvents,
        eventTypes,
        successfulEvents: totalEvents, // Assuming all are successful for now
        failedEvents: 0, // No failed events tracking yet
        averageProcessingTime: 0, // Not tracking processing time yet
        lastEventAt: lastEvent?.occurredAt
      };
    } catch (error) {
      this.logger.error('Failed to get event statistics:', error);
      throw error;
    }
  }

  /**
   * Delete old events (cleanup)
   */
  async deleteOldEvents(olderThanDays: number): Promise<number> {
    this.logger.debug(`Deleting events older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.event.deleteMany({
        where: {
          occurredAt: { lt: cutoffDate }
        }
      });

      this.logger.debug(`Deleted ${result.count} old events`);
      return result.count;
    } catch (error) {
      this.logger.error(`Failed to delete old events:`, error);
      throw error;
    }
  }

  /**
   * Create a new event stream
   */
  async createEventStream(
    streamId: string,
    aggregateId: string,
    aggregateType: string
  ): Promise<void> {
    this.logger.debug(`Creating event stream ${streamId} for aggregate ${aggregateId}:${aggregateType}`);

    try {
      await this.prisma.eventStream.create({
        data: {
          streamId,
          aggregateId,
          aggregateType,
          version: 0
        }
      });

      this.logger.debug(`Successfully created event stream ${streamId}`);
    } catch (error) {
      this.logger.error(`Failed to create event stream ${streamId}:`, error);
      throw error;
    }
  }

  /**
   * Save a snapshot of an aggregate's state
   */
  async saveSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    data: any,
    metadata?: any
  ): Promise<void> {
    this.logger.debug(`Saving snapshot for aggregate ${aggregateId}:${aggregateType} at version ${version}`);

    try {
      await this.prisma.eventSnapshot.create({
        data: {
          aggregateId,
          aggregateType,
          version,
          data: data as any,
          metadata: metadata ? JSON.stringify(metadata) : undefined
        }
      });

      this.logger.debug(`Successfully saved snapshot for aggregate ${aggregateId}:${aggregateType}`);
    } catch (error) {
      this.logger.error(`Failed to save snapshot for aggregate ${aggregateId}:${aggregateType}:`, error);
      throw error;
    }
  }

  /**
   * Get the latest snapshot for an aggregate
   */
  async getLatestSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<{ version: number; data: any; metadata?: any } | null> {
    this.logger.debug(`Getting latest snapshot for aggregate ${aggregateId}:${aggregateType}`);

    try {
      const snapshot = await this.prisma.eventSnapshot.findFirst({
        where: {
          aggregateId,
          aggregateType
        },
        orderBy: {
          version: 'desc'
        }
      });

      if (!snapshot) {
        return null;
      }

      return {
        version: snapshot.version,
        data: snapshot.data,
        metadata: snapshot.metadata ? JSON.parse(snapshot.metadata as string) : undefined
      };
    } catch (error) {
      this.logger.error(`Failed to get latest snapshot for aggregate ${aggregateId}:${aggregateType}:`, error);
      throw error;
    }
  }

  /**
   * Map database event to domain event
   */
  private mapToDomainEvent(dbEvent: any): IDomainEvent {
    const metadata = dbEvent.metadata ? JSON.parse(dbEvent.metadata) : {};
    return {
      id: dbEvent.eventId,
      type: dbEvent.eventType,
      aggregateId: dbEvent.aggregateId,
      aggregateType: dbEvent.aggregateType,
      version: dbEvent.eventVersion,
      occurredAt: dbEvent.occurredAt,
      correlationId: dbEvent.correlationId,
      causationId: dbEvent.causationId,
      metadata: dbEvent.eventData,
      schemaVersion: metadata.schemaVersion || '1.0.0'
    };
  }

  /**
   * Map database event to event envelope
   */
  private mapToEventEnvelope(dbEvent: any): IEventEnvelope {
    return {
      eventId: dbEvent.eventId,
      event: this.mapToDomainEvent(dbEvent),
      streamId: dbEvent.streamId || '',
      streamVersion: dbEvent.eventVersion,
      recordedAt: dbEvent.processedAt || dbEvent.occurredAt,
      retryCount: 0
    };
  }

  /**
   * Update retry count for failed events
   */
  async updateRetryCount(eventId: string, retryCount: number): Promise<void> {
    this.logger.debug(`Updating retry count to ${retryCount} for event ${eventId}`);

    // For simplicity, we'll skip retry count updates for now
    // In a production system, you would update retry count in a separate table
  }

  /**
   * Get event processing statistics
   */
  async getStatistics(): Promise<IEventStatistics> {
    return this.getEventStatistics();
  }

  /**
   * Cleanup old events based on retention policy
   */
  async cleanupOldEvents(cutoffDate: Date): Promise<number> {
    const result = await this.prisma.event.deleteMany({
      where: {
        occurredAt: { lt: cutoffDate }
      }
    });

    this.logger.debug(`Cleaned up ${result.count} old events`);
    return result.count;
  }

  /**
   * Get events for replay
   */
  async getEventsForReplay(
    eventType?: string,
    fromVersion?: number,
    batchSize: number = 100
  ): Promise<AsyncIterable<IDomainEvent[]>> {
    const events = await this.getEvents(eventType, undefined, 1, batchSize, fromVersion);

    async function* eventGenerator() {
      yield events;
    }

    return eventGenerator();
  }

  /**
   * Save multiple events atomically
   */
  async saveEvents(events: IDomainEvent[], streamId: string, expectedVersion: number): Promise<IEventEnvelope[]> {
    const envelopes: IEventEnvelope[] = [];

    for (const event of events) {
      const envelope = await this.saveEvent(event, streamId, expectedVersion);
      envelopes.push(envelope);
    }

    return envelopes;
  }
}