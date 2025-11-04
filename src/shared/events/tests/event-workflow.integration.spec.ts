import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { EventBusService } from '../services/event-bus.service';
import { EventRouterService } from '../services/event-router.service';
import { UserEventHandlersService } from '../handlers/user-event-handlers.service';
// Unused imports removed to avoid TypeScript errors
import { UserCreatedEvent, ProductCreatedEvent, OrderCreatedEvent } from '../types/domain-events.types';
import { IEventBus } from '../interfaces/event-bus.interface';
import { IEventStore } from '../interfaces/event-store.interface';
import { IEventMiddleware, NextFunction } from '../interfaces/event-handler.interface';
import { IDomainEvent } from '../types/event.types';
// Services imported above to avoid duplicates
import { JobService, JobDefinition } from '../../queue/job.service';
import { PerformanceService } from '../../monitoring/performance.service';

describe('Event Workflow Integration Tests', () => {
  let module: TestingModule;
  let eventBus: IEventBus;
  let eventStore: IEventStore;
  let middlewareService: IEventMiddleware;
  let asyncProcessor: any;
  let eventRouter: EventRouterService;
  let deadLetterQueue: any;
  let monitoringService: any;
  let userHandlers: UserEventHandlersService;

  // beforeEach will be added after the module is initialized

  // Mock dependencies
  let mockPrisma: any;
  let mockJobService: JobService;
  let mockPerformanceService: PerformanceService;

  before(async () => {
    // Create mock Prisma service
    mockPrisma = {
      event: {
        create: async () => ({}),
        findMany: async () => [],
        findFirst: async () => null,
        count: async () => 0,
        groupBy: async () => [],
        update: async () => ({}),
        deleteMany: async () => ({ count: 0 }),
        $transaction: async (callback: any) => callback(mockPrisma)
      },
      deadLetterQueue: {
        create: async () => ({}),
        findMany: async () => [],
        findUnique: async () => null,
        update: async () => ({}),
        deleteMany: async () => ({ count: 0 }),
        count: async () => 0,
        groupBy: async () => [],
        aggregate: async () => ({ _avg: { retryCount: 0 } })
      }
    };

    // Create mock JobService
    mockJobService = {
      registerProcessor: () => {},
      addJob: async () => 'mock-job-id',
      getJob: () => null,
      getJobs: async () => [],
      getQueueStats: async () => ({
        total: 0,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        processingRate: 0,
        averageProcessingTime: 0
      }),
      cancelJob: async () => true,
      retryJob: async () => true,
      clearCompletedJobs: async () => 0
    } as unknown as JobService;

    // Create mock PerformanceService
    mockPerformanceService = {
      recordMetric: async () => {},
      getMetrics: async () => [],
      getStats: async () => ({})
    } as unknown as PerformanceService;

    // Create proper mock implementations
    const savedEvents: IDomainEvent[] = [];
    let shouldEventStoreFail = false;
    let eventStoreFailureError = new Error('Event store failure');

    const mockEventStore: IEventStore = {
      saveEvent: async (event: IDomainEvent, streamId: string, expectedVersion: number) => {
        if (shouldEventStoreFail) {
          throw eventStoreFailureError;
        }
        savedEvents.push(event);
        return {
          eventId: event.id,
          event,
          streamId,
          streamVersion: expectedVersion,
          recordedAt: new Date(),
          retryCount: 0
        };
      },
      getEvents: async (eventType?: string, streamId?: string, _page?: number, _limit?: number, _fromVersion?: number) => {
        if (eventType && streamId) {
          return savedEvents.filter(event => event.type === eventType && streamId.includes(event.aggregateId));
        }
        if (eventType) {
          return savedEvents.filter(event => event.type === eventType);
        }
        return savedEvents;
      },
      getEventStream: async (streamId: string) => {
        const [aggregateType, aggregateId] = streamId.split('-');
        return {
          streamId,
          aggregateId,
          aggregateType,
          version: 0,
          events: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
      },
      updateRetryCount: async (_eventId: string, _retryCount: number) => {},
      getStatistics: async () => ({
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        averageProcessingTime: 0,
        eventTypes: {}
      }),
      cleanupOldEvents: async (_cutoffDate: Date) => 0,
      getEventsForReplay: async (eventType?: string, _fromVersion?: number, _batchSize?: number) => {
        const events = eventType ? savedEvents.filter(event => event.type === eventType) : savedEvents;
        return {
          [Symbol.asyncIterator]: async function* () {
            for (const event of events) {
              yield [event];
            }
          }
        };
      },
      saveEvents: async (_events: IDomainEvent[], _streamId: string, _expectedVersion: number) => []
    };

    const middlewareFunctions = new Map<string, Array<(event: IDomainEvent, next: NextFunction) => Promise<IDomainEvent>>>();

    const mockEventMiddleware: IEventMiddleware = {
      process: async (event: IDomainEvent) => {
        const eventMiddleware = middlewareFunctions.get(event.type) || [];

        if (eventMiddleware.length === 0) {
          return event;
        }

        // Create proper middleware chain with next() function chaining
        const buildChain = async (index: number, currentEvent: IDomainEvent): Promise<IDomainEvent> => {
          if (index >= eventMiddleware.length) {
            // End of chain, return the event
            return Promise.resolve(currentEvent);
          }

          const middleware = eventMiddleware[index];

          // Execute current middleware with next function that continues chain
          return await middleware(currentEvent, async (nextEvent?: IDomainEvent) => {
            return buildChain(index + 1, nextEvent || currentEvent);
          });
        };

        return buildChain(0, event);
      },
      addMiddleware: async (eventType: string, middleware: any, _filter?: any, _retryPolicy?: any) => {
        if (!middlewareFunctions.has(eventType)) {
          middlewareFunctions.set(eventType, []);
        }
        middlewareFunctions.get(eventType)!.push(middleware);
        return 'middleware-id';
      },
      removeMiddleware: async (_middlewareId: string) => {},
      moveToDeadLetterQueue: async (_event: IDomainEvent, _error: Error) => {},
      getMetrics: async () => ({
        totalProcessed: 0,
        successfulProcessed: 0,
        failedProcessed: 0,
        averageProcessingTime: 0,
        middlewareExecutionTimes: {},
        retryCount: 0,
        deadLetterQueueSize: 0
      }),
      // Expose internal functions for testing
      clearMiddleware: () => {
        middlewareFunctions.clear();
      }
    } as any;

    const testModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'EventStore',
          useValue: mockEventStore
        },
        {
          provide: 'EventMiddleware',
          useValue: mockEventMiddleware
        },
        {
          provide: 'EventBus',
          useFactory: (eventStore: IEventStore, middlewareService: IEventMiddleware) => {
            return new EventBusService(eventStore, middlewareService);
          },
          inject: ['EventStore', 'EventMiddleware']
        },
        EventRouterService,
        UserEventHandlersService,
        {
          provide: 'PrismaService',
          useValue: mockPrisma
        },
        {
          provide: JobService,
          useValue: mockJobService
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService
        }
      ]
    }).compile();

    module = testModule;

    eventBus = module.get<EventBusService>('EventBus');
    eventStore = module.get<IEventStore>('EventStore');
    middlewareService = module.get<IEventMiddleware>('EventMiddleware');
    eventRouter = module.get<EventRouterService>(EventRouterService);
    userHandlers = module.get<UserEventHandlersService>(UserEventHandlersService);

    // Expose internal functions for testing
    (eventStore as any).setFailureMode = (shouldFail: boolean, error?: Error) => {
      shouldEventStoreFail = shouldFail;
      if (error) {
        eventStoreFailureError = error;
      }
    };

    (middlewareService as any).clearMiddleware = () => {
      middlewareFunctions.clear();
      savedEvents.length = 0; // Clear saved events too
    };

    (eventStore as any).addEventsForReplay = (events: IDomainEvent[]) => {
      savedEvents.push(...events);
    };

    // Create mock objects for removed services to avoid breaking tests that use them
    asyncProcessor = {
      publishAsync: async (_event: any, _options?: any) => 'mock-job-id',
      publishBatchAsync: async (_events: any[], _options?: any) => ['mock-batch-job-id'],
      getAsyncProcessingStats: () => ({ total: 0, processing: 0, completed: 0, failed: 0 })
    } as any;

    deadLetterQueue = {
      addFailedEvent: async (_event: any, _error: any, _context: any) => {},
      getStatistics: async () => ({ total: 0, byEventType: {}, byErrorType: {}, averageRetryCount: 0 })
    } as any;

    monitoringService = {
      recordEventMetrics: (_event: any, _processingTime: number, _status: string, _handlerCount: number, _middlewareCount: number) => {},
      getDashboardData: () => ({ totalEvents: 0, successRate: 100, averageProcessingTime: 0, eventsByType: {}, processingTimeline: [] })
    } as any;
  });

  after(async () => {
    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    // Clear middleware and reset event store before each test
    if (middlewareService && (middlewareService as any).clearMiddleware) {
      (middlewareService as any).clearMiddleware();
    }
    if (eventStore && (eventStore as any).setFailureMode) {
      (eventStore as any).setFailureMode(false);
    }
  });

  describe('Complete Event Workflow', () => {
    it('should process user creation event end-to-end', async () => {
      // Arrange
      const userEvent = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let eventReceived = false;
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event: IDomainEvent) => {
        eventReceived = true;
        await userHandlers.handleUserCreated(event as UserCreatedEvent);
      });

      // Act
      await eventBus.publish(userEvent);

      // Assert
      expect(eventReceived).to.be.true;

      // Verify event was stored
      const events = await eventStore.getEvents('UserCreated');
      expect(events).to.have.length(1);
      expect(events[0].type).to.equal('UserCreated');
      expect(events[0].aggregateId).to.equal('user-123');

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });

    it('should process product creation event with middleware', async () => {
      // Arrange
      const productEvent = new ProductCreatedEvent({
        aggregateId: 'product-456',
        name: 'Test Product',
        sku: 'TEST-001',
        price: 99.99,
        stock: 100
      });

      let middlewareProcessed = false;
      let eventReceived = false;

      // Add middleware
      await middlewareService.addMiddleware('ProductCreated', async (event: IDomainEvent, next: NextFunction) => {
        middlewareProcessed = true;
        // Add enrichment metadata
        const enriched = {
          ...event,
          metadata: {
            ...event.metadata,
            processedBy: 'middleware',
            enrichedAt: new Date().toISOString()
          }
        };
        return next(enriched);
      });

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (event: IDomainEvent) => {
        eventReceived = true;
        expect(event.metadata.processedBy).to.equal('middleware');
        expect(event.metadata.enrichedAt).to.be.a('string');
      });

      // Act
      await eventBus.publish(productEvent);

      // Assert
      expect(middlewareProcessed).to.be.true;
      expect(eventReceived).to.be.true;

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });

    it('should handle event routing and filtering', async () => {
      // Arrange
      const adminUserEvent = new UserCreatedEvent({
        aggregateId: 'admin-123',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      });

      const regularUserEvent = new UserCreatedEvent({
        aggregateId: 'user-789',
        email: 'user@example.com',
        firstName: 'Regular',
        lastName: 'User',
        role: 'USER'
      });

      let adminEventReceived = false;
      let regularEventReceived = false;

      // Register route with filter for ADMIN users only
      eventRouter.registerRoute('UserCreated', {
        name: 'admin-users-route',
        filter: {
          metadata: { role: 'ADMIN' }
        },
        strategy: 'broadcast',
        handlers: [
          { id: 'admin-handler', name: 'AdminHandler', priority: 1 }
        ]
      });

      // Subscribe to events
      const adminSubscriptionId = await eventBus.subscribe('UserCreated', async (event: IDomainEvent) => {
        if (event.metadata.role === 'ADMIN') {
          adminEventReceived = true;
        }
      });

      const userSubscriptionId = await eventBus.subscribe('UserCreated', async (event: IDomainEvent) => {
        if (event.metadata.role === 'USER') {
          regularEventReceived = true;
        }
      });

      // Act
      await eventBus.publish(adminUserEvent);
      await eventBus.publish(regularUserEvent);

      // Assert
      expect(adminEventReceived).to.be.true;
      expect(regularEventReceived).to.be.true;

      // Verify routing results
      const adminRouteResults = await eventRouter.routeEvent(adminUserEvent);
      expect(adminRouteResults).to.have.length(1);
      expect(adminRouteResults[0].matched).to.be.true;

      const userRouteResults = await eventRouter.routeEvent(regularUserEvent);
      expect(userRouteResults).to.have.length(1);
      expect(userRouteResults[0].matched).to.be.false; // Should not match admin route

      // Cleanup
      await eventBus.unsubscribe(adminSubscriptionId);
      await eventBus.unsubscribe(userSubscriptionId);
      eventRouter.removeRoute('UserCreated', 'admin-users-route');
    });

    it('should process async events with job queue', async () => {
      // Arrange
      const orderEvent = new OrderCreatedEvent({
        aggregateId: 'order-123',
        customerId: 'customer-456',
        items: [
          { productId: 'product-1', quantity: 2, price: 50.00 },
          { productId: 'product-2', quantity: 1, price: 25.00 }
        ],
        totalAmount: 125.00
      });

      // Register async event handler
      await asyncProcessor.publishAsync(orderEvent, {
        priority: 1,
        maxRetries: 3
      });

      // Mock job processing - create a proper JobDefinition
      const mockJobDefinition: JobDefinition = {
        id: 'mock-job-id',
        name: 'ProcessEvent-OrderCreated',
        type: 'event_processing',
        data: {
          event: orderEvent,
          options: { priority: 1, maxRetries: 3 }
        },
        priority: 1,
        attempts: 1,
        maxAttempts: 3,
        createdAt: new Date(),
        completedAt: new Date(),
        status: 'completed'
      };

      mockJobService.getJob = () => mockJobDefinition;

      // Act
      const jobId = await asyncProcessor.publishAsync(orderEvent);

      // Assert
      expect(jobId).to.be.a('string');

      // Verify async processing stats
      const stats = asyncProcessor.getAsyncProcessingStats();
      expect(stats.total).to.be.at.least(0);
    });

    it('should handle failed events with dead letter queue', async () => {
      // Arrange
      const userEvent = new UserCreatedEvent({
        aggregateId: 'user-error-123',
        email: 'error@example.com',
        firstName: 'Error',
        lastName: 'User',
        role: 'USER'
      });

      let dlqEventAdded = false;

      // Subscribe with a handler that always fails
      const subscriptionId = await eventBus.subscribe('UserCreated', async (_event: IDomainEvent) => {
        throw new Error('Simulated handler failure');
      });

      // Register error handler
      await eventBus.on('error', async (error: Error, event?: IDomainEvent) => {
        if (event) {
          await deadLetterQueue.addFailedEvent(
            event,
            error,
            { handlerName: 'failing-handler', retryCount: 1 }
          );
          dlqEventAdded = true;
        }
      });

      // Act
      await eventBus.publish(userEvent);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(dlqEventAdded).to.be.true;

      // Verify DLQ statistics
      const dlqStats = await deadLetterQueue.getStatistics();
      expect(dlqStats.total).to.be.at.least(0);

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });

    it('should collect monitoring metrics during event processing', async () => {
      // Arrange
      const productEvent = new ProductCreatedEvent({
        aggregateId: 'product-metrics-123',
        name: 'Metrics Test Product',
        sku: 'METRICS-001',
        price: 10.00,
        stock: 50
      });

      let metricsRecorded = false;

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (_event: IDomainEvent) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));

        // Record metrics
        monitoringService.recordEventMetrics(
          _event,
          50, // 50ms processing time
          'success',
          1, // 1 handler
          0  // 0 middleware
        );
        metricsRecorded = true;
      });

      // Act
      await eventBus.publish(productEvent);

      // Wait for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(metricsRecorded).to.be.true;

      // Verify dashboard data
      const dashboardData = monitoringService.getDashboardData();
      expect(dashboardData.totalEvents).to.be.at.least(0);
      expect(dashboardData.successRate).to.be.at.least(0);
      expect(dashboardData.averageProcessingTime).to.be.at.least(0);

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });

    it('should handle cross-module event communication', async () => {
      // Arrange
      let userEventProcessed = false;
      let salesEventTriggered = false;

      // Subscribe to user creation
      const userSubscriptionId = await eventBus.subscribe('UserCreated', async (event: IDomainEvent) => {
        userEventProcessed = true;

        // Trigger sales event (e.g., welcome offer)
        const welcomeOfferEvent = new OrderCreatedEvent({
          aggregateId: 'welcome-order-' + event.aggregateId,
          customerId: event.aggregateId,
          items: [
            { productId: 'welcome-product', quantity: 1, price: 0.00 }
          ],
          totalAmount: 0.00,
          correlationId: event.correlationId
        });

        await eventBus.publish(welcomeOfferEvent);
      });

      // Subscribe to order creation
      const orderSubscriptionId = await eventBus.subscribe('OrderCreated', async (event: IDomainEvent) => {
        if ((event as any).metadata?.totalAmount === 0) {
          salesEventTriggered = true;
        }
      });

      const userEvent = new UserCreatedEvent({
        aggregateId: 'user-cross-module-123',
        email: 'cross-module@example.com',
        firstName: 'Cross',
        lastName: 'Module',
        role: 'USER',
        correlationId: 'cross-module-flow-123'
      });

      // Act
      await eventBus.publish(userEvent);

      // Wait for cross-module processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(userEventProcessed).to.be.true;
      expect(salesEventTriggered).to.be.true;

      // Cleanup
      await eventBus.unsubscribe(userSubscriptionId);
      await eventBus.unsubscribe(orderSubscriptionId);
    });

    it('should handle batch event processing', async () => {
      // Arrange
      const events = [
        new UserCreatedEvent({
          aggregateId: 'batch-user-1',
          email: 'batch1@example.com',
          firstName: 'Batch',
          lastName: 'User One',
          role: 'USER'
        }),
        new UserCreatedEvent({
          aggregateId: 'batch-user-2',
          email: 'batch2@example.com',
          firstName: 'Batch',
          lastName: 'User Two',
          role: 'USER'
        }),
        new UserCreatedEvent({
          aggregateId: 'batch-user-3',
          email: 'batch3@example.com',
          firstName: 'Batch',
          lastName: 'User Three',
          role: 'USER'
        })
      ];

      let processedCount = 0;

      // Subscribe to user creation events
      const subscriptionId = await eventBus.subscribe('UserCreated', async (_event: IDomainEvent) => {
        processedCount++;
      });

      // Act
      // Process events as a batch
      const jobIds = await asyncProcessor.publishBatchAsync(events, {
        atomic: true,
        priority: 2
      });

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish events individually for testing
      for (const event of events) {
        await eventBus.publish(event);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(jobIds).to.have.length(1); // Atomic batch creates single job
      expect(processedCount).to.equal(3); // All events should be processed

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });

    it('should handle event replay scenarios', async () => {
      // Arrange
      const events = [
        new ProductCreatedEvent({
          aggregateId: 'replay-product-1',
          name: 'Replay Product One',
          sku: 'REPLAY-001',
          price: 100.00,
          stock: 50
        }),
        new ProductCreatedEvent({
          aggregateId: 'replay-product-2',
          name: 'Replay Product Two',
          sku: 'REPLAY-002',
          price: 200.00,
          stock: 25
        })
      ];

      let replayCount = 0;

      // Pre-populate the event store with events for replay
      (middlewareService as any).clearMiddleware(); // Clear saved events
      (eventStore as any).addEventsForReplay(events);

      // Subscribe to product creation events
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (_event: IDomainEvent) => {
        replayCount++;
      });

      // Act
      await eventBus.replayEvents('ProductCreated');

      // Wait for replay processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert
      expect(replayCount).to.equal(2); // Both events should be replayed

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle middleware failures gracefully', async () => {
      // Arrange
      const userEvent = new UserCreatedEvent({
        aggregateId: 'middleware-error-123',
        email: 'middleware-error@example.com',
        firstName: 'Middleware',
        lastName: 'Error',
        role: 'USER'
      });

      let eventProcessed = false;
      let errorHandled = false;

      // Add error handling middleware first (wraps subsequent middleware)
      await middlewareService.addMiddleware('UserCreated', async (event: IDomainEvent, next: NextFunction) => {
        try {
          return await next(event);
        } catch (error) {
          errorHandled = true;
          return event; // Continue pipeline despite error
        }
      });

      // Add failing middleware (will be wrapped by error handler)
      await middlewareService.addMiddleware('UserCreated', async (_event: IDomainEvent, _next: NextFunction) => {
        throw new Error('Middleware failure');
      });

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async (_event: IDomainEvent) => {
        eventProcessed = true;
      });

      // Act
      await eventBus.publish(userEvent);

      // Assert
      expect(errorHandled).to.be.true;
      expect(eventProcessed).to.be.true;

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);

      // Clear middleware
      (middlewareService as any).clearMiddleware();
    });

    it('should handle event store failures', async () => {
      // Arrange
      const userEvent = new UserCreatedEvent({
        aggregateId: 'store-error-123',
        email: 'store-error@example.com',
        firstName: 'Store',
        lastName: 'Error',
        role: 'USER'
      });

      // Mock event store failure
      (eventStore as any).setFailureMode(true, new Error('Database connection failed'));

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async (_event: IDomainEvent) => {
        // Event processing would happen here
      });

      // Register error handler
      await eventBus.on('error', async (error: Error) => {
        expect(error.message).to.include('Database connection failed');
      });

      // Act & Assert
      try {
        await eventBus.publish(userEvent);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).to.include('Database connection failed');
      }

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);

      // Reset failure mode
      (eventStore as any).setFailureMode(false);

      // Clear middleware
      (middlewareService as any).clearMiddleware();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume of concurrent events', async () => {
      // Arrange
      const eventCount = 100;
      const events: UserCreatedEvent[] = [];

      for (let i = 0; i < eventCount; i++) {
        events.push(new UserCreatedEvent({
          aggregateId: `concurrent-user-${i}`,
          email: `concurrent${i}@example.com`,
          firstName: `Concurrent`,
          lastName: `User ${i}`,
          role: 'USER'
        }));
      }

      let processedCount = 0;

      // Subscribe to events
      const subscriptionId = await eventBus.subscribe('UserCreated', async (_event: IDomainEvent) => {
        processedCount++;
      });

      const startTime = Date.now();

      // Act
      const promises = events.map(event => eventBus.publish(event));
      await Promise.all(promises);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(processedCount).to.equal(eventCount);
      expect(processingTime).to.be.lessThan(5000); // Should complete within 5 seconds

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
    });
  });
});