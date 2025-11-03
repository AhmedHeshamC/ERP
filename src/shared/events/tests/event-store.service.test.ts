import { expect } from 'chai';
import { EventStoreService } from '../services/event-store.service';
import { IEventStore } from '../interfaces/event-store.interface';
import { IDomainEvent, IEventStream, IEventEnvelope } from '../types/event.types';
import { UserCreatedEvent, ProductCreatedEvent } from '../types/domain-events.types';

describe('EventStoreService - TDD Tests', () => {
  let eventStore: IEventStore;
  let mockPrisma: any;

  beforeEach(() => {
    // Mock Prisma service - this will be implemented with actual database later
    mockPrisma = {
      event: {
        create: async () => ({}),
        findMany: async () => [],
        findFirst: async () => null,
        count: async () => 0,
        groupBy: async () => []
      },
      $transaction: async (callback) => callback(mockPrisma)
    };

    // This will fail initially since EventStoreService doesn't exist yet
    eventStore = new EventStoreService(mockPrisma);
  });

  describe('RED Phase - Tests should fail initially', () => {
    it('should save event with envelope metadata', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      const envelope = await eventStore.saveEvent(event, 'User-user-123', 1);

      // Verify envelope structure
      expect(envelope).to.not.be.null;
      expect(envelope.eventId).to.be.a('string');
      expect(envelope.event).to.deep.include({
        id: event.id,
        type: 'UserCreated',
        aggregateId: 'user-123',
        aggregateType: 'User'
      });
      expect(envelope.streamId).to.equal('User-user-123');
      expect(envelope.streamVersion).to.equal(1);
      expect(envelope.recordedAt).to.be.instanceOf(Date);
      expect(envelope.retryCount).to.equal(0);
    });

    it('should retrieve events by stream ID', async () => {
      const events = [
        new UserCreatedEvent({
          aggregateId: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER'
        }),
        new UserCreatedEvent({
          aggregateId: 'user-123',
          email: 'updated@example.com',
          firstName: 'John',
          lastName: 'Smith',
          role: 'USER'
        })
      ];

      // Mock database responses
      mockPrisma.event.findMany = async () => [
        {
          id: 'env-1',
          eventId: events[0].id,
          eventData: JSON.stringify(events[0]),
          streamId: 'User-user-123',
          streamVersion: 1,
          recordedAt: new Date(),
          recordedBy: 'system',
          retryCount: 0
        },
        {
          id: 'env-2',
          eventId: events[1].id,
          eventData: JSON.stringify(events[1]),
          streamId: 'User-user-123',
          streamVersion: 2,
          recordedAt: new Date(),
          recordedBy: 'system',
          retryCount: 0
        }
      ];

      const stream = await eventStore.getEventStream('User-user-123');

      // Verify stream structure
      expect(stream.streamId).to.equal('User-user-123');
      expect(stream.aggregateId).to.equal('user-123');
      expect(stream.aggregateType).to.equal('User');
      expect(stream.version).to.equal(2);
      expect(stream.events).to.have.length(2);
      expect(stream.events[0].metadata.email).to.equal('test@example.com');
      expect(stream.events[1].metadata.email).to.equal('updated@example.com');
    });

    it('should retrieve events by type', async () => {
      const events = [
        new UserCreatedEvent({
          aggregateId: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER'
        }),
        new ProductCreatedEvent({
          aggregateId: 'product-456',
          name: 'Test Product',
          sku: 'TEST-001',
          price: 99.99,
          stock: 100
        })
      ];

      // Mock database response for UserCreated events only
      mockPrisma.event.findMany = async ({ where }) => {
        if (where.eventData.includes('UserCreated')) {
          return [{
            id: 'env-1',
            eventId: events[0].id,
            eventData: JSON.stringify(events[0]),
            streamId: 'User-user-123',
            streamVersion: 1,
            recordedAt: new Date(),
            recordedBy: 'system',
            retryCount: 0
          }];
        }
        return [];
      };

      const userEvents = await eventStore.getEvents('UserCreated');

      // Verify only UserCreated events are returned
      expect(userEvents).to.have.length(1);
      expect(userEvents[0].type).to.equal('UserCreated');
      expect(userEvents[0].metadata.email).to.equal('test@example.com');
    });

    it('should retrieve events with pagination', async () => {
      const page = 1;
      const limit = 10;

      // Mock paginated response
      mockPrisma.event.findMany = async ({ skip, take }) => {
        expect(skip).to.equal((page - 1) * limit);
        expect(take).to.equal(limit);
        return [];
      };

      mockPrisma.event.count = async () => 25;

      const result = await eventStore.getEvents(undefined, undefined, page, limit);

      // Verify pagination parameters were used correctly
      expect(result).to.be.an('array');
      // We'll test total count in actual implementation
    });

    it('should replay events from specific version', async () => {
      const streamId = 'User-user-123';
      const fromVersion = 5;

      mockPrisma.event.findMany = async ({ where }) => {
        expect(where.streamId).to.equal(streamId);
        expect(where.streamVersion.gte).to.equal(fromVersion);
        return [];
      };

      const events = await eventStore.getEvents(undefined, streamId, 1, 100, fromVersion);

      // Verify fromVersion parameter was used
      expect(events).to.be.an('array');
    });

    it('should handle event version conflicts', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      // Mock version conflict scenario
      mockPrisma.event.findFirst = async () => ({
        streamVersion: 5 // Expected version is 1, but stream is already at 5
      });

      try {
        await eventStore.saveEvent(event, 'User-user-123', 1);
        expect.fail('Should have thrown version conflict error');
      } catch (error) {
        expect(error.message).to.include('version conflict');
      }
    });

    it('should update retry count for failed events', async () => {
      const eventId = 'event-123';
      const newRetryCount = 3;

      mockPrisma.event.update = async ({ where, data }) => {
        expect(where.eventId).to.equal(eventId);
        expect(data.retryCount).to.equal(newRetryCount);
        return {};
      };

      await eventStore.updateRetryCount(eventId, newRetryCount);

      // If we get here, the mock assertions passed
      expect(mockPrisma.event.update.called).to.be.true;
    });

    it('should get event statistics', async () => {
      const mockStats = {
        totalEvents: 100,
        eventTypes: [
          { eventType: 'UserCreated', count: 50 },
          { eventType: 'ProductCreated', count: 30 },
          { eventType: 'OrderCreated', count: 20 }
        ],
        successfulEvents: 95,
        failedEvents: 5,
        averageProcessingTime: 150
      };

      mockPrisma.event.count = async ({ where }) => {
        if (!where) return 100; // total events
        if (where.retryCount.equals(0)) return 95; // successful events
        return 5; // failed events
      };

      mockPrisma.event.groupBy = async () => mockStats.eventTypes;

      const stats = await eventStore.getStatistics();

      expect(stats.totalEvents).to.equal(100);
      expect(stats.eventTypes.UserCreated).to.equal(50);
      expect(stats.eventTypes.ProductCreated).to.equal(30);
      expect(stats.eventTypes.OrderCreated).to.equal(20);
      expect(stats.successfulEvents).to.equal(95);
      expect(stats.failedEvents).to.equal(5);
    });

    it('should cleanup old events', async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

      mockPrisma.event.deleteMany = async ({ where }) => {
        expect(where.recordedAt.lt).to.deep.equal(cutoffDate);
        return { count: 50 };
      };

      const deletedCount = await eventStore.cleanupOldEvents(cutoffDate);

      expect(deletedCount).to.equal(50);
      expect(mockPrisma.event.deleteMany.called).to.be.true;
    });
  });

  describe('GREEN Phase - Tests should pass after implementation', () => {
    // These tests will pass once we implement the EventStoreService

    it('should handle concurrent event saves', async () => {
      const events = [
        new UserCreatedEvent({
          aggregateId: 'user-123',
          email: 'test1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER'
        }),
        new UserCreatedEvent({
          aggregateId: 'user-456',
          email: 'test2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'USER'
        })
      ];

      // Mock transaction handling
      mockPrisma.$transaction = async (callback) => {
        return callback(mockPrisma);
      };

      // Save events concurrently
      const promises = events.map((event, index) =>
        eventStore.saveEvent(event, `User-${event.aggregateId}`, 1)
      );

      const results = await Promise.all(promises);

      expect(results).to.have.length(2);
      expect(results[0].event.id).to.equal(events[0].id);
      expect(results[1].event.id).to.equal(events[1].id);
    });
  });
});