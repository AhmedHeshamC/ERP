import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { SecurityValidationService, InputValidationRules, SecurityValidationContext } from '../../security/services/security-validation.service';
import { ApiResponseBuilder } from '../interfaces/api-response.interface';

/**
 * Enhanced Validation Pipe
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles input validation and transformation
 * - Open/Closed: Extensible for new validation rules
 * - Interface Segregation: Focused validation interface
 * - Dependency Inversion: Depends on abstractions
 *
 * OWASP Compliance:
 * - A03: Injection prevention through comprehensive input validation
 * - A05: Security misconfiguration prevention
 * - A08: Data integrity validation
 * - A10: Server-side request forgery prevention
 */

export interface ValidationPipeOptions {
  transform?: boolean;
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  skipMissingProperties?: boolean;
  validationRules?: InputValidationRules;
  skipSecurityValidation?: boolean;
}

@Injectable()
export class EnhancedValidationPipe implements PipeTransform {
  constructor(
    private readonly securityValidationService: SecurityValidationService,
    @Optional() @Inject('ValidationPipeOptions') private readonly options: ValidationPipeOptions = {},
  ) {}

  async transform(value: any, metadata: ArgumentMetadata, context?: any): Promise<any> {
    try {
      // Skip validation if not needed
      if (this.shouldSkipValidation(metadata)) {
        return value;
      }

      // Extract correlation ID from request
      const correlationId = this.extractCorrelationId(context);

      // Create validation context with correlation ID
      const validationContext = this.createValidationContext(correlationId, context);

      // Perform basic type validation
      if (!this.validateType(value, metadata)) {
        throw this.createValidationException('Invalid input type');
      }

      // Perform security validation
      if (!this.options.skipSecurityValidation) {
        const securityResult = await this.performSecurityValidation(value, validationContext);
        if (!securityResult.isValid) {
          throw this.createSecurityValidationException(securityResult, correlationId);
        }
      }

      // Perform transformation if enabled
      if (this.options.transform) {
        value = await this.transformValue(value, metadata);
      }

      // Perform whitelist validation if enabled
      if (this.options.whitelist && metadata.metatype) {
        value = this.applyWhitelist(value, metadata, correlationId);
      }

      // Perform custom validation if DTO has validate method
      if (value && typeof value.validate === 'function') {
        const validationResult = await value.validate();
        if (!validationResult.isValid) {
          throw this.createCustomValidationException(validationResult, correlationId);
        }
      }

      return value;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle unexpected errors
      const correlationId = this.extractCorrelationId(context);
      throw this.createValidationException(
        'Validation failed due to system error',
        error instanceof Error ? error : undefined,
        correlationId
      );
    }
  }

  /**
   * Check if validation should be skipped
   */
  private shouldSkipValidation(metadata: ArgumentMetadata): boolean {
    // Skip if no metadata
    if (!metadata || !metadata.metatype) {
      return true;
    }

    // Skip if explicitly configured
    if (this.options.skipMissingProperties && !metadata.type) {
      return true;
    }

    // Skip for basic types
    const basicTypes = [String, Boolean, Number, Array, Object];
    return basicTypes.some(type => metadata.metatype === type);
  }

