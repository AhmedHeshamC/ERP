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

    // Log request start
    this.logger.debug(`[${method}] ${url} - Request started`);

    return next.handle().pipe(
      tap(() => {
        // Request completed successfully
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = response.statusCode;

        // Collect memory usage
        const memoryUsage = process.memoryUsage();

        // Create performance metrics
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
        };

        // Record metrics
        this.performanceService.recordMetrics(metrics);

        // Log request completion
        const logMessage = `[${method}] ${url} - ${statusCode} - ${responseTime}ms`;
        if (responseTime > 1000) {
          this.logger.warn(`${logMessage} (SLOW)`);
        } else {
          this.logger.debug(logMessage);
        }

        // Add performance headers
        response.set('X-Response-Time', `${responseTime}ms`);
        response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }),
      catchError((error) => {
        // Request failed
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = error.status || 500;

        // Collect memory usage
        const memoryUsage = process.memoryUsage();

        // Create performance metrics for error
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
        };

        // Record metrics
        this.performanceService.recordMetrics(metrics);

        // Log error
        this.logger.error(
          `[${method}] ${url} - ${statusCode} - ${responseTime}ms - Error: ${error.message}`,
          error.stack
        );

        // Add performance headers
        response.set('X-Response-Time', `${responseTime}ms`);
        response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

        // Re-throw the error
        throw error;
      })
    );
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