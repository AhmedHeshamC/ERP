import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  correlationId?: string;
  timestamp: string;
  path?: string;
  details?: any;
  stack?: string; // Only in development
}

/**
 * Production Error Filter
 * Provides sanitized, secure error responses for production environments
 * Follows OWASP Top 10 A05: Security Misconfiguration
 * Follows OWASP Top 10 A09: Security Logging and Monitoring
 *
 * Features:
 * - Sanitized error messages (no sensitive information leakage)
 * - Correlation ID tracking for debugging
 * - Structured logging for monitoring
 * - Environment-specific error details
 * - Security event logging for suspicious errors
 */
@Catch()
export class ProductionErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProductionErrorFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = this.getCorrelationId(request);
    const statusCode = this.getStatusCode(exception);
    const message = this.getSanitizedMessage(exception);
    const error = this.getErrorType(exception);

    // Create sanitized error response
    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add development-only details
    if (this.isDevelopment()) {
      errorResponse.details = this.getDevelopmentDetails(exception);
      errorResponse.stack = this.getStackTrace(exception);
    }

    // Log the error with context
    this.logError(exception, request, correlationId);

    // Log security events for suspicious errors
    this.logSecurityEvents(exception, request, correlationId);

    // Send sanitized response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Extract correlation ID from request headers
   */
  private getCorrelationId(request: Request): string {
    return (
      request.headers['x-correlation-id'] as string ||
      request.headers['x-request-id'] as string ||
      this.generateCorrelationId()
    );
  }

  /**
   * Generate a new correlation ID
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get appropriate HTTP status code
   */
  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Default to 500 for unknown exceptions
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Get sanitized error message (no sensitive information)
   */
  private getSanitizedMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        return this.sanitizeMessage(exceptionResponse);
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;

        if (responseObj.message) {
          if (Array.isArray(responseObj.message)) {
            return this.sanitizeMessage(responseObj.message.join(', '));
          }
          return this.sanitizeMessage(responseObj.message);
        }
      }

      return this.sanitizeMessage(exception.message);
    }

    if (exception instanceof Error) {
      return this.sanitizeErrorMessage(exception.message);
    }

    return 'An unexpected error occurred';
  }

  /**
   * Get error type for categorization
   */
  private getErrorType(exception: unknown): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          return 'Bad Request';
        case HttpStatus.UNAUTHORIZED:
          return 'Unauthorized';
        case HttpStatus.FORBIDDEN:
          return 'Forbidden';
        case HttpStatus.NOT_FOUND:
          return 'Not Found';
        case HttpStatus.CONFLICT:
          return 'Conflict';
        case HttpStatus.TOO_MANY_REQUESTS:
          return 'Too Many Requests';
        case HttpStatus.INTERNAL_SERVER_ERROR:
          return 'Internal Server Error';
        default:
          return 'Error';
      }
    }

    return 'Internal Server Error';
  }

  /**
   * Sanitize message to prevent information leakage
   */
  private sanitizeMessage(message: string): string {
    if (!message) {
      return 'An error occurred';
    }

    // Remove sensitive information patterns
    let sanitized = message;

    // Database connection strings and credentials
    sanitized = sanitized.replace(/(postgresql|mysql|mongodb):\/\/[^:\s]+:[^@\s]+@/gi, '$1://***:***@');

    // File paths
    sanitized = sanitized.replace(/\/[a-zA-Z0-9_\-\/]+\.(ts|js|json|sql)/gi, '***');

    // Internal server details
    sanitized = sanitized.replace(/internal server error at .*/gi, 'Internal server error');
    sanitized = sanitized.replace(/error: .+\.ts:\d+:\d+/gi, 'Internal server error');

    // Stack trace patterns
    sanitized = sanitized.replace(/at .+ \(.+:\d+:\d+\)/gi, 'at internal location');

    // Database query details
    sanitized = sanitized.replace(/SELECT.*FROM.*WHERE/gi, 'Database query');
    sanitized = sanitized.replace(/INSERT.*INTO/gi, 'Database operation');
    sanitized = sanitized.replace(/UPDATE.*SET/gi, 'Database operation');
    sanitized = sanitized.replace(/DELETE.*FROM/gi, 'Database operation');

    return sanitized;
  }

  /**
   * Sanitize error message for security
   */
  private sanitizeErrorMessage(message: string): string {
    const sanitized = this.sanitizeMessage(message);

    // Additional security sanitization
    if (this.containsSensitiveInfo(sanitized)) {
      return 'An unexpected error occurred';
    }

    return sanitized;
  }

  /**
   * Check if message contains sensitive information
   */
  private containsSensitiveInfo(message: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
      /connection string/i,
      /database/i,
      /internal/i,
      /stack trace/i,
      /\.ts:\d+:\d+/,
      /\/src\//,
      /node_modules/,
    ];

    return sensitivePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Get development-specific error details
   */
  private getDevelopmentDetails(exception: unknown): any {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        return response;
      }
    }

    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
      };
    }

    return { originalException: exception };
  }

  /**
   * Get stack trace for development
   */
  private getStackTrace(exception: unknown): string | undefined {
    if (exception instanceof Error) {
      return exception.stack;
    }

    return undefined;
  }

  /**
   * Check if running in development mode
   */
  private isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Log error with full context for debugging
   */
  private logError(exception: unknown, request: Request, correlationId: string): void {
    const logData = {
      correlationId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
      userId: (request as any).user?.id,
      statusCode: this.getStatusCode(exception),
      message: this.getSanitizedMessage(exception),
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof Error) {
      this.logger.error(`Request failed [${correlationId}]`, {
        ...logData,
        error: exception.message,
        stack: exception.stack,
      });
    } else {
      this.logger.error(`Request failed [${correlationId}]`, {
        ...logData,
        exception,
      });
    }
  }

  /**
   * Log security events for suspicious errors
   */
  private logSecurityEvents(exception: unknown, request: Request, correlationId: string): void {
    const statusCode = this.getStatusCode(exception);
    const message = this.getSanitizedMessage(exception);

    // Log authentication failures
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      this.logger.warn(`Authentication failure [${correlationId}]`, {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        reason: message,
        timestamp: new Date().toISOString(),
      });
    }

    // Log authorization failures
    if (statusCode === HttpStatus.FORBIDDEN) {
      this.logger.warn(`Authorization failure [${correlationId}]`, {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        userId: (request as any).user?.id,
        reason: message,
        timestamp: new Date().toISOString(),
      });
    }

    // Log rate limiting
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(`Rate limit exceeded [${correlationId}]`, {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });
    }

    // Log database errors (potential SQL injection attempts)
    if (message.toLowerCase().includes('database') ||
        message.toLowerCase().includes('sql') ||
        message.toLowerCase().includes('query')) {
      this.logger.warn(`Database error detected [${correlationId}]`, {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        userId: (request as any).user?.id,
        error: message,
        timestamp: new Date().toISOString(),
      });
    }

    // Log validation errors (potential injection attempts)
    if (statusCode === HttpStatus.BAD_REQUEST &&
        this.sanitizeMessage(message) !== message) {
      this.logger.warn(`Suspicious input detected [${correlationId}]`, {
        correlationId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        userId: (request as any).user?.id,
        sanitizedMessage: this.sanitizeMessage(message),
        timestamp: new Date().toISOString(),
      });
    }
  }
}