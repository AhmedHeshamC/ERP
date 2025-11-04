import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponseBuilder, ApiResponseMetadata } from '../interfaces/api-response.interface';

/**
 * Standardized API Response Interceptor
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles response formatting
 * - Open/Closed: Extensible for new response formats
 * - Interface Segregation: Focused response formatting interface
 * - Dependency Inversion: Depends on ApiResponseBuilder abstraction
 *
 * Features:
 * - Consistent API response format across all endpoints
 * - Correlation ID tracking in all responses
 * - Performance timing metadata
 * - Pagination support
 * - File response handling
 * - Error response preservation
 */

export interface ResponseInterceptorOptions {
  includePerformance?: boolean;
  includeRequestDetails?: boolean;
  sanitizeResponses?: boolean;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiResponseInterceptor.name);

  constructor(
    @Optional() @Inject('ResponseInterceptorOptions') private readonly options: ResponseInterceptorOptions = {}
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    // Extract correlation ID
    const correlationId = this.extractCorrelationId(request);

    return next.handle().pipe(
      map((data) => {
        const processingTime = Date.now() - startTime;

        // Skip formatting for special response types
        if (this.shouldSkipFormatting(data, response)) {
          return data;
        }

        // Format response using ApiResponseBuilder
        return this.formatResponse(data, {
          correlationId,
          processingTime,
          request,
          response,
        });
      }),
    );
  }

  /**
   * Extract correlation ID from request
   */
  private extractCorrelationId(request: Request): string {
    return (
      (request as any).correlationId ||
      request.headers['x-correlation-id'] as string ||
      request.headers['x-request-id'] as string ||
      `resp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );
  }

  /**
   * Check if response formatting should be skipped
   */
  private shouldSkipFormatting(data: any, response: Response): boolean {
    // Skip if data is already in our standard format
    if (data && typeof data === 'object' && 'success' in data && 'metadata' in data) {
      return true;
    }

    // Skip for file downloads
    if (response.get('content-type')?.includes('application/octet-stream') ||
        response.get('content-disposition')?.includes('attachment')) {
      return true;
    }

    // Skip for binary data
    if (data instanceof Buffer) {
      return true;
    }

    // Skip for streams
    if (data && typeof data === 'object' && (data.pipe || data.readable)) {
      return true;
    }

    return false;
  }

  /**
   * Format response using ApiResponseBuilder
   */
  private formatResponse(
    data: any,
    context: {
      correlationId: string;
      processingTime: number;
      request: Request;
      response: Response;
    }
  ): any {
    try {
      const { correlationId, processingTime, request } = context;

      // Check for potentially problematic data that might cause formatting issues
      if (this.isProblematicData(data)) {
        this.logger.warn('Detected potentially problematic data, returning original');
        return data;
      }

      // Create response metadata
      const metadata: ApiResponseMetadata = {
        timestamp: new Date().toISOString(),
        requestId: correlationId,
        version: this.getApiVersion(),
        environment: process.env.NODE_ENV || 'development',
      };

      // Add performance timing if enabled
      if (this.options.includePerformance) {
        metadata.processingTime = processingTime;
      }

      // Add request details if enabled
      if (this.options.includeRequestDetails) {
        // Add sanitized request metadata
        this.addRequestMetadata(metadata, request);
      }

      // Handle different response types
      if (this.isPaginatedResponse(data)) {
        return ApiResponseBuilder.paginated(
          data.data || data.items,
          data.pagination,
          data.message || 'Data retrieved successfully',
          metadata
        );
      }

      if (this.isBulkOperationResponse(data)) {
        return ApiResponseBuilder.bulk(
          data.successful || [],
          data.failed || [],
          data.message || 'Bulk operation completed',
          metadata
        );
      }

      if (this.isFileResponse(data)) {
        return ApiResponseBuilder.file(
          data,
          data.message || 'File processed successfully',
          metadata
        );
      }

      // Handle error responses that weren't caught by filters
      if (this.isErrorResponse(data)) {
        return ApiResponseBuilder.error(
          data.message || 'Operation failed',
          data.errors,
          data.errorCode,
          metadata
        );
      }

      // Default success response
      const message = this.extractSuccessMessage(data, request);
      return ApiResponseBuilder.success(
        this.sanitizeResponseData(data),
        message,
        metadata
      );

    } catch (error) {
      this.logger.error('Failed to format response', error instanceof Error ? error.stack : undefined);

      // Fallback to original data if formatting fails
      return data;
    }
  }

  /**
   * Check if response is paginated
   */
  private isPaginatedResponse(data: any): boolean {
    return data && (
      (data.data && data.pagination) ||
      (data.items && data.pagination) ||
      (data.total !== undefined && data.page !== undefined)
    );
  }

  /**
   * Check if response is bulk operation result
   */
  private isBulkOperationResponse(data: any): boolean {
    return data && (
      (data.successful !== undefined && data.failed !== undefined) ||
      (data.total !== undefined && data.successful !== undefined)
    );
  }

  /**
   * Check if response is file response
   */
  private isFileResponse(data: any): boolean {
    return data && (
      data.filename !== undefined ||
      data.contentType !== undefined ||
      data.buffer instanceof Buffer ||
      data.data instanceof Buffer
    );
  }

  /**
   * Check if response is error response
   */
  private isErrorResponse(data: any): boolean {
    return data && (
      data.success === false ||
      data.error !== undefined ||
      (data.statusCode && data.statusCode >= 400)
    );
  }

  /**
   * Check if data might be problematic for formatting
   */
  private isProblematicData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for objects with potentially dangerous getters or valueOf methods
    if (typeof data.get === 'function' || typeof data.valueOf === 'function') {
      try {
        // Try to access potentially problematic methods
        if (data.get && typeof data.get === 'function') {
          data.get();
        }
        if (data.valueOf && typeof data.valueOf === 'function') {
          data.valueOf();
        }
      } catch (error) {
        return true; // This data is problematic
      }
    }

    return false;
  }

  /**
   * Extract success message based on request method and data
   */
  private extractSuccessMessage(data: any, request: Request): string {
    // If data already has a message, use it
    if (data && typeof data === 'object' && data.message) {
      return data.message;
    }

    // Generate message based on HTTP method
    const method = request.method?.toLowerCase();
    const url = request.url;

    switch (method) {
      case 'post':
        return 'Resource created successfully';
      case 'put':
      case 'patch':
        return 'Resource updated successfully';
      case 'delete':
        return 'Resource deleted successfully';
      case 'get':
        return url?.includes('/search') ? 'Search completed successfully' : 'Data retrieved successfully';
      default:
        return 'Operation completed successfully';
    }
  }

  /**
   * Sanitize response data if enabled
   */
  private sanitizeResponseData(data: any): any {
    if (!this.options.sanitizeResponses) {
      return data;
    }

    // Remove sensitive fields from response
    if (data && typeof data === 'object') {
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'apiKey'];
      const sanitized = Array.isArray(data) ? [...data] : { ...data };

      const removeSensitiveFields = (obj: any): void => {
        if (!obj || typeof obj !== 'object') return;

        // Check each property against sensitive fields
        for (const key in obj) {
          // Check exact matches
          if (sensitiveFields.includes(key)) {
            obj[key] = '***';
            continue;
          }

          // Check partial matches (e.g., 'apiKey' contains 'key')
          for (const field of sensitiveFields) {
            if (key.toLowerCase().includes(field.toLowerCase())) {
              obj[key] = '***';
              break;
            }
          }

          // Recursively sanitize nested objects
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            removeSensitiveFields(obj[key]);
          }
        }
      };

      removeSensitiveFields(sanitized);
      return sanitized;
    }

    return data;
  }

  /**
   * Add request metadata to response
   */
  private addRequestMetadata(metadata: ApiResponseMetadata, request: Request): void {
    // Add sanitized request information
    Object.assign(metadata, {
      method: request.method,
      path: request.url,
      userAgent: this.sanitizeUserAgent(request.headers['user-agent']),
    });
  }

  /**
   * Sanitize user agent string
   */
  private sanitizeUserAgent(userAgent?: string): string {
    if (!userAgent) return 'unknown';

    // Remove potential sensitive information from user agent
    return userAgent
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***@***.***') // Email addresses
      .replace(/password[\w\s]*[=:][\w\s]*/gi, 'password=***') // Password parameters
      .replace(/token[\w\s]*[=:][\w\s]*/gi, 'token=***') // Token parameters
      .substring(0, 200); // Limit length
  }

  /**
   * Get API version from environment or headers
   */
  private getApiVersion(): string {
    return process.env.API_VERSION || '1.0.0';
  }
}