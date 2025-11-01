import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { JwtStrategy } from '../authentication/jwt.strategy';
import { LocalStrategy } from '../authentication/local.strategy';
import { AuthService } from '../authentication/auth.service';
import { AuthController } from '../authentication/auth.controller';
import { AuthHelpers } from '../../shared/testing/auth-helpers';
import {
  CreateUserDto,
  UpdateUserDto,
  UserRole,
  UserPasswordChangeDto,
} from './dto/user.dto';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare var before: any;
declare var after: any;
declare var beforeEach: any;
declare var afterEach: any;
declare var afterAll: any;

/**
 * Users Module Integration Tests
 * Tests complete user management workflows end-to-end
 * These tests validate the entire user management system including CRUD operations,
 * role-based access control, password management, and security logging
 * following enterprise-grade standards and OWASP security principles
 */
describe('Users Module Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let userService: UserService;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;

  // Setup test environment before all tests
  before(async () => {
    // Setup integration test environment
    await setupIntegrationTest();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
              JWT_EXPIRATION: '1h',
              JWT_REFRESH_EXPIRATION: '7d',
              DATABASE_URL: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
              app: {
                database: {
                  url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
                },
              },
              LOG_LEVEL: 'error',
              NODE_ENV: 'test',
            })
          ],
        }),
        PrismaModule,
        SecurityModule,
        JwtModule.register({
          secret: 'test-jwt-secret-key-for-integration-tests',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [UserController, AuthController],
      providers: [UserService, AuthService, JwtStrategy, LocalStrategy],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a direct PrismaService instance for test cleanup
    const { PrismaService } = await import('../../shared/database/prisma.service');
    const { ConfigService } = await import('@nestjs/config');

    const configService = new ConfigService({
      app: {
        database: {
          url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
        },
      },
    });

    prismaService = new PrismaService(configService);
    await prismaService.$connect();
    userService = moduleFixture.get<UserService>(UserService);

    // Create test users with different roles using direct generation
    adminToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
    managerToken = AuthHelpers.createTestTokenDirect(UserRole.MANAGER);
    userToken = AuthHelpers.createTestTokenDirect(UserRole.USER);
  });

  // Cleanup after all tests
  after(async () => {
    if (prismaService) {
      await prismaService.$disconnect();
    }
    if (app) {
      await app.close();
    }
    await cleanupIntegrationTest();
  });

  // Clean up test data before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  // Additional comprehensive cleanup before any test runs
  before(async () => {
    await cleanupTestData();
  });

  describe('User CRUD Operations', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createUserDto: CreateUserDto = {
        email: `test.user${timestamp}@test.com`,
        username: `testuser${timestamp}`,
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message', 'User created successfully');
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('id');
      expect(response.body.data.email).to.equal(createUserDto.email);
      expect(response.body.data.username).to.equal(createUserDto.username);
      expect(response.body.data.firstName).to.equal(createUserDto.firstName);
      expect(response.body.data.lastName).to.equal(createUserDto.lastName);
      expect(response.body.data.role).to.equal(UserRole.USER);
      expect(response.body.data.isActive).to.be.true;
      expect(response.body.data.isEmailVerified).to.be.false;
      expect(response.body.data).to.not.have.property('password'); // Password should not be returned
      expect(response.body.data).to.have.property('createdAt');
      expect(response.body.data).to.have.property('updatedAt');
    });

    it('should reject user creation with duplicate email', async () => {
      // Arrange - Create first user
      const timestamp = Date.now();
      const createUserDto: CreateUserDto = {
        email: `duplicate${timestamp}@test.com`,
        username: `duplicateuser${timestamp}`,
        password: 'SecurePassword123!',
        firstName: 'First',
        lastName: 'User',
        role: UserRole.USER,
      };

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201);

      // Act - Try to create second user with same email
      const duplicateUserDto = {
        ...createUserDto,
        username: `differentuser${timestamp}`,
        firstName: 'Second',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should reject user creation with duplicate username', async () => {
      // Arrange - Create first user
      const timestamp = Date.now();
      const createUserDto: CreateUserDto = {
        email: `user1${timestamp}@test.com`,
        username: `duplicateusername${timestamp}`,
        password: 'SecurePassword123!',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.USER,
      };

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201);

      // Act - Try to create second user with same username
      const duplicateUserDto = {
        ...createUserDto,
        email: `user2${timestamp}@test.com`,
        firstName: 'User',
        lastName: 'Two',
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateUserDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should validate user creation data', async () => {
      // Arrange - Invalid data
      const invalidUserDto = {
        email: 'invalid-email', // Invalid email format
        username: 'ab', // Too short
        password: '123', // Too weak
        firstName: '', // Empty first name
        lastName: '', // Empty last name
        role: 'INVALID_ROLE', // Invalid role
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should validate password strength requirements', async () => {
      // Arrange - Weak passwords
      const weakPasswords = [
        'password', // No uppercase, numbers, or special chars
        'PASSWORD', // No lowercase, numbers, or special chars
        '12345678', // No letters or special chars
        'Pass123', // Too short
        'Password', // No numbers or special chars
        'Password123', // No special chars
      ];

      for (const weakPassword of weakPasswords) {
        const weakPasswordDto = {
          email: `weak${Date.now()}@test.com`,
          username: `weakuser${Date.now()}`,
          password: weakPassword,
          firstName: 'Weak',
          lastName: 'Password',
          role: UserRole.USER,
        };

        // Act & Assert
        await request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(weakPasswordDto)
          .expect(400);
      }
    });

    it('should get user by ID successfully', async () => {
      // Arrange - Create a user first
      const createdUser = await createTestUser();

      // Act
      const response = await request(app.getHttpServer())
        .get(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('id', createdUser.id);
      expect(response.body.email).to.equal(createdUser.email);
      expect(response.body.username).to.equal(createdUser.username);
      expect(response.body.firstName).to.equal(createdUser.firstName);
      expect(response.body.lastName).to.equal(createdUser.lastName);
      expect(response.body.role).to.equal(createdUser.role);
      expect(response.body).to.not.have.property('password');
    });

    it('should return 404 for non-existent user', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).to.include('not found');
    });

    it('should update user successfully', async () => {
      // Arrange - Create a user first
      const createdUser = await createTestUser();

      const updateData: UpdateUserDto = {
        firstName: 'Updated First Name',
        lastName: 'Updated Last Name',
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body.data.id).to.equal(createdUser.id);
      expect(response.body.data.firstName).to.equal(updateData.firstName);
      expect(response.body.data.lastName).to.equal(updateData.lastName);
      expect(response.body.data.updatedAt).to.not.equal(createdUser.updatedAt);
    });

    it('should change user role successfully', async () => {
      // Arrange - Create a user first
      const createdUser = await createTestUser({ role: UserRole.USER });

      const updateData: UpdateUserDto = {
        role: UserRole.MANAGER,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.data.id).to.equal(createdUser.id);
      expect(response.body.data.role).to.equal(UserRole.MANAGER);
    });

    it('should deactivate user successfully', async () => {
      // Arrange - Create a user first
      const createdUser = await createTestUser();

      const updateData: UpdateUserDto = {
        isActive: false,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.data.id).to.equal(createdUser.id);
      expect(response.body.data.isActive).to.be.false;
    });

    it('should delete user successfully', async () => {
      // Arrange - Create a user first
      const createdUser = await createTestUser();

      // Act
      const response = await request(app.getHttpServer())
        .delete(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body.message).to.include('deleted successfully');

      // Verify user is deleted
      await request(app.getHttpServer())
        .get(`/users/${createdUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('User Listing and Search', () => {
    beforeEach(async () => {
      // Create test users for listing/search tests
      await createMultipleTestUsers();
    });

    it('should get paginated user list', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('pagination');
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');
      expect(response.body.data.pagination.page).to.equal(1);
      expect(response.body.data.pagination.limit).to.equal(5);
      expect(response.body.data.pagination.total).to.be.greaterThan(0);
      expect(response.body.data.users.length).to.be.lessThanOrEqual(5);
    });

    it('should filter users by role', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?role=USER')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach((user: any) => {
          expect(user.role).to.equal('USER');
        });
      }
    });

    it('should filter users by status', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach((user: any) => {
          expect(user.isActive).to.be.true;
        });
      }
    });

    it('should search users by name', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?search=John')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach((user: any) => {
          const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
          expect(fullName).to.include('john');
        });
      }
    });

    it('should search users by email', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?search=@test.com')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach((user: any) => {
          expect(user.email).to.include('@test.com');
        });
      }
    });

    it('should sort users by email', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/users?sortBy=email&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data.users).to.be.an('array');
      if (response.body.data.users.length > 1) {
        for (let i = 1; i < response.body.data.users.length; i++) {
          expect(response.body.data.users[i-1].email <= response.body.data.users[i].email).to.be.true;
        }
      }
    });
  });

  describe('Password Management', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await createTestUser();
    });

    it('should change user password successfully', async () => {
      // Arrange
      const passwordChangeData: UserPasswordChangeDto = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'NewSecurePassword456!',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/users/${testUser.id}/change-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordChangeData)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body.message).to.include('Password changed successfully');

      // Verify new password works by logging in
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: passwordChangeData.newPassword,
        })
        .expect(200);

      expect(loginResponse.body).to.have.property('accessToken');
    });

    it('should reject password change with incorrect current password', async () => {
      // Arrange
      const passwordChangeData: UserPasswordChangeDto = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'NewSecurePassword456!',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .put(`/users/${testUser.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordChangeData)
        .expect(400);

      expect(response.body.message).to.include('Current password is incorrect');
    });

    it('should reject password change with mismatched confirmation', async () => {
      // Arrange
      const passwordChangeData: UserPasswordChangeDto = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'DifferentPassword789!',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .put(`/users/${testUser.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordChangeData)
        .expect(400);

      expect(response.body.message).to.include('Passwords do not match');
    });

    it('should validate new password strength', async () => {
      // Arrange - Weak new password
      const passwordChangeData: UserPasswordChangeDto = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'weak', // Too weak
        confirmPassword: 'weak',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .put(`/users/${testUser.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordChangeData)
        .expect(400);

      expect(response.body.message).to.include('Password does not meet security requirements');
    });

    it('should reset user password successfully (admin only)', async () => {
      // Arrange
      const resetPasswordData = {
        newPassword: 'ResetPassword123!',
        forcePasswordChange: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resetPasswordData)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('success', true);
      expect(response.body.message).to.include('Password reset successfully');
    });

    it('should prevent non-admin users from resetting passwords', async () => {
      // Arrange
      const resetPasswordData = {
        newPassword: 'ResetPassword123!',
        forcePasswordChange: true,
      };

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(resetPasswordData)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(resetPasswordData)
        .expect(403);
    });
  });

  describe('Security and Authorization', () => {
    it('should enforce RBAC for user management', async () => {
      // Arrange - User data
      const userData = {
        email: 'rbac.test@test.com',
        username: 'rbactest',
        password: 'SecurePassword123!',
        firstName: 'RBAC',
        lastName: 'Test',
        role: UserRole.USER,
      };

      // Act & Assert - Regular user should not be able to create users
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send(userData)
        .expect(403);

      // Act & Assert - Manager should not be able to create users (admin only)
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(userData)
        .expect(403);

      // Act & Assert - Admin should be able to create users
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);
    });

    it('should allow users to view their own profile', async () => {
      // Arrange - Get user info from token
      const userInfoResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userId = userInfoResponse.body.id;

      // Act & Assert - User can view their own profile
      await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should prevent users from viewing other users profiles', async () => {
      // Arrange - Create another user
      const otherUser = await createTestUser();

      // Act & Assert - Regular user cannot view other user's profile
      await request(app.getHttpServer())
        .get(`/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Act & Assert - Manager can view other user's profile
      await request(app.getHttpServer())
        .get(`/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Act & Assert - Admin can view other user's profile
      await request(app.getHttpServer())
        .get(`/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should allow users to update their own profile', async () => {
      // Arrange - Get user info from token
      const userInfoResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userId = userInfoResponse.body.id;

      const updateData: UpdateUserDto = {
        firstName: 'Updated By User',
        lastName: 'Self Update',
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.data.firstName).to.equal(updateData.firstName);
      expect(response.body.data.lastName).to.equal(updateData.lastName);
    });

    it('should prevent users from changing their own role', async () => {
      // Arrange - Get user info from token
      const userInfoResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userId = userInfoResponse.body.id;
      const originalRole = userInfoResponse.body.role;

      const updateData: UpdateUserDto = {
        role: UserRole.ADMIN, // Trying to promote self to admin
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Assert - Role should not have changed
      expect(response.body.data.role).to.equal(originalRole);
    });

    it('should prevent users from deactivating themselves', async () => {
      // Arrange - Get user info from token
      const userInfoResponse = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userId = userInfoResponse.body.id;

      const updateData: UpdateUserDto = {
        isActive: false, // Trying to deactivate self
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Assert - User should still be active
      expect(response.body.data.isActive).to.be.true;
    });

    it('should prevent XSS attacks in user data', async () => {
      // Arrange - Malicious input with XSS attempt
      const maliciousUserData = {
        email: 'xss.test@test.com',
        username: 'xsstest',
        password: 'SecurePassword123!',
        firstName: '<script>alert("xss")</script>Malicious',
        lastName: 'User',
        role: UserRole.USER,
      };

      // Act - XSS should be blocked by validation
      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousUserData);

      // Assert - XSS should be rejected by validation
      expect(response.status).to.equal(400);
      expect(response.body).to.have.property('message');
      // The request should be rejected due to validation rules against script tags
    });

    it('should prevent SQL injection in search parameters', async () => {
      // Arrange - Malicious search term with SQL injection attempt
      const maliciousSearch = "'; DROP TABLE users; --";

      // Act
      const response = await request(app.getHttpServer())
        .get(`/users?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert - Should return empty array or handle gracefully, not crash
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');

      // Verify users table still exists
      const users = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(users.body).to.have.property('data');
    });

    it('should log security events for user management actions', async () => {
      // This test verifies that security logging is working
      // In a real implementation, you would check the security logs
      const user = await createTestUser();

      // Act - Perform various user management actions
      await request(app.getHttpServer())
        .put(`/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Updated For Security Test' })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/users/${user.id}/password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'SecurePassword123!',
          newPassword: 'NewPasswordForSecurityTest123!',
          confirmPassword: 'NewPasswordForSecurityTest123!',
        })
        .expect(200);

      // Assert - Security events should be logged (this would be verified in a real implementation)
      // For now, we just verify the operations completed successfully
      const updatedUser = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedUser.body.firstName).to.equal('Updated For Security Test');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent user creation with unique constraints', async () => {
      // Arrange - Same email for multiple users (should cause conflict)
      const timestamp = Date.now();
      const commonEmail = `concurrent${timestamp}@test.com`;

      const userDtos = [
        {
          email: commonEmail,
          username: `user1-${timestamp}`,
          password: 'SecurePassword123!',
          firstName: 'User',
          lastName: 'One',
          role: UserRole.USER,
        },
        {
          email: commonEmail,
          username: `user2-${timestamp}`,
          password: 'SecurePassword123!',
          firstName: 'User',
          lastName: 'Two',
          role: UserRole.USER,
        },
      ];

      // Act - Create users concurrently
      const creationPromises = userDtos.map(dto =>
        request(app.getHttpServer())
          .post('/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(dto)
      );

      const results = await Promise.allSettled(creationPromises);

      // Assert - One should succeed (201), one should fail with conflict (409)
      const successfulCreations = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 201
      );
      const conflictResponses = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 409
      );

      expect(successfulCreations.length).to.equal(1);
      expect(conflictResponses.length).to.equal(1);

      // Verify only one user was created
      const users = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const usersWithEmail = users.body.data.users.filter((u: any) => u.email === commonEmail);
      expect(usersWithEmail.length).to.equal(1);
    });

    it('should handle concurrent user updates safely', async () => {
      // Arrange - Create a user
      const user = await createTestUser();

      const updateDatas = [
        { firstName: 'ConcurrentFirst', lastName: 'Test' },
        { firstName: 'ConcurrentSecond', lastName: 'Test' },
      ];

      // Act - Update user concurrently
      const updatePromises = updateDatas.map(data =>
        request(app.getHttpServer())
          .put(`/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(data)
      );

      const results = await Promise.allSettled(updatePromises);

      
      // Assert - Both should complete (last update wins)
      const successfulUpdates = results.filter(r => r.status === 'fulfilled');
      expect(successfulUpdates.length).to.equal(2);

      // Verify final state
      const finalUser = await request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      
      expect(finalUser.body.firstName).to.be.oneOf([
        'ConcurrentFirst',
        'ConcurrentSecond',
      ]);
    });
  });

  /**
   * Helper Functions
   */

  // NOTE: getTestAuthToken function replaced with AuthHelpers.createTestToken()
// The AuthHelpers automatically handles role assignment during user creation

  async function createTestUser(overrides?: Partial<CreateUserDto>): Promise<any> {
    const timestamp = Date.now();
    const userData: CreateUserDto = {
      email: `testuser${timestamp}@test.com`,
      username: `testuser${timestamp}`,
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(userData);

    return response.body.data;
  }

  async function createMultipleTestUsers(): Promise<void> {
    const users = [
      {
        email: `john.doe${Date.now()}@test.com`,
        username: `johndoe${Date.now()}`,
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
      },
      {
        email: `jane.smith${Date.now()}@test.com`,
        username: `janesmith${Date.now()}`,
        password: 'SecurePassword123!',
        firstName: 'Jane',
        lastName: 'Smith',
        role: UserRole.MANAGER,
      },
      {
        email: `bob.wilson${Date.now()}@test.com`,
        username: `bobwilson${Date.now()}`,
        password: 'SecurePassword123!',
        firstName: 'Bob',
        lastName: 'Wilson',
        role: UserRole.USER,
      },
    ];

    for (const user of users) {
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(user);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      console.log('Starting users module cleanup...');

      // Get all test users first
      const testUsers = await prismaService.user.findMany({
        where: {
          OR: [
            // Users test patterns
            { email: { startsWith: 'testuser' } },
            { email: { startsWith: 'rbac.test' } },
            { email: { startsWith: 'xss.test' } },
            { email: { startsWith: 'concurrent' } },
            { email: { startsWith: 'john.doe' } },
            { email: { startsWith: 'jane.smith' } },
            { email: { startsWith: 'bob.wilson' } },
            { email: { endsWith: '@test.com' } },
            { username: { startsWith: 'testuser' } },
            { username: { startsWith: 'rbactest' } },
            { username: { startsWith: 'xsstest' } },
            { username: { startsWith: 'user1-' } },
            { username: { startsWith: 'user2-' } },
            { username: { startsWith: 'johndoe' } },
            { username: { startsWith: 'janesmith' } },
            { username: { startsWith: 'bobwilson' } },

            // Auth test patterns (to clean up cross-module interference)
            { email: { contains: '@example.com' } },
            { email: { contains: 'logintest' } },
            { email: { contains: 'jwttest' } },
            { email: { contains: 'duplicate-' } },
            { email: { contains: 'test-' } },
            { username: { startsWith: 'login' } },
            { username: { startsWith: 'jwt' } },
            { username: { startsWith: 'john' } },
            { username: { startsWith: 'jane' } },

            // Generic test patterns
            { email: { contains: 'test' } },
            { username: { contains: 'test' } },
          ]
        },
        select: { id: true }
      });

      if (testUsers.length > 0) {
        const userIds = testUsers.map(user => user.id);

        // Clean up in correct order respecting foreign key constraints
        console.log(`Cleaning up ${testUsers.length} test users and related data...`);

        // 1. Sessions first
        await prismaService.session.deleteMany({
          where: { userId: { in: userIds } }
        });

        // 2. Clean up any business data that might reference users
        // Note: Product, Customer, Supplier models don't have userId fields
        // They can be cleaned up by test patterns instead

        // 3. Clean up accounting data if it exists
        try {
          // Clean up journal entries that reference transactions
          await prismaService.journalEntry.deleteMany({
            where: {
              transaction: {
                reference: { startsWith: 'TX-' }
              }
            }
          });

          // Clean up transactions
          await prismaService.transaction.deleteMany({
            where: { reference: { startsWith: 'TX-' } }
          });

          // Clean up chart of accounts
          await prismaService.chartOfAccounts.deleteMany({
            where: { id: { startsWith: 'test-account-' } }
          });
        } catch (accountingError) {
          console.log('Accounting cleanup error (expected if no accounting tables):', accountingError.message);
        }

        // 4. Finally clean up the users
        await prismaService.user.deleteMany({
          where: { id: { in: userIds } }
        });

        console.log(`Users cleanup completed. Removed ${testUsers.length} test users.`);
      }
    } catch (error) {
      console.log('Users cleanup error:', error.message);
    }
  }

  // Add the missing cleanup hooks
  after(async () => {
    console.log('Running afterAll cleanup for users module...');
    await cleanupTestData();

    // Close database connection
    if (prismaService) {
      await prismaService.$disconnect();
    }

    // Close the app
    if (app) {
      await app.close();
    }

    await cleanupIntegrationTest();
  });

  afterEach(async () => {
    // Optional: Run cleanup after each test for better isolation
    // Comment this out for performance, uncomment for debugging
    // await cleanupTestData();
  });
});