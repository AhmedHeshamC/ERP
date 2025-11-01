import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from '../../security/security.service';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Transaction Reference Management Service
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles transaction reference generation and validation
 * - Open/Closed: Extensible for different reference types
 * - Interface Segregation: Focused interface for reference management
 * - Dependency Inversion: Depends on abstractions
 *
 * KISS Principle: Simple, focused implementation
 * OWASP Compliance: Secure reference generation and validation
 */

export interface TransactionReferenceConfig {
  prefix: string;
  minLength?: number;
  maxLength?: number;
  includeTimestamp?: boolean;
  includeChecksum?: boolean;
}

export interface TransactionReferenceResult {
  reference: string;
  type: string;
  isValid: boolean;
  errors?: string[];
}

export enum TransactionType {
  SALES_ORDER = 'SALES_ORDER',
  INVOICE = 'INVOICE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  STOCK_MOVEMENT = 'STOCK_MOVEMENT',
  PAYROLL = 'PAYROLL',
  EXPENSE = 'EXPENSE',
  JOURNAL_ENTRY = 'JOURNAL_ENTRY'
}

export const TRANSACTION_REFERENCE_CONFIGS: Record<TransactionType, TransactionReferenceConfig> = {
  [TransactionType.SALES_ORDER]: {
    prefix: 'SO',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.INVOICE]: {
    prefix: 'INV',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.PURCHASE_ORDER]: {
    prefix: 'PO',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.PAYMENT]: {
    prefix: 'PAY',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.REFUND]: {
    prefix: 'REF',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.ADJUSTMENT]: {
    prefix: 'ADJ',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.TRANSFER]: {
    prefix: 'TRF',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.STOCK_MOVEMENT]: {
    prefix: 'STM',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.PAYROLL]: {
    prefix: 'PR',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.EXPENSE]: {
    prefix: 'EXP',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  },
  [TransactionType.JOURNAL_ENTRY]: {
    prefix: 'JE',
    minLength: 12,
    maxLength: 20,
    includeTimestamp: true,
    includeChecksum: true
  }
};

@Injectable()
export class TransactionReferenceService {
  private readonly logger = new Logger(TransactionReferenceService.name);
  private readonly referenceCache = new Map<string, Set<string>>();
  private readonly cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {
    this.initializeCache();
  }

