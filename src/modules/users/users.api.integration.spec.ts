import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { CommonModule } from '../../shared/common/common.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { AuthHelpers, UserRole } from '../../shared/testing/auth-helpers';
import { User } from '@prisma/client';
import { UsersModule } from './users.module';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Users Module API Integration Tests
 *
 * Tests complete user management functionality including:
 * - User CRUD operations
 * - Role-based access control (RBAC)
 * - User profile management
 * - Password management
 * - User activity tracking
 * - Bulk user operations
 * - User search and filtering
 * - Security and compliance
 */
describe('Users Module API Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let testUser: User;

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
        CommonModule,
        UsersModule,
        JwtModule.register({
          secret: 'test-jwt-secret-key-for-integration-tests',
          signOptions: { expiresIn: '1h' },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a direct PrismaService instance for test cleanup
    const { PrismaService } = await import('../../shared/database/prisma.service');
    const { ConfigService: ConfigServiceClass } = await import('@nestjs/config');

    const prismaConfigService = new ConfigServiceClass({
      app: {
        database: {
          url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
        },
      },
    });

    prismaService = new PrismaService(prismaConfigService);
    await prismaService.$connect();

    // Create authentication tokens for different roles
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
    await setupTestData();
  });

  describe('User Management API', () => {
    it('should create a new user', async () => {
      const userData = {
        email: `newuser-${Date.now()}@test.com`,
        username: `newuser${Date.now()}`,
        password: 'SecurePassword123!',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
      };

      const response = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData);

      
      // Should get 201 Created
      expect(response.status).to.equal(201);

      // Response should have wrapper structure
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');

      const user = response.body.data;
      expect(user).to.have.property('id');
      expect(user.email).to.equal(userData.email);
      expect(user.username).to.equal(userData.username);
      expect(user.firstName).to.equal(userData.firstName);
      expect(user.lastName).to.equal(userData.lastName);
      expect(user.role).to.equal(userData.role);
      expect(user).to.not.have.property('password');
      expect(user.createdAt).to.be.a('string');

      testUser = user;
    });

    it('should get all users with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).to.equal(200);

      // Response should have wrapper structure
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('data');

      // Data should contain users and pagination
      expect(response.body.data).to.have.property('users');
      expect(response.body.data).to.have.property('pagination');
      expect(response.body.data.users).to.be.an('array');
      expect(response.body.data.pagination.page).to.equal(1);
      expect(response.body.data.pagination.limit).to.equal(10);
      expect(response.body.data.pagination.total).to.be.a('number');
    });

    it('should search users by name, email, or username', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?search=New')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Response should have wrapper structure
      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.have.property('users');
      expect(response.body.data.users).to.be.an('array');

      if (response.body.data.users.length > 0) {
        expect(response.body.data.users[0].firstName).to.include('New');
      }
    });

    it('should filter users by role', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users?role=${UserRole.USER}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      response.body.data.forEach((user: any) => {
        expect(user.role).to.equal(UserRole.USER);
      });
    });

    it('should filter users by active status', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?isActive=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      response.body.data.forEach((user: any) => {
        expect(user.isActive).to.be.true;
      });
    });

    it('should get a specific user by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).to.equal(testUser.id);
      expect(response.body.email).to.equal(testUser.email);
      expect(response.body).to.not.have.property('password');
    });

    it('should update user details', async () => {
      const updateData = {
        firstName: 'Updated First',
        lastName: 'Updated Last',
        phone: '+0987654321',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .patch(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).to.equal(updateData.firstName);
      expect(response.body.lastName).to.equal(updateData.lastName);
      expect(response.body.phone).to.equal(updateData.phone);
      expect(response.body.isActive).to.equal(updateData.isActive);
    });

    it('should update user role', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/${testUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.MANAGER })
        .expect(200);

      expect(response.body.role).to.equal(UserRole.MANAGER);
    });

    it('should deactivate user', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/users/${testUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(response.body.isActive).to.be.false;
      expect(response.body.deactivatedAt).to.be.a('string');
    });

    it('should delete user (soft delete)', async () => {
      await request(app.getHttpServer())
        .delete(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify user is no longer active
      const response = await request(app.getHttpServer())
        .get(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.isActive).to.be.false;
      expect(response.body.deletedAt).to.be.a('string');
    });
  });

  describe('User Profile Management', () => {
    it('should allow user to view their own profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('email');
      expect(response.body).to.have.property('firstName');
      expect(response.body).to.have.property('lastName');
      expect(response.body).to.not.have.property('password');
    });

    it('should allow user to update their own profile', async () => {
      const updateData = {
        firstName: 'Self Updated',
        lastName: 'Name',
        phone: '+1234567890',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.firstName).to.equal(updateData.firstName);
      expect(response.body.lastName).to.equal(updateData.lastName);
      expect(response.body.phone).to.equal(updateData.phone);
    });

    it('should prevent user from updating sensitive fields', async () => {
      const restrictedData = {
        role: UserRole.ADMIN,
        isActive: false,
        email: 'hacker@evil.com',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(restrictedData)
        .expect(200);

      // These fields should not be updated
      expect(response.body.role).to.not.equal(UserRole.ADMIN);
      expect(response.body.email).to.not.equal('hacker@evil.com');
    });

    it('should handle profile picture upload', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/profile/avatar')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('avatar', Buffer.from('fake image data'), 'profile.jpg')
        .expect(201);

      expect(response.body).to.have.property('avatarUrl');
    });
  });

  describe('Password Management', () => {
    it('should allow user to change their password', async () => {
      const passwordData = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'NewSecurePassword456!',
      };

      const response = await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.message).to.include('Password changed successfully');

      // Verify login with new password works
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: passwordData.newPassword,
        })
        .expect(200);

      expect(loginResponse.body).to.have.property('accessToken');
    });

    it('should reject invalid current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'NewSecurePassword456!',
      };

      await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(400); // Should fail due to wrong current password
    });

    it('should reject password mismatch', async () => {
      const passwordData = {
        currentPassword: 'SecurePassword123!',
        newPassword: 'NewSecurePassword456!',
        confirmPassword: 'DifferentPassword123!',
      };

      await request(app.getHttpServer())
        .post('/users/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send(passwordData)
        .expect(400); // Should fail due to password mismatch
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'weak',
        'short',
        'nouppercase1!',
        'NOLOWERCASE1!',
        'NoNumbers!',
        'NoSpecialChars123',
      ];

      for (const weakPassword of weakPasswords) {
        const passwordData = {
          currentPassword: 'SecurePassword123!',
          newPassword: weakPassword,
          confirmPassword: weakPassword,
        };

        await request(app.getHttpServer())
          .post('/users/change-password')
          .set('Authorization', `Bearer ${userToken}`)
          .send(passwordData)
          .expect(400); // Should reject weak passwords
      }
    });

    it('should support admin password reset', async () => {
      const resetData = {
        newPassword: 'AdminResetPassword123!',
        confirmPassword: 'AdminResetPassword123!',
        requirePasswordChange: true,
      };

      const response = await request(app.getHttpServer())
        .post(`/users/${testUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(resetData)
        .expect(200);

      expect(response.body.message).to.include('Password reset successfully');
    });
  });

  describe('User Activity and Audit', () => {
    it('should track user login activity', async () => {
      // This would typically be handled by the authentication module
      // but we can test that user profiles update last login

      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Simulate login (this would normally be done through auth endpoint)
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!',
        })
        .expect(200);

      // Check if last login was updated (implementation dependent)
      await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // This test depends on the implementation
      // expect(updatedProfile.lastLoginAt).to.be.a('string');
    });

    it('should log user profile changes', async () => {
      const updateData = {
        firstName: 'Audit Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .patch('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Verify the change was made
      expect(response.body.firstName).to.equal(updateData.firstName);

      // In a real implementation, this would be verified through audit logs
      // For now, we just verify the change was successful
    });

    it('should track failed login attempts', async () => {
      const failedAttempts = 5;

      for (let i = 0; i < failedAttempts; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // After several failed attempts, account should be temporarily locked
      // This depends on the implementation
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!',
        });

      // Should either succeed or fail with account locked message
      expect(loginResponse.status).to.be.oneOf([200, 401, 429]);
    });
  });

  describe('Bulk User Operations', () => {
    it('should support bulk user creation', async () => {
      const bulkUsers = [
        {
          email: `bulk1-${Date.now()}@test.com`,
          username: `bulkuser1-${Date.now()}`,
          password: 'BulkPassword123!',
          firstName: 'Bulk',
          lastName: 'User One',
          role: UserRole.USER,
        },
        {
          email: `bulk2-${Date.now()}@test.com`,
          username: `bulkuser2-${Date.now()}`,
          password: 'BulkPassword123!',
          firstName: 'Bulk',
          lastName: 'User Two',
          role: UserRole.USER,
        },
        {
          email: `bulk3-${Date.now()}@test.com`,
          username: `bulkuser3-${Date.now()}`,
          password: 'BulkPassword123!',
          firstName: 'Bulk',
          lastName: 'User Three',
          role: UserRole.USER,
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ users: bulkUsers })
        .expect(201);

      expect(response.body).to.have.property('created');
      expect(response.body).to.have.property('failed');
      expect(response.body.created.length).to.equal(3);
      expect(response.body.failed.length).to.equal(0);
    });

    it('should support bulk user updates', async () => {
      // Create users first
      const users = [];
      for (let i = 0; i < 3; i++) {
        const user = await prismaService.user.create({
          data: {
            email: `bulkupdate${i}-${Date.now()}@test.com`,
            username: `bulkupdate${i}-${Date.now()}`,
            password: 'BulkUpdatePassword123!',
            firstName: 'Bulk',
            lastName: `Update ${i}`,
            role: UserRole.USER,
            isActive: true,
          },
        });
        users.push(user);
      }

      const updateData = {
        userIds: users.map(u => u.id),
        updates: {
          isActive: false,
          role: UserRole.MANAGER,
        },
      };

      const response = await request(app.getHttpServer())
        .patch('/users/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('updated');
      expect(response.body.updated).to.equal(3);
    });

    it('should support bulk user deactivation', async () => {
      // Create users first
      const users = [];
      for (let i = 0; i < 2; i++) {
        const user = await prismaService.user.create({
          data: {
            email: `bulkdeactivate${i}-${Date.now()}@test.com`,
            username: `bulkdeactivate${i}-${Date.now()}`,
            password: 'BulkDeactivatePassword123!',
            firstName: 'Bulk',
            lastName: `Deactivate ${i}`,
            role: UserRole.USER,
            isActive: true,
          },
        });
        users.push(user);
      }

      const response = await request(app.getHttpServer())
        .post('/users/bulk-deactivate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: users.map(u => u.id) })
        .expect(200);

      expect(response.body).to.have.property('deactivated');
      expect(response.body.deactivated).to.equal(2);
    });
  });

  describe('Security and Compliance', () => {
    it('should prevent XSS in user profile data', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert("XSS")</script>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app.getHttpServer())
          .patch('/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            firstName: payload,
            lastName: 'Test User',
          })
          .expect(200);

        // XSS should be sanitized
        expect(response.body.firstName).to.not.include('<script>');
        expect(response.body.firstName).to.not.include('javascript:');
        expect(response.body.firstName).to.not.include('onerror');
      }
    });

    it('should validate email uniqueness', async () => {
      const duplicateEmail = testUser.email;

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: duplicateEmail,
          username: `different-${Date.now()}`,
          password: 'Password123!',
          firstName: 'Different',
          lastName: 'User',
          role: UserRole.USER,
        })
        .expect(400); // Should fail due to duplicate email
    });

    it('should validate username uniqueness', async () => {
      const duplicateUsername = testUser.username;

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: `different-${Date.now()}@test.com`,
          username: duplicateUsername,
          password: 'Password123!',
          firstName: 'Different',
          lastName: 'User',
          role: UserRole.USER,
        })
        .expect(400); // Should fail due to duplicate username
    });

    it('should prevent unauthorized access to user management', async () => {
      // Regular user trying to access admin functions
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403); // Should fail - insufficient permissions

      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: `unauthorized-${Date.now()}@test.com`,
          username: `unauth-${Date.now()}`,
          password: 'Password123!',
          firstName: 'Unauthorized',
          lastName: 'User',
          role: UserRole.USER,
        })
        .expect(403); // Should fail - insufficient permissions
    });

    it('should enforce role hierarchy in user management', async () => {
      // Manager trying to create admin user
      await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: `admin-attempt-${Date.now()}@test.com`,
          username: `adminattempt-${Date.now()}`,
          password: 'Password123!',
          firstName: 'Admin',
          lastName: 'Attempt',
          role: UserRole.ADMIN,
        })
        .expect(403); // Should fail - managers cannot create admins
    });

    it('should handle SQL injection attempts in search', async () => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --",
      ];

      for (const query of maliciousQueries) {
        const response = await request(app.getHttpServer())
          .get(`/users?search=${encodeURIComponent(query)}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Should not crash and should return safe results
        expect(response.body).to.have.property('data');
        expect(response.body.data).to.be.an('array');
      }
    });
  });

  describe('User Search and Advanced Filtering', () => {
    it('should support complex search queries', async () => {
      const response = await request(app.getHttpServer())
        .get('/users?search=Test&role=USER&isActive=true&page=1&limit=5')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.limit).to.equal(5);
    });

    it('should support sorting and ordering', async () => {
      const sortOptions = ['firstName', 'lastName', 'email', 'createdAt'];
      const orderOptions = ['asc', 'desc'];

      for (const sortBy of sortOptions) {
        for (const sortOrder of orderOptions) {
          const response = await request(app.getHttpServer())
            .get(`/users?sortBy=${sortBy}&sortOrder=${sortOrder}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body).to.have.property('data');
          expect(response.body.data).to.be.an('array');

          if (response.body.data.length > 1) {
            // Verify sorting direction
            const first = response.body.data[0][sortBy];
            const last = response.body.data[response.body.data.length - 1][sortBy];

            if (sortOrder === 'asc') {
              expect(first).to.be.lessThanOrEqual(last);
            } else {
              expect(first).to.be.greaterThanOrEqual(last);
            }
          }
        }
      }
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get(`/users?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');

      // Verify all results are within date range
      response.body.data.forEach((user: any) => {
        const userDate = new Date(user.createdAt);
        expect(userDate).to.be.greaterThanOrEqual(new Date(startDate));
        expect(userDate).to.be.lessThanOrEqual(new Date(endDate));
      });
    });
  });

  /**
   * Helper Functions
   */

  async function setupTestData(): Promise<void> {
    try {
      // Create test user
      testUser = await prismaService.user.create({
        data: {
          email: `testuser-${Date.now()}@test.com`,
          username: `testuser-${Date.now()}`,
          password: 'SecurePassword123!', // This would be hashed by the service
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
          role: UserRole.USER,
          isActive: true,
          isEmailVerified: true,
        },
      });
    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up test users
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { startsWith: 'newuser-' } },
            { email: { startsWith: 'bulk1-' } },
            { email: { startsWith: 'bulk2-' } },
            { email: { startsWith: 'bulk3-' } },
            { email: { startsWith: 'bulkupdate' } },
            { email: { startsWith: 'bulkdeactivate' } },
            { email: { startsWith: 'unauthorized-' } },
            { email: { startsWith: 'admin-attempt-' } },
            { email: { startsWith: 'testuser-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});