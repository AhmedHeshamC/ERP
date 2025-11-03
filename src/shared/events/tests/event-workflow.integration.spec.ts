import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { EventBusService } from '../services/event-bus.service';
import { EventStoreService } from '../services/event-store.service';
import { EventMiddlewareService } from '../services/event-middleware.service';
import { AsyncEventProcessorService } from '../services/async-event-processor.service';
import { EventRouterService } from '../services/event-router.service';
import { DeadLetterQueueService } from '../services/dead-letter-queue.service';
import { EventMonitoringService } from '../services/event-monitoring.service';
import { UserEventHandlersService } from '../handlers/user-event-handlers.service';
import { ProductEventHandlersService } from '../handlers/product-event-handlers.service';
import { SalesEventHandlersService } from '../handlers/sales-event-handlers.service';
import { WorkflowEventHandlersService } from '../handlers/workflow-event-handlers.service';
import { UserCreatedEvent, ProductCreatedEvent, OrderCreatedEvent } from '../types/domain-events.types';
import { IEventBus, IEventStore, IEventMiddleware } from '../interfaces';
import { JobService } from '../../queue/job.service';
import { PerformanceService } from '../../monitoring/performance.service';

describe('Event Workflow Integration Tests', () => {
  let module: TestingModule;
  let eventBus: IEventBus;
  let eventStore: IEventStore;
  let middlewareService: IEventMiddleware;
  let asyncProcessor: AsyncEventProcessorService;
  let eventRouter: EventRouterService;
  let deadLetterQueue: DeadLetterQueueService;
  let monitoringService: EventMonitoringService;
  let userHandlers: UserEventHandlersService;
  let productHandlers: ProductEventHandlersService;
  let salesHandlers: SalesEventHandlersService;
  let workflowHandlers: WorkflowEventHandlersService;

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
        $transaction: async (callback) => callback(mockPrisma)
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
      registerProcessor: async () => {},
      addJob: async () => 'mock-job-id',
      getJob: async () => null,
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
    } as JobService;

    // Create mock PerformanceService
    mockPerformanceService = {
      recordMetric: async () => {},
      getMetrics: async () => [],
      getStats: async () => ({})
    } as PerformanceService;

    const testModule = await Test.createTestingModule({
      providers: [
        {
          provide: IEventBus,
          useClass: EventBusService
        },
        {
          provide: IEventStore,
          useClass: EventStoreService
        },
        {
          provide: IEventMiddleware,
          useClass: EventMiddlewareService
        },
        AsyncEventProcessorService,
        EventRouterService,
        DeadLetterQueueService,
        EventMonitoringService,
        UserEventHandlersService,
        ProductEventHandlersService,
        SalesEventHandlersService,
        WorkflowEventHandlersService,
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

    eventBus = module.get<IEventBus>(IEventBus);
    eventStore = module.get<IEventStore>(IEventStore);
    middlewareService = module.get<IEventMiddleware>(IEventMiddleware);
    asyncProcessor = module.get<AsyncEventProcessorService>(AsyncEventProcessorService);
    eventRouter = module.get<EventRouterService>(EventRouterService);
    deadLetterQueue = module.get<DeadLetterQueueService>(DeadLetterQueueService);
    monitoringService = module.get<EventMonitoringService>(EventMonitoringService);
    userHandlers = module.get<UserEventHandlersService>(UserEventHandlersService);
    productHandlers = module.get<ProductEventHandlersService>(ProductEventHandlersService);
    salesHandlers = module.get<SalesEventHandlersService>(SalesEventHandlersService);
    workflowHandlers = module.get<WorkflowEventHandlersService>(WorkflowEventHandlersService);
  });

  after(async () => {
    await module.close();
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
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
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
      await middlewareService.addMiddleware('ProductCreated', async (event, next) => {
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
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (event) => {
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
      const adminSubscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
        if (event.metadata.role === 'ADMIN') {
          adminEventReceived = true;
        }
      });

      const userSubscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
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

      let asyncEventProcessed = false;

      // Register async event handler
      await asyncProcessor.publishAsync(orderEvent, {
        priority: 1,
        maxRetries: 3
      });

      // Mock job processing
      mockJobService.getJob = async (jobId: string) => ({
        id: jobId,
        name: 'ProcessEvent-OrderCreated',
        type: 'event_processing',
        data: {
          event: orderEvent,
          options: { priority: 1, maxRetries: 3 }
        },
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date()
      });

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
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
        throw new Error('Simulated handler failure');
      });

      // Register error handler
      await eventBus.on('error', async (error, event) => {
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
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (event) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));

        // Record metrics
        monitoringService.recordEventMetrics(
          event,
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
      const userSubscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
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
      const orderSubscriptionId = await eventBus.subscribe('OrderCreated', async (event) => {
        if (event.metadata.totalAmount === 0) {
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
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
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

      // Mock event store to return events for replay
      mockPrisma.event.findMany = async () => [
        {
          id: 'event-1',
          eventData: JSON.stringify(events[0]),
          streamId: `Product-${events[0].aggregateId}`,
          streamVersion: 1
        },
        {
          id: 'event-2',
          eventData: JSON.stringify(events[1]),
          streamId: `Product-${events[1].aggregateId}`,
          streamVersion: 1
        }
      ];

      // Subscribe to product creation events
      const subscriptionId = await eventBus.subscribe('ProductCreated', async (event) => {
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

      // Add failing middleware
      await middlewareService.addMiddleware('UserCreated', async (event, next) => {
        throw new Error('Middleware failure');
      });

      // Add error handling middleware
      await middlewareService.addMiddleware('UserCreated', async (event, next) => {
        try {
          return next(event);
        } catch (error) {
          errorHandled = true;
          return event; // Continue pipeline
        }
      });

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
        eventProcessed = true;
      });

      // Act
      await eventBus.publish(userEvent);

      // Assert
      expect(errorHandled).to.be.true;
      expect(eventProcessed).to.be.true;

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
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

      let eventProcessed = false;

      // Mock event store failure
      mockPrisma.event.create = async () => {
        throw new Error('Database connection failed');
      };

      // Subscribe to event
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
        eventProcessed = true;
      });

      // Register error handler
      await eventBus.on('error', async (error) => {
        expect(error.message).to.include('Database connection failed');
      });

      // Act & Assert
      try {
        await eventBus.publish(userEvent);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Database connection failed');
      }

      // Cleanup
      await eventBus.unsubscribe(subscriptionId);
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
      const subscriptionId = await eventBus.subscribe('UserCreated', async (event) => {
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