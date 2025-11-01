/**
 * Standard API Response Interfaces
 *
 * Implements SOLID principles for consistent API responses
 * OWASP A05: Secure defaults and proper status codes
 * OWASP A08: Data integrity through structured responses
 */

export interface ApiResponseMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
  environment?: string;
  processingTime?: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  value?: any;
  timestamp?: string;
}

export interface ValidationErrorDetail extends ErrorDetail {
  constraints?: Record<string, string>;
  children?: ValidationErrorDetail[];
}

export interface BaseApiResponse {
  success: boolean;
  message: string;
  metadata: ApiResponseMetadata;
  errors?: ErrorDetail[];
}

export interface SuccessApiResponse<T = any> extends BaseApiResponse {
  success: true;
  data: T;
  pagination?: PaginationMetadata;
}

export interface ErrorApiResponse extends BaseApiResponse {
  success: false;
  errorCode?: string;
  stack?: string; // Only in development
}

export interface PaginatedApiResponse<T> extends SuccessApiResponse<T[]> {
  pagination: PaginationMetadata;
}

export interface FileResponse {
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  data?: Buffer;
}

export interface BulkOperationResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    error: string;
    item?: any;
  }>;
}

export interface BulkApiResponse<T> extends BaseApiResponse {
  success: true;
  data: {
    successful: T[];
    failed: Array<{
      item: any;
      error: string;
      index: number;
    }>;
    summary: BulkOperationResult;
  };
}

// Response builders for common use cases
export class ApiResponseBuilder {
  /**
   * Create success response
   */
  static success<T>(
    data: T,
    message = 'Operation completed successfully',
    metadata?: Partial<ApiResponseMetadata>
  ): SuccessApiResponse<T> {
    return {
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Create paginated success response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMetadata,
    message = 'Data retrieved successfully',
    metadata?: Partial<ApiResponseMetadata>
  ): PaginatedApiResponse<T> {
    return {
      success: true,
      message,
      data,
      pagination,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Create error response
   */
  static error(
    message: string,
    errors?: ErrorDetail[],
    errorCode?: string,
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    return {
      success: false,
      message,
      errors,
      errorCode,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Create validation error response
   */
  static validationError(
    errors: ValidationErrorDetail[],
    message = 'Validation failed',
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    return this.error(message, errors, 'VALIDATION_ERROR', metadata);
  }

  /**
   * Create not found error response
   */
  static notFound(
    resource: string,
    id?: string,
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    return this.error(message, undefined, 'NOT_FOUND', metadata);
  }

  /**
   * Create conflict error response
   */
  static conflict(
    message: string,
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    return this.error(message, undefined, 'CONFLICT', metadata);
  }

  /**
   * Create unauthorized error response
   */
  static unauthorized(
    message = 'Unauthorized access',
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    return this.error(message, undefined, 'UNAUTHORIZED', metadata);
  }

  /**
   * Create forbidden error response
   */
  static forbidden(
    message = 'Insufficient permissions',
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    return this.error(message, undefined, 'FORBIDDEN', metadata);
  }

  /**
   * Create internal server error response
   */
  static internalError(
    message = 'Internal server error',
    error?: Error,
    metadata?: Partial<ApiResponseMetadata>
  ): ErrorApiResponse {
    const response: ErrorApiResponse = {
      success: false,
      message,
      errorCode: 'INTERNAL_ERROR',
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && error?.stack) {
      response.stack = error instanceof Error ? error.stack : undefined;
    }

    return response;
  }

  /**
   * Create bulk operation response
   */
  static bulk<T>(
    successful: T[],
    failed: Array<{ item: any; error: string; index: number }>,
    message = 'Bulk operation completed',
    metadata?: Partial<ApiResponseMetadata>
  ): BulkApiResponse<T> {
    const total = successful.length + failed.length;
    const summary: BulkOperationResult = {
      total,
      successful: successful.length,
      failed: failed.length,
      errors: failed.map(f => ({
        index: f.index,
        error: f.error,
        item: f.item,
      })),
    };

    return {
      success: true,
      message,
      data: {
        successful,
        failed,
        summary,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Create file response
   */
  static file(
    file: FileResponse,
    message = 'File processed successfully',
    metadata?: Partial<ApiResponseMetadata>
  ): SuccessApiResponse<FileResponse> {
    return this.success(file, message, metadata);
  }
}

// HTTP Status Code mappings
export const HttpStatusCodes = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Standard error codes
export const ErrorCodes = {
  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',

  // Resource Errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // Business Logic Errors
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVALID_TRANSACTION_STATE: 'INVALID_TRANSACTION_STATE',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',

  // System Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // External Service Errors
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
} as const;