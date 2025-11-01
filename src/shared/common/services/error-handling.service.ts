import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorDetail, ValidationErrorDetail, ApiResponseBuilder, ErrorCodes } from '../interfaces/api-response.interface';
import { AuditEvents } from '../constants';

/**
 * Concurrency Error for resource locking conflicts
 */
export class ConcurrencyError extends HttpException {
  public entityType?: string;
  public entityId?: string;
  public currentVersion?: number;
  public attemptedVersion?: number;

  constructor(resourceType: string, resourceId: string, lockType?: string) {
    super({
      statusCode: HttpStatus.CONFLICT,
      message: `Resource ${resourceType}:${resourceId} is currently locked${lockType ? ` (${lockType})` : ''}`,
      error: 'CONCURRENCY_ERROR',
      details: {
        resourceType,
        resourceId,
        lockType,
        timestamp: new Date().toISOString(),
      },
    }, HttpStatus.CONFLICT);
  }
}

/**
 * Enhanced Error Handling Service
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles error processing and transformation
 * - Open/Closed: Extensible for new error types
 * - Interface Segregation: Focused error handling interface
 * - Dependency Inversion: Depends on abstractions
 *
 * OWASP Compliance:
 * - A01: Secure error handling without information disclosure
 * - A09: Comprehensive security event logging for errors
 * - A10: Input validation through proper error reporting
 */

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  body?: any;
  params?: any;
  query?: any;
}

export interface BusinessRuleError extends Error {
  code: string;
  field?: string;
  value?: any;
  constraints?: Record<string, string>;
}


@Injectable()
export class ErrorHandlingService {
  private readonly logger = new Logger(ErrorHandlingService.name);

  /**
   * Process and standardize any error into a proper response
   * OWASP A01: Prevents information disclosure in production
   */
  processError(error: any, context?: ErrorContext): {
    response: any;
    statusCode: number;
    shouldLog: boolean;
  } {
    const errorInfo = this.classifyError(error);
    const shouldLog = this.shouldLogError(errorInfo);

    if (shouldLog) {
      this.logError(error, errorInfo, context);
    }

    const response = this.createErrorResponse(errorInfo, context);
    const statusCode = this.getStatusCode(errorInfo);

    return { response, statusCode, shouldLog };
  }

  /**
   * Classify error type and extract relevant information
   * OWASP A01: Proper error classification without sensitive info
   */
  private classifyError(error: any): {
    type: string;
    code: string;
    message: string;
    details?: ErrorDetail[];
    originalError: any;
    isOperational: boolean;
  } {
    // HttpException (NestJS)
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const statusCode = error.getStatus();

      if (typeof response === 'string') {
        return {
          type: 'HTTP_EXCEPTION',
          code: this.getErrorCodeFromStatus(statusCode),
          message: response,
          originalError: error,
          isOperational: true,
        };
      }

      if (typeof response === 'object' && (response as any).message) {
        return {
          type: 'VALIDATION_ERROR',
          code: ErrorCodes.VALIDATION_ERROR,
          message: (response as any).message || 'Validation failed',
          details: this.extractValidationDetails(response),
          originalError: error,
          isOperational: true,
        };
      }
    }

