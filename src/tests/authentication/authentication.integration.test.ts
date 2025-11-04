import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { AuthHelpers } from '../../shared/testing/auth-helpers';
import { IntegrationTestHelpers } from '../../shared/testing/integration-setup';

describe('Authentication Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;

  // Test data
  let testUsers: any[] = [];
  let adminToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    userToken = testSetup.getTestToken('user');
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  beforeEach(async () => {
    // Create test users for authentication testing
    testUsers = [];
    const testUserData = [
      {
        email: 'auth-test-1@example.com',
        username: 'authtest1',
        firstName: 'Auth',
        lastName: 'Test One',
        password: 'AuthTest123!',
        role: 'USER'
      },
      {
        email: 'auth-test-2@example.com',
        username: 'authtest2',
        firstName: 'Auth',
        lastName: 'Test Two',
        password: 'AuthTest123!',
        role: 'MANAGER'
      }
    ];

    for (const userData of testUserData) {
      try {
        // Register user
        await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(userData)
          .expect(201);

        testUsers.push(userData);
      } catch (error) {
        // User might already exist, continue
        testUsers.push(userData);
      }
    }
  });

  afterEach(async () => {
    // Clean up test users
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('User Registration', () => {
    describe('POST /auth/register', () => {
      it('should register a new user successfully', async () => {
        const newUser = {
          email: 'newuser@example.com',
          username: 'newuser123',
          firstName: 'New',
          lastName: 'User',
          password: 'NewUser123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(newUser)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('user');
        expect(response.body.data.user).to.have.property('id');
        expect(response.body.data.user.email).to.equal(newUser.email);
        expect(response.body.data.user.username).to.equal(newUser.username);
        expect(response.body.data.user).to.have.property('isActive', true);
        expect(response.body.data.user).to.not.have.property('password'); // Password should not be returned
        expect(response.body).to.have.property('correlationId');
      });

      it('should reject registration with invalid email', async () => {
        const invalidUser = {
          email: 'invalid-email',
          username: 'invaliduser',
          firstName: 'Invalid',
          lastName: 'User',
          password: 'InvalidUser123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(invalidUser)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('email');
      });

      it('should reject registration with weak password', async () => {
        const weakPasswordUser = {
          email: 'weak@example.com',
          username: 'weakuser',
          firstName: 'Weak',
          lastName: 'Password',
          password: '123' // Too weak
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(weakPasswordUser)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('password');
      });

      it('should reject registration with duplicate email', async () => {
        const duplicateUser = {
          email: testUsers[0].email, // Already exists
          username: 'differentuser',
          firstName: 'Duplicate',
          lastName: 'User',
          password: 'DuplicateUser123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(duplicateUser)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('already exists');
      });

      it('should reject registration with duplicate username', async () => {
        const duplicateUser = {
          email: 'different@example.com',
          username: testUsers[0].username, // Already exists
          firstName: 'Duplicate',
          lastName: 'Username',
          password: 'DuplicateUser123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(duplicateUser)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('already exists');
      });

      it('should validate required fields', async () => {
        const incompleteUser = {
          email: 'incomplete@example.com'
          // Missing required fields
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send(incompleteUser)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('required');
      });
    });
  });

  describe('User Login', () => {
    describe('POST /auth/login', () => {
      it('should login with valid credentials', async () => {
        const loginData = {
          email: testUsers[0].email,
          password: testUsers[0].password
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('user');
        expect(response.body.data).to.have.property('accessToken');
        expect(response.body.data).to.have.property('refreshToken');
        expect(response.body.data.user).to.have.property('id');
        expect(response.body.data.user.email).to.equal(loginData.email);
        expect(response.body.data.user).to.not.have.property('password');
        expect(response.body).to.have.property('correlationId');
      });

      it('should reject login with invalid email', async () => {
        const invalidLogin = {
          email: 'nonexistent@example.com',
          password: 'Password123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(invalidLogin)
          .expect(401);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('invalid');
      });

      it('should reject login with invalid password', async () => {
        const invalidLogin = {
          email: testUsers[0].email,
          password: 'wrongpassword'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(invalidLogin)
          .expect(401);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('invalid');
      });

      it('should validate required login fields', async () => {
        const incompleteLogin = {
          email: testUsers[0].email
          // Missing password
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(incompleteLogin)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('required');
      });

      it('should handle case-insensitive email login', async () => {
        const loginData = {
          email: testUsers[0].email.toUpperCase(), // Uppercase email
          password: testUsers[0].password
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.user.email).to.equal(testUsers[0].email.toLowerCase());
      });
    });
  });

  describe('Token Management', () => {
    let testUserToken: string;
    let testUserRefreshToken: string;

    beforeEach(async () => {
      // Login to get tokens
      const loginResponse = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUsers[0].email,
          password: testUsers[0].password
        });

      testUserToken = loginResponse.body.data.accessToken;
      testUserRefreshToken = loginResponse.body.data.refreshToken;
    });

    describe('POST /auth/refresh', () => {
      it('should refresh access token with valid refresh token', async () => {
        const refreshData = {
          refreshToken: testUserRefreshToken
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send(refreshData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('accessToken');
        expect(response.body.data).to.have.property('refreshToken');
        expect(response.body.data.accessToken).to.not.equal(testUserToken); // Should be different
        expect(response.body).to.have.property('correlationId');
      });

      it('should reject refresh with invalid refresh token', async () => {
        const invalidRefresh = {
          refreshToken: 'invalid-refresh-token'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send(invalidRefresh)
          .expect(401);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('invalid');
      });

      it('should reject refresh with expired refresh token', async () => {
        // This test would require creating an expired token
        // For now, test with malformed token
        const expiredRefresh = {
          refreshToken: 'expired-or-malformed-token'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/refresh')
          .send(expiredRefresh)
          .expect(401);

        expect(response.body).to.have.property('success', false);
      });
    });

    describe('POST /auth/logout', () => {
      it('should logout successfully with valid token', async () => {
        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${testUserToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('logged out');

        // Token should be invalidated and cannot be used again
        await request(testSetup.getHttpServer())
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${testUserToken}`)
          .expect(401);
      });

      it('should reject logout without token', async () => {
        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/logout')
          .expect(401);

        expect(response.body).to.have.property('success', false);
      });

      it('should reject logout with invalid token', async () => {
        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/logout')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).to.have.property('success', false);
      });
    });
  });

  describe('Password Management', () => {
    let testUserToken: string;

    beforeEach(async () => {
      // Login to get token
      const loginResponse = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUsers[0].email,
          password: testUsers[0].password
        });

      testUserToken = loginResponse.body.data.accessToken;
    });

    describe('POST /auth/change-password', () => {
      it('should change password with valid current password', async () => {
        const passwordChange = {
          currentPassword: testUsers[0].password,
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(passwordChange)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('changed successfully');

        // Should be able to login with new password
        const newLoginResponse = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: testUsers[0].email,
            password: passwordChange.newPassword
          })
          .expect(200);

        expect(newLoginResponse.body).to.have.property('success', true);
      });

      it('should reject password change with invalid current password', async () => {
        const passwordChange = {
          currentPassword: 'wrongpassword',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(passwordChange)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('current password');
      });

      it('should reject password change with mismatched confirmation', async () => {
        const passwordChange = {
          currentPassword: testUsers[0].password,
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(passwordChange)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('passwords do not match');
      });

      it('should reject password change with weak new password', async () => {
        const passwordChange = {
          currentPassword: testUsers[0].password,
          newPassword: '123', // Too weak
          confirmPassword: '123'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/change-password')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(passwordChange)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('password');
      });
    });

    describe('POST /auth/forgot-password', () => {
      it('should initiate password reset for valid email', async () => {
        const forgotPasswordData = {
          email: testUsers[0].email
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send(forgotPasswordData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.message).to.include('reset link sent');
        // Should not reveal if email exists or not for security
      });

      it('should handle password reset for non-existent email', async () => {
        const forgotPasswordData = {
          email: 'nonexistent@example.com'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send(forgotPasswordData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        // Should still return success for security (don't reveal email existence)
      });

      it('should validate email format for password reset', async () => {
        const forgotPasswordData = {
          email: 'invalid-email'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send(forgotPasswordData)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('email');
      });
    });
  });

  describe('JWT Token Validation', () => {
    it('should validate JWT token format', async () => {
      const token = adminToken;
      const isValid = AuthHelpers.validateTokenFormat(token);
      expect(isValid).to.be.true;
    });

    it('should reject malformed JWT tokens', async () => {
      const malformedToken = 'not.a.valid.jwt.token';
      const isValid = AuthHelpers.validateTokenFormat(malformedToken);
      expect(isValid).to.be.false;
    });

    it('should extract token payload correctly', async () => {
      const payload = AuthHelpers.decodeToken(adminToken);
      expect(payload).to.have.property('sub');
      expect(payload).to.have.property('email');
      expect(payload).to.have.property('role');
      expect(payload).to.have.property('firstName');
      expect(payload).to.have.property('lastName');
      expect(payload).to.have.property('username');
    });

    it('should handle token decoding errors gracefully', async () => {
      try {
        AuthHelpers.decodeToken('invalid.token.here');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Failed to decode token');
      }
    });
  });

  describe('Session Management', () => {
    it('should handle concurrent login sessions', async () => {
      const loginData = {
        email: testUsers[1].email,
        password: testUsers[1].password
      };

      // Create multiple concurrent login sessions
      const loginPromises = Array(3).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(loginData)
          .expect(200)
      );

      const responses = await Promise.all(loginPromises);

      // All logins should succeed
      responses.forEach(response => {
        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('accessToken');
        expect(response.body.data).to.have.property('refreshToken');
      });

      // All tokens should be different
      const tokens = responses.map(r => r.body.data.accessToken);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).to.equal(tokens.length);
    });

    it('should invalidate all tokens on logout', async () => {
      // Login multiple times
      const loginData = {
        email: testUsers[0].email,
        password: testUsers[0].password
      };

      const loginResponse = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      const firstToken = loginResponse.body.data.accessToken;

      // Login again to get another token
      const secondLoginResponse = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      const secondToken = secondLoginResponse.body.data.accessToken;

      // Logout with second token
      await request(testSetup.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(200);

      // Both tokens should be invalidated
      await request(testSetup.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${firstToken}`)
        .expect(401);

      await request(testSetup.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(401);
    });
  });

  describe('Security Headers and OWASP Compliance', () => {
    it('should include security headers in responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUsers[0].email,
          password: testUsers[0].password
        })
        .expect(200);

      // Check for security headers
      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options', 'DENY');
      expect(response.headers).to.have.property('x-xss-protection', '1; mode=block');
      expect(response.headers).to.have.property('x-correlation-id');
    });

    it('should prevent brute force attacks with rate limiting', async () => {
      const invalidLogin = {
        email: testUsers[0].email,
        password: 'wrongpassword'
      };

      // Make multiple failed login attempts
      const promises = Array(10).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send(invalidLogin)
      );

      const responses = await Promise.all(promises);

      // Should eventually be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    });

    it('should sanitize error responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUsers[0].email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('correlationId');
      // Should not contain stack traces or internal details
      expect(response.body.message).to.not.include('sql');
      expect(response.body.message).to.not.include('bcrypt');
      expect(response.body.message).to.not.include('prisma');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to login requests within acceptable time', async () => {
      const { result, executionTime } = await IntegrationTestHelpers.measureExecutionTime(async () => {
        return await request(testSetup.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: testUsers[0].email,
            password: testUsers[0].password
          })
          .expect(200);
      });

      expect(executionTime).to.be.lessThan(2000); // Less than 2 seconds
      expect(result.body).to.have.property('success', true);
    });

    it('should handle concurrent registration requests', async () => {
      const concurrentRegistrations = Array(5).fill(null).map((_, index) =>
        request(testSetup.getHttpServer())
          .post('/api/v1/auth/register')
          .send({
            email: `concurrent${index}@test.com`,
            username: `concurrent${index}`,
            firstName: 'Concurrent',
            lastName: `User ${index}`,
            password: 'ConcurrentUser123!'
          })
      );

      const responses = await Promise.all(concurrentRegistrations);

      // All registrations should succeed
      responses.forEach((response, index) => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('success', true);
        expect(response.body.data.user.email).to.equal(`concurrent${index}@test.com`);
      });
    });
  });
});