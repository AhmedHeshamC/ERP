import { expect } from 'chai';
import { EventBusService } from '../services/event-bus.service';
import { IEventBus } from '../interfaces/event-bus.interface';
import { IDomainEvent, IEventSubscription } from '../types/event.types';
import { UserCreatedEvent } from '../types/domain-events.types';

describe('EventBusService - TDD Tests', () => {
  let eventBus: IEventBus;
  let mockEventStore: any;
  let mockMiddlewareService: any;

  beforeEach(() => {
    // Mock dependencies - these will be implemented later
    mockEventStore = {
      saveEvent: async () => {},
      getEvents: async () => [],
      getEventStream: async () => ({ events: [], version: 0 })
    };

    mockMiddlewareService = {
      process: async (event: IDomainEvent) => event,
      addMiddleware: async () => {}
    };

    // This will fail initially since EventBusService doesn't exist yet
    eventBus = new EventBusService(mockEventStore, mockMiddlewareService);
  });

  describe('RED Phase - Tests should fail initially', () => {
    it('should publish an event to subscribers', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let receivedEvent: IDomainEvent | null = null;

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvent = evt;
      });

      // Publish event
      await eventBus.publish(event);

      // Verify event was received
      expect(receivedEvent).to.not.be.null;
      expect(receivedEvent!.type).to.equal('UserCreated');
      expect(receivedEvent!.aggregateId).to.equal('user-123');
      expect(receivedEvent!.metadata.email).to.equal('test@example.com');
    });

    it('should handle multiple subscribers for the same event type', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let receivedEvents: IDomainEvent[] = [];

      // Subscribe multiple handlers
      await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvents.push({ ...evt, metadata: { ...evt.metadata, handler: 'handler1' } });
      });

      await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvents.push({ ...evt, metadata: { ...evt.metadata, handler: 'handler2' } });
      });

      // Publish event
      await eventBus.publish(event);

      // Verify both handlers received the event
      expect(receivedEvents).to.have.length(2);
      expect(receivedEvents[0].metadata.handler).to.equal('handler1');
      expect(receivedEvents[1].metadata.handler).to.equal('handler2');
    });

    it('should filter events based on subscription criteria', async () => {
      const event1 = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      const event2 = new UserCreatedEvent({
        aggregateId: 'user-456',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      });

      let receivedEvents: IDomainEvent[] = [];

      // Subscribe with filter for only ADMIN users
      await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvents.push(evt);
      }, {
        metadata: { role: 'ADMIN' }
      });

      // Publish both events
      await eventBus.publish(event1);
      await eventBus.publish(event2);

      // Verify only ADMIN event was received
      expect(receivedEvents).to.have.length(1);
      expect(receivedEvents[0].metadata.role).to.equal('ADMIN');
    });

    it('should unsubscribe from events', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let receivedCount = 0;

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async () => {
        receivedCount++;
      });

      // Publish event - should be received
      await eventBus.publish(event);
      expect(receivedCount).to.equal(1);

      // Unsubscribe
      await eventBus.unsubscribe(subscriptionId);

      // Publish again - should not be received
      await eventBus.publish(event);
      expect(receivedCount).to.equal(1); // Still 1, not 2
    });

    it('should handle event publishing failures gracefully', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let errorHandlerCalled = false;

      // Subscribe with a handler that throws an error
      await eventBus.subscribe('UserCreated', async () => {
        throw new Error('Handler failed');
      });

      // Subscribe with error handler
      await eventBus.on('error', async (error) => {
        errorHandlerCalled = true;
        expect(error.message).to.include('Handler failed');
      });

      // Publish event - should not throw, but should trigger error handler
      await eventBus.publish(event);
      expect(errorHandlerCalled).to.be.true;
    });

    it('should persist events to event store', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      // Mock event store saveEvent method
      mockEventStore.saveEvent = async (envelope) => {
        expect(envelope.event.id).to.equal(event.id);
        expect(envelope.event.type).to.equal('UserCreated');
        expect(envelope.streamId).to.equal('User-user-123');
      };

      await eventBus.publish(event);

      // If we get here, the mock assertions passed
      expect(mockEventStore.saveEvent.called).to.be.true;
    });

    it('should replay events from event store', async () => {
      const events = [
        new UserCreatedEvent({
          aggregateId: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'USER'
        }),
        new UserCreatedEvent({
          aggregateId: 'user-456',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN'
        })
      ];

      // Mock event store getEvents method
      mockEventStore.getEvents = async (eventType?, aggregateId?) => {
        if (eventType === 'UserCreated') {
          return events;
        }
        return [];
      };

      let receivedEvents: IDomainEvent[] = [];

      // Subscribe to events
      await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvents.push(evt);
      });

      // Replay events
      await eventBus.replayEvents('UserCreated');

      // Verify all events were replayed
      expect(receivedEvents).to.have.length(2);
      expect(receivedEvents[0].aggregateId).to.equal('user-123');
      expect(receivedEvents[1].aggregateId).to.equal('user-456');
    });

    it('should provide event statistics', async () => {
      // Mock event store to return some statistics
      const mockStats = {
        totalEvents: 100,
        eventTypes: { UserCreated: 50, ProductCreated: 30, OrderCreated: 20 },
        successfulEvents: 95,
        failedEvents: 5,
        averageProcessingTime: 150,
        lastEventAt: new Date()
      };

      mockEventStore.getStatistics = async () => mockStats;

      const stats = await eventBus.getStatistics();

      expect(stats.totalEvents).to.equal(100);
      expect(stats.eventTypes.UserCreated).to.equal(50);
      expect(stats.successfulEvents).to.equal(95);
      expect(stats.averageProcessingTime).to.equal(150);
    });
  });

  describe('GREEN Phase - Tests should pass after implementation', () => {
    // These tests will pass once we implement the EventBusService
    // They are here to guide the implementation

    it('should maintain event ordering', async () => {
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

      let receivedEvents: IDomainEvent[] = [];

      await eventBus.subscribe('UserCreated', async (evt) => {
        receivedEvents.push(evt);
      });

      // Publish events in order
      for (const event of events) {
        await eventBus.publish(event);
      }

      // Verify order is maintained
      expect(receivedEvents).to.have.length(2);
      expect(receivedEvents[0].metadata.email).to.equal('test@example.com');
      expect(receivedEvents[1].metadata.email).to.equal('updated@example.com');
    });
  });
});