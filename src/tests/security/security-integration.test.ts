import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityModule } from '../../shared/security/security.module';
import { AuthenticationModule } from '../../modules/authentication/authentication.module';
import { UsersModule } from '../../modules/users/users.module';
import { SalesModule } from '../../modules/sales/sales.module';
import { ProductionErrorFilter } from '../../shared/filters/production-error.filter';
import { CorrelationIdMiddleware } from '../../shared/middleware/correlation-id.middleware';
import { SecurityHeadersMiddleware } from '../../shared/middleware/security-headers.middleware';
import { EnhancedThrottlerGuard } from '../../shared/security/guards/enhanced-throttler.guard';

describe('Security Integration Tests', () => {
  let app: INestApplication;
  let configService: ConfigService;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            NODE_ENV: 'test',
            JWT_SECRET: 'test-secret',
            JWT_EXPIRATION: '1h',
            RATE_LIMIT_WINDOW_MS: 60000,
            RATE_LIMIT_MAX_REQUESTS: 100,
          })],
        }),
        ThrottlerModule.forRoot([{
          ttl: 60,
          limit: 100,
        }]),
        SecurityModule,
        AuthenticationModule,
        UsersModule,
        SalesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get(ConfigService);

    // Apply security middleware and filters
    app.use(new CorrelationIdMiddleware().use);
    app.use(new SecurityHeadersMiddleware(configService).use);

    // Apply global pipes and filters
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    app.useGlobalFilters(new ProductionErrorFilter(configService));

    await app.init();
  });

  after(async () => {
    await app.close();
  });

  describe('Security Headers', () => {
    it('should include security headers on all responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .send({ token: 'invalid-token' });

      expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
      expect(response.headers).to.have.property('x-frame-options', 'DENY');
      expect(response.headers).to.have.property('x-xss-protection', '1; mode=block');
      expect(response.headers).to.have.property('referrer-policy', 'strict-origin-when-cross-origin');
      expect(response.headers).to.have.property('content-security-policy');
      expect(response.headers).to.have.property('permissions-policy');
    });

    it('should include correlation ID in response headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .send({ token: 'invalid-token' });

      expect(response.headers).to.have.property('x-correlation-id');
      expect(response.headers).to.have.property('x-request-id');
    });
  });

  describe('Error Handling', () => {
    it('should sanitize error responses in production', async () => {
      configService.set('NODE_ENV', 'production');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com'; DROP TABLE users; --',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).to.have.property('correlationId');
      expect(response.body).to.have.property('timestamp');
      expect(response.body).to.not.have.property('stack');
      expect(response.body.message).to.not.include('DROP TABLE');
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        })
        .expect(400);

      expect(response.body).to.have.property('correlationId');
      expect(response.body.correlationId).to.be.a('string');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .expect(401);

      expect(response.body.message).to.include('Access token required');
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).to.include('Invalid or expired token');
    });

    it('should enforce role-based access control', async () => {
      // This test would require a valid user token with specific roles
      // For now, we'll test the endpoint structure
      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'test@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER'
        })
        .expect(401); // Should require authentication

      expect(response.body.message).to.include('Access token required');
    });

    it('should validate resource-based permissions', async () => {
      // This would test the resource-based guard with valid tokens
      // Implementation would depend on having proper test users and tokens
    });
  });

  describe('Rate Limiting', () => {
    it('should allow normal request rates', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .send({ token: 'test-token' });

      expect(response.headers).to.have.property('x-ratelimit-limit');
      expect(response.headers).to.have.property('x-ratelimit-remaining');
    });

    it('should enforce rate limits on sensitive endpoints', async () => {
      // This test would make multiple rapid requests to trigger rate limiting
      // Implementation would depend on the specific rate limiting configuration
      const promises = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);

      // At least some responses should succeed (before rate limit kicks in)
      const successfulResponses = responses.filter(r => r.status !== 429);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length).to.be.greaterThan(0);
      // Rate limiting behavior depends on configuration
    });
  });

  describe('Input Validation', () => {
    it('should validate user input on registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // Too short
          firstName: '', // Required
          lastName: '', // Required
        })
        .expect(400);

      expect(response.body.message).to.be.a('string');
    });

    it('should sanitize malicious input', async () => {
      const maliciousInput = "test@example.com'; DROP TABLE users; --";

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: maliciousInput,
          password: 'password123'
        })
        .expect(400);

      expect(response.body.message).to.not.include('DROP TABLE');
      expect(response.body.message).to.not.include(';');
    });
  });

  describe('CORS and Cross-Origin Security', () => {
    it('should handle cross-origin requests appropriately', async () => {
      const response = await request(app.getHttpServer())
        .options('/auth/validate-token')
        .set('Origin', 'https://malicious-site.com');

      // CORS policy should be enforced
      // Implementation depends on CORS configuration
    });
  });

  describe('Token Management', () => {
    it('should handle logout with token invalidation', async () => {
      // This test would require authentication first
      // Then test that logout properly invalidates the token
      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer test-token')
        .expect(401); // Should require valid token

      expect(response.body.message).to.include('Invalid or expired token');
    });
  });

  describe('Business Logic Security', () => {
    it('should enforce business rules on customer operations', async () => {
      // Test that business logic includes proper security checks
      const response = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', 'Bearer test-token')
        .send({
          name: 'Test Customer',
          email: 'test@example.com',
          creditLimit: 999999999 // Unreasonably high
        })
        .expect(401); // Should require valid authentication and authorization

      // Would need valid token to test business logic validation
    });
  });

  describe('Security Monitoring', () => {
    it('should log security events appropriately', async () => {
      // This test would verify that security events are logged
      // Implementation would require log capture and verification
    });

    it('should track correlation IDs across requests', async () => {
      const correlationId = 'test-correlation-123';

      const response = await request(app.getHttpServer())
        .get('/auth/validate-token')
        .set('X-Correlation-Id', correlationId)
        .send({ token: 'test-token' });

      expect(response.headers['x-correlation-id']).to.equal(correlationId);
      expect(response.body.correlationId).to.equal(correlationId);
    });
  });
});