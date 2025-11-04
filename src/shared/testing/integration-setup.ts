import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { DatabaseCleanup } from './database-cleanup';
import { AuthHelpers } from './auth-helpers';
import { AppModule } from '../../app.module';
import { UserRole } from '../../modules/users/dto/user.dto';

/**
 * Enhanced Integration Test Setup Utilities
 *
 * Provides comprehensive setup and teardown for integration tests
 * with proper application initialization, database management,
 * and authentication token handling.
 */

export interface IntegrationTestSetup {
  app: INestApplication;
  prisma: PrismaService;
  databaseCleanup: DatabaseCleanup;
  authHelpers: typeof AuthHelpers;
}

export interface TestTokens {
  admin: string;
  manager: string;
  user: string;
  accountant: string;
  inventoryManager: string;
  finance: string;
  viewer: string;
  purchasing: string;
  sales: string;
  hrAdmin: string;
  employee: string;
}

/**
 * Base Integration Test Class
 *
 * Provides standardized setup and teardown for all integration tests
 * with proper database cleanup and authentication token management
 */
export class BaseIntegrationTest {
  public app!: INestApplication;
  public prisma!: PrismaService;
  public databaseCleanup!: DatabaseCleanup;
  protected testTokens!: TestTokens;

  /**
   * Setup integration test environment
   * Creates full NestJS application with test configuration
   */
  async setupIntegrationTest(): Promise<IntegrationTestSetup> {
    // Create test module with full application
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Create application
    this.app = moduleRef.createNestApplication();

    // Get required services
    this.prisma = this.app.get(PrismaService);
    this.databaseCleanup = new DatabaseCleanup(this.prisma);

    // Initialize application
    await this.app.init();

    // Generate test tokens for all roles
    this.testTokens = {
      admin: AuthHelpers.createTestTokenDirect(UserRole.ADMIN),
      manager: AuthHelpers.createTestTokenDirect(UserRole.MANAGER),
      user: AuthHelpers.createTestTokenDirect(UserRole.USER),
      accountant: AuthHelpers.createTestTokenDirect(UserRole.ACCOUNTANT),
      inventoryManager: AuthHelpers.createTestTokenDirect(UserRole.INVENTORY_MANAGER),
      finance: AuthHelpers.createTestTokenDirect(UserRole.FINANCE),
      viewer: AuthHelpers.createTestTokenDirect(UserRole.VIEWER),
      purchasing: AuthHelpers.createTestTokenDirect(UserRole.PURCHASING),
      sales: AuthHelpers.createTestTokenDirect(UserRole.SALES),
      hrAdmin: AuthHelpers.createTestTokenDirect(UserRole.HR_ADMIN),
      employee: AuthHelpers.createTestTokenDirect(UserRole.EMPLOYEE),
    };

    return {
      app: this.app,
      prisma: this.prisma,
      databaseCleanup: this.databaseCleanup,
      authHelpers: AuthHelpers,
    };
  }

  /**
   * Cleanup integration test environment
   * Properly closes database connections and application
   */
  async cleanupIntegrationTest(): Promise<void> {
    try {
      // Clean up all test data
      if (this.databaseCleanup) {
        await this.databaseCleanup.cleanupAllTestData();
      }

      // Disconnect from database
      if (this.prisma) {
        await this.prisma.$disconnect();
      }

      // Close application
      if (this.app) {
        await this.app.close();
      }
    } catch (error) {
      // Log error but don't throw to prevent test failures
      console.error('Error during integration test cleanup:', error);
    }
  }

  /**
   * Get HTTP server for making requests
   */
  getHttpServer(): any {
    return this.app.getHttpServer();
  }

  /**
   * Get authenticated headers for a specific role
   */
  getAuthHeaders(role: keyof TestTokens): { Authorization: string } {
    return {
      Authorization: `Bearer ${this.testTokens[role]}`,
    };
  }

  /**
   * Get test token for a specific role
   */
  getTestToken(role: keyof TestTokens): string {
    return this.testTokens[role];
  }

  /**
   * Create a custom test token with overrides
   */
  createCustomTestToken(role: string, overrides?: any): string {
    return AuthHelpers.createTestTokenDirect(role as any, overrides);
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use BaseIntegrationTest class instead
 */
export async function setupIntegrationTest(): Promise<void> {
  // Legacy implementation - use BaseIntegrationTest class instead
  console.warn('setupIntegrationTest() is deprecated. Use BaseIntegrationTest class instead.');
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use BaseIntegrationTest class instead
 */
export async function cleanupIntegrationTest(): Promise<void> {
  // Legacy implementation - use BaseIntegrationTest class instead
  console.warn('cleanupIntegrationTest() is deprecated. Use BaseIntegrationTest class instead.');
}

/**
 * Enhanced database cleanup function
 */
export async function cleanupDatabase(prismaService: PrismaService): Promise<void> {
  const cleanup = new DatabaseCleanup(prismaService);
  await cleanup.cleanupAllTestData();
}

/**
 * Setup integration test with minimal configuration
 * For lightweight tests that don't need full application
 */
export async function setupMinimalIntegrationTest(): Promise<{
  prisma: PrismaService;
  databaseCleanup: DatabaseCleanup;
}> {
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaService],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  const databaseCleanup = new DatabaseCleanup(prisma);

  return { prisma, databaseCleanup };
}

/**
 * Create test tokens for all roles
 */
export function createAllTestTokens(): TestTokens {
  return {
    admin: AuthHelpers.createTestTokenDirect(UserRole.ADMIN),
    manager: AuthHelpers.createTestTokenDirect(UserRole.MANAGER),
    user: AuthHelpers.createTestTokenDirect(UserRole.USER),
    accountant: AuthHelpers.createTestTokenDirect(UserRole.ACCOUNTANT),
    inventoryManager: AuthHelpers.createTestTokenDirect(UserRole.INVENTORY_MANAGER),
    finance: AuthHelpers.createTestTokenDirect(UserRole.FINANCE),
    viewer: AuthHelpers.createTestTokenDirect(UserRole.VIEWER),
    purchasing: AuthHelpers.createTestTokenDirect(UserRole.PURCHASING),
    sales: AuthHelpers.createTestTokenDirect(UserRole.SALES),
    hrAdmin: AuthHelpers.createTestTokenDirect(UserRole.HR_ADMIN),
    employee: AuthHelpers.createTestTokenDirect(UserRole.EMPLOYEE),
  };
}

/**
 * Integration test helper functions
 */
export class IntegrationTestHelpers {
  /**
   * Wait for a specified amount of time (useful for async operations)
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique test data with timestamp
   */
  static generateUniqueData(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique email for testing
   */
  static generateTestEmail(role: string): string {
    return `${role.toLowerCase()}-${Date.now()}@integration-test.com`;
  }

  /**
   * Generate unique reference number
   */
  static generateReference(prefix: string): string {
    return `${prefix}-${Date.now().toString().slice(-8)}`;
  }

  /**
   * Validate API response structure
   */
  static validateApiResponse(response: any, expectedFields: string[]): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    return expectedFields.every(field => {
      const keys = field.split('.');
      let current = response;

      for (const key of keys) {
        if (current === null || current === undefined || !(key in current)) {
          return false;
        }
        current = current[key];
      }

      return true;
    });
  }

  /**
   * Extract correlation ID from response headers
   */
  static extractCorrelationId(headers: any): string | null {
    return headers['x-correlation-id'] || headers['correlation-id'] || null;
  }

  /**
   * Measure execution time of async function
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await fn();
    const executionTime = Date.now() - startTime;

    return { result, executionTime };
  }
}