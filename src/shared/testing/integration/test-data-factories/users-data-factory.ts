import { BaseDataFactory, ITestDataFactory } from './base-data-factory';
import { UserRole, CreateUserDto, UpdateUserDto, UserPasswordChangeDto } from '../../../../modules/users/dto/user.dto';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { SecurityService } from '../../../../shared/security/security.service';

/**
 * Users Data Factory
 *
 * Generates comprehensive test data for user management scenarios
 * following TDD methodology and enterprise-grade testing patterns
 */
export class UsersDataFactory extends BaseDataFactory implements ITestDataFactory {
  constructor(prisma: PrismaService, private securityService?: SecurityService) {
    super(prisma);
  }

  /**
   * Create base test data for users module
   * Sets up essential users for testing different scenarios
   */
  async createBaseData(): Promise<void> {
    const baseUsers = [
      { role: UserRole.ADMIN, firstName: 'Admin', lastName: 'User' },
      { role: UserRole.MANAGER, firstName: 'Manager', lastName: 'User' },
      { role: UserRole.USER, firstName: 'Regular', lastName: 'User' },
      { role: UserRole.ACCOUNTANT, firstName: 'Accountant', lastName: 'User' },
      { role: UserRole.INVENTORY_MANAGER, firstName: 'Inventory', lastName: 'Manager' },
      { role: UserRole.FINANCE, firstName: 'Finance', lastName: 'User' },
      { role: UserRole.VIEWER, firstName: 'Viewer', lastName: 'User' },
      { role: UserRole.PURCHASING, firstName: 'Purchasing', lastName: 'User' },
      { role: UserRole.SALES, firstName: 'Sales', lastName: 'User' },
      { role: UserRole.HR_ADMIN, firstName: 'HR', lastName: 'Admin' },
      { role: UserRole.EMPLOYEE, firstName: 'Employee', lastName: 'User' },
    ];

    for (const userConfig of baseUsers) {
      await this.createTestUser(userConfig.role, {
        firstName: userConfig.firstName,
        lastName: userConfig.lastName,
      });
    }
  }

  /**
   * Clean up all test data created by this factory
   */
  override async cleanupTestData(): Promise<void> {
    await super.cleanupTestData(['integration-test.com', '@test-users', 'user-factory']);
  }

  /**
   * Generate test user data with realistic business information
   */
  generateTestData(overrides?: Partial<CreateUserDto>): CreateUserDto {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Jennifer'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

    const defaultData: CreateUserDto = {
      email: this.generateTestEmail(`user-${timestamp}`),
      username: `user_${timestamp}_${randomSuffix}`,
      firstName: this.selectRandom(firstNames),
      lastName: this.selectRandom(lastNames),
      password: 'SecureTest123!@#',
      role: this.selectRandom(Object.values(UserRole)),
    };

    return { ...defaultData, ...overrides } as CreateUserDto;
  }

