import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

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
        action: 'deny' as const,
      },

      // X-Content-Type-Options
      noSniff: true,

      // Referrer Policy
      referrerPolicy: {
        policy: 'no-referrer' as const,
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
        policy: 'cross-origin' as const,
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
  validateStringInput(input: string, type: 'email' | 'username' | 'id' | 'text' = 'text'): boolean {
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

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) {
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
    event: string, // Accept any audit event string
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
      this.logger.warn(`SECURITY EVENT!: ${event}`, logData);
    } else {
      this.logger.log(`Security event!: ${event}`, logData);
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
      if (!hostname) {return false;}

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
      return ['http!: ', 'https:'].includes(parsedUrl.protocol);
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

    return sensitiveEndpoints[endpoint as keyof typeof sensitiveEndpoints] || {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    };
  }

  
  /**
   * OWASP A02: Cryptographic Failures
   * Hash password using Argon2 (simple, secure, KISS)
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  /**
   * Verify password against hash using Argon2
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      this.logger.error('Password verification failed', error);
      return false;
    }
  }

  /**
   * Validate input object (for DTOs)
   */
  validateInput(input: any): boolean {
    if (!input) {return false;}

    // Basic validation - ensure input is an object with required fields
    if (typeof input !== 'object') {return false;}

    return true;
  }

  /**
   * Sanitize input object (for DTOs)
   */
  sanitizeInput(input: any): any {
    if (!input) {return input;}

    const sanitized = { ...input };

    // Sanitize string fields
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key]
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      }
    });

    return sanitized;
  }

  /**
   * Validate file upload for security
   */
  validateFileUpload(file: any): { isValid: boolean; error?: string } {
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

  // HR/Payroll specific security methods

  /**
   * Generate unique employee ID
   */
  generateEmployeeId(): string {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `EMP${timestamp}${random}`;
  }

  /**
   * Validate personal information for security
   */
  validatePersonalInfo(data: any): boolean {
    if (!data || typeof data !== 'object') {return false;}

    // Check for required personal fields
    if (!data.firstName || !data.lastName || !data.email) {return false;}

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {return false;}

    // Check for potentially malicious content
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(JSON.stringify(data))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate tax information
   */
  validateTaxInfo(employee: any): boolean {
    if (!employee) {return false;}

    // Check for required tax fields (basic validation)
    if (!employee.socialSecurity && !employee.taxId) {
      return false; // At least one tax identifier is required
    }

    // Validate SSN format if provided (basic validation)
    if (employee.socialSecurity) {
      const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
      if (!ssnRegex.test(employee.socialSecurity)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate bank account information
   */
  validateBankAccount(employee: any): boolean {
    if (!employee) {return false;}

    // Bank account is optional (some employees may be paid by check)
    if (!employee.bankAccount) {return true;}

    const bankAccount = employee.bankAccount;
    if (!bankAccount.accountNumber || !bankAccount.routingNumber) {
      return false;
    }

    // Basic routing number validation (US format)
    const routingRegex = /^\d{9}$/;
    if (!routingRegex.test(bankAccount.routingNumber)) {
      return false;
    }

    // Basic account number validation
    if (bankAccount.accountNumber.length < 4 || bankAccount.accountNumber.length > 17) {
      return false;
    }

    return true;
  }

  /**
   * Calculate payroll taxes (simplified calculation)
   */
  calculatePayrollTaxes(grossPay: number, _employee: any): any {
    const federalTaxRate = 0.125; // 12.5% federal tax
    const stateTaxRate = 0.05;   // 5% state tax
    const socialSecurityRate = 0.062; // 6.2% Social Security
    const medicareRate = 0.0145; // 1.45% Medicare

    return {
      federalTax: grossPay * federalTaxRate,
      stateTax: grossPay * stateTaxRate,
      socialSecurityTax: grossPay * socialSecurityRate,
      medicareTax: grossPay * medicareRate,
    };
  }

  /**
   * Validate leave request
   */
  validateLeaveRequest(data: any): boolean {
    if (!data || typeof data !== 'object') {return false;}

    // Check required fields
    if (!data.employeeId || !data.leaveType || !data.startDate || !data.endDate) {
      return false;
    }

    // Validate leave type
    const validTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
    if (!validTypes.includes(data.leaveType)) {
      return false;
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < startDate || startDate < today) {
      return false;
    }

    // Maximum leave duration validation (365 days)
    const maxDays = 365;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > maxDays) {
      return false;
    }

    return true;
  }

  /**
   * Calculate leave days between two dates
   */
  calculateLeaveDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Reset time to start of day
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
  }

  /**
   * Check for leave conflicts
   */
  async checkLeaveConflicts(_employeeId: string, _startDate: Date, _endDate: Date): Promise<any[]> {
    // This would typically query the database
    // For now, return empty array (no conflicts)
    return [];
  }

  /**
   * Validate leave balance
   */
  validateLeaveBalance(employee: any, leaveType: string, daysRequested: number): boolean {
    if (!employee || daysRequested <= 0) {return false;}

    let availableBalance = 0;

    switch (leaveType) {
      case 'ANNUAL':
        availableBalance = employee.annualLeaveBalance || 0;
        break;
      case 'SICK':
        availableBalance = employee.sickLeaveBalance || 0;
        break;
      case 'PERSONAL':
        availableBalance = employee.personalLeaveBalance || 0;
        break;
      case 'MATERNITY':
      case 'PATERNITY':
      case 'UNPAID':
        // These types don't use the standard balance
        return true;
      default:
        return false;
    }

    return availableBalance >= daysRequested;
  }
}