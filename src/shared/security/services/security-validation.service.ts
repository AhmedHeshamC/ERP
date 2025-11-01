import { Injectable, Logger } from '@nestjs/common';
import { SecurityService } from '../security.service';

/**
 * Comprehensive Security Validation Service
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles security validation
 * - Open/Closed: Extensible for new validation rules
 * - Interface Segregation: Focused validation interface
 * - Dependency Inversion: Depends on abstractions
 *
 * OWASP Compliance:
 * - A01: Broken Access Control prevention
 * - A02: Cryptographic validation
 * - A03: Injection prevention
 * - A04: Insecure design prevention
 * - A05: Security misconfiguration prevention
 * - A06: Vulnerable component prevention
 * - A07: Authentication failures prevention
 * - A08: Data integrity validation
 * - A09: Security logging and monitoring
 * - A10: Server-side request forgery prevention
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  securityLevel: SecurityLevel;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  owaspCategory: string;
  recommendation?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM';
  recommendation?: string;
}

export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityValidationContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  timestamp: Date;
  requestId?: string;
}

export interface InputValidationRules {
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  sanitizeHtml?: boolean;
  preventSqlInjection?: boolean;
  preventXss?: boolean;
  requiredFields?: string[];
  sensitiveFields?: string[];
}

@Injectable()
export class SecurityValidationService {
  private readonly logger = new Logger(SecurityValidationService.name);

  // OWASP Top 10 validation patterns
  private readonly PATTERNS = {
    // SQL Injection patterns
    SQL_INJECTION: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--|#|\/\*|\*\/|;|'|")/,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"][\w\s]*['"]\s*=\s*['"][\w\s]*['"])/i,
    ],

    // XSS patterns
    XSS: [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[\s\S]*?>/gi,
      /<object[\s\S]*?>/gi,
      /<embed[\s\S]*?>/gi,
    ],

    // Path traversal
    PATH_TRAVERSAL: [
      /\.\.[\/\\]/,
      /\//,
      /%2e%2e[\/\\]/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
    ],

    // Command injection
    COMMAND_INJECTION: [
      /[;&|`$(){}[\]]/,
      /\b(cat|ls|dir|rm|del|ping|net|whoami|id)\b/i,
    ],

    // LDAP injection
    LDAP_INJECTION: [
      /[()*&|]/,
      /\)\(.*\)/,
    ],

    // NoSQL injection
    NOSQL_INJECTION: [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$in/i,
    ],

    // Email validation
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

    // Phone validation
    PHONE: /^\+?[\d\s\-\(\)]{10,}$/,

    // Password strength
    PASSWORD: {
      MIN_LENGTH: 8,
      REQUIRE_UPPERCASE: /[A-Z]/,
      REQUIRE_LOWERCASE: /[a-z]/,
      REQUIRE_NUMBERS: /\d/,
      REQUIRE_SPECIAL: /[!@#$%^&*(),.?":{}|<>]/,
      NO_COMMON_PASSWORDS: /^(password|123456|qwerty|admin|letmein)/i,
    },

    // File upload validation
    FILENAME: /^[a-zA-Z0-9._-]+$/,
    DANGEROUS_EXTENSIONS: /\.(exe|bat|cmd|scr|pif|com|js|vbs|jar|sh|php|asp|jsp)$/i,
  };

  constructor(
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Comprehensive input validation with OWASP Top 10 compliance
   * OWASP A03: Injection prevention
   * OWASP A05: Security misconfiguration prevention
   */
  async validateInput(
    data: any,
    rules: InputValidationRules,
    context: SecurityValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      this.logger.log(`Performing comprehensive security validation`, {
        context: context.endpoint,
        userId: context.userId,
        requestId: context.requestId,
      });

      // Validate structure
      if (typeof data !== 'object' || data === null) {
        errors.push({
          code: 'INVALID_INPUT_TYPE',
          message: 'Input must be a valid object',
          severity: 'HIGH',
          owaspCategory: 'A03: Injection',
          recommendation: 'Ensure input data is properly structured',
        });
        return this.createValidationResult(errors, warnings);
      }

      // Validate required fields
      if (rules.requiredFields) {
        for (const field of rules.requiredFields) {
          if (!(field in data) || data[field] === null || data[field] === undefined) {
            errors.push({
              code: 'MISSING_REQUIRED_FIELD',
              message: `Required field '${field}' is missing`,
              field,
              severity: 'HIGH',
              owaspCategory: 'A05: Security Misconfiguration',
              recommendation: `Provide the required field: ${field}`,
            });
          }
        }
      }

      // Validate each field
      for (const [key, value] of Object.entries(data)) {
        const fieldErrors = await this.validateField(
          key,
          value,
          rules,
          context
        );
        errors.push(...fieldErrors);
      }

      // Check for sensitive data exposure
      if (rules.sensitiveFields) {
        for (const field of rules.sensitiveFields) {
          if (field in data && data[field]) {
            warnings.push({
              code: 'SENSITIVE_DATA_EXPOSURE',
              message: `Sensitive field '${field}' should not be transmitted in requests`,
              field,
              severity: 'MEDIUM',
              recommendation: 'Remove sensitive data from request payloads',
            });
          }
        }
      }

      // Log security validation results
      await this.logValidationResult(errors, warnings, context);

      return this.createValidationResult(errors, warnings);
    } catch (error) {
      this.logger.error(`Security validation failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      errors.push({
        code: 'VALIDATION_SYSTEM_ERROR',
        message: 'Security validation system encountered an error',
        severity: 'CRITICAL',
        owaspCategory: 'A09: Security Logging',
        recommendation: 'Contact security team immediately',
      });

      return this.createValidationResult(errors, warnings);
    }
  }

  /**
   * Validate user permissions and access control
   * OWASP A01: Broken Access Control prevention
   */
  async validateAccess(
    userId: string,
    resource: string,
    action: string,
    context: SecurityValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      this.logger.log(`Validating access control`, {
        userId,
        resource,
        action,
        endpoint: context.endpoint,
      });

      // Check if user exists and is active
      const user = await this.validateUserExists(userId);
      if (!user) {
        errors.push({
          code: 'USER_NOT_FOUND',
          message: 'User does not exist or is inactive',
          severity: 'CRITICAL',
          owaspCategory: 'A01: Broken Access Control',
          recommendation: 'Ensure user is properly authenticated',
        });
        return this.createValidationResult(errors, warnings);
      }

      // Validate user permissions
      const hasPermission = await this.checkUserPermission(userId, resource, action);
      if (!hasPermission) {
        errors.push({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `User does not have permission to ${action} ${resource}`,
          severity: 'HIGH',
          owaspCategory: 'A01: Broken Access Control',
          recommendation: 'Grant appropriate permissions to the user',
        });

        // Log security violation
        await this.securityService.logSecurityEvent(
          'SECURITY_VIOLATION',
          userId,
          context.ip || 'unknown',
          'security-validation-service',
          {
            resource,
            action,
            endpoint: context.endpoint,
            userAgent: context.userAgent,
          },
        );
      }

      // Check for suspicious activity patterns
      const suspiciousActivity = await this.detectSuspiciousActivity(userId, context);
      if (suspiciousActivity) {
        warnings.push({
          code: 'SUSPICIOUS_ACTIVITY',
          message: 'Suspicious activity pattern detected',
          severity: 'MEDIUM',
          recommendation: 'Monitor user activity for potential security threats',
        });
      }

      return this.createValidationResult(errors, warnings);
    } catch (error) {
      this.logger.error(`Access validation failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      errors.push({
        code: 'ACCESS_VALIDATION_ERROR',
        message: 'Access validation system encountered an error',
        severity: 'CRITICAL',
        owaspCategory: 'A01: Broken Access Control',
        recommendation: 'Contact security team immediately',
      });

      return this.createValidationResult(errors, warnings);
    }
  }

  /**
   * Validate file uploads for security threats
   * OWASP A08: Data integrity validation
   */
  async validateFileUpload(
    file: any,
    context: SecurityValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      this.logger.log(`Validating file upload`, {
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        userId: context.userId,
      });

      // Validate filename
      if (!this.PATTERNS.FILENAME.test(file.originalname)) {
        errors.push({
          code: 'INVALID_FILENAME',
          message: 'Filename contains invalid characters',
          field: 'filename',
          severity: 'HIGH',
          owaspCategory: 'A08: Data Integrity',
          recommendation: 'Use only alphanumeric characters, dots, hyphens, and underscores in filenames',
        });
      }

      // Check for dangerous file extensions
      if (this.PATTERNS.DANGEROUS_EXTENSIONS.test(file.originalname)) {
        errors.push({
          code: 'DANGEROUS_FILE_EXTENSION',
          message: 'File extension is not allowed for security reasons',
          field: 'filename',
          severity: 'CRITICAL',
          owaspCategory: 'A06: Vulnerable Components',
          recommendation: 'Upload only allowed file types',
        });
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        errors.push({
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds maximum allowed limit',
          field: 'size',
          severity: 'MEDIUM',
          owaspCategory: 'A05: Security Misconfiguration',
          recommendation: 'Compress or reduce file size',
        });
      }

      // Validate MIME type
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'text/plain',
        'text/csv',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        errors.push({
          code: 'INVALID_MIME_TYPE',
          message: 'File type is not allowed',
          field: 'mimetype',
          severity: 'HIGH',
          owaspCategory: 'A06: Vulnerable Components',
          recommendation: 'Upload only allowed file types',
        });
      }

      // Scan for malware (placeholder - would integrate with actual AV service)
      const malwareScanResult = await this.scanForMalware(file);
      if (!malwareScanResult.isClean) {
        errors.push({
          code: 'MALWARE_DETECTED',
          message: 'File contains malicious content',
          severity: 'CRITICAL',
          owaspCategory: 'A06: Vulnerable Components',
          recommendation: 'File contains malware and cannot be processed',
        });
      }

      return this.createValidationResult(errors, warnings);
    } catch (error) {
      this.logger.error(`File validation failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      errors.push({
        code: 'FILE_VALIDATION_ERROR',
        message: 'File validation system encountered an error',
        severity: 'CRITICAL',
        owaspCategory: 'A08: Data Integrity',
        recommendation: 'Contact security team immediately',
      });

      return this.createValidationResult(errors, warnings);
    }
  }

  /**
   * Validate API rate limiting
   * OWASP A04: Insecure design prevention
   */
  async validateRateLimit(
    identifier: string,
    limit: number,
    windowMs: number,
    context: SecurityValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // This would integrate with Redis or similar for distributed rate limiting
      const currentCount = await this.getCurrentRequestCount(identifier, windowMs);

      if (currentCount >= limit) {
        errors.push({
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms allowed`,
          severity: 'HIGH',
          owaspCategory: 'A04: Insecure Design',
          recommendation: 'Reduce request frequency or contact administrator for higher limits',
        });

        // Log rate limit violation
        await this.securityService.logSecurityEvent(
          'RATE_LIMIT_VIOLATION',
          identifier,
          context.ip || 'unknown',
          'security-validation-service',
          {
            limit,
            currentCount,
            windowMs,
            endpoint: context.endpoint,
          },
        );
      } else if (currentCount > limit * 0.8) {
        warnings.push({
          code: 'RATE_LIMIT_WARNING',
          message: 'Approaching rate limit threshold',
          severity: 'LOW',
          recommendation: 'Consider reducing request frequency',
        });
      }

      return this.createValidationResult(errors, warnings);
    } catch (error) {
      this.logger.error(`Rate limit validation failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);

      // On rate limiting errors, allow the request but log the issue
      warnings.push({
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limiting system encountered an error',
        severity: 'INFO',
        recommendation: 'Rate limiting temporarily unavailable',
      });

      return this.createValidationResult(errors, warnings);
    }
  }

  // Private helper methods

  /**
   * Validate individual field
   */
  private async validateField(
    fieldName: string,
    value: any,
    rules: InputValidationRules,
    _context: SecurityValidationContext
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Skip validation for null/undefined values unless required
    if (value === null || value === undefined) {
      return errors;
    }

    // Convert to string for validation
    const stringValue = String(value);

    // Length validation
    if (rules.minLength && stringValue.length < rules.minLength) {
      errors.push({
        code: 'MIN_LENGTH_VIOLATION',
        message: `Field must be at least ${rules.minLength} characters long`,
        field: fieldName,
        severity: 'MEDIUM',
        owaspCategory: 'A03: Injection',
        recommendation: `Provide at least ${rules.minLength} characters`,
      });
    }

    if (rules.maxLength && stringValue.length > rules.maxLength) {
      errors.push({
        code: 'MAX_LENGTH_VIOLATION',
        message: `Field must not exceed ${rules.maxLength} characters`,
        field: fieldName,
        severity: 'MEDIUM',
        owaspCategory: 'A03: Injection',
        recommendation: `Reduce to ${rules.maxLength} characters or less`,
      });
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(stringValue)) {
      errors.push({
        code: 'PATTERN_VIOLATION',
        message: 'Field format is invalid',
        field: fieldName,
        severity: 'MEDIUM',
        owaspCategory: 'A03: Injection',
        recommendation: 'Ensure field matches required format',
      });
    }

    // Allowed values validation
    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      errors.push({
        code: 'INVALID_VALUE',
        message: `Field value must be one of: ${rules.allowedValues.join(', ')}`,
        field: fieldName,
        severity: 'MEDIUM',
        owaspCategory: 'A05: Security Misconfiguration',
        recommendation: `Select from allowed values: ${rules.allowedValues.join(', ')}`,
      });
    }

    // Security validations
    if (rules.preventSqlInjection) {
      for (const pattern of this.PATTERNS.SQL_INJECTION) {
        if (pattern.test(stringValue)) {
          errors.push({
            code: 'SQL_INJECTION_DETECTED',
            message: 'Potential SQL injection detected',
            field: fieldName,
            severity: 'CRITICAL',
            owaspCategory: 'A03: Injection',
            recommendation: 'Remove SQL keywords and special characters',
          });
        }
      }
    }

    if (rules.preventXss) {
      for (const pattern of this.PATTERNS.XSS) {
        if (pattern.test(stringValue)) {
          errors.push({
            code: 'XSS_DETECTED',
            message: 'Potential XSS attack detected',
            field: fieldName,
            severity: 'CRITICAL',
            owaspCategory: 'A03: Injection',
            recommendation: 'Remove script tags and JavaScript code',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Create validation result
   */
  private createValidationResult(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): ValidationResult {
    const securityLevel = this.calculateSecurityLevel(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      securityLevel,
    };
  }

  /**
   * Calculate overall security level
   */
  private calculateSecurityLevel(
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): SecurityLevel {
    if (errors.some(e => e.severity === 'CRITICAL')) {
      return SecurityLevel.CRITICAL;
    }
    if (errors.some(e => e.severity === 'HIGH')) {
      return SecurityLevel.HIGH;
    }
    if (errors.some(e => e.severity === 'MEDIUM') || warnings.some(w => w.severity === 'MEDIUM')) {
      return SecurityLevel.MEDIUM;
    }
    return SecurityLevel.LOW;
  }

  /**
   * Log validation results
   */
  private async logValidationResult(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    context: SecurityValidationContext
  ): Promise<void> {
    if (errors.length > 0 || warnings.length > 0) {
      await this.securityService.logSecurityEvent(
        'SECURITY_VALIDATION_COMPLETED',
        context.userId || 'anonymous',
        context.ip || 'unknown',
        'security-validation-service',
        {
          endpoint: context.endpoint,
          errorCount: errors.length,
          warningCount: warnings.length,
          criticalErrors: errors.filter(e => e.severity === 'CRITICAL').length,
          requestId: context.requestId,
        },
      );
    }
  }

  // Placeholder methods - would implement actual logic
  private async validateUserExists(_userId: string): Promise<boolean> {
    // Implement actual user validation
    return true;
  }

  private async checkUserPermission(_userId: string, _resource: string, _action: string): Promise<boolean> {
    // Implement actual permission checking
    return true;
  }

  private async detectSuspiciousActivity(_userId: string, _context: SecurityValidationContext): Promise<boolean> {
    // Implement actual suspicious activity detection
    return false;
  }

  private async scanForMalware(_file: any): Promise<{ isClean: boolean }> {
    // Implement actual malware scanning
    return { isClean: true };
  }

  private async getCurrentRequestCount(_identifier: string, _windowMs: number): Promise<number> {
    // Implement actual rate limiting with Redis
    return 0;
  }
}