  /**
   * Create a test user with hashed password
   */
  override async createTestUser(role: string, overrides?: any): Promise<any> {
    const timestamp = Date.now();
    const userData = {
      email: this.generateTestEmail(`${role}-${timestamp}`),
      username: `${role.toLowerCase()}-${timestamp}`,
      firstName: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
      lastName: 'Test User',
      password: 'TestPassword123!',
      role: role,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: this.generateBoolean(0.7) ? this.generatePastDate(Math.floor(Math.random() * 30)) : null,
      ...overrides
    };

    try {
      // Hash password if security service is available
      if (this.securityService) {
        userData.password = await this.securityService.hashPassword(userData.password);
      }

      return await this.prisma.user.create({
        data: userData,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        }
      });
    } catch (error) {
      // User might already exist, try to find existing
      return await this.prisma.user.findFirst({
        where: { email: userData.email },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        }
      });
    }
  }

  /**
   * Create multiple test users with different roles
   */
  async createMultipleTestUsers(count: number, roles?: string[]): Promise<any[]> {
    const availableRoles = roles || Object.values(UserRole);
    const users = [];

    for (let i = 0; i < count; i++) {
      const role = this.selectRandom(availableRoles);
      const user = await this.createTestUser(role, {
        firstName: `Test${i}`,
        lastName: `User${i}`,
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Generate user update test data
   */
  generateUpdateTestData(overrides?: Partial<UpdateUserDto>): UpdateUserDto {
    const firstNames = ['Updated', 'Modified', 'Changed', 'New', 'Fixed'];
    const lastNames = ['Name', 'User', 'Account', 'Profile', 'Data'];

    const defaultData: UpdateUserDto = {
      firstName: this.selectRandom(firstNames),
      lastName: this.selectRandom(lastNames),
      role: this.selectRandom(Object.values(UserRole)),
      isActive: this.generateBoolean(),
    };

    return { ...defaultData, ...overrides } as UpdateUserDto;
  }

  /**
   * Generate password change test data
   */
  generatePasswordChangeTestData(overrides?: Partial<UserPasswordChangeDto>): UserPasswordChangeDto {
    const defaultData: UserPasswordChangeDto = {
      currentPassword: 'TestPassword123!',
      newPassword: 'NewSecureTest456!@#',
      confirmPassword: 'NewSecureTest456!@#',
    };

    return { ...defaultData, ...overrides } as UserPasswordChangeDto;
  }

  /**
   * Create users with specific business scenarios
   */

  /**
   * Create inactive users for testing deactivation workflows
   */
  async createInactiveUsers(count: number = 3): Promise<any[]> {
    const inactiveUsers = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(UserRole.USER, {
        firstName: `Inactive${i}`,
        lastName: 'User',
        isActive: false,
        isEmailVerified: false,
      });
      inactiveUsers.push(user);
    }

    return inactiveUsers;
  }

  /**
   * Create users with unverified emails for testing email verification workflows
   */
  async createUnverifiedUsers(count: number = 3): Promise<any[]> {
    const unverifiedUsers = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(UserRole.USER, {
        firstName: `Unverified${i}`,
        lastName: 'User',
        isActive: true,
        isEmailVerified: false,
      });
      unverifiedUsers.push(user);
    }

    return unverifiedUsers;
  }

  /**
   * Create users with recently changed passwords for testing password policies
   */
  async createUsersWithRecentPasswordChanges(count: number = 3): Promise<any[]> {
    const users = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(UserRole.USER, {
        firstName: `Password${i}`,
        lastName: 'User',
        updatedAt: this.generatePastDate(Math.floor(Math.random() * 7)), // Updated within last week
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Create admin users for testing administrative workflows
   */
  async createAdminUsers(count: number = 2): Promise<any[]> {
    const adminUsers = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(UserRole.ADMIN, {
        firstName: `Admin${i}`,
        lastName: 'User',
        isEmailVerified: true,
      });
      adminUsers.push(user);
    }

    return adminUsers;
  }

  /**
   * Create manager users for testing management workflows
   */
  async createManagerUsers(count: number = 2): Promise<any[]> {
    const managerUsers = [];

    for (let i = 0; i < count; i++) {
      const user = await this.createTestUser(UserRole.MANAGER, {
        firstName: `Manager${i}`,
        lastName: 'User',
        isEmailVerified: true,
      });
      managerUsers.push(user);
    }

    return managerUsers;
  }

  /**
   * Create users for testing search and filtering
   */
  async createUsersForSearchTesting(): Promise<any[]> {
    const searchUsers = [
      { firstName: 'Alice', lastName: 'Anderson', role: UserRole.USER },
      { firstName: 'Bob', lastName: 'Brown', role: UserRole.MANAGER },
      { firstName: 'Charlie', lastName: 'Clark', role: UserRole.ADMIN },
      { firstName: 'Diana', lastName: 'Davis', role: UserRole.USER },
      { firstName: 'Edward', lastName: 'Evans', role: UserRole.SALES },
      { firstName: 'Fiona', lastName: 'Foster', role: UserRole.PURCHASING },
    ];

    const createdUsers = [];
    for (const userConfig of searchUsers) {
      const user = await this.createTestUser(userConfig.role, userConfig);
      createdUsers.push(user);
    }

    return createdUsers;
  }

  /**
   * Generate invalid user data for negative testing
   */
  generateInvalidUserData(): {
    invalidEmail: CreateUserDto;
    invalidUsername: CreateUserDto;
    invalidPassword: CreateUserDto;
    invalidNames: CreateUserDto;
    missingRequired: CreateUserDto;
  } {
    return {
      invalidEmail: {
        ...this.generateTestData(),
        email: 'invalid-email-format',
      },
      invalidUsername: {
        ...this.generateTestData(),
        username: 'ab', // Too short
      },
      invalidPassword: {
        ...this.generateTestData(),
        password: 'weak', // Doesn't meet requirements
      },
      invalidNames: {
        ...this.generateTestData(),
        firstName: '', // Empty first name
        lastName: '123', // Invalid characters in last name
      },
      missingRequired: {
        email: '', // Missing email
        username: '', // Missing username
        firstName: '', // Missing first name
        lastName: '', // Missing last name
        password: '', // Missing password
        role: UserRole.USER,
      } as CreateUserDto,
    };
  }

  /**
   * Generate invalid password change data for negative testing
   */
  generateInvalidPasswordChangeData(): {
    mismatchedPasswords: UserPasswordChangeDto;
    wrongCurrentPassword: UserPasswordChangeDto;
    weakNewPassword: UserPasswordChangeDto;
    missingCurrentPassword: UserPasswordChangeDto;
  } {
    return {
      mismatchedPasswords: {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewSecureTest456!@#',
        confirmPassword: 'DifferentPassword789!@#',
      },
      wrongCurrentPassword: {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecureTest456!@#',
        confirmPassword: 'NewSecureTest456!@#',
      },
      weakNewPassword: {
        currentPassword: 'TestPassword123!',
        newPassword: 'weak',
        confirmPassword: 'weak',
      },
      missingCurrentPassword: {
        currentPassword: '',
        newPassword: 'NewSecureTest456!@#',
        confirmPassword: 'NewSecureTest456!@#',
      },
    };
  }

  /**
   * Create test data for pagination testing
   */
  async createUsersForPaginationTesting(totalCount: number = 25): Promise<any[]> {
    const users = [];

    for (let i = 0; i < totalCount; i++) {
      const user = await this.createTestUser(UserRole.USER, {
        firstName: `Page${i}`,
        lastName: `User${i}`,
        email: this.generateTestEmail(`page-${i}`),
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Create users for performance testing
   */
  async createUsersForPerformanceTesting(count: number = 100): Promise<any[]> {
    const users = [];
    const roles = Object.values(UserRole);

    for (let i = 0; i < count; i++) {
      const role = this.selectRandom(roles) as string;
      const user = await this.createTestUser(role, {
        firstName: `Perf${i}`,
        lastName: 'User',
        email: this.generateTestEmail(`perf-${i}`),
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Get user statistics for testing
   */
  async getUserStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    verified: number;
    unverified: number;
    byRole: Record<string, number>;
  }> {
    const [total, active, inactive, verified, unverified, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { isEmailVerified: true } }),
      this.prisma.user.count({ where: { isEmailVerified: false } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
    ]);

    const roleStats = byRole.reduce((acc, item) => {
      acc[item.role] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      active,
      inactive,
      verified,
      unverified,
      byRole: roleStats,
    };
  }
}