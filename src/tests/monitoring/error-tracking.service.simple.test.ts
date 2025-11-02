import { expect } from 'chai';
import { stub } from 'sinon';
import * as sinon from 'sinon';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ErrorTrackingService } from '../../shared/monitoring/errors/error-tracking.service';

// Mock the EnhancedLoggerService to avoid compilation dependencies
const mockEnhancedLoggerService = {
  error: stub(),
  warn: stub(),
  info: stub(),
  debug: stub(),
  log: stub(),
  fatal: stub(),
};

describe('ErrorTrackingService - Simple Implementation Tests', () => {
  let service: ErrorTrackingService;
  let configService: any;
  let module: TestingModule;

  beforeEach(async () => {
    const mockConfigService = {
      get: stub().returns('development'),
    };

    module = await Test.createTestingModule({
      providers: [
        ErrorTrackingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'EnhancedLoggerService',
          useValue: mockEnhancedLoggerService,
        },
      ],
    }).compile();

    service = module.get<ErrorTrackingService>(ErrorTrackingService);
    configService = module.get(ConfigService);

    // Manually inject the mock logger service
    (service as any).enhancedLogger = mockEnhancedLoggerService;

    // Reset all stubs
    Object.values(mockEnhancedLoggerService).forEach((stub: any) => stub.reset());
    mockConfigService.get.reset();
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Error Fingerprinting', () => {
    it('should generate consistent fingerprints for similar errors', () => {
      const error1 = new Error('Cannot read property "name" of undefined');
      const error2 = new Error('Cannot read property "age" of undefined');

      const context = {
        controller: 'UserController',
        action: 'getUserProfile',
        method: 'GET',
      };

      const fingerprint1 = service.generateFingerprint(error1, context);
      const fingerprint2 = service.generateFingerprint(error2, context);

      expect(fingerprint1).to.not.be.undefined;
      expect(fingerprint2).to.not.be.undefined;
      expect(fingerprint1).to.equal(fingerprint2);
    });

    it('should normalize error messages by removing variable values', () => {
      const error1 = new Error('User with id 123 not found');
      const error2 = new Error('User with id 456 not found');

      const normalized1 = service.normalizeErrorMessage(error1.message);
      const normalized2 = service.normalizeErrorMessage(error2.message);

      expect(normalized1).to.equal(normalized2);
      expect(normalized1).to.include('user');
      expect(normalized1).to.include('not_found');
      expect(normalized1).to.not.include('123');
      expect(normalized1).to.not.include('456');
    });

    it('should create different fingerprints for different error types', () => {
      const typeError = new TypeError('Cannot read property');
      const referenceError = new ReferenceError('User is not defined');
      const validationError = new Error('Validation failed');

      const fingerprint1 = service.generateFingerprint(typeError);
      const fingerprint2 = service.generateFingerprint(referenceError);
      const fingerprint3 = service.generateFingerprint(validationError);

      expect(fingerprint1).to.not.equal(fingerprint2);
      expect(fingerprint2).to.not.equal(fingerprint3);
      expect(fingerprint1).to.not.equal(fingerprint3);
    });
  });

  describe('Error Capture and Processing', () => {
    it('should capture and process errors with full context', () => {
      const error = new Error('Database connection failed');
      const context = {
        userId: 'user123',
        requestId: 'req456',
        controller: 'DatabaseController',
        action: 'connect',
        method: 'POST',
        ip: '192.168.1.1',
      };
      const metadata = {
        correlationId: 'corr789',
        sessionId: 'sess101112',
        module: 'database',
      };

      const errorEvent = service.captureError(error, context, metadata);

      expect(errorEvent).to.not.be.undefined;
      expect(errorEvent.name).to.equal('Error');
      expect(errorEvent.message).to.equal('Database connection failed');
      expect(errorEvent.userId).to.equal('user123');
      expect(errorEvent.requestId).to.equal('req456');
      expect(errorEvent.correlationId).to.equal('corr789');
      expect(errorEvent.sessionId).to.equal('sess101112');
      expect(errorEvent.context).to.deep.include(context);
      expect(errorEvent.metadata).to.deep.include(metadata);
      expect(errorEvent.timestamp).to.be.instanceOf(Date);
      expect(errorEvent.occurrences).to.equal(1);
      expect(errorEvent.resolved).to.be.false;
    });

    it('should capture unhandled rejections', () => {
      const reason = 'Promise rejected unexpectedly';
      const context = {
        controller: 'PaymentController',
        action: 'processPayment',
      };

      const errorEvent = service.captureUnhandledRejection(reason, context);

      expect(errorEvent).to.not.be.undefined;
      expect(errorEvent.type).to.equal('UNHANDLED_REJECTION');
      expect(errorEvent.message).to.include('Unhandled Rejection');
      expect(errorEvent.metadata.originalReason).to.equal(reason);
    });

    it('should capture timeout errors', () => {
      const operation = 'Database query';
      const timeout = 5000;

      const errorEvent = service.captureTimeout(operation, timeout);

      expect(errorEvent).to.not.be.undefined;
      expect(errorEvent.type).to.equal('TIMEOUT');
      expect(errorEvent.message).to.include('Database query');
      expect(errorEvent.message).to.include('5000ms');
      expect(errorEvent.metadata.operation).to.equal(operation);
      expect(errorEvent.metadata.timeout).to.equal(timeout);
    });

    it('should capture memory leak errors', async () => {
      const threshold = 1024; // 1GB
      const currentUsage = 1536; // 1.5GB

      const errorEvent = await service.captureMemoryLeak(threshold, currentUsage);

      expect(errorEvent).to.not.be.undefined;
      expect(errorEvent.type).to.equal('MEMORY_LEAK');
      expect(errorEvent.message).to.include('1536');
      expect(errorEvent.message).to.include('1024');
      expect(errorEvent.severity).to.equal('CRITICAL');
      expect(errorEvent.metadata.threshold).to.equal(threshold);
      expect(errorEvent.metadata.currentUsage).to.equal(currentUsage);
    });
  });

  describe('Error Classification and Severity', () => {
    it('should classify database connection errors as CRITICAL', () => {
      const error = new Error('Database connection failed');
      const context = { statusCode: 500 };

      const severity = service.determineSeverity(error, context);

      expect(severity).to.equal('CRITICAL');
    });

    it('should classify authentication failures as HIGH', () => {
      const error = new Error('Authentication failed');
      const context = { statusCode: 401 };

      const severity = service.determineSeverity(error, context);

      expect(severity).to.equal('HIGH');
    });

    it('should classify validation errors as MEDIUM', () => {
      const error = new Error('Email validation failed');
      const context = { statusCode: 400 };

      const severity = service.determineSeverity(error, context);

      expect(severity).to.equal('MEDIUM');
    });

    it('should classify unknown errors as LOW', () => {
      const error = new Error('Some unknown error occurred');
      const context = { statusCode: 200 };

      const severity = service.determineSeverity(error, context);

      expect(severity).to.equal('LOW');
    });

    it('should detect out of memory errors as CRITICAL', () => {
      const error = new Error('JavaScript heap out of memory');

      const severity = service.determineSeverity(error);

      expect(severity).to.equal('CRITICAL');
    });

    it('should detect stack overflow errors as CRITICAL', () => {
      const error = new Error('Maximum call stack size exceeded');

      const severity = service.determineSeverity(error);

      expect(severity).to.equal('CRITICAL');
    });
  });

  describe('Error Grouping and Aggregation', () => {
    it('should group similar errors together', () => {
      const error1 = new Error('User with id 123 not found');
      const error2 = new Error('User with id 456 not found');
      const context = { controller: 'UserController', action: 'getUser' };

      service.captureError(error1, context);
      service.captureError(error2, context);

      const groups = service.getErrorGroups();
      expect(groups).to.have.length(1);
      expect(groups[0].totalOccurrences).to.equal(2);
      expect(groups[0].uniqueUsers).to.equal(0); // No userId in context
    });

    it('should track unique users affected by errors', () => {
      const error = new Error('Permission denied');
      const context1 = { userId: 'user1', controller: 'AuthController' };
      const context2 = { userId: 'user2', controller: 'AuthController' };

      service.captureError(error, context1);
      service.captureError(error, context2);

      const groups = service.getErrorGroups();
      expect(groups[0].uniqueUsers).to.equal(2);
    });

    it('should update group statistics on new occurrences', (done) => {
      const error = new Error('Database timeout');
      const context = { controller: 'DatabaseController' };

      const event1 = service.captureError(error, context);

      setTimeout(() => {
        const event2 = service.captureError(error, context);

        const groups = service.getErrorGroups();
        expect(groups[0].firstSeen).to.deep.equal(event1.timestamp);
        expect(groups[0].lastSeen).to.deep.equal(event2.timestamp);
        expect(groups[0].totalOccurrences).to.equal(2);
        done();
      }, 10);
    });

    it('should upgrade severity if new occurrence is more severe', () => {
      const error1 = new Error('Validation failed');
      const error2 = new Error('Database connection failed');
      const context = { controller: 'AppController' };

      service.captureError(error1, context);
      let groups = service.getErrorGroups();
      expect(groups[0].severity).to.equal('MEDIUM');

      service.captureError(error2, context);
      groups = service.getErrorGroups();
      expect(groups[0].severity).to.equal('CRITICAL');
    });
  });

  describe('Error Trend Analysis', () => {
    it('should calculate error rate over time', () => {
      const error = new Error('API rate limit exceeded');

      // Create multiple errors
      for (let i = 0; i < 10; i++) {
        service.captureError(error);
      }

      const stats = service.getErrorStatistics(1); // Last 1 hour
      expect(stats.totalErrors).to.equal(10);
      expect(stats.errorRate).to.be.greaterThan(0);
    });

    it('should identify error trends', () => {
      const error = new Error('Service unavailable');

      // Create errors over time (simulate with different timestamps)
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        const errorEvent = service.captureError(error);
        // Manually set timestamp for testing
        errorEvent.timestamp = new Date(now.getTime() - i * 60000); // i minutes ago
      }

      const trends = service['generateErrorTrends'](1); // Last hour
      expect(trends).to.have.length.greaterThan(0);
      expect(trends[0]).to.have.property('timestamp');
      expect(trends[0]).to.have.property('totalErrors');
      expect(trends[0]).to.have.property('errorRate');
    });

    it('should identify top errors by frequency', () => {
      const commonError = new Error('Database connection failed');
      const rareError = new Error('Cache miss');

      // Create many instances of common error
      for (let i = 0; i < 10; i++) {
        service.captureError(commonError);
      }

      // Create few instances of rare error
      for (let i = 0; i < 2; i++) {
        service.captureError(rareError);
      }

      const stats = service.getErrorStatistics(24);
      expect(stats.topErrors).to.have.length.greaterThan(0);
      expect(stats.topErrors[0].name).to.equal('Error');
      expect(stats.topErrors[0].count).to.be.greaterThanOrEqual(10);
    });
  });

  describe('Resolution Workflow', () => {
    it('should resolve individual errors', async () => {
      const error = new Error('Test error');
      const errorEvent = service.captureError(error);

      const resolved = await service.resolveError(errorEvent.id, 'admin-user');

      expect(resolved).to.be.true;

      const retrievedError = service.getErrors({ resolved: true }).errors[0];
      expect(retrievedError.resolved).to.be.true;
      expect(retrievedError.resolvedAt).to.be.instanceOf(Date);
      expect(retrievedError.resolvedBy).to.equal('admin-user');
    });

    it('should resolve entire error groups', async () => {
      const error = new Error('Grouped error');
      const context = { controller: 'TestController' };

      service.captureError(error, context);
      service.captureError(error, context);

      const groups = service.getErrorGroups();
      const groupId = groups[0].id;

      const resolved = await service.resolveErrorGroup(groupId, 'admin-user');

      expect(resolved).to.be.true;

      const group = service.getErrorGroups({ status: 'RESOLVED' })[0];
      expect(group.status).to.equal('RESOLVED');
      expect(group.resolvedBy).to.equal('admin-user');
      expect(group.resolvedAt).to.be.instanceOf(Date);
    });

    it('should calculate average resolution time', () => {
      const error = new Error('Test error');
      const errorEvent = service.captureError(error);

      // Simulate resolution after 30 minutes
      errorEvent.resolved = true;
      errorEvent.resolvedAt = new Date(Date.now() + 30 * 60 * 1000);

      const stats = service.getErrorStatistics(24);
      expect(stats.averageResolutionTime).to.be.greaterThan(0);
    });
  });

  describe('Error Alerting', () => {
    it('should trigger alerts for high error rates', () => {
      const error = new Error('Critical system error');

      // Create many errors to trigger alert
      for (let i = 0; i < 60; i++) {
        service.captureError(error);
      }

      // Should have triggered an alert
      expect(mockEnhancedLoggerService.error.calledWith(
        sinon.match('Error alert triggered')
      )).to.be.true;
    });

    it('should trigger alerts for critical errors', () => {
      const criticalError = new Error('Database connection failed');
      const context = { statusCode: 500 };

      service.captureError(criticalError, context);

      // Should handle critical error
      expect(mockEnhancedLoggerService.fatal.calledWith(
        sinon.match('Critical error detected')
      )).to.be.true;
    });

    it('should respect alert cooldown periods', () => {
      const error = new Error('Frequent error');

      service.captureError(error);

      // Reset call count
      mockEnhancedLoggerService.error.resetHistory();

      // Second occurrence should not trigger alert due to cooldown
      service.captureError(error);

      // Should not trigger second alert
      expect(mockEnhancedLoggerService.error.called).to.be.false;
    });
  });

  describe('Context Tracking', () => {
    it('should track request context', () => {
      const error = new Error('Request processing failed');
      const context = {
        requestId: 'req123',
        userId: 'user456',
        method: 'POST',
        url: '/api/users',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0...',
      };

      const errorEvent = service.captureError(error, context);

      expect(errorEvent.requestId).to.equal('req123');
      expect(errorEvent.userId).to.equal('user456');
      expect(errorEvent.context.method).to.equal('POST');
      expect(errorEvent.context.url).to.equal('/api/users');
      expect(errorEvent.context.ip).to.equal('192.168.1.1');
      expect(errorEvent.context.userAgent).to.equal('Mozilla/5.0...');
    });

    it('should track system context', () => {
      const error = new Error('System error');
      const context = {
        memoryUsage: 1024 * 1024 * 1024, // 1GB
        cpuUsage: 85.5,
        responseTime: 2500,
      };

      const errorEvent = service.captureError(error, context);

      expect(errorEvent.context.memoryUsage).to.equal(1024 * 1024 * 1024);
      expect(errorEvent.context.cpuUsage).to.equal(85.5);
      expect(errorEvent.context.responseTime).to.equal(2500);
    });

    it('should generate relevant tags', () => {
      const error = new TypeError('Cannot read property');
      const context = {
        controller: 'UserController',
        method: 'GET',
        statusCode: 500,
      };
      const metadata = {
        module: 'user-management',
        exceptionType: 'TIMEOUT',
      };

      const errorEvent = service.captureError(error, context, metadata);

      expect(errorEvent.tags).to.include('typeerror');
      expect(errorEvent.tags).to.include('controller:usercontroller');
      expect(errorEvent.tags).to.include('method:get');
      expect(errorEvent.tags).to.include('status:500');
      expect(errorEvent.tags).to.include('url');
      expect(errorEvent.tags).to.include('timeout');
      expect(errorEvent.tags).to.include('module:user-management');
      expect(errorEvent.tags).to.include('development'); // environment
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should integrate with enhanced logger service', () => {
      const error = new Error('Integration test error');
      const context = { requestId: 'req123', controller: 'TestController' };

      service.captureError(error, context);

      expect(mockEnhancedLoggerService.error.calledWith(
        sinon.match('Error captured'),
        sinon.match.any,
        'ERROR_TRACKING',
        sinon.match({
          errorId: sinon.match.string,
          fingerprint: sinon.match.string,
          severity: sinon.match.string,
        })
      )).to.be.true;
    });

    it('should respect configuration settings', () => {
      configService.get.returns('production');

      const error = new Error('Production error');
      service.captureError(error);

      // Should use production configuration
      expect(configService.get.calledWith('NODE_ENV', 'development')).to.be.true;
    });
  });
});