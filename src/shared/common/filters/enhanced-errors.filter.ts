import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorHandlingService, ErrorContext } from '../services/error-handling.service';
import { SecurityService } from '../../security/security.service';
import { ApiResponseBuilder } from '../interfaces/api-response.interface';
import { AuditEvents } from '../constants';

/**
 * Enhanced Global Exception Filter
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles exception filtering and response formatting
 * - Open/Closed: Extensible for new exception types
 * - Interface Segregation: Focused exception filtering interface
 * - Dependency Inversion: Depends on abstractions
 *
 * OWASP Compliance:
 * - A01: Prevents information disclosure in error responses
 * - A09: Comprehensive security logging for all exceptions
 * - A05: Secure defaults for error handling
 */
@Catch()
export class EnhancedErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger(EnhancedErrorsFilter.name);

  constructor(
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly securityService: SecurityService,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    try {
      // Extract context information
      const errorContext: ErrorContext = {
        userId: this.extractUserId(request),
        requestId: this.extractRequestId(request),
        endpoint: request.path,
        method: request.method,
        ip: this.extractClientIp(request),
        userAgent: request.get('User-Agent'),
        body: request.body,
        params: request.params,
        query: request.query,
      };

      // Process error using enhanced error handling
      const { response: errorResponse, statusCode, shouldLog } =
        this.errorHandlingService.processError(exception, errorContext);

      // Log security event for critical errors
      if (this.isSecurityRelevantError(exception, statusCode)) {
        await this.logSecurityError(exception, errorContext, statusCode);
      }

      // Set response headers
      this.setSecurityHeaders(response);

      // Send error response
      response.status(statusCode).json(errorResponse);

      // Log error if needed
      if (shouldLog) {
        this.logRequest(request, statusCode, errorContext);
      }
    } catch (filterError) {
      // Fallback error handling if the filter itself fails
      this.logger.error(
        `Error filter failed: ${filterError.message}`,
        filterError.stack,
      );

      const fallbackResponse = ApiResponseBuilder.internalError(
        'Internal server error',
        filterError instanceof Error ? filterError : undefined,
      );

      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(fallbackResponse);
    }
  }

  /**
   * Extract user ID from request
   */
  private extractUserId(request: Request): string | undefined {
    // Try to get user ID from various sources
    return (
      (request as any).user?.id ||
      (request as any).user?.sub ||
      request.headers['x-user-id'] as string ||
      request.headers['user-id'] as string
    );
  }

  /**
   * Extract request ID from request
   */
  private extractRequestId(request: Request): string | undefined {
    return (
      request.headers['x-request-id'] as string ||
      request.headers['request-id'] as string ||
      (request as any).id
    );
  }

  /**
   * Extract client IP from request
   */
  private extractClientIp(request: Request): string | undefined {
    return (
      request.ip ||
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection?.remoteAddress
    );
  }

  /**
   * Check if error is security-relevant
   */
  private isSecurityRelevantError(exception: unknown, statusCode: number): boolean {
    // Security-relevant status codes
    const securityStatusCodes = [
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.TOO_MANY_REQUESTS,
      HttpStatus.PAYMENT_REQUIRED,
    ];

    // Security-relevant error types
    const securityErrorTypes = [
      'UnauthorizedError',
      'ForbiddenError',
      'RateLimitError',
      'SecurityViolationError',
      'ValidationError',
    ];

    return (
      securityStatusCodes.includes(statusCode) ||
      (exception instanceof Error && securityErrorTypes.includes(exception.name)) ||
      (exception instanceof HttpException && [401, 403, 429].includes(exception.getStatus()))
    );
  }

  /**
   * Log security error events
   */
  private async logSecurityError(
    exception: unknown,
    context: ErrorContext,
    statusCode: number
  ): Promise<void> {
    try {
      const eventType = this.getSecurityEventType(exception, statusCode);
      const details = this.extractSecurityDetails(exception, context);

      await this.securityService.logSecurityEvent(
        eventType,
        context.userId || 'anonymous',
        context.ip || 'unknown',
        'enhanced-errors-filter',
        {
          ...details,
          endpoint: context.endpoint,
          method: context.method,
          statusCode,
          userAgent: context.userAgent,
          requestId: context.requestId,
        },
      );
    } catch (logError) {
      this.logger.error(`Failed to log security error: ${logError.message}`, logError.stack);
    }
  }

  /**
   * Get security event type based on exception
   */
  private getSecurityEventType(exception: unknown, statusCode: number): string {
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return AuditEvents.LOGIN_FAILED;
    }
    if (statusCode === HttpStatus.FORBIDDEN) {
      return AuditEvents.SECURITY_VIOLATION;
    }
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return 'RATE_LIMIT_EXCEEDED';
    }
    if (exception instanceof Error && exception.name === 'ValidationError') {
      return 'VALIDATION_ERROR';
    }
    return AuditEvents.SECURITY_VIOLATION;
  }

  /**
   * Extract security details from exception
   */
  private extractSecurityDetails(exception: unknown, context: ErrorContext): any {
    const details: any = {};

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        details.exceptionDetails = response;
      }
    }

    if (exception instanceof Error) {
      details.errorName = exception.name;
      details.errorMessage = exception.message;
    }

    // Add suspicious patterns if detected
    const suspiciousPatterns = this.detectSuspiciousPatterns(context);
    if (suspiciousPatterns.length > 0) {
      details.suspiciousPatterns = suspiciousPatterns;
    }

    return details;
  }

  /**
   * Detect suspicious patterns in request
   */
  private detectSuspiciousPatterns(context: ErrorContext): string[] {
    const patterns: string[] = [];

    if (context.body) {
      const bodyString = JSON.stringify(context.body).toLowerCase();

      // SQL injection patterns
      const sqlPatterns = ['select', 'insert', 'update', 'delete', 'drop', 'union', 'script'];
      if (sqlPatterns.some(pattern => bodyString.includes(pattern))) {
        patterns.push('POTENTIAL_SQL_INJECTION');
      }

      // XSS patterns
      const xssPatterns = ['<script', 'javascript:', 'onload=', 'onerror='];
      if (xssPatterns.some(pattern => bodyString.includes(pattern))) {
        patterns.push('POTENTIAL_XSS');
      }

      // Path traversal patterns
      const pathPatterns = ['../', '..\\', '%2e%2e'];
      if (pathPatterns.some(pattern => bodyString.includes(pattern))) {
        patterns.push('POTENTIAL_PATH_TRAVERSAL');
      }
    }

    return patterns;
  }

  /**
   * Set security headers on response
   */
  private setSecurityHeaders(response: Response): void {
    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    response.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS protection
    response.setHeader('X-XSS-Protection', '1; mode=block');

    // Restrict referrer information
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy (basic implementation)
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );

    // HSTS (in production)
    if (process.env.NODE_ENV === 'production') {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    // Remove server information
    response.removeHeader('Server');
  }

  /**
   * Log request for monitoring
   */
  private logRequest(request: Request, statusCode: number, context: ErrorContext): void {
    const logData = {
      method: request.method,
      url: request.url,
      statusCode,
      ip: context.ip,
      userAgent: context.userAgent,
      userId: context.userId,
      requestId: context.requestId,
      responseTime: Date.now() - (request as any).startTime,
    };

    if (statusCode >= 500) {
      this.logger.error(`Server Error: ${request.method} ${request.url}`, logData);
    } else if (statusCode >= 400) {
      this.logger.warn(`Client Error: ${request.method} ${request.url}`, logData);
    } else {
      this.logger.log(`Request: ${request.method} ${request.url}`, logData);
    }
  }
}