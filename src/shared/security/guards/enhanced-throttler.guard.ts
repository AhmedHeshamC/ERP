import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface ClientInfo {
  count: number;
  resetTime: number;
  firstRequest: number;
  blockedUntil?: number;
}

/**
 * Enhanced Rate Limiting Guard
 * Implements intelligent rate limiting with different rules for different endpoints
 * Follows OWASP Top 10 A04: Insecure Design - Rate limiting
 *
 * Features:
 * - Different rate limits for different endpoint types
 * - IP-based and user-based rate limiting
 * - Progressive penalties for repeated violations
 * - Whitelist support for trusted IPs
 * - Configurable windows and limits
 */
@Injectable()
export class EnhancedThrottlerGuard implements NestMiddleware {
  private readonly logger = new Logger(EnhancedThrottlerGuard.name);
  private readonly clients = new Map<string, ClientInfo>();
  private readonly userClients = new Map<string, ClientInfo>();
  private readonly trustedIPs = new Set<string>();

  private readonly rateLimitConfigs: Map<string, RateLimitConfig> = new Map([
    // Authentication endpoints - very strict
    ['/auth/login', { windowMs: 15 * 60 * 1000, maxRequests: 5 }], // 5 requests per 15 minutes
    ['/auth/register', { windowMs: 60 * 60 * 1000, maxRequests: 3 }], // 3 requests per hour
    ['/auth/forgot-password', { windowMs: 60 * 60 * 1000, maxRequests: 3 }], // 3 requests per hour
    ['/auth/reset-password', { windowMs: 60 * 60 * 1000, maxRequests: 5 }], // 5 requests per hour

    // Sensitive operations
    ['/users', { windowMs: 60 * 1000, maxRequests: 10 }], // 10 requests per minute
    ['/auth/change-password', { windowMs: 15 * 60 * 1000, maxRequests: 3 }], // 3 requests per 15 minutes

    // Business operations
    ['/sales/customers', { windowMs: 60 * 1000, maxRequests: 30 }], // 30 requests per minute
    ['/sales/orders', { windowMs: 60 * 1000, maxRequests: 20 }], // 20 requests per minute
    ['/purchasing', { windowMs: 60 * 1000, maxRequests: 25 }], // 25 requests per minute
    ['/inventory', { windowMs: 60 * 1000, maxRequests: 50 }], // 50 requests per minute

    // Reports and analytics (more restrictive)
    ['/reports', { windowMs: 60 * 1000, maxRequests: 15 }], // 15 requests per minute
    ['/accounting', { windowMs: 60 * 1000, maxRequests: 20 }], // 20 requests per minute

    // Default rate limit for all other endpoints
    ['default', { windowMs: 60 * 1000, maxRequests: 100 }], // 100 requests per minute
  ]);

  constructor(private readonly configService: ConfigService) {
    this.initializeTrustedIPs();
    this.startCleanupInterval();
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Skip rate limiting for trusted IPs
      if (req.ip && this.isTrustedIP(req.ip)) {
        this.logger.debug(`Skipping rate limit for trusted IP: ${req.ip}`);
        return next();
      }

      // Get appropriate rate limit config
      const config = this.getRateLimitConfig(req.path);
      const clientId = this.getClientId(req);

      // Check if client is currently blocked
      if (this.isClientBlocked(clientId)) {
        this.handleBlockedClient(req, res, clientId);
        return;
      }

      // Check rate limits
      const isAllowed = await this.checkRateLimit(clientId, config, req);

      if (isAllowed) {
        this.addRateLimitHeaders(res, clientId, config);
        next();
      } else {
        this.handleRateLimitExceeded(req, res, clientId, config);
      }
    } catch (error) {
      this.logger.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  }

  /**
   * Get appropriate rate limit configuration for the endpoint
   */
  private getRateLimitConfig(path: string): RateLimitConfig {
    // Find matching configuration
    for (const [endpoint, config] of this.rateLimitConfigs) {
      if (endpoint !== 'default' && path.startsWith(endpoint)) {
        return config;
      }
    }

    // Return default configuration
    return this.rateLimitConfigs.get('default')!;
  }

  /**
   * Get client identifier (IP-based or user-based)
   */
  private getClientId(req: Request): string {
    // If user is authenticated, use user ID for more accurate tracking
    if (req.user && (req.user as any).sub) {
      return `user:${(req.user as any).sub}`;
    }

    // Otherwise use IP address
    return `ip:${req.ip || req.connection.remoteAddress}`;
  }

  /**
   * Check if client is currently blocked
   */
  private isClientBlocked(clientId: string): boolean {
    const clientInfo = this.clients.get(clientId) || this.userClients.get(clientId);
    return clientInfo?.blockedUntil ? clientInfo.blockedUntil > Date.now() : false;
  }