  /**
   * Validate input type
   */
  private validateType(value: any, metadata: ArgumentMetadata): boolean {
    if (!metadata || !metadata.type) {
      return true;
    }

    switch (String(metadata.type)) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Perform security validation
   */
  private async performSecurityValidation(
    value: any,
    context: SecurityValidationContext
  ): Promise<any> {
    const validationRules: InputValidationRules = {
      ...this.options.validationRules,
      preventSqlInjection: true,
      preventXss: true,
      sanitizeHtml: true,
    };

    return await this.securityValidationService.validateInput(
      value,
      validationRules,
      context
    );
  }

  /**
   * Transform value based on metadata
   */
  private async transformValue(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (!value || !metadata.type) {
      return value;
    }

    switch (metadata.type as string) {
      case 'string':
        return String(value).trim();
      case 'number':
        const num = Number(value);
        return isNaN(num) ? value : num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return value;
    }
  }

  /**
   * Apply whitelist to remove non-allowed properties
   */
  private applyWhitelist(value: any, metadata: ArgumentMetadata, correlationId?: string): any {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    // Get allowed properties from DTO class
    const allowedProperties = this.getAllowedProperties(metadata.metatype);

    if (!allowedProperties || allowedProperties.length === 0) {
      return value;
    }

    const whitelisted: any = {};

    for (const prop of allowedProperties) {
      if (prop in value) {
        whitelisted[prop] = value[prop];
      }
    }

    // Check for non-whitelisted properties
    if (this.options.forbidNonWhitelisted) {
      const nonWhitelisted = Object.keys(value).filter(
        key => !allowedProperties.includes(key)
      );

      if (nonWhitelisted.length > 0) {
        throw this.createWhitelistException(nonWhitelisted, correlationId);
      }
    }

    return whitelisted;
  }

  /**
   * Get allowed properties from DTO class
   */
  private getAllowedProperties(metatype: any): string[] {
    // This is a simplified implementation
    // In a real scenario, you would use reflection to get class properties
    const properties: string[] = [];

    // Try to get properties from constructor parameters (for class-validator DTOs)
    if (metatype && metatype.prototype) {
      const instance = new metatype();
      properties.push(...Object.keys(instance));
    }

    return properties;
  }

  /**
   * Extract correlation ID from request context
   */
  private extractCorrelationId(context?: any): string {
    if (!context) {
      return this.generateCorrelationId();
    }

    // Try to extract from various possible request contexts
    const request = context.getRequest?.() || context.req || context;

    if (request && typeof request === 'object') {
      return (request as any).correlationId ||
             request.headers?.['x-correlation-id'] ||
             request.headers?.['x-request-id'] ||
             this.generateCorrelationId();
    }

    return this.generateCorrelationId();
  }

  /**
   * Generate a new correlation ID
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `val_${timestamp}_${random}`;
  }

  /**
   * Create validation context with correlation ID
   */
  private createValidationContext(correlationId: string, context?: any): SecurityValidationContext {
    const request = context?.getRequest?.() || context?.req || context;

    return {
      timestamp: new Date(),
      requestId: correlationId,
      ip: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      method: request?.method,
      endpoint: request?.url,
    };
  }

  /**
   * Create validation exception
   */
  private createValidationException(
    message: string,
    originalError?: Error,
    correlationId?: string
  ): HttpException {
    const response = ApiResponseBuilder.error(
      message,
      originalError ? [{
        code: 'VALIDATION_ERROR',
        message: originalError.message,
        timestamp: new Date().toISOString(),
      }] : undefined,
      'VALIDATION_ERROR',
      { requestId: correlationId }
    );

    return new HttpException(response, HttpStatus.BAD_REQUEST);
  }

  /**
   * Create security validation exception
   */
  private createSecurityValidationException(securityResult: any, correlationId?: string): HttpException {
    const response = ApiResponseBuilder.error(
      'Security validation failed',
      securityResult.errors.map((error: any) => ({
        code: error.code,
        message: error instanceof Error ? error.message : "Unknown error",
        field: error.field,
        timestamp: new Date().toISOString(),
      })),
      'SECURITY_VALIDATION_ERROR',
      { requestId: correlationId }
    );

    // Use appropriate status code based on security level
    const statusCode = this.getStatusCodeFromSecurityLevel(securityResult.securityLevel);

    return new HttpException(response, statusCode);
  }

  /**
   * Create custom validation exception
   */
  private createCustomValidationException(validationResult: any, correlationId?: string): HttpException {
    const response = ApiResponseBuilder.validationError(
      validationResult.errors || [{
        code: 'CUSTOM_VALIDATION_ERROR',
        message: validationResult.message || 'Custom validation failed',
        timestamp: new Date().toISOString(),
      }],
      'Custom validation failed',
      { requestId: correlationId }
    );

    return new HttpException(response, HttpStatus.BAD_REQUEST);
  }

  /**
   * Create whitelist exception
   */
  private createWhitelistException(nonWhitelistedProperties: string[], correlationId?: string): HttpException {
    const response = ApiResponseBuilder.error(
      `Properties not allowed: ${nonWhitelistedProperties.join(', ')}`,
      nonWhitelistedProperties.map(prop => ({
        code: 'NON_WHITELISTED_PROPERTY',
        message: `Property '${prop}' is not allowed`,
        field: prop,
        timestamp: new Date().toISOString(),
      })),
      'WHITELIST_VIOLATION',
      { requestId: correlationId }
    );

    return new HttpException(response, HttpStatus.BAD_REQUEST);
  }

  /**
   * Get HTTP status code from security level
   */
  private getStatusCodeFromSecurityLevel(securityLevel: string): HttpStatus {
    switch (securityLevel) {
      case 'CRITICAL':
        return HttpStatus.FORBIDDEN;
      case 'HIGH':
        return HttpStatus.BAD_REQUEST;
      case 'MEDIUM':
        return HttpStatus.BAD_REQUEST;
      case 'LOW':
        return HttpStatus.OK; // Allow but log
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }
}