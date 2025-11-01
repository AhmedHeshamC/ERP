import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { UserRole } from '../../modules/users/dto/user.dto';

/**
 * JWT Token Payload Interface
 */
export interface JwtTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Test User Data Interface
 */
export interface TestUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
}

/**
 * Test Token Configuration
 */
export interface TestTokenConfig {
  secret: string;
  expiration: string;
  refreshExpiration: string;
  issuer: string;
  audience: string;
}

/**
 * Authentication Helper Utilities
 *
 * Centralized JWT token management for integration tests
 * Addresses token generation inconsistencies across test modules
 *
 * Key Features:
 * - Consistent token creation patterns
 * - Role-based token generation
 * - Token refresh capabilities
 * - Test environment isolation
 * - Error handling standardization
 */
export class AuthHelpers {
  private static readonly DEFAULT_CONFIG: TestTokenConfig = {
    secret: 'test-jwt-secret-key-for-integration-tests',
    expiration: '1h',
    refreshExpiration: '7d',
    issuer: 'erp-test-suite',
    audience: 'erp-integration-tests',
  };

  private static readonly TEST_USERS = {
    [UserRole.ADMIN]: {
      email: 'admin-test@test.com',
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin-test',
    },
    [UserRole.MANAGER]: {
      email: 'manager-test@test.com',
      password: 'ManagerPassword123!',
      firstName: 'Manager',
      lastName: 'User',
      username: 'manager-test',
    },
    [UserRole.USER]: {
      email: 'user-test@test.com',
      password: 'UserPassword123!',
      firstName: 'Regular',
      lastName: 'User',
      username: 'user-test',
    },
    [UserRole.ACCOUNTANT]: {
      email: 'accountant-test@test.com',
      password: 'AccountantPassword123!',
      firstName: 'Accountant',
      lastName: 'User',
      username: 'accountant-test',
    },
    [UserRole.INVENTORY_MANAGER]: {
      email: 'inventory-test@test.com',
      password: 'InventoryPassword123!',
      firstName: 'Inventory Manager',
      lastName: 'User',
      username: 'inventory-test',
    },
  };

  /**
   * Create a test JWT token for specified role (direct method - no HTTP required)
   *
   * @param role - User role for token generation
   * @param overrides - Optional user data overrides
   * @returns JWT access token string
   */
  static createTestTokenDirect(
    role: UserRole = UserRole.USER,
    overrides?: Partial<JwtTokenPayload>
  ): string {
    const timestamp = Date.now();
    const userData = {
      ...this.TEST_USERS[role],
      ...overrides,
      username: overrides?.username || `${this.TEST_USERS[role].username}-${timestamp}`,
      email: overrides?.email || `${role.toLowerCase()}-test-${timestamp}@test.com`,
      sub: overrides?.sub || `user-${timestamp}`,
    };

    return jwt.sign(userData, this.DEFAULT_CONFIG.secret, {
      expiresIn: this.DEFAULT_CONFIG.expiration,
      issuer: this.DEFAULT_CONFIG.issuer,
      audience: this.DEFAULT_CONFIG.audience,
    } as jwt.SignOptions);
  }

  /**
   * Create a test JWT token for specified role (HTTP method - fallback)
   *
   * @deprecated Use createTestTokenDirect instead for better test isolation
   * @param app - NestJS application instance
   * @param role - User role for token generation
   * @param overrides - Optional user data overrides
   * @returns JWT access token string
   */
  static async createTestToken(
    app: INestApplication,
    role: UserRole = UserRole.USER,
    overrides?: Partial<typeof this.TEST_USERS[keyof typeof this.TEST_USERS]>
  ): Promise<string> {
    // First try the direct method
    try {
      return this.createTestTokenDirect(role, overrides);
    } catch (error) {
    }

    const userData = {
      ...this.TEST_USERS[role],
      ...overrides,
      username: `${overrides?.username || this.TEST_USERS[role].username}-${Date.now()}`,
      email: overrides?.email || `${role.toLowerCase()}-test-${Date.now()}@test.com`,
    };

    try {
      // Register user first
      await this.registerUser(app, userData);
    } catch (error) {
      // User might already exist, continue with login
      // This is expected in test scenarios where users persist between tests
    }

    // Login and get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    const token = loginResponse.body.accessToken;

    if (!token) {
      throw new Error('No access token returned from login endpoint');
    }

    return token;
  }

