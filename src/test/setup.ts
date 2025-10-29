/**
 * Enterprise-grade test setup file
 * Configures global test environment and utilities
 */

import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../shared/security/security.service';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
};

// Global mock for environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
process.env.COOKIE_SECRET = 'test-cookie-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_erp_db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Setup global test utilities
before(async () => {
  // Global test setup can go here
});

after(async () => {
  // Global test cleanup can go here
});

beforeEach(() => {
  // Reset all mocks before each test - using sinon if needed
});

afterEach(() => {
  // Cleanup after each test - using sinon if needed
});

// Helper function to create test modules
export const createTestingModule = async (imports: any[] = [], providers: any[] = []) => {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            app: {
              nodeEnv: 'test',
              port: 3000,
              apiPrefix: 'api/v1',
              jwt: {
                secret: 'test-jwt-secret',
                refreshSecret: 'test-refresh-secret',
                expiration: '15m',
                refreshExpiration: '7d',
              },
              security: {
                bcryptRounds: 10,
                rateLimitWindowMs: 900000,
                rateLimitMaxRequests: 100,
                cookieSecret: 'test-cookie-secret',
              },
            },
          }),
        ],
      }),
      ...imports,
    ],
    providers: [
      {
        provide: PrismaService,
        useValue: {
          user: {
            findUnique: () => {},
            create: () => {},
            update: () => {},
            findMany: () => [],
            delete: () => {},
          },
          session: {
            findUnique: () => {},
            create: () => {},
            update: () => {},
            findMany: () => [],
            delete: () => {},
          },
          $transaction: () => {},
        },
      },
      {
        provide: SecurityService,
        useValue: {
          generateSecureToken: () => 'test-token',
          isPasswordStrong: () => ({ isValid: true, errors: [] }),
          sanitizeInput: (input: any) => input,
          validateInput: () => true,
          logSecurityEvent: () => {},
          getCookieOptions: () => ({}),
          getHelmetConfig: () => ({}),
          getBcryptRounds: () => 12,
        },
      },
      ...providers,
    ],
  });
};

// Helper function to create mock user
export const createMockUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  password: 'hashed-password',
  isActive: true,
  isEmailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  ...overrides,
});

// Helper function to create mock session
export const createMockSession = (overrides: any = {}) => ({
  id: 'test-session-id',
  userId: 'test-user-id',
  refreshToken: 'test-refresh-token',
  isActive: true,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 86400000), // Tomorrow
  lastAccessAt: new Date(),
  ...overrides,
});