  /**
   * Generate a unique transaction reference
   * OWASP A02: Uses cryptographically secure UUID generation
   * OWASP A08: Ensures data integrity through checksum validation
   */
  async generateTransactionReference(
    type: TransactionType,
    customPrefix?: string
  ): Promise<string> {
    try {
      this.logger.log(`Generating transaction reference for type: ${type}`);

      const config = TRANSACTION_REFERENCE_CONFIGS[type];
      if (!config) {
        throw new Error(`Unsupported transaction type: ${type}`);
      }

      const prefix = customPrefix || config.prefix;
      let reference: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        reference = this.buildReference(prefix, config);
        attempts++;

        if (attempts > maxAttempts) {
          throw new Error(`Failed to generate unique reference after ${maxAttempts} attempts`);
        }
      } while (!(await this.isReferenceUnique(reference)));

      // Cache the reference to prevent duplicates in cache window
      this.cacheReference(reference, type);

      // Log security event
      await this.securityService.logSecurityEvent(
        'TRANSACTION_CREATED',
        reference,
        'system',
        'transaction-reference-service',
        {
          transactionType: type,
          prefix,
          generatedAt: new Date().toISOString(),
        },
      );

      this.logger.log(`Transaction reference generated successfully: ${reference}`);
      return reference;
    } catch (error) {
      this.logger.error(`Failed to generate transaction reference: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate transaction reference format and uniqueness
   * OWASP A08: Comprehensive validation for data integrity
   */
  async validateTransactionReference(
    reference: string,
    type: TransactionType
  ): Promise<TransactionReferenceResult> {
    try {
      this.logger.log(`Validating transaction reference: ${reference} for type: ${type}`);

      const errors: string[] = [];

      // Basic format validation
      if (!reference || typeof reference !== 'string') {
        errors.push('Reference must be a non-empty string');
        return { reference, type: type.toString(), isValid: false, errors };
      }

      const config = TRANSACTION_REFERENCE_CONFIGS[type];
      if (!config) {
        errors.push(`Unsupported transaction type: ${type}`);
        return { reference, type: type.toString(), isValid: false, errors };
      }

      // Length validation
      if (config.minLength && reference.length < config.minLength) {
        errors.push(`Reference must be at least ${config.minLength} characters long`);
      }

      if (config.maxLength && reference.length > config.maxLength) {
        errors.push(`Reference must not exceed ${config.maxLength} characters`);
      }

      // Prefix validation
      if (!reference.startsWith(config.prefix)) {
        errors.push(`Reference must start with prefix: ${config.prefix}`);
      }

      // Format validation (basic pattern)
      const pattern = new RegExp(`^${config.prefix}[A-Z0-9]+${config.includeChecksum ? '\\d$' : ''}$`);
      if (!pattern.test(reference)) {
        errors.push('Reference format is invalid');
      }

      // Checksum validation if enabled
      if (config.includeChecksum && !this.validateChecksum(reference)) {
        errors.push('Reference checksum is invalid');
      }

      // Uniqueness validation
      if (!(await this.isReferenceUnique(reference))) {
        errors.push('Reference already exists');
      }

      const isValid = errors.length === 0;

      this.logger.log(`Transaction reference validation completed: ${reference}, valid: ${isValid}`);
      return {
        reference,
        type: type.toString(),
        isValid,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to validate transaction reference: ${error.message}`, error.stack);
      return {
        reference,
        type: type.toString(),
        isValid: false,
        errors: ['Validation failed due to system error'],
      };
    }
  }

  /**
   * Check if reference exists in database
   * OWASP A03: Parameterized query to prevent injection
   */
  async isReferenceUnique(reference: string): Promise<boolean> {
    try {
      // Check cache first
      if (this.isReferenceCached(reference)) {
        return false;
      }

      // Check in various transaction tables
      const [salesOrder, invoice, purchaseOrder, stockMovement] = await Promise.all([
        this.prismaService.order.findFirst({ where: { orderNumber: reference } }),
        this.prismaService.invoice.findFirst({ where: { invoiceNumber: reference } }),
        this.prismaService.purchaseOrder.findFirst({ where: { orderNumber: reference } }),
        this.prismaService.stockMovement.findFirst({ where: { reference } }),
      ]);

      return !(salesOrder || invoice || purchaseOrder || stockMovement);
    } catch (error) {
      this.logger.error(`Failed to check reference uniqueness: ${error.message}`, error.stack);
      // Assume not unique on error to be safe
      return false;
    }
  }

  /**
   * Extract transaction type from reference
   */
  extractTransactionType(reference: string): TransactionType | null {
    for (const [type, config] of Object.entries(TRANSACTION_REFERENCE_CONFIGS)) {
      if (reference.startsWith(config.prefix)) {
        return type as TransactionType;
      }
    }
    return null;
  }

  /**
   * Get transaction reference statistics
   */
  async getReferenceStatistics(): Promise<any> {
    try {
      this.logger.log('Retrieving transaction reference statistics');

      const stats = await Promise.all([
        this.prismaService.order.count(),
        this.prismaService.invoice.count(),
        this.prismaService.purchaseOrder.count(),
        this.prismaService.stockMovement.count(),
      ]);

      return {
        totalReferences: stats.reduce((sum, count) => sum + count, 0),
        salesOrders: stats[0],
        invoices: stats[1],
        purchaseOrders: stats[2],
        stockMovements: stats[3],
        cacheSize: this.referenceCache.size,
        cacheExpirations: this.cacheExpiry.size,
      };
    } catch (error) {
      this.logger.error(`Failed to get reference statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.referenceCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  // Private helper methods

  /**
   * Build transaction reference with UUID and optional checksum
   * OWASP A02: Uses cryptographically secure UUID
   */
  private buildReference(prefix: string, config: TransactionReferenceConfig): string {
    const uuid = uuidv4().replace(/-/g, '').toUpperCase();
    const timestamp = config.includeTimestamp ? Date.now().toString(36).toUpperCase() : '';
    const base = `${prefix}${timestamp}${uuid}`;

    // Trim to max length if specified
    const trimmed = config.maxLength ? base.substring(0, config.maxLength) : base;

    // Add checksum if enabled
    if (config.includeChecksum) {
      return `${trimmed}${this.calculateChecksum(trimmed)}`;
    }

    return trimmed;
  }

  /**
   * Calculate checksum for reference integrity
   * OWASP A08: Simple checksum for data integrity validation
   */
  private calculateChecksum(reference: string): string {
    let sum = 0;
    for (let i = 0; i < reference.length; i++) {
      sum += reference.charCodeAt(i) * (i + 1);
    }
    return (sum % 10).toString();
  }

  /**
   * Validate checksum of reference
   */
  private validateChecksum(reference: string): boolean {
    if (reference.length < 2) return false;

    const expectedChecksum = reference.charAt(reference.length - 1);
    const actualChecksum = this.calculateChecksum(reference.substring(0, reference.length - 1));

    return expectedChecksum === actualChecksum;
  }

  /**
   * Cache reference to prevent duplicates
   */
  private cacheReference(reference: string, type: TransactionType): void {
    this.clearExpiredCache();

    const typeKey = type.toString();
    if (!this.referenceCache.has(typeKey)) {
      this.referenceCache.set(typeKey, new Set());
    }

    this.referenceCache.get(typeKey)!.add(reference);
    this.cacheExpiry.set(reference, Date.now() + this.CACHE_TTL);
  }

  /**
   * Check if reference is cached
   */
  private isReferenceCached(reference: string): boolean {
    this.clearExpiredCache();

    for (const cachedSet of this.referenceCache.values()) {
      if (cachedSet.has(reference)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Initialize cache cleanup interval
   */
  private initializeCache(): void {
    // Clean up expired cache entries every minute
    setInterval(() => {
      this.clearExpiredCache();
    }, 60 * 1000);
  }
}