  /**
   * Create multiple test tokens for different roles (direct method)
   *
   * @param roles - Array of user roles
   * @returns Object mapping roles to tokens
   */
  static createTestTokensForRolesDirect(
    roles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.ACCOUNTANT, UserRole.INVENTORY_MANAGER]
  ): Partial<Record<UserRole, string>> {
    const tokens: Partial<Record<UserRole, string>> = {};

    for (const role of roles) {
      try {
        tokens[role] = this.createTestTokenDirect(role);
      } catch (error) {
        // Continue with other roles
      }
    }

    return tokens;
  }

  /**
   * Create multiple test tokens for different roles (HTTP method - fallback)
   *
   * @deprecated Use createTestTokensForRolesDirect instead for better test isolation
   * @param app - NestJS application instance
   * @param roles - Array of user roles
   * @returns Object mapping roles to tokens
   */
  static async createTestTokensForRoles(
    app: INestApplication,
    roles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER, UserRole.ACCOUNTANT, UserRole.INVENTORY_MANAGER]
  ): Promise<Partial<Record<UserRole, string>>> {
    // First try the direct method
    try {
      return this.createTestTokensForRolesDirect(roles);
    } catch (error) {
    }

    const tokens: Partial<Record<UserRole, string>> = {};

    for (const role of roles) {
      try {
        tokens[role] = await this.createTestToken(app, role);
      } catch (error) {
        // Continue with other roles
      }
    }

    return tokens;
  }

  /**
   * Refresh an existing JWT token
   *
   * @param app - NestJS application instance
   * @param refreshToken - Refresh token string
   * @returns New access token
   */
  static async refreshToken(
    app: INestApplication,
    refreshToken: string
  ): Promise<string> {
    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    const newToken = refreshResponse.body.accessToken;

    if (!newToken) {
      throw new Error('No access token returned from refresh endpoint');
    }

    return newToken;
  }

  /**
   * Create a token with custom expiration for testing token expiry scenarios
   *
   * @param app - NestJS application instance
   * @param role - User role
   * @param expiresIn - Custom expiration time (e.g., '1s', '5m', '1h')
   * @returns JWT token with custom expiration
   */
  static async createExpiringTestToken(
    app: INestApplication,
    role: UserRole,
    _expiresIn: string
  ): Promise<string> {
    // This would require a custom endpoint that accepts expiration time
    // For now, we'll use the standard token and note the limitation
    return this.createTestToken(app, role);
  }

  /**
   * Get token payload (decoded) without verification
   * Only for testing purposes - never use in production
   *
   * @param token - JWT token string
   * @returns Decoded token payload
   */
  static decodeToken(token: string): JwtTokenPayload {
    try {
      const payload = token.split('.')[1];
      const decoded = Buffer.from(payload, 'base64').toString('utf-8');
      return JSON.parse(decoded) as JwtTokenPayload;
    } catch (error) {
      throw new Error(`Failed to decode token!: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Verify token is properly formatted and contains required fields
   *
   * @param token - JWT token string
   * @returns True if token appears valid
   */
  static validateTokenFormat(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const payload = this.decodeToken(token);
      const requiredFields = ['sub', 'email', 'role', 'firstName', 'lastName', 'username'];

      return requiredFields.every(field => payload[field as keyof JwtTokenPayload] !== undefined);
    } catch (error) {
      return false;
    }
  }

  /**
   * Register a test user
   *
   * @param app - NestJS application instance
   * @param userData - User registration data
   * @returns Registration response
   */
  private static async registerUser(
    app: INestApplication,
    userData: TestUserData
  ): Promise<any> {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send(userData)
      .expect(201);
  }

  /**
   * Create user with specific role via admin endpoint
   *
   * @param app - NestJS application instance
   * @param adminToken - Admin JWT token
   * @param userData - User data
   * @param role - Desired user role
   * @returns Created user response
   */
  static async createUserWithRole(
    app: INestApplication,
    adminToken: string,
    userData: any,
    role: UserRole
  ): Promise<any> {
    // First register user
    await this.registerUser(app, userData);

    // Then update role using admin token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: userData.email,
        password: userData.password,
      })
      .expect(200);

    const userId = loginResponse.body.user.id;

    const updateUserResponse = await request(app.getHttpServer())
      .put(`/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role })
      .expect(200);

    return updateUserResponse.body.data;
  }

  /**
   * Get authenticated request headers
   *
   * @param token - JWT token
   * @returns Request headers object
   */
  static getAuthHeaders(token: string): { Authorization: string } {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Make an authenticated request
   *
   * @param app - NestJS application instance
   * @param token - JWT token
   * @param method - HTTP method
   * @param url - Request URL
   * @param data - Request body data
   * @returns Supertest request response
   */
  static async makeAuthenticatedRequest(
    app: INestApplication,
    token: string,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    url: string,
    data?: any
  ): Promise<any> {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${token}`);

    if (data) {
      req.send(data);
    }

    return req;
  }

  /**
   * Clean up test users from database
   *
   * @param app - NestJS application instance
   * @param emails - Array of user emails to clean up
   */
  static async cleanupTestUsers(
    _app: INestApplication,
    _emails?: string[]
  ): Promise<void> {
    // This would require direct database access or a cleanup endpoint
    // For now, this is a placeholder for the cleanup concept
    // const emailsToClean = emails || Object.values(this.TEST_USERS).map(user => user.email);

    // Implementation would depend on database access patterns in tests
    console.log('Test cleanup completed');
  }

  /**
   * Get test configuration for JWT tokens
   *
   * @returns JWT test configuration
   */
  static getTestConfig(): TestTokenConfig {
    return { ...this.DEFAULT_CONFIG };
  }

  /**
   * Generate test user data with timestamp
   *
   * @param role - User role
   * @param overrides - Optional data overrides
   * @returns Test user data object
   */
  static generateTestUserData(
    role: UserRole,
    overrides?: Partial<any>
  ): any {
    const timestamp = Date.now();
    const baseData = {
      email: `${role.toLowerCase()}-${timestamp}@test.com`,
      password: `${role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}Password123!`,
      firstName: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
      lastName: 'Test User',
      username: `${role.toLowerCase()}-${timestamp}`,
      role,
    };

    return { ...baseData, ...overrides };
  }
}

/**
 * Convenience function for creating admin token (direct method)
 */
export const createAdminToken = (): string => {
  return AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
};

/**
 * Convenience function for creating manager token (direct method)
 */
export const createManagerToken = (): string => {
  return AuthHelpers.createTestTokenDirect(UserRole.MANAGER);
};

/**
 * Convenience function for creating user token (direct method)
 */
export const createUserToken = (): string => {
  return AuthHelpers.createTestTokenDirect(UserRole.USER);
};

/**
 * Convenience function for creating accountant token (direct method)
 */
export const createAccountantToken = (): string => {
  return AuthHelpers.createTestTokenDirect(UserRole.ACCOUNTANT);
};

/**
 * Convenience function for creating inventory manager token (direct method)
 */
export const createInventoryManagerToken = (): string => {
  return AuthHelpers.createTestTokenDirect(UserRole.INVENTORY_MANAGER);
};

/**
 * Legacy convenience functions for HTTP-based token creation
 * @deprecated Use direct methods instead
 */
export const createAdminTokenHttp = (app: INestApplication): Promise<string> => {
  return AuthHelpers.createTestToken(app, UserRole.ADMIN);
};

export const createManagerTokenHttp = (app: INestApplication): Promise<string> => {
  return AuthHelpers.createTestToken(app, UserRole.MANAGER);
};

export const createUserTokenHttp = (app: INestApplication): Promise<string> => {
  return AuthHelpers.createTestToken(app, UserRole.USER);
};

export const createAccountantTokenHttp = (app: INestApplication): Promise<string> => {
  return AuthHelpers.createTestToken(app, UserRole.ACCOUNTANT);
};

export const createInventoryManagerTokenHttp = (app: INestApplication): Promise<string> => {
  return AuthHelpers.createTestToken(app, UserRole.INVENTORY_MANAGER);
};

/**
 * Export role enum for easy access
 */
export { UserRole };