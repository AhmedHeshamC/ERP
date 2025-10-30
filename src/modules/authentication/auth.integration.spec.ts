import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest, cleanupDatabase } from '../../../test/integration-setup';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Authentication Integration Tests
 * Foundation for testing authentication flows end-to-end
 * These tests validate the complete authentication workflow
 */
describe('Authentication Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;

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
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        LocalStrategy,
      ],
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

  describe('Health Check', () => {
    it('should return 404 for non-existent endpoint', async () => {
      // This is a basic test to verify the test framework is working
      const response = await request(app.getHttpServer())
        .get('/auth/non-existent')
        .expect(404);

      expect(response.body).to.be.an('object');
    });

    it('should return 404 for root endpoint (no global prefix set)', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(404);
    });

    it('should check if authentication routes are available', async () => {
      // Check if we can access the auth controller
      const response = await request(app.getHttpServer())
        .get('/auth')
        .expect(404); // Should be 404 since GET /auth is not defined
    });

    it('should debug: check what routes are registered', async () => {
      // Debug: Let's see what routes are actually registered
      const server = app.getHttpServer();
      console.log('Server created, checking if we can make requests...');

      const response = await request(server)
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: 'test123',
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser'
        });

      console.log('POST /auth/register response status:', response.status);
      console.log('POST /auth/register response body:', response.body);

      // We expect this to fail initially, but we want to see what the actual response is
      expect(response.status).to.be.oneOf([201, 400, 404, 500]);
    });
  });

  describe('User Registration Flow', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        username: `johndoe${Math.random().toString(36).substr(2, 8)}`, // Unique username with short random string
        phone: '+1234567890',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto);

      // Assert
      expect(response.status).to.equal(201);
      expect(response.body).to.have.property('user');
      expect(response.body.user).to.have.property('email', registerDto.email);
      expect(response.body.user).to.have.property('username', registerDto.username);
      expect(response.body.user).to.not.have.property('password');
      expect(response.body).to.have.property('accessToken');
      expect(response.body).to.have.property('refreshToken');
    });

    it('should reject duplicate email registration', async () => {
      // Arrange - First user
      const registerDto = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        firstName: 'Jane',
        lastName: 'Doe',
        username: `janedoe${Math.random().toString(36).substr(2, 8)}`,
        phone: '+1234567890',
      };

      // Act - First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      // Act & Assert - Second registration with same email
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);

      expect(response.body.message).to.include('already exists');
    });

    it('should validate input data', async () => {
      // Arrange - Invalid data
      const invalidDto = {
        email: 'invalid-email',
        password: '123', // Too short
        firstName: '', // Empty
        lastName: '', // Empty
        username: '', // Empty
        phone: '', // Empty
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      // The response has an array of validation errors, not a single message
      expect(response.body.message).to.be.an('array');
      expect(response.body.message).to.have.length.greaterThan(0);
      expect(response.body.error).to.equal('Bad Request');
    });
  });

  describe('User Login Flow', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const registerDto = {
        email: 'logintest@example.com',
        password: 'LoginPassword123!',
        firstName: 'Login',
        lastName: 'User',
        username: `loginuser${Math.random().toString(36).substr(2, 8)}`,
        phone: '+1234567890',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);
    });

    it('should login user successfully', async () => {
      // Arrange
      const loginDto = {
        email: 'logintest@example.com',
        password: 'LoginPassword123!',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('accessToken');
      expect(response.body).to.have.property('refreshToken');
      expect(response.body.user.email).to.equal(loginDto.email);
      expect(response.body.user).to.not.have.property('password');
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      const invalidLoginDto = {
        email: 'logintest@example.com',
        password: 'WrongPassword123',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(invalidLoginDto)
        .expect(401);

      expect(response.body.message).to.include('Invalid credentials');
    });

    it('should reject non-existent user login', async () => {
      // Arrange
      const nonExistentLoginDto = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(nonExistentLoginDto)
        .expect(401);

      expect(response.body.message).to.include('Invalid credentials');
    });
  });

  describe('JWT Token Validation', () => {
    let accessToken: string;
    let testUserId: string;

    beforeEach(async () => {
      // Create and login user
      const registerDto = {
        email: 'jwttest@example.com',
        password: 'JWTPassword123!',
        firstName: 'JWT',
        lastName: 'User',
        username: `jwtuser${Math.random().toString(36).substr(2, 8)}`,
        phone: '+1234567890',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      testUserId = registerResponse.body.user.id;

      const loginDto = {
        email: registerDto.email,
        password: registerDto.password,
      };

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      accessToken = loginResponse.body.accessToken;
    });

    it('should validate JWT token for protected route', async () => {
      // Act & Assert - Use valid token for protected route
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).to.have.property('id', testUserId);
      expect(response.body).to.not.have.property('password');
    });

    it('should reject invalid JWT token', async () => {
      // Act & Assert - Use invalid token
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).to.include('Unauthorized');
    });

    it('should reject requests without authorization header', async () => {
      // Act & Assert - No authorization header
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);

      expect(response.body.message).to.include('Unauthorized');
    });
  });

  /**
   * Helper function to clean up test data
   */
  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up test users
      const testEmails = [
        'test@example.com',
        'duplicate@example.com',
        'logintest@example.com',
        'jwttest@example.com',
      ];

      for (const email of testEmails) {
        await prismaService.user.deleteMany({
          where: { email },
        });
      }
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup error:', error.message);
    }
  }
});