  /**
   * Check if request is within rate limits
   */
  private async checkRateLimit(
    clientId: string,
    config: RateLimitConfig,
    req: Request
  ): Promise<boolean> {
    const now = Date.now();
    const isUser = clientId.startsWith('user:');
    const clientMap = isUser ? this.userClients : this.clients;

    let clientInfo = clientMap.get(clientId);

    if (!clientInfo || now > clientInfo.resetTime) {
      // Create new client info or reset expired window
      clientInfo = {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now,
      };
      clientMap.set(clientId, clientInfo);
      return true;
    }

    // Increment request count
    clientInfo.count++;

    // Check if limit exceeded
    if (clientInfo.count > config.maxRequests) {
      this.logger.warn(`Rate limit exceeded for ${clientId}`, {
        clientId,
        count: clientInfo.count,
        maxRequests: config.maxRequests,
        path: req.path,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Apply progressive blocking
      this.applyProgressiveBlocking(clientId, clientInfo, config);
      return false;
    }

    return true;
  }

  /**
   * Apply progressive blocking for repeated violations
   */
  private applyProgressiveBlocking(
    clientId: string,
    clientInfo: ClientInfo,
    config: RateLimitConfig
  ): void {
    const violations = clientInfo.count - config.maxRequests;
    let blockDuration = config.windowMs; // Start with window duration

    // Increase block duration based on number of violations
    if (violations > 5) {
      blockDuration = config.windowMs * 10; // 10x window for severe violations
    } else if (violations > 3) {
      blockDuration = config.windowMs * 5; // 5x window for moderate violations
    } else if (violations > 1) {
      blockDuration = config.windowMs * 2; // 2x window for minor violations
    }

    clientInfo.blockedUntil = Date.now() + blockDuration;

    this.logger.warn(`Client ${clientId} blocked for ${blockDuration}ms`, {
      clientId,
      violations,
      blockDuration,
      blockedUntil: clientInfo.blockedUntil,
    });
  }

  /**
   * Handle rate limit exceeded
   */
  private handleRateLimitExceeded(
    req: Request,
    res: Response,
    clientId: string,
    config: RateLimitConfig
  ): void {
    const clientInfo = this.clients.get(clientId) || this.userClients.get(clientId);
    const retryAfter = Math.ceil((clientInfo?.resetTime! - Date.now()) / 1000);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', new Date(clientInfo?.resetTime!).toISOString());
    res.setHeader('Retry-After', retryAfter);

    throw new HttpException({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Rate limit exceeded',
      retryAfter,
      correlationId: (req as any).correlationId,
      timestamp: new Date().toISOString(),
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  /**
   * Handle blocked client
   */
  private handleBlockedClient(
    req: Request,
    res: Response,
    clientId: string
  ): void {
    const clientInfo = this.clients.get(clientId) || this.userClients.get(clientId);
    const retryAfter = Math.ceil((clientInfo?.blockedUntil! - Date.now()) / 1000);

    res.setHeader('Retry-After', retryAfter);

    this.logger.warn(`Blocked client attempted access: ${clientId}`, {
      clientId,
      blockedUntil: clientInfo?.blockedUntil,
      path: req.path,
      ip: req.ip,
    });

    throw new HttpException({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Client temporarily blocked due to excessive requests',
      retryAfter,
      correlationId: (req as any).correlationId,
      timestamp: new Date().toISOString(),
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    res: Response,
    clientId: string,
    config: RateLimitConfig
  ): void {
    const clientInfo = this.clients.get(clientId) || this.userClients.get(clientId);
    const remaining = Math.max(0, config.maxRequests - clientInfo!.count);

    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(clientInfo!.resetTime).toISOString());
  }

  /**
   * Check if IP is in trusted list
   */
  private isTrustedIP(ip: string): boolean {
    return this.trustedIPs.has(ip);
  }

  /**
   * Initialize trusted IPs from configuration
   */
  private initializeTrustedIPs(): void {
    const trustedIPs = this.configService.get<string>('TRUSTED_IPS', '');
    if (trustedIPs) {
      trustedIPs.split(',').forEach(ip => {
        this.trustedIPs.add(ip.trim());
      });
    }

    // Add localhost for development
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      this.trustedIPs.add('127.0.0.1');
      this.trustedIPs.add('::1');
      this.trustedIPs.add('localhost');
    }
  }

  /**
   * Start cleanup interval to remove expired client data
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredClients();
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Clean up expired client data
   */
  private cleanupExpiredClients(): void {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean IP-based clients
    for (const [clientId, clientInfo] of this.clients.entries()) {
      if (now > clientInfo.resetTime && now > (clientInfo.blockedUntil || 0)) {
        this.clients.delete(clientId);
        cleanedCount++;
      }
    }

    // Clean user-based clients
    for (const [clientId, clientInfo] of this.userClients.entries()) {
      if (now > clientInfo.resetTime && now > (clientInfo.blockedUntil || 0)) {
        this.userClients.delete(clientId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit clients`);
    }
  }
}