import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as helmet from 'helmet';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly sensitiveOperations = new Set([
    'login',
    'register',
    'password-change',
    'password-reset',
    'delete',
    'transfer',
    'payment',
  ]);

  constructor(private configService: ConfigService) {}

  /**
   * OWASP A01: Broken Access Control
   * Returns Helmet configuration for security headers
   */
  getHelmetConfig() {
    return {
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
        },
      },

      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // X-Frame-Options
      frameguard: {
        action: 'deny',
      },

      // X-Content-Type-Options
      noSniff: true,

      // Referrer Policy
      referrerPolicy: {
        policy: ['no-referrer', 'strict-origin-when-cross-origin'],
      },

      // Permissions Policy
      permissionsPolicy: {
        features: {
          geolocation: ["'none'"],
          microphone: ["'none'"],
          camera: ["'none'"],
          payment: ["'none'"],
          usb: ["'none'"],
          magnetometer: ["'none'"],
          accelerometer: ["'none'"],
          gyroscope: ["'none'"],
        },
      },

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: false,

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: {
        policy: 'cross-origin',
      },

      // Remove X-Powered-By header
      hidePoweredBy: true,
    };
  }

  /**
   * OWASP A02: Cryptographic Failures
   * Generate secure random tokens
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(sessionToken),
    );
  }

  /**
   * OWASP A03: Injection
   * Validate and sanitize input
   */
  validateInput(input: string, type: 'email' | 'username' | 'id' | 'text' = 'text'): boolean {
    const patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      username: /^[a-zA-Z0-9_-]{3,20}$/,
      id: /^[a-zA-Z0-9_-]{1,50}$/,
      text: /^[\s\S]{1,500}$/,
    };

    return patterns[type].test(input);
  }

  /**
   * OWASP A07: Identification & Authentication Failures
   * Check for common password patterns
   */
  isPasswordStrong(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common passwords
    const commonPasswords = [
      'password', '123456', '123456789', '12345678', '12345',
      '1234567', '1234567890', '1234', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * OWASP A09: Security Logging and Monitoring
   * Log security events
   */
  logSecurityEvent(
    event: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'SECURITY_VIOLATION' | 'SUSPICIOUS_ACTIVITY',
    userId?: string,
    ip?: string,
    userAgent?: string,
    details?: any,
  ) {
    const logData = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      ip,
      userAgent,
      details,
    };

    if (this.isSensitiveOperation(event)) {
      this.logger.warn(`SECURITY EVENT: ${event}`, logData);
    } else {
      this.logger.log(`Security event: ${event}`, logData);
    }
  }

  /**
   * Check if operation is sensitive
   */
  private isSensitiveOperation(operation: string): boolean {
    return this.sensitiveOperations.has(operation.toLowerCase());
  }

  /**
   * OWASP A10: Server-Side Request Forgery (SSRF)
   * Validate URL for SSRF protection
   */
  isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // Block private/internal IP ranges
      const hostname = parsedUrl.hostname;
      if (!hostname) return false;

      // Block localhost and private IP ranges
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.localhost')
      ) {
        return false;
      }

      // Only allow HTTP/HTTPS
      return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  /**
   * OWASP A05: Security Misconfiguration
   * Get secure cookie options
   */
  getCookieOptions() {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      domain: this.configService.get<string>('COOKIE_DOMAIN'),
      path: '/',
    };
  }

  /**
   * Rate limiting configuration for sensitive endpoints
   */
  getRateLimitConfig(endpoint: string) {
    const sensitiveEndpoints = {
      '/auth/login': { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
      '/auth/register': { windowMs: 60 * 60 * 1000, max: 3 }, // 3 attempts per hour
      '/auth/forgot-password': { windowMs: 60 * 60 * 1000, max: 3 }, // 3 attempts per hour
      '/auth/reset-password': { windowMs: 60 * 60 * 1000, max: 5 }, // 5 attempts per hour
    };

    return sensitiveEndpoints[endpoint] || {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    };
  }

  /**
   * Input sanitization for XSS prevention
   */
  sanitizeInput(input: string): string {
    if (!input) return input;

    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate file upload for security
   */
  validateFileUpload(file: Express.Multer.File): { isValid: boolean; error?: string } {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    const maxSize = this.configService.get<number>('app.upload.maxFileSize', 10 * 1024 * 1024); // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { isValid: false, error: 'File type not allowed' };
    }

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size too large' };
    }

    // Check file extension matches MIME type
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.xls', '.xlsx'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
      return { isValid: false, error: 'File extension not allowed' };
    }

    return { isValid: true };
  }
}