import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Correlation ID Middleware
 * Adds unique correlation IDs to all HTTP requests for tracking and debugging
 * Essential for microservices architecture and distributed tracing
 *
 * Features:
 * - Generates unique correlation ID for each request
 * - Preserves existing correlation ID from upstream services
 * - Adds correlation ID to response headers
 * - Supports request ID headers for compatibility
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // Check for existing correlation ID from upstream services
    const incomingCorrelationId =
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      req.headers['request-id'] as string ||
      req.headers['trace-id'] as string;

    // Generate new correlation ID if none exists
    const correlationId = incomingCorrelationId || this.generateCorrelationId();

    // Add correlation ID to request object for downstream use
    (req as any).correlationId = correlationId;

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-ID', correlationId);

    // Log request with correlation ID
    this.logRequest(req, correlationId);

    // Override res.json to add correlation ID to all responses
    const originalJson = res.json;
    res.json = function(data: any) {
      // Add correlation ID to response data if it's an object
      if (data && typeof data === 'object' && !data.correlationId) {
        data.correlationId = correlationId;
      }
      return originalJson.call(this, data);
    };

    next();
  }

  /**
   * Generate a new correlation ID
   */
  private generateCorrelationId(): string {
    // Use timestamp and random number for uniqueness
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `req_${timestamp}_${random}`;
  }

  /**
   * Log incoming request with correlation ID
   */
  private logRequest(req: Request, correlationId: string): void {
    this.logger.debug(`Incoming request [${correlationId}]`, {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
    });
  }
}