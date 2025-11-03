import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PerformanceService, PerformanceMetrics } from '../performance.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Performance Monitoring Interceptor
 *
 * Automatically collects performance metrics for all API requests:
 * - Response time measurement
 * - Request/response logging
 * - Error tracking
 * - Memory usage monitoring
 * - User tracking for personal metrics
 */
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor(private readonly performanceService: PerformanceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Extract request information
    const method = request.method;
    const url = request.url;
    const userAgent = request.get('User-Agent');
    const ip = request.ip || request.connection.remoteAddress;
    const userId = this.extractUserId(request);

    // Generate correlation ID and trace ID for distributed tracing
    const correlationId = this.generateOrGetCorrelationId(request, response);
    const traceId = this.generateOrGetTraceId(request, response);

    // Enhanced request context tracking
    const enhancedContext = this.extractEnhancedContext(request);

    // Log request start with trace context
    this.logger.debug(`[${method}] ${url} - Request started [cid: ${correlationId}]`);

    return next.handle().pipe(
      tap(() => {
        // Request completed successfully
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = response.statusCode;

        // Collect memory usage
        const memoryUsage = process.memoryUsage();

        // Create enhanced performance metrics
        const metrics: PerformanceMetrics = {
          endpoint: url,
          method,
          responseTime,
          timestamp: new Date(),
          statusCode,
          userId,
          userAgent,
          ip,
          memoryUsage: memoryUsage.heapUsed,
          // Enhanced features
          isSlowRequest: responseTime > 1000,
          databaseQueries: enhancedContext.databaseQueries,
          queryTime: enhancedContext.queryTime,
          hasError: false,
          cacheHit: enhancedContext.cacheHit,
          cacheResponseTime: enhancedContext.cacheResponseTime,
          cacheInvalidation: enhancedContext.cacheInvalidation,
          invalidationTime: enhancedContext.invalidationTime,
          memoryAlert: this.checkMemoryAlert(memoryUsage),
          correlationId,
          traceId,
        };

        // Record metrics with enhanced context
        try {
          this.performanceService.recordMetrics(metrics);
        } catch (error) {
          // Handle performance service failures gracefully
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to record performance metrics: ${errorMessage}`);
        }

        // Log request completion
        const logMessage = `[${method}] ${url} - ${statusCode} - ${responseTime}ms [cid: ${correlationId}]`;
        if (responseTime > 1000) {
          this.logger.warn(`${logMessage} (SLOW)`);
        } else {
          this.logger.debug(logMessage);
        }

        // Add performance headers
        response.set('X-Response-Time', `${responseTime}ms`);
        response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        response.set('X-Correlation-Id', correlationId);
      }),
      catchError((error) => {
        // Request failed
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = error.status || 500;

        // Collect memory usage
        const memoryUsage = process.memoryUsage();

        // Create enhanced performance metrics for error
        const metrics: PerformanceMetrics = {
          endpoint: url,
          method,
          responseTime,
          timestamp: new Date(),
          statusCode,
          userId,
          userAgent,
          ip,
          memoryUsage: memoryUsage.heapUsed,
          // Enhanced error features
          isSlowRequest: responseTime > 1000,
          hasError: true,
          errorMessage: error.message,
          correlationId,
          traceId,
        };

        // Record metrics for error analysis
        try {
          this.performanceService.recordMetrics(metrics);
        } catch (recordError) {
          const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
          this.logger.warn(`Failed to record error metrics: ${errorMessage}`);
        }

        // Log error with trace context
        this.logger.error(
          `[${method}] ${url} - ${statusCode} - ${responseTime}ms - Error: ${error.message} [cid: ${correlationId}]`,
          error.stack
        );

        // Add performance headers even for errors
        response.set('X-Response-Time', `${responseTime}ms`);
        response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        response.set('X-Correlation-Id', correlationId);

        // Re-throw the error
        throw error;
      })
    );
  }

  /**
   * Generate or get correlation ID for request tracing
   */
  private generateOrGetCorrelationId(request: Request, response: Response): string {
    // Check if correlation ID already exists in headers
    let correlationId = request.get('X-Correlation-Id') || request.get('x-correlation-id');

    if (!correlationId) {
      correlationId = uuidv4();
      response.set('X-Correlation-Id', correlationId);
    }

    return correlationId;
  }

  /**
   * Generate or get trace ID for distributed tracing
   */
  private generateOrGetTraceId(request: Request, response: Response): string {
    // Check if trace ID already exists in headers
    let traceId = request.get('X-Trace-Id') || request.get('x-trace-id');

    if (!traceId) {
      traceId = uuidv4();
      response.set('X-Trace-Id', traceId);
    }

    return traceId;
  }

  /**
   * Extract enhanced context from request
   */
  private extractEnhancedContext(request: Request): {
    databaseQueries?: number;
    queryTime?: number;
    cacheHit?: boolean;
    cacheResponseTime?: number;
    cacheInvalidation?: boolean;
    invalidationTime?: number;
  } {
    // Extract database query information from headers or metadata
    const context: any = {};

    // Database query metrics
    const queryCountHeader = request.get('X-Query-Count');
    if (queryCountHeader) {
      context.databaseQueries = parseInt(queryCountHeader, 10);
    }

    const queryTimeHeader = request.get('X-Query-Time');
    if (queryTimeHeader) {
      context.queryTime = parseInt(queryTimeHeader, 10);
    }

    // Cache performance metrics
    const cacheStatusHeader = request.get('X-Cache-Status');
    if (cacheStatusHeader) {
      context.cacheHit = cacheStatusHeader === 'HIT';
    }

    const cacheTimeHeader = request.get('X-Cache-Time');
    if (cacheTimeHeader) {
      context.cacheResponseTime = parseInt(cacheTimeHeader, 10);
    }

    // Cache invalidation metrics
    const cacheInvalidationHeader = request.get('X-Cache-Invalidation');
    if (cacheInvalidationHeader) {
      context.cacheInvalidation = cacheInvalidationHeader === 'true';
    }

    const invalidationTimeHeader = request.get('X-Invalidation-Time');
    if (invalidationTimeHeader) {
      context.invalidationTime = parseInt(invalidationTimeHeader, 10);
    }

    return context;
  }

  /**
   * Check for memory usage alerts
   */
  private checkMemoryAlert(memoryUsage: NodeJS.MemoryUsage): boolean {
    const memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
    return memoryUsage.heapUsed > memoryThreshold;
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: Request): string | undefined {
    // Try to get user from different possible sources
    const user = (request as any).user;

    if (user) {
      return user.id || user.userId || user.sub;
    }

    // Try JWT token payload
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // In a real implementation, you would decode the JWT token
        // For now, returning undefined to keep it simple
        return undefined;
      } catch (error) {
        return undefined;
      }
    }

    return undefined;
  }
}