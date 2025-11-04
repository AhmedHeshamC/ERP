import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';

/**
 * Performance Optimization Middleware
 *
 * Implements various performance optimizations:
 * - Response compression
 * - Response caching headers
 * - Security headers
 * - Request size limiting
 * - Memory usage monitoring
 */
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly configService: ConfigService;
  private readonly compressionMiddleware: any;

  constructor(configService: ConfigService) {
    this.configService = configService;

    // Initialize compression middleware
    const compressionEnabled = this.configService.get('API_COMPRESSION', true);
    if (compressionEnabled) {
      this.compressionMiddleware = compression({
        filter: () => true,
        threshold: 1024,
        level: 6, // Balanced compression level
      });
    }
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // Apply compression if enabled
    if (this.compressionMiddleware) {
      this.compressionMiddleware(req, res, next);
    } else {
      next();
    }

    // Set performance headers
    this.setPerformanceHeaders(res);

    // Set caching headers for GET requests
    if (req.method === 'GET') {
      this.setCacheHeaders(req, res);
    }

    // Set security headers
    this.setSecurityHeaders(res);

    // Monitor response completion
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.logRequestMetrics(req, res, duration);
    });

    // Monitor memory usage
    this.monitorMemoryUsage(req, res);
  }

  
  /**
   * Set performance-related headers
   */
  private setPerformanceHeaders(res: Response): void {
    // Remove server information
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    // Set connection keep-alive
    res.setHeader('Connection', 'keep-alive');

    // Set timing allow origin for performance APIs
    res.setHeader('Timing-Allow-Origin', '*');
  }

  /**
   * Set caching headers for GET requests
   */
  private setCacheHeaders(req: Request, res: Response): void {
    const url = req.url;
    const now = Date.now();

    // Different caching strategies based on endpoint
    if (url.includes('/api/')) {
      if (url.includes('/performance/') || url.includes('/health')) {
        // Health and performance endpoints - short cache
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (url.includes('/reports/') || url.includes('/analytics')) {
        // Reports and analytics - medium cache
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        res.setHeader('Expires', new Date(now + 300000).toUTCString());
      } else if (url.includes('/static/') || url.includes('/assets/')) {
        // Static assets - long cache
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.setHeader('Expires', new Date(now + 86400000).toUTCString());
      } else {
        // API data - short cache
        res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute
        res.setHeader('Expires', new Date(now + 60000).toUTCString());
      }
    }

    // Add ETag for cache validation
    const etag = this.generateETag(req, res);
    if (etag) {
      res.setHeader('ETag', etag);
    }
  }

  /**
   * Set security headers
   */
  private setSecurityHeaders(res: Response): void {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Strict transport security (if HTTPS)
    if (this.configService.get('NODE_ENV') === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content security policy
    res.setHeader('Content-Security-Policy', "default-src 'self'");

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  /**
   * Generate ETag for cache validation
   */
  private generateETag(_req: Request, res: Response): string | null {
    try {
      const content = res.locals.data || res.locals.response;
      if (content) {
        const hash = this.simpleHash(JSON.stringify(content));
        return `"${hash}"`;
      }
    } catch (error) {
      // Ignore errors in ETag generation
    }
    return null;
  }

  /**
   * Simple hash function for ETag generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Log request metrics
   */
  private logRequestMetrics(req: Request, res: Response, duration: number): void {
    const statusCode = res.statusCode;
    const contentLength = parseInt(res.getHeader('Content-Length') as string || '0', 10);
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    // Log slow requests
    if (duration > 1000) {
      this.logger.warn(
        `Slow request: ${req.method} ${req.url} - ${statusCode} - ${duration}ms - ${contentLength} bytes`
      );
    }

    // Log large responses
    if (contentLength > 1048576) { // 1MB
      this.logger.warn(
        `Large response: ${req.method} ${req.url} - ${statusCode} - ${(contentLength / 1024 / 1024).toFixed(2)}MB`
      );
    }

    // Log errors
    if (statusCode >= 400) {
      this.logger.error(
        `Error response: ${req.method} ${req.url} - ${statusCode} - ${duration}ms - ${userAgent} - ${ip}`
      );
    }

    // Add performance metrics to response headers (KISS: only if headers not sent)
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Content-Length', `${contentLength}`);
    }
  }

  /**
   * Monitor memory usage for the request
   */
  private monitorMemoryUsage(req: Request, res: Response): void {
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endMemory = process.memoryUsage();
      const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      };

      // Log significant memory usage
      if (Math.abs(memoryDelta.heapUsed) > 10 * 1024 * 1024) { // 10MB
        this.logger.warn(
          `Memory usage change for ${req.method} ${req.url}: ` +
          `RSS: ${(memoryDelta.rss / 1024 / 1024).toFixed(2)}MB, ` +
          `Heap: ${(memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`
        );
      }
    });
  }
}

/**
 * Request Size Limiting Middleware
 */
@Injectable()
export class RequestSizeLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestSizeLimitMiddleware.name);
  private readonly maxRequestSize: number;

  constructor(configService: ConfigService) {
    const maxSize = configService.get<string>('API_MAX_REQUEST_SIZE', '10mb');
    this.maxRequestSize = this.parseSize(maxSize);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);

    if (contentLength > this.maxRequestSize) {
      this.logger.warn(
        `Request too large: ${req.method} ${req.url} - ${contentLength} bytes (max: ${this.maxRequestSize})`
      );

      res.status(413).json({
        success: false,
        error: 'Request Entity Too Large',
        message: `Request size ${contentLength} exceeds maximum allowed size ${this.maxRequestSize}`,
      });
      return;
    }

    next();
  }

  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      kb: 1024,
      mb: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)$/);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }
}