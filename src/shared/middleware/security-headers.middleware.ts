import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

/**
 * Security Headers Middleware
 * Implements comprehensive security headers for OWASP Top 10 compliance
 * Follows security best practices for web applications
 *
 * Security Headers Implemented:
 * - X-Content-Type-Options: Prevents MIME-type sniffing
 * - X-Frame-Options: Protects against clickjacking
 * - X-XSS-Protection: Enables XSS filtering
 * - Strict-Transport-Security: Enforces HTTPS
 * - Content-Security-Policy: Prevents XSS and data injection
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Controls browser features
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Prevent MIME-type sniffing (OWASP A05)
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Protect against clickjacking (OWASP A04)
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS filtering in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control referrer information leakage
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Prevent caching of sensitive pages
    if (this.isSensitiveEndpoint(req.url)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // Content Security Policy (CSP) - Prevent XSS and data injection
    const csp = this.buildContentSecurityPolicy();
    res.setHeader('Content-Security-Policy', csp);

    // Permissions Policy (formerly Feature Policy) - Control browser features
    const permissionsPolicy = this.buildPermissionsPolicy();
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // HTTP Strict Transport Security (HSTS) - Enforce HTTPS
    if (this.isProduction() && req.protocol === 'https') {
      const maxAge = this.configService.get<string>('HSTS_MAX_AGE', '31536000'); // 1 year
      const includeSubDomains = this.configService.get<boolean>('HSTS_INCLUDE_SUBDOMAINS', true);
      const preload = this.configService.get<boolean>('HSTS_PRELOAD', false);

      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (preload) {
        hstsValue += '; preload';
      }

      res.setHeader('Strict-Transport-Security', hstsValue);
    }

    // Additional security headers
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    // Custom security headers for API
    res.setHeader('X-API-Version', '1.0');
    res.setHeader('X-Protected-By', 'NestJS-Security-Middleware');

    // Log security headers applied (for debugging)
    if (this.isDevelopment()) {
      this.logSecurityHeaders(req, res);
    }

    next();
  }

  /**
   * Build Content Security Policy
   * Prevents XSS and data injection attacks
   */
  private buildContentSecurityPolicy(): string {
    const isDev = this.isDevelopment();

    // Base CSP directives
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // More permissive in development
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];

    // Adjust for development vs production
    if (isDev) {
      // More permissive for development
      directives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-dynamic'");
      directives.push("connect-src 'self' ws: wss: http: https:");
    } else {
      // Stricter for production
      directives.push("script-src 'self'");
      directives.push("object-src 'none'");
      directives.push("media-src 'self'");
      directives.push("manifest-src 'self'");
    }

    // Add API-specific directives
    directives.push("worker-src 'self' blob:");
    directives.push("child-src 'self'");

    return directives.join('; ');
  }

  /**
   * Build Permissions Policy
   * Controls access to browser features and APIs
   */
  private buildPermissionsPolicy(): string {
    const policies = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=(self)',
      'encrypted-media=(self)',
      'fullscreen=(self)',
      'picture-in-picture=(self)',
      'speaker=()',
      'vr=()',
      'publickey-credentials-get=(self)',
      'screen-wake-lock=(self)',
      'web-share=(self)',
    ];

    return policies.join(', ');
  }

  /**
   * Check if endpoint is sensitive and should not be cached
   */
  private isSensitiveEndpoint(url: string): boolean {
    const sensitivePatterns = [
      '/auth/',
      '/users/',
      '/admin/',
      '/api/v1/auth',
      '/api/v1/users',
      '/security',
      '/logout',
      '/change-password',
      '/reset-password',
    ];

    return sensitivePatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Check if running in production environment
   */
  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Check if running in development environment
   */
  private isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Log security headers for debugging
   */
  private logSecurityHeaders(req: Request, res: Response): void {
    this.logger.debug(`Security headers applied`, {
      url: req.url,
      method: req.method,
      headers: {
        'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
        'X-Frame-Options': res.getHeader('X-Frame-Options'),
        'X-XSS-Protection': res.getHeader('X-XSS-Protection'),
        'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
        'Referrer-Policy': res.getHeader('Referrer-Policy'),
        'Permissions-Policy': res.getHeader('Permissions-Policy'),
      },
    });
  }
}