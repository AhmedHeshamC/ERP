import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceInterceptor } from '../../shared/monitoring/interceptors/performance.interceptor';
import { PerformanceService } from '../../shared/monitoring/performance.service';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { Request, Response } from 'express';

describe('Enhanced Performance Interceptor', () => {
  let interceptor: PerformanceInterceptor;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        PerformanceInterceptor,
        {
          provide: PerformanceService,
          useValue: {
            recordMetrics: () => {},
            getMetrics: () => [],
            getSlowQueries: () => [],
            getPerformanceAlerts: () => [],
          },
        },
      ],
    }).compile();

    interceptor = module.get<PerformanceInterceptor>(PerformanceInterceptor);
  });

  describe('Basic Request Profiling', () => {
    it('should process requests without errors', async () => {
      // Arrange
      const context = createMockContext('GET', '/api/products');
      const callHandler = createMockCallHandler({ data: 'test response' });

      // Act & Assert - Should not throw error
      const result = await interceptor.intercept(context, callHandler).toPromise();
      expect(result).to.not.be.undefined;
    });

    it('should track correlation IDs for distributed tracing', async () => {
      // Arrange
      const context = createMockContext('GET', '/api/orders/123');
      const callHandler = createMockCallHandler({ data: { order: { id: 123 } } });

      // Act
      await interceptor.intercept(context, callHandler).toPromise();

      // Assert
      const response = context.switchToHttp().getResponse();
      expect(response.header('x-correlation-id')).to.be.a('string');
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const context = createMockContext('DELETE', '/api/products/123');
      const error = new Error('Product not found');
      const callHandler = createMockCallHandler(error, 0, true);

      // Act & Assert
      try {
        await interceptor.intercept(context, callHandler).toPromise();
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.equal(error);
      }
    });
  });

  describe('Performance Headers', () => {
    it('should add performance headers to responses', async () => {
      // Arrange
      const context = createMockContext('GET', '/api/test');
      const callHandler = createMockCallHandler({ data: 'test response' });

      // Act
      await interceptor.intercept(context, callHandler).toPromise();

      // Assert
      const response = context.switchToHttp().getResponse();
      expect(response.header('x-response-time')).to.be.a('string');
      expect(response.header('x-memory-usage')).to.be.a('string');
      expect(response.header('x-correlation-id')).to.be.a('string');
    });
  });

  // Helper functions
  function createMockContext(method: string, url: string, additional: any = {}) {
    const headers: any = {};

    const mockRequest = {
      method,
      url,
      get: (header: string) => additional.headers?.[header],
      ip: additional.ip || '127.0.0.1',
      user: additional.user,
      body: additional.body || {},
      ...additional,
    } as unknown as Request;

    const mockResponse = {
      statusCode: 200,
      headers: headers,
      set: (key: string, value: string) => {
        headers[key] = value;
      },
      header: (key: string) => headers[key],
    } as unknown as Response;

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as ExecutionContext;
  }

  function createMockCallHandler(response: any, delay: number = 0, shouldError: boolean = false): CallHandler {
    return {
      handle: () => {
        if (shouldError) {
          return throwError(() => response);
        }
        return new Promise(resolve => {
          setTimeout(() => resolve(of(response)), delay);
        });
      },
    } as CallHandler;
  }
});