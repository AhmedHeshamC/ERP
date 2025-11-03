import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IEventStore } from '../interfaces/event-store.interface';
import { IDomainEvent, IEventEnvelope, IEventStream, IEventStatistics } from '../types/event.types';
import { DomainEvent } from '../types/event.types';

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
   * Save an event to the event store with optimistic concurrency
   */
  async saveEvent(event: IDomainEvent, streamId: string, expectedVersion: number): Promise<IEventEnvelope> {
    this.logger.debug(`Saving event ${event.type} to stream ${streamId} with version ${expectedVersion}`);

    try {
      // Check for version conflicts (optimistic concurrency)
      await this.checkVersionConflict(streamId, expectedVersion);

      // Create event envelope
      const envelope = await this.prisma.event.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          eventData: JSON.stringify(event),
          streamId,
          streamVersion: expectedVersion,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          occurredAt: event.occurredAt,
          version: event.version,
          correlationId: event.correlationId,
          causationId: event.causationId,
          metadata: JSON.stringify(event.metadata),
          schemaVersion: event.schemaVersion,
          recordedAt: new Date(),
          recordedBy: 'system', // Could be injected from context
          retryCount: 0
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
    fromVersion?: number
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

    if (fromVersion) {
      where.streamVersion = { gte: fromVersion };
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: [
        { streamId: 'asc' },
        { streamVersion: 'asc' }
      ],
      skip,
      take: limit
    });

    return events.map(event => this.parseEventData(event.eventData));
  }

  /**
   * Get event stream for an aggregate
   */
  async getEventStream(streamId: string): Promise<IEventStream> {
    this.logger.debug(`Getting event stream for ${streamId}`);

    const events = await this.prisma.event.findMany({
      where: { streamId },
      orderBy: { streamVersion: 'asc' }
    });

    if (events.length === 0) {
      throw new Error(`Event stream not found: ${streamId}`);
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];

    return {
      streamId,
      aggregateId: firstEvent.aggregateId,
      aggregateType: firstEvent.aggregateType,
      version: lastEvent.streamVersion,
      events: events.map(event => this.parseEventData(event.eventData)),
      createdAt: firstEvent.recordedAt,
      updatedAt: lastEvent.recordedAt
    };
  }

  /**
   * Update retry count for failed events
   */
  async updateRetryCount(eventId: string, retryCount: number): Promise<void> {
    this.logger.debug(`Updating retry count to ${retryCount} for event ${eventId}`);

    await this.prisma.event.update({
      where: { eventId },
      data: {
        retryCount,
        lastError: retryCount > 0 ? 'Failed processing' : null
      }
    });
  }

  /**
   * Get event processing statistics
   */
  async getStatistics(): Promise<IEventStatistics> {
    this.logger.debug('Getting event statistics');

    const [
      totalEvents,
      successfulEvents,
      failedEvents,
      eventTypeStats,
      lastEvent
    ] = await Promise.all([
      this.prisma.event.count(),
      this.prisma.event.count({ where: { retryCount: 0 } }),
      this.prisma.event.count({ where: { retryCount: { gt: 0 } } }),
      this.prisma.event.groupBy({
        by: ['eventType'],
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } }
      }),
      this.prisma.event.findFirst({
        orderBy: { recordedAt: 'desc' },
        select: { recordedAt: true }
      })
    ]);

    // Transform event type stats
    const eventTypes: Record<string, number> = {};
    eventTypeStats.forEach(stat => {
      eventTypes[stat.eventType] = stat._count.eventType;
    });

    // Calculate average processing time (mock for now)
    const averageProcessingTime = 150; // This would come from actual metrics

    return {
      totalEvents,
      eventTypes,
      successfulEvents,
      failedEvents,
      averageProcessingTime,
      lastEventAt: lastEvent?.recordedAt
    };
  }

  /**
   * Cleanup old events based on retention policy
   */
  async cleanupOldEvents(cutoffDate: Date): Promise<number> {
    this.logger.debug(`Cleaning up events before ${cutoffDate}`);

    const result = await this.prisma.event.deleteMany({
      where: {
        recordedAt: { lt: cutoffDate }
      }
    });

    this.logger.debug(`Cleaned up ${result.count} old events`);
    return result.count;
  }

  /**
   * Get events for replay with async iteration
   */
  async getEventsForReplay(
    eventType?: string,
    fromVersion?: number,
    batchSize: number = 100
  ): Promise<AsyncIterable<IDomainEvent[]>> {
    this.logger.debug(`Getting events for replay: eventType=${eventType}, fromVersion=${fromVersion}`);

    const self = this;

    return {
      async *[Symbol.asyncIterator]() {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          const events = await self.getEvents(eventType, undefined, page, batchSize, fromVersion);

          if (events.length === 0) {
            hasMore = false;
          } else {
            yield events;
            page++;

            // If we got less than the batch size, we're at the end
            if (events.length < batchSize) {
              hasMore = false;
            }
          }
        }
      }
    };
  }

  /**
   * Save multiple events atomically
   */
  async saveEvents(events: IDomainEvent[], streamId: string, expectedVersion: number): Promise<IEventEnvelope[]> {
    this.logger.debug(`Saving ${events.length} events to stream ${streamId}`);

    return await this.prisma.$transaction(async (tx) => {
      const envelopes: IEventEnvelope[] = [];

      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const version = expectedVersion + i;

        const envelope = await tx.event.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            eventData: JSON.stringify(event),
            streamId,
            streamVersion: version,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            occurredAt: event.occurredAt,
            version: event.version,
            correlationId: event.correlationId,
            causationId: event.causationId,
            metadata: JSON.stringify(event.metadata),
            schemaVersion: event.schemaVersion,
            recordedAt: new Date(),
            recordedBy: 'system',
            retryCount: 0
          }
        });

        envelopes.push(this.mapToEventEnvelope(envelope));
      }

      return envelopes;
    });
  }

  /**
   * Check for version conflicts (optimistic concurrency)
   */
  private async checkVersionConflict(streamId: string, expectedVersion: number): Promise<void> {
    const existingEvent = await this.prisma.event.findFirst({
      where: { streamId },
      orderBy: { streamVersion: 'desc' }
    });

    if (existingEvent && existingEvent.streamVersion >= expectedVersion) {
      throw new Error(
        `Version conflict: Expected version ${expectedVersion} but stream ${streamId} is at version ${existingEvent.streamVersion}`
      );
    }
  }

  /**
   * Parse event data from JSON string
   */
  private parseEventData(eventData: string): IDomainEvent {
    try {
      const data = JSON.parse(eventData);
      // Return as plain object for now - in a real implementation,
      // you might want to reconstruct the actual event class
      return {
        ...data,
        occurredAt: new Date(data.occurredAt)
      };
    } catch (error) {
      this.logger.error('Failed to parse event data:', error);
      throw new Error(`Invalid event data: ${eventData}`);
    }
  }

  /**
   * Map database event to event envelope
   */
  private mapToEventEnvelope(dbEvent: any): IEventEnvelope {
    return {
      eventId: dbEvent.id,
      event: this.parseEventData(dbEvent.eventData),
      streamId: dbEvent.streamId,
      streamVersion: dbEvent.streamVersion,
      recordedAt: dbEvent.recordedAt,
      recordedBy: dbEvent.recordedBy,
      retryCount: dbEvent.retryCount,
      lastError: dbEvent.lastError
    };
  }

  /**
   * Get stream information for monitoring
   */
  async getStreamInfo(streamId: string): Promise<{
    exists: boolean;
    version: number;
    eventCount: number;
    lastUpdated?: Date;
  }> {
    const [count, lastEvent] = await Promise.all([
      this.prisma.event.count({ where: { streamId } }),
      this.prisma.event.findFirst({
        where: { streamId },
        orderBy: { streamVersion: 'desc' },
        select: { streamVersion: true, recordedAt: true }
      })
    ]);

    return {
      exists: count > 0,
      version: lastEvent?.streamVersion || 0,
      eventCount: count,
      lastUpdated: lastEvent?.recordedAt
    };
  }
}