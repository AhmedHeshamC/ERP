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
  // Uncomment to disable specific console methods during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // info: jest.fn(),
  // debug: jest.fn(),
};

// Global test timeout
jest.setTimeout(30000);

// Global mock for environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing';
process.env.COOKIE_SECRET = 'test-cookie-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_erp_db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock global dependencies that might be used across tests
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
}));

jest.mock('speakeasy', () => ({
  totp: jest.fn(() => ({ base32: 'test-secret' })),
  verify: jest.fn(() => true),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => 'data:image/png;base64,test-image'),
}));

// Setup global test utilities
beforeAll(async () => {
  // Global test setup can go here
});

afterAll(async () => {
  // Global test cleanup can go here
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
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
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
          },
          session: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
          },
          $transaction: jest.fn(),
        },
      },
      {
        provide: SecurityService,
        useValue: {
          generateSecureToken: jest.fn(() => 'test-token'),
          isPasswordStrong: jest.fn(() => ({ isValid: true, errors: [] })),
          sanitizeInput: jest.fn((input) => input),
          validateInput: jest.fn(() => true),
          logSecurityEvent: jest.fn(),
          getCookieOptions: jest.fn(() => ({})),
          getHelmetConfig: jest.fn(() => ({})),
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

// Custom matchers for better assertions
expect.extend({
  toBeValidUser(received) {
    const requiredFields = ['id', 'email', 'firstName', 'lastName', 'username'];
    const hasAllFields = requiredFields.every(field => received && received[field] !== undefined);

    if (hasAllFields) {
      return {
        message: () => `expected ${received} to be a valid user`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid user but missing required fields`,
        pass: false,
      };
    }
  },

  toBeValidAuthResponse(received) {
    const hasUser = received && received.user !== undefined;
    const hasAccessToken = received && received.accessToken !== undefined;
    const hasRefreshToken = received && received.refreshToken !== undefined;

    if (hasUser && hasAccessToken && hasRefreshToken) {
      return {
        message: () => `expected ${received} to be a valid auth response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid auth response but missing required fields`,
        pass: false,
      };
    }
  },
});

// Declare the custom matchers for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUser(): R;
      toBeValidAuthResponse(): R;
    }
  }
}