    // Prisma Database Errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return this.handlePrismaError(error);
    }

    // Prisma Validation Errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        type: 'VALIDATION_ERROR',
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Database validation failed',
        details: [{
          code: 'DATABASE_VALIDATION',
          message: error.message,
          timestamp: new Date().toISOString(),
        }],
        originalError: error,
        isOperational: true,
      };
    }

    // Business Rule Errors
    if (this.isBusinessRuleError(error)) {
      return {
        type: 'BUSINESS_RULE_ERROR',
        code: error.code || ErrorCodes.BUSINESS_RULE_VIOLATION,
        message: error.message,
        details: error.field ? [{
          code: error.code,
          message: error.message,
          field: error.field,
          value: error.value,
          timestamp: new Date().toISOString(),
        }] : undefined,
        originalError: error,
        isOperational: true,
      };
    }

    // Concurrency Errors
    if (this.isConcurrencyError(error)) {
      return {
        type: 'CONCURRENCY_ERROR',
        code: ErrorCodes.CONFLICT,
        message: 'Resource was modified by another process. Please refresh and try again.',
        details: [{
          code: 'OPTIMISTIC_CONCURRENCY',
          message: error.message,
          timestamp: new Date().toISOString(),
        }],
        originalError: error,
        isOperational: true,
      };
    }

    // Default to internal server error
    return {
      type: 'INTERNAL_ERROR',
      code: ErrorCodes.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again later.'
        : error.message || 'Unknown error occurred',
      originalError: error,
      isOperational: false,
    };
  }

  /**
   * Handle Prisma database errors with proper mapping
   * OWASP A03: Secure database error handling
   */
  private handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
    type: string;
    code: string;
    message: string;
    details?: ErrorDetail[];
    originalError: any;
    isOperational: boolean;
  } {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] | undefined;
        const field = target?.[0] || 'field';
        return {
          type: 'UNIQUE_CONSTRAINT_ERROR',
          code: ErrorCodes.ALREADY_EXISTS,
          message: `The ${field} is already in use.`,
          details: [{
            code: 'DUPLICATE_ENTRY',
            message: `Duplicate value for ${field}`,
            field,
            timestamp: new Date().toISOString(),
          }],
          originalError: error,
          isOperational: true,
        };

      case 'P2025':
        // Record not found
        return {
          type: 'NOT_FOUND_ERROR',
          code: ErrorCodes.NOT_FOUND,
          message: 'Record not found.',
          originalError: error,
          isOperational: true,
        };

      case 'P2003':
        // Foreign key constraint violation
        return {
          type: 'FOREIGN_KEY_ERROR',
          code: ErrorCodes.INVALID_INPUT,
          message: 'Referenced record does not exist.',
          details: [{
            code: 'FOREIGN_KEY_VIOLATION',
            message: 'Invalid reference to related record',
            timestamp: new Date().toISOString(),
          }],
          originalError: error,
          isOperational: true,
        };

      case 'P2014':
        // Relation violation
        return {
          type: 'RELATION_ERROR',
          code: ErrorCodes.BUSINESS_RULE_VIOLATION,
          message: 'Cannot delete or update record due to existing relations.',
          details: [{
            code: 'RELATION_VIOLATION',
            message: 'Record has dependent records',
            timestamp: new Date().toISOString(),
          }],
          originalError: error,
          isOperational: true,
        };

      case 'P2021':
        // Table does not exist
        return {
          type: 'DATABASE_ERROR',
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Database configuration error.',
          originalError: error,
          isOperational: false,
        };

      case 'P2022':
        // Column does not exist
        return {
          type: 'DATABASE_ERROR',
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Database schema error.',
          originalError: error,
          isOperational: false,
        };

      default:
        return {
          type: 'DATABASE_ERROR',
          code: ErrorCodes.DATABASE_ERROR,
          message: 'Database operation failed.',
          originalError: error,
          isOperational: false,
        };
    }
  }

  /**
   * Extract validation details from error response
   */
  private extractValidationDetails(response: any): ValidationErrorDetail[] {
    const details: ValidationErrorDetail[] = [];

    if (Array.isArray(response.message)) {
      response.message.forEach((message: string, index: number) => {
        details.push({
          code: 'VALIDATION_ERROR',
          message,
          timestamp: new Date().toISOString(),
        });
      });
    } else if (typeof response.message === 'object') {
      // Handle complex validation objects
      Object.entries(response.message).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          messages.forEach((message: string) => {
            details.push({
              code: 'VALIDATION_ERROR',
              message,
              field,
              timestamp: new Date().toISOString(),
            });
          });
        } else {
          details.push({
            code: 'VALIDATION_ERROR',
            message: String(messages),
            field,
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    return details;
  }

  /**
   * Determine if error should be logged
   * OWASP A09: Log security-relevant errors
   */
  private shouldLogError(errorInfo: any): boolean {
    // Always log non-operational errors
    if (!errorInfo.isOperational) {
      return true;
    }

    // Log specific error types that are security-relevant
    const securityRelevantTypes = [
      'UNAUTHORIZED',
      'FORBIDDEN',
      'SECURITY_VIOLATION',
      'INJECTION_ATTEMPT',
      'RATE_LIMIT_EXCEEDED',
    ];

    return securityRelevantTypes.includes(errorInfo.code);
  }

  /**
   * Log error with context
   * OWASP A09: Comprehensive security logging
   */
  private logError(error: any, errorInfo: any, context?: ErrorContext): void {
    const logData = {
      errorType: errorInfo.type,
      errorCode: errorInfo.code,
      message: errorInfo.message,
      timestamp: new Date().toISOString(),
      context,
      stack: error.stack,
    };

    if (errorInfo.type === 'INTERNAL_ERROR' || !errorInfo.isOperational) {
      this.logger.error(`Internal Error: ${errorInfo.message}`, {
        ...logData,
        originalError: error,
      });
    } else if (this.isSecurityRelevantError(errorInfo.code)) {
      this.logger.warn(`Security-Relevant Error: ${errorInfo.message}`, logData);
    } else {
      this.logger.log(`Operational Error: ${errorInfo.message}`, logData);
    }
  }

  /**
   * Create standardized error response
   * OWASP A01: Prevent information disclosure
   */
  private createErrorResponse(errorInfo: any, context?: ErrorContext): any {
    const baseMetadata = {
      timestamp: new Date().toISOString(),
      requestId: context?.requestId,
    };

    switch (errorInfo.type) {
      case 'VALIDATION_ERROR':
        return ApiResponseBuilder.validationError(
          errorInfo.details || [],
          errorInfo.message,
          baseMetadata
        );

      case 'NOT_FOUND_ERROR':
        return ApiResponseBuilder.notFound(
          'Resource',
          undefined,
          baseMetadata
        );

      case 'UNIQUE_CONSTRAINT_ERROR':
        return ApiResponseBuilder.conflict(
          errorInfo.message,
          baseMetadata
        );

      case 'BUSINESS_RULE_ERROR':
        return ApiResponseBuilder.error(
          errorInfo.message,
          errorInfo.details,
          errorInfo.code,
          baseMetadata
        );

      case 'CONCURRENCY_ERROR':
        return ApiResponseBuilder.error(
          errorInfo.message,
          errorInfo.details,
          ErrorCodes.CONFLICT,
          baseMetadata
        );

      default:
        return ApiResponseBuilder.internalError(
          errorInfo.message,
          errorInfo.originalError,
          baseMetadata
        );
    }
  }

  /**
   * Get appropriate HTTP status code
   */
  private getStatusCode(errorInfo: any): number {
    switch (errorInfo.type) {
      case 'VALIDATION_ERROR':
        return HttpStatus.BAD_REQUEST;

      case 'NOT_FOUND_ERROR':
        return HttpStatus.NOT_FOUND;

      case 'UNIQUE_CONSTRAINT_ERROR':
      case 'CONCURRENCY_ERROR':
        return HttpStatus.CONFLICT;

      case 'BUSINESS_RULE_ERROR':
        if (errorInfo.code === ErrorCodes.INSUFFICIENT_PERMISSIONS) {
          return HttpStatus.FORBIDDEN;
        }
        return HttpStatus.UNPROCESSABLE_ENTITY;

      case 'FOREIGN_KEY_ERROR':
        return HttpStatus.BAD_REQUEST;

      case 'HTTP_EXCEPTION':
        return errorInfo.originalError.getStatus();

      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Get error code from HTTP status
   */
  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCodes.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCodes.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ErrorCodes.VALIDATION_ERROR;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCodes.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCodes.INTERNAL_ERROR;
    }
  }

  /**
   * Check if error is business rule error
   */
  private isBusinessRuleError(error: any): error is BusinessRuleError {
    return error && typeof error === 'object' && 'code' in error;
  }

  /**
   * Check if error is concurrency error
   */
  private isConcurrencyError(error: any): error is ConcurrencyError {
    return error && typeof error === 'object' &&
           'entityType' in error && 'entityId' in error;
  }

  /**
   * Check if error is security-relevant
   * OWASP A09: Security logging for relevant errors
   */
  private isSecurityRelevantError(errorCode: string): boolean {
    const securityCodes = [
      ErrorCodes.UNAUTHORIZED,
      ErrorCodes.FORBIDDEN,
      ErrorCodes.INVALID_TOKEN,
      ErrorCodes.TOKEN_EXPIRED,
      ErrorCodes.SECURITY_VIOLATION,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
    ];

    return securityCodes.includes(errorCode as any);
  }

  /**
   * Create business rule error
   */
  createBusinessRuleError(
    message: string,
    code: string = ErrorCodes.BUSINESS_RULE_VIOLATION,
    field?: string,
    value?: any
  ): BusinessRuleError {
    const error = new Error(message) as BusinessRuleError;
    error.code = code;
    error.field = field;
    error.value = value;
    return error;
  }

  /**
   * Create concurrency error
   */
  createConcurrencyError(
    entityType: string,
    entityId: string,
    currentVersion: number,
    attemptedVersion: number
  ): ConcurrencyError {
    const error = new Error(
      `${entityType} with id ${entityId} was modified by another process`
    ) as ConcurrencyError;
    error.entityType = entityType;
    error.entityId = entityId;
    error.currentVersion = currentVersion;
    error.attemptedVersion = attemptedVersion;
    return error;
  }
}