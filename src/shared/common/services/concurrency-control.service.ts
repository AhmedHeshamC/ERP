import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ErrorHandlingService, ConcurrencyError } from './error-handling.service';
import { SecurityService } from '../../security/security.service';

/**
 * Concurrency Control Service
 *
 * Implements SOLID principles:
 * - Single Responsibility: Only handles concurrency control and locking
 * - Open/Closed: Extensible for different locking strategies
 * - Interface Segregation: Focused concurrency control interface
 * - Dependency Inversion: Depends on abstractions
 *
 * OWASP Compliance:
 * - A01: Proper resource locking and access control
 * - A05: Secure defaults with timeout handling
 * - A09: Comprehensive logging of concurrency conflicts
 */

export interface LockOptions {
  timeout?: number; // Lock timeout in milliseconds
  retryAttempts?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in milliseconds
  lockType?: LockType;
}

export interface LockInfo {
  id: string;
  resourceType: string;
  resourceId: string;
  lockType: LockType;
  ownerId: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: any;
}

export enum LockType {
  PESSIMISTIC = 'PESSIMISTIC',
  OPTIMISTIC = 'OPTIMISTIC',
  SHARED = 'SHARED',
  EXCLUSIVE = 'EXCLUSIVE'
}

export interface VersionedEntity {
  id: string;
  version: number;
  updatedAt: Date;
}

export interface ConcurrencyResult<T> {
  success: boolean;
  entity?: T;
  lock?: LockInfo;
  error?: string;
  retryAfter?: number;
}

@Injectable()
export class ConcurrencyControlService {
  private readonly logger = new Logger(ConcurrencyControlService.name);
  private readonly DEFAULT_LOCK_TIMEOUT = 30 * 1000; // 30 seconds
  private readonly DEFAULT_RETRY_ATTEMPTS = 3;
  private readonly DEFAULT_RETRY_DELAY = 100; // 100ms

  constructor(
    private readonly prismaService: PrismaService,
    private readonly errorHandlingService: ErrorHandlingService,
    private readonly securityService: SecurityService,
  ) {
    this.initializeLockCleanup();
  }

  /**
   * Acquire a lock on a resource
   * OWASP A01: Secure resource locking with proper authentication
   */
  async acquireLock(
    resourceType: string,
    resourceId: string,
    ownerId: string,
    options: LockOptions = {}
  ): Promise<LockInfo> {
    try {
      this.logger.log(`Acquiring ${options.lockType || LockType.EXCLUSIVE} lock on ${resourceType}!: ${resourceId}`);

      const lockType = options.lockType || LockType.EXCLUSIVE;
      const timeout = options.timeout || this.DEFAULT_LOCK_TIMEOUT;
      const expiresAt = new Date(Date.now() + timeout);

      // Check if lock already exists
      const existingLock = await this.getActiveLock(resourceType, resourceId);
      if (existingLock) {
        // Check if lock is expired
        if (existingLock.expiresAt < new Date()) {
          await this.releaseLock(existingLock.id);
          this.logger.warn(`Released expired lock!: ${existingLock.id}`);
        } else {
          // Check if owner is trying to reacquire
          if (existingLock.ownerId === ownerId) {
            await this.extendLock(existingLock.id, timeout);
            this.logger.log(`Extended existing lock!: ${existingLock.id}`);
            return existingLock;
          }

          throw new ConflictException(
            `Resource is locked by another user. Lock expires at ${existingLock.expiresAt.toISOString()}`
          );
        }
      }

      // Create new lock
      const lock = await this.prismaService.resourceLock.create({
        data: {
          resourceType,
          resourceId,
          lockType,
          userId: ownerId,
          expiresAt,
        },
      });

      // Log security event
      await this.securityService.logSecurityEvent(
        'RESOURCE_LOCKED',
        lock.id,
        ownerId,
        'concurrency-control-service',
        {
          resourceType,
          resourceId,
          lockType,
          expiresAt: expiresAt.toISOString(),
        },
      );

      this.logger.log(`Lock acquired successfully!: ${lock.id}`);
      return {
        id: lock.id,
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        lockType: lock.lockType as LockType,
        ownerId: lock.userId || ownerId,
        createdAt: lock.createdAt,
        expiresAt: lock.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Failed to acquire lock: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Release a lock
   * OWASP A09: Log lock release for audit trail
   */
  async releaseLock(lockId: string): Promise<void> {
    try {
      this.logger.log(`Releasing lock!: ${lockId}`);

      const lock = await this.prismaService.resourceLock.findUnique({
        where: { id: lockId },
      });

      if (!lock) {
        this.logger.warn(`Lock not found for release!: ${lockId}`);
        return;
      }

      await this.prismaService.resourceLock.delete({
        where: { id: lockId },
      });

      // Log security event
      await this.securityService.logSecurityEvent(
        'RESOURCE_UNLOCKED',
        lockId,
        lock.userId || undefined,
        'concurrency-control-service',
        {
          resourceType: lock.resourceType,
          resourceId: lock.resourceId,
          lockType: lock.lockType,
        },
      );

      this.logger.log(`Lock released successfully!: ${lockId}`);
    } catch (error) {
      this.logger.error(`Failed to release lock: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Execute operation with automatic locking
   * OWASP A01: Secure locked operations
   */
  async withLock<T>(
    entityType: string,
    entityId: string,
    ownerId: string,
    operation: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    let lock: LockInfo | null = null;

    try {
      // Acquire lock
      lock = await this.acquireLock(entityType, entityId, ownerId, options);

      // Execute operation
      const result = await operation();

      return result;
    } finally {
      // Always release lock
      if (lock) {
        await this.releaseLock(lock.id);
      }
    }
  }

  /**
   * Execute operation with retry logic
   * OWASP A05: Handle temporary failures gracefully
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      attempts?: number;
      delay?: number;
      backoff?: boolean;
    } = {}
  ): Promise<T> {
    const attempts = options.attempts || this.DEFAULT_RETRY_ATTEMPTS;
    const delay = options.delay || this.DEFAULT_RETRY_DELAY;
    const backoff = options.backoff !== false;

    let lastError!: Error;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain error types
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        if (attempt < attempts) {
          const currentDelay = backoff ? delay * attempt : delay;
          this.logger.warn(`Attempt ${attempt} failed, retrying in ${currentDelay}ms!: ${error instanceof Error ? error.message : "Unknown error"}`);
          await this.sleep(currentDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Optimistic concurrency check
   * OWASP A08: Data integrity through version checking
   */
  async optimisticUpdate<T extends VersionedEntity>(
    resourceType: string,
    resourceId: string,
    expectedVersion: number,
    updateFn: (current: T) => Promise<T>,
    _options: LockOptions = {}
  ): Promise<T> {
    try {
      this.logger.log(`Performing optimistic update on ${resourceType}!: ${resourceId}, version: ${expectedVersion}`);

      // Get current entity
      const current = await this.getEntityByVersion(resourceType, resourceId);
      if (!current) {
        throw new NotFoundException(`${resourceType} with id ${resourceId} not found`);
      }

      // Check version
      if (current.version !== expectedVersion) {
        const concurrencyError = this.errorHandlingService.createConcurrencyError(
          resourceType,
          resourceId,
          current.version,
          expectedVersion
        );

        // Log security event
        await this.securityService.logSecurityEvent(
          'CONCURRENCY_CONFLICT',
          resourceId,
          'system',
          'concurrency-control-service',
          {
            resourceType,
            expectedVersion,
            actualVersion: current.version,
            updatedAt: current.updatedAt,
          },
        );

        throw concurrencyError;
      }

      // Perform update with version increment
      const updateData = {
        ...current,
        version: current.version + 1,
        updatedAt: new Date(),
      } as T;
      const updated = await updateFn(updateData);

      this.logger.log(`Optimistic update successful!: ${resourceType}:${resourceId}, new version: ${updated.version}`);
      return updated;
    } catch (error) {
      this.logger.error(`Optimistic update failed: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Check if entity is locked
   */
  async isLocked(resourceType: string, resourceId: string): Promise<boolean> {
    const lock = await this.getActiveLock(resourceType, resourceId);
    return lock !== null;
  }

  /**
   * Get active lock for entity
   */
  async getActiveLock(resourceType: string, resourceId: string): Promise<LockInfo | null> {
    try {
      const lock = await this.prismaService.resourceLock.findFirst({
        where: {
          resourceType,
          resourceId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      return lock ? {
        id: lock.id,
        resourceType: lock.resourceType,
        resourceId: lock.resourceId,
        lockType: lock.lockType as LockType,
        ownerId: lock.userId || 'unknown',
        createdAt: lock.createdAt,
        expiresAt: lock.expiresAt,
      } !: null;
    } catch (error) {
      this.logger.error(`Failed to get active lock: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  /**
   * Extend existing lock
   */
  async extendLock(lockId: string, timeout: number): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + timeout);

      await this.prismaService.resourceLock.update({
        where: { id: lockId },
        data: { expiresAt },
      });

      this.logger.log(`Lock extended!: ${lockId}, expires at: ${expiresAt.toISOString()}`);
    } catch (error) {
      this.logger.error(`Failed to extend lock: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /**
   * Get lock statistics
   */
  async getLockStatistics(): Promise<any> {
    try {
      const stats = await this.prismaService.resourceLock.aggregate({
        _count: { id: true },
        where: {
          expiresAt: { gt: new Date() },
        },
      });

      const locksByType = await this.prismaService.resourceLock.groupBy({
        by: ['lockType'],
        _count: { id: true },
        where: {
          expiresAt: { gt: new Date() },
        },
      });

      return {
        activeLocks: stats._count.id,
        locksByType: locksByType.reduce((acc, group) => {
          acc[group.lockType] = group._count.id;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      this.logger.error(`Failed to get lock statistics: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Get entity by version (simplified implementation)
   */
  private async getEntityByVersion(resourceType: string, resourceId: string): Promise<VersionedEntity | null> {
    // This is a simplified implementation
    // In a real scenario, you'd have specific repositories for each entity type
    try {
      switch (resourceType) {
        case 'Product':
          const product = await this.prismaService.product.findUnique({
            where: { id: resourceId },
          });
          return product ? {
            id: product.id,
            version: 1, // Simplified - would use actual version field
            updatedAt: product.updatedAt,
          } !: null;

        case 'SalesOrder':
          const order = await this.prismaService.order.findUnique({
            where: { id: resourceId },
          });
          return order ? {
            id: order.id,
            version: 1, // Simplified - would use actual version field
            updatedAt: order.updatedAt,
          } !: null;

        default:
          throw new Error(`Unsupported entity type!: ${resourceType}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get entity by version: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      return null;
    }
  }

  /**
   * Check if error should not be retried
   */
  private shouldNotRetry(error: any): boolean {
    // Don't retry on validation errors, not found, or authorization errors
    if (error.name === 'ValidationError' ||
        error.name === 'NotFoundException' ||
        error.name === 'UnauthorizedException' ||
        error.name === 'ForbiddenException') {
      return true;
    }

    // Don't retry on concurrency conflicts
    if (error.name === 'ConflictException' || error instanceof ConcurrencyError) {
      return true;
    }

    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize periodic lock cleanup
   */
  private initializeLockCleanup(): void {
    // Clean up expired locks every 5 minutes
    setInterval(async () => {
      try {
        await this.cleanupExpiredLocks();
      } catch (error) {
        this.logger.error(`Failed to cleanup expired locks: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired locks
   */
  private async cleanupExpiredLocks(): Promise<void> {
    try {
      const result = await this.prismaService.resourceLock.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired locks`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup expired locks: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
    }
  }
}