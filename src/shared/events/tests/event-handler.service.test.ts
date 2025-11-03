import { expect } from 'chai';
import { EventMiddlewareService } from '../services/event-middleware.service';
import { IEventMiddleware } from '../interfaces/event-handler.interface';
import { IDomainEvent, IEventFilter, IRetryPolicy, IEventHandlingResult } from '../types/event.types';
import { UserCreatedEvent } from '../types/domain-events.types';

describe('EventMiddlewareService - TDD Tests', () => {
  let middlewareService: IEventMiddleware;
  let mockEventBus: any;
  let mockEventStore: any;

  beforeEach(() => {
    // Mock dependencies
    mockEventBus = {
      publish: async () => {},
      subscribe: async () => 'subscription-id',
      unsubscribe: async () => {}
    };

    mockEventStore = {
      updateRetryCount: async () => {},
      saveEvent: async () => ({})
    };

    // This will fail initially since EventMiddlewareService doesn't exist yet
    middlewareService = new EventMiddlewareService(mockEventBus, mockEventStore);
  });

  describe('RED Phase - Tests should fail initially', () => {
    it('should process event through middleware pipeline', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let middlewareCalled = false;
      let transformedEvent: IDomainEvent | null = null;

      // Add middleware that transforms event
      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        middlewareCalled = true;
        // Add metadata to event
        const transformed = {
          ...evt,
          metadata: {
            ...evt.metadata,
            processedBy: 'middleware'
          }
        };
        transformedEvent = await next(transformed);
        return transformedEvent;
      });

      // Process event through middleware
      const result = await middlewareService.process(event);

      // Verify middleware was called and event was transformed
      expect(middlewareCalled).to.be.true;
      expect(result.metadata.processedBy).to.equal('middleware');
    });

    it('should execute multiple middleware in order', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      const executionOrder: string[] = [];

      // Add multiple middleware
      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        executionOrder.push('middleware1');
        return next(evt);
      });

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        executionOrder.push('middleware2');
        return next(evt);
      });

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        executionOrder.push('middleware3');
        return next(evt);
      });

      await middlewareService.process(event);

      // Verify execution order
      expect(executionOrder).to.deep.equal(['middleware1', 'middleware2', 'middleware3']);
    });

    it('should handle middleware errors and continue pipeline', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let errorHandled = false;
      let pipelineContinued = false;

      // Add middleware that throws an error
      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        throw new Error('Middleware failed');
      });

      // Add error handling middleware
      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        try {
          return next(evt);
        } catch (error) {
          errorHandled = true;
          // Return original event to continue pipeline
          return evt;
        }
      });

      // Add final middleware
      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        pipelineContinued = true;
        return next(evt);
      });

      const result = await middlewareService.process(event);

      expect(errorHandled).to.be.true;
      expect(pipelineContinued).to.be.true;
      expect(result).to.not.be.null;
    });

    it('should apply event filters before processing', async () => {
      const userEvent = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN'
      });

      let eventProcessed = false;

      const filter: IEventFilter = {
        metadata: { role: 'ADMIN' }
      };

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        eventProcessed = true;
        return next(evt);
      }, filter);

      // Process event that matches filter
      await middlewareService.process(userEvent);
      expect(eventProcessed).to.be.true;

      // Reset and test event that doesn't match filter
      eventProcessed = false;
      const regularUserEvent = new UserCreatedEvent({
        aggregateId: 'user-456',
        email: 'user@example.com',
        firstName: 'Regular',
        lastName: 'User',
        role: 'USER'
      });

      await middlewareService.process(regularUserEvent);
      expect(eventProcessed).to.be.false; // Should not be processed
    });

    it('should implement retry policy for failed event handling', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      const retryPolicy: IRetryPolicy = {
        maxRetries: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        retryableErrors: ['NetworkError', 'TimeoutError']
      };

      let attemptCount = 0;

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('NetworkError');
        }
        return next(evt);
      }, undefined, retryPolicy);

      const startTime = Date.now();
      const result = await middlewareService.process(event);
      const duration = Date.now() - startTime;

      // Verify retry attempts were made
      expect(attemptCount).to.equal(3);
      expect(result).to.not.be.null;
      expect(duration).to.be.at.least(100); // Should have some delay due to retries
    });

    it('should move failed events to dead letter queue after max retries', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      const retryPolicy: IRetryPolicy = {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: ['NetworkError']
      };

      let deadLetterQueueCalled = false;

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        throw new Error('NetworkError');
      }, undefined, retryPolicy);

      // Mock dead letter queue
      middlewareService.moveToDeadLetterQueue = async (evt, error) => {
        deadLetterQueueCalled = true;
        expect(evt.id).to.equal(event.id);
        expect(error.message).to.include('NetworkError');
      };

      try {
        await middlewareService.process(event);
        expect.fail('Should have thrown error after max retries');
      } catch (error) {
        expect(deadLetterQueueCalled).to.be.true;
        expect(error.message).to.include('Max retries exceeded');
      }
    });

    it('should measure and report event processing metrics', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let metricsCollected = false;

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        const startTime = Date.now();
        const result = await next(evt);
        const duration = Date.now() - startTime;

        metricsCollected = true;
        expect(duration).to.be.a('number');
        expect(duration).to.be.at.least(0);

        return result;
      });

      const result = await middlewareService.process(event);

      expect(metricsCollected).to.be.true;
      expect(result).to.not.be.null;
    });

    it('should support async event handlers', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let asyncHandlerCompleted = false;

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 50));
        asyncHandlerCompleted = true;
        return next(evt);
      });

      const startTime = Date.now();
      const result = await middlewareService.process(event);
      const duration = Date.now() - startTime;

      expect(asyncHandlerCompleted).to.be.true;
      expect(duration).to.be.at.least(50); // Should wait for async operation
      expect(result).to.not.be.null;
    });
  });

  describe('GREEN Phase - Tests should pass after implementation', () => {
    // These tests will pass once we implement the EventMiddlewareService

    it('should handle event validation in middleware', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      let validationPassed = false;

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        // Validate required fields
        if (!evt.metadata.email || !evt.metadata.firstName) {
          throw new Error('Invalid event data');
        }
        validationPassed = true;
        return next(evt);
      });

      const result = await middlewareService.process(event);

      expect(validationPassed).to.be.true;
      expect(result).to.not.be.null;
    });

    it('should support event transformation and enrichment', async () => {
      const event = new UserCreatedEvent({
        aggregateId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'USER'
      });

      await middlewareService.addMiddleware('UserCreated', async (evt, next) => {
        // Enrich event with additional data
        const enriched = {
          ...evt,
          metadata: {
            ...evt.metadata,
            fullName: `${evt.metadata.firstName} ${evt.metadata.lastName}`,
            domain: evt.metadata.email.split('@')[1],
            processedAt: new Date().toISOString()
          }
        };
        return next(enriched);
      });

      const result = await middlewareService.process(event);

      expect(result.metadata.fullName).to.equal('John Doe');
      expect(result.metadata.domain).to.equal('example.com');
      expect(result.metadata.processedAt).to.be.a('string');
    });
  });
});