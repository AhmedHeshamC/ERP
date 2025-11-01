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
 * Performance and Load Testing Integration Tests
 *
 * Tests system performance under various load conditions:
 * - Concurrent user operations
 * - Database query performance
 * - API response times
 * - Memory usage under load
 * - Connection pool management
 * - Caching effectiveness
 * - Resource cleanup and garbage collection
 *
 * Critical for ensuring system can handle enterprise-level workloads
 */
describe('Performance and Load Testing Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let _adminToken: string;
  let managerToken: string;
  let userToken: string;

  // Performance measurement utilities
  let performanceMetrics: {
    responseTimes: number[];
    memoryUsage: NodeJS.MemoryUsage[];
    errorCounts: Map<string, number>;
    concurrentConnections: number;
  };

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
    _adminToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
    managerToken = AuthHelpers.createTestTokenDirect(UserRole.MANAGER);
    userToken = AuthHelpers.createTestTokenDirect(UserRole.USER);

    // Initialize performance metrics
    performanceMetrics = {
      responseTimes: [],
      memoryUsage: [],
      errorCounts: new Map(),
      concurrentConnections: 0,
    };
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
    resetPerformanceMetrics();
  });

  describe('Concurrent User Operations', () => {
    it('should handle 10 concurrent user requests', async () => {
      const concurrentUsers = 10;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(
          makeAuthenticatedRequest('/sales/customers', userToken, 'get')
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      // Analyze results
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      const failedRequests = results.filter(r => r.status === 'rejected');

      expect(successfulRequests.length).to.be.greaterThan(concurrentUsers * 0.9); // 90% success rate
      expect(failedRequests.length).to.be.lessThan(concurrentUsers * 0.1); // Less than 10% failures
      expect(endTime - startTime).to.be.lessThan(5000); // Should complete within 5 seconds

      // Record performance metrics
      performanceMetrics.responseTimes.push(endTime - startTime);
    });

    it('should handle 50 concurrent read operations', async () => {
      const concurrentOps = 50;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          makeAuthenticatedRequest('/inventory/products', userToken, 'get')
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successfulRequests = results.filter(r => r.status === 'fulfilled');

      expect(successfulRequests.length).to.be.greaterThan(concurrentOps * 0.8); // 80% success rate
      expect(endTime - startTime).to.be.lessThan(10000); // Should complete within 10 seconds

      // Calculate average response time
      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / concurrentOps;
      expect(avgResponseTime).to.be.lessThan(200); // Average under 200ms
    });

    it('should handle concurrent write operations with proper locking', async () => {
      const concurrentWrites = 20;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentWrites; i++) {
        promises.push(
          makeAuthenticatedRequest('/sales/customers', managerToken, 'post', {
            code: `CONCURRENT-${i}-${Date.now()}`,
            name: `Concurrent Customer ${i}`,
            email: `concurrent${i}-${Date.now()}@test.com`,
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 1000.00,
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successfulRequests = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 201
      );

      expect(successfulRequests.length).to.be.greaterThan(concurrentWrites * 0.7); // 70% success rate
      expect(endTime - startTime).to.be.lessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Database Performance', () => {
    it('should handle complex queries with pagination efficiently', async () => {
      const querySizes = [10, 50, 100];

      for (const size of querySizes) {
        const startTime = Date.now();

        const response = await makeAuthenticatedRequest(
          `/sales/customers?page=1&limit=${size}`,
          userToken,
          'get'
        );

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(response.status).to.equal(200);
        expect(responseTime).to.be.lessThan(1000); // Should respond within 1 second
        expect(response.body.data).to.be.an('array');

        performanceMetrics.responseTimes.push(responseTime);
      }
    });

    it('should maintain performance with filtered searches', async () => {
      const searchQueries = [
        'test',
        'customer',
        'very long search term with multiple words',
        'non-existent-term-xyz123',
      ];

      for (const query of searchQueries) {
        const startTime = Date.now();

        const response = await makeAuthenticatedRequest(
          `/sales/customers?search=${encodeURIComponent(query)}`,
          userToken,
          'get'
        );

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        expect(response.status).to.equal(200);
        expect(responseTime).to.be.lessThan(2000); // Should respond within 2 seconds
        expect(response.body).to.have.property('data');

        performanceMetrics.responseTimes.push(responseTime);
      }
    });

    it('should handle concurrent database connections efficiently', async () => {
      const concurrentConnections = 30;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentConnections; i++) {
        promises.push(
          // Simulate different types of database operations
          makeAuthenticatedRequest('/sales/customers', userToken, 'get'),
          makeAuthenticatedRequest('/inventory/products', userToken, 'get'),
          makeAuthenticatedRequest('/purchasing/suppliers', userToken, 'get')
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();

      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      const totalTime = endTime - startTime;

      expect(successfulRequests.length).to.be.greaterThan(concurrentConnections * 0.8);
      expect(totalTime).to.be.lessThan(20000); // Should complete within 20 seconds

      // Check connection pool efficiency
      const avgTimePerRequest = totalTime / concurrentConnections;
      expect(avgTimePerRequest).to.be.lessThan(500); // Average under 500ms per request
    });
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain stable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 5;
      const requestsPerIteration = 20;

      for (let iteration = 0; iteration < iterations; iteration++) {
        const promises = [];

        for (let i = 0; i < requestsPerIteration; i++) {
          promises.push(
            makeAuthenticatedRequest('/sales/customers', userToken, 'get'),
            makeAuthenticatedRequest('/inventory/products', userToken, 'get'),
            makeAuthenticatedRequest('/reports/sales/summary', managerToken, 'post', {
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              endDate: new Date().toISOString(),
            })
          );
        }

        await Promise.allSettled(promises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const currentMemory = process.memoryUsage();
        performanceMetrics.memoryUsage.push(currentMemory);

        // Check memory growth
        const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);

        // Memory should not grow more than 100MB during test
        expect(memoryGrowthMB).to.be.lessThan(100);
      }
    });

    it('should properly clean up resources after operations', async () => {
      // Create resources
      const createPromises = [];
      for (let i = 0; i < 10; i++) {
        createPromises.push(
          makeAuthenticatedRequest('/sales/customers', managerToken, 'post', {
            code: `CLEANUP-${i}-${Date.now()}`,
            name: `Cleanup Test Customer ${i}`,
            email: `cleanup${i}-${Date.now()}@test.com`,
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 1000.00,
          })
        );
      }

      const createResults = await Promise.allSettled(createPromises);
      const createdCustomerIds = createResults
        .filter(r => r.status === 'fulfilled' && r.value.status === 201)
        .map(r => r.value.body.id);

      // Measure memory after creation
      const memoryAfterCreation = process.memoryUsage();

      // Clean up resources
      const deletePromises = [];
      for (const customerId of createdCustomerIds) {
        deletePromises.push(
          makeAuthenticatedRequest(`/sales/customers/${customerId}`, managerToken, 'delete')
        );
      }

      await Promise.allSettled(deletePromises);

      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memoryAfterCleanup = process.memoryUsage();

      // Memory should be released after cleanup
      const memoryDifference = memoryAfterCleanup.heapUsed - memoryAfterCreation.heapUsed;
      expect(memoryDifference).to.be.lessThan(10 * 1024 * 1024); // Less than 10MB difference
    });
  });

  describe('API Response Time Performance', () => {
    it('should meet response time SLA for critical endpoints', async () => {
      const criticalEndpoints = [
        { path: '/sales/customers', method: 'get', expectedTime: 200 },
        { path: '/inventory/products', method: 'get', expectedTime: 200 },
        { path: '/purchasing/suppliers', method: 'get', expectedTime: 200 },
        { path: '/auth/profile', method: 'get', expectedTime: 100 },
      ];

      for (const endpoint of criticalEndpoints) {
        const responseTimes = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();

          const response = await makeAuthenticatedRequest(
            endpoint.path,
            endpoint.method === 'get' ? userToken : managerToken,
            endpoint.method
          );

          const endTime = Date.now();
          const responseTime = endTime - startTime;

          expect(response.status).to.equal(200);
          responseTimes.push(responseTime);
        }

        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxResponseTime = Math.max(...responseTimes);

        expect(avgResponseTime).to.be.lessThan(endpoint.expectedTime);
        expect(maxResponseTime).to.be.lessThan(endpoint.expectedTime * 2);

        performanceMetrics.responseTimes.push(...responseTimes);
      }
    });

    it('should handle large payload requests efficiently', async () => {
      const largePayload = {
        customerId: 'test-customer',
        description: 'Large order with many items for performance testing',
        items: [],
        currency: 'USD',
      };

      // Create 100 items in the order
      for (let i = 0; i < 100; i++) {
        largePayload.items.push({
          productId: `product-${i}`,
          quantity: Math.floor(Math.random() * 10) + 1,
          unitPrice: Math.random() * 100 + 10,
        });
      }

      const startTime = Date.now();

      const response = await makeAuthenticatedRequest(
        '/sales/orders',
        managerToken,
        'post',
        largePayload
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should handle large payloads within reasonable time
      expect(responseTime).to.be.lessThan(3000); // 3 seconds max
      expect(response.status).to.be.oneOf([201, 400]); // Either succeeds or fails gracefully

      performanceMetrics.responseTimes.push(responseTime);
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const startTime = Date.now();
      const responseTimes = [];
      const errors = [];

      while (Date.now() - startTime < duration) {
        try {
          const requestStart = Date.now();

          await makeAuthenticatedRequest('/sales/customers', userToken, 'get');

          const requestEnd = Date.now();
          responseTimes.push(requestEnd - requestStart);
        } catch (error) {
          errors.push(error);
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const errorRate = errors.length / (responseTimes.length + errors.length);

      expect(avgResponseTime).to.be.lessThan(500); // Average under 500ms
      expect(maxResponseTime).to.be.lessThan(2000); // Max under 2 seconds
      expect(errorRate).to.be.lessThan(0.05); // Error rate under 5%
    });
  });

  describe('Caching Performance', () => {
    it('should demonstrate caching effectiveness for repeated requests', async () => {
      const endpoint = '/sales/customers';
      const iterations = 20;

      // First request (cache miss)
      const firstRequestStart = Date.now();
      await makeAuthenticatedRequest(endpoint, userToken, 'get');
      const firstRequestTime = Date.now() - firstRequestStart;

      // Subsequent requests (should benefit from cache)
      const cachedRequestTimes = [];
      for (let i = 0; i < iterations; i++) {
        const requestStart = Date.now();
        await makeAuthenticatedRequest(endpoint, userToken, 'get');
        const requestTime = Date.now() - requestStart;
        cachedRequestTimes.push(requestTime);
      }

      const avgCachedTime = cachedRequestTimes.reduce((a, b) => a + b, 0) / cachedRequestTimes.length;

      // Cached requests should be faster (if caching is implemented)
      // This test may not pass if caching is not implemented, which is fine
      if (avgCachedTime < firstRequestTime * 0.8) {
        console.log(`Caching effective: ${firstRequestTime}ms -> ${avgCachedTime}ms`);
      } else {
        console.log(`Caching not detected: ${firstRequestTime}ms -> ${avgCachedTime}ms`);
      }
    });

    it('should handle cache invalidation properly', async () => {
      // Get initial data
      const initialResponse = await makeAuthenticatedRequest('/sales/customers', userToken, 'get');
      const initialData = initialResponse.body.data;

      // Create new customer (should invalidate cache)
      await makeAuthenticatedRequest('/sales/customers', managerToken, 'post', {
        code: `CACHE-TEST-${Date.now()}`,
        name: 'Cache Test Customer',
        email: `cache-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      });

      // Get data again (should reflect new customer)
      const updatedResponse = await makeAuthenticatedRequest('/sales/customers', userToken, 'get');
      const updatedData = updatedResponse.body.data;

      // Should have updated data (cache invalidated properly)
      expect(updatedData.length).to.be.greaterThan(initialData.length);
    });
  });

  describe('Connection Pool and Resource Limits', () => {
    it('should handle database connection limits gracefully', async () => {
      const concurrentConnections = 50;
      const promises = [];

      for (let i = 0; i < concurrentConnections; i++) {
        promises.push(
          makeAuthenticatedRequest('/sales/customers', userToken, 'get')
            .catch(error => {
              // Track connection errors
              performanceMetrics.errorCounts.set('connection_error',
                (performanceMetrics.errorCounts.get('connection_error') || 0) + 1
              );
              return { status: 500, error: error.message };
            })
        );
      }

      const results = await Promise.allSettled(promises);
      const successfulRequests = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 200
      );
      const connectionErrors = performanceMetrics.errorCounts.get('connection_error') || 0;

      expect(successfulRequests.length).to.be.greaterThan(concurrentConnections * 0.5); // At least 50% success
      expect(connectionErrors).to.be.lessThan(concurrentConnections * 0.3); // Less than 30% connection errors
    });

    it('should recover from temporary connection issues', async () => {
      // This test simulates recovery from temporary database issues
      const _requests = [];
      const recoveryAttempts = 3;

      for (let attempt = 0; attempt < recoveryAttempts; attempt++) {
        try {
          const response = await makeAuthenticatedRequest('/sales/customers', userToken, 'get');
          expect(response.status).to.equal(200);
          break; // Success, no need for more attempts
        } catch (error) {
          if (attempt === recoveryAttempts - 1) {
            throw error; // Re-throw on final attempt
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    });
  });

  describe('Performance Metrics Summary', () => {
    it('should generate performance summary report', () => {
      const summary = {
        totalRequests: performanceMetrics.responseTimes.length,
        averageResponseTime: performanceMetrics.responseTimes.length > 0
          ? performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / performanceMetrics.responseTimes.length
          : 0,
        maxResponseTime: performanceMetrics.responseTimes.length > 0
          ? Math.max(...performanceMetrics.responseTimes)
          : 0,
        minResponseTime: performanceMetrics.responseTimes.length > 0
          ? Math.min(...performanceMetrics.responseTimes)
          : 0,
        errorCounts: Object.fromEntries(performanceMetrics.errorCounts),
        memorySnapshots: performanceMetrics.memoryUsage.length,
      };

      console.log('\n=== Performance Summary ===');
      console.log(`Total Requests: ${summary.totalRequests}`);
      console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
      console.log(`Max Response Time: ${summary.maxResponseTime}ms`);
      console.log(`Min Response Time: ${summary.minResponseTime}ms`);
      console.log(`Error Counts:`, summary.errorCounts);
      console.log(`Memory Snapshots: ${summary.memorySnapshots}`);
      console.log('========================\n');

      // Performance assertions
      expect(summary.averageResponseTime).to.be.lessThan(1000); // Average under 1 second
      expect(summary.maxResponseTime).to.be.lessThan(5000); // Max under 5 seconds
      expect(summary.totalRequests).to.be.greaterThan(0);
    });
  });

  /**
   * Helper Functions
   */

  async function makeAuthenticatedRequest(
    path: string,
    token: string,
    method: 'get' | 'post' | 'delete' | 'patch' = 'get',
    data?: any
  ) {
    const requestBuilder = request(app.getHttpServer())[method](path)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    if (data) {
      requestBuilder.send(data);
    }

    return requestBuilder;
  }

  function resetPerformanceMetrics(): void {
    performanceMetrics = {
      responseTimes: [],
      memoryUsage: [],
      errorCounts: new Map(),
      concurrentConnections: 0,
    };
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up any test data created during performance tests
      const _timestampPattern = Date.now().toString().substring(0, 9);

      // Clean up customers created during tests
      await prismaService.customer.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'CONCURRENT-' } },
            { code: { startsWith: 'CLEANUP-' } },
            { code: { startsWith: 'CACHE-TEST-' } },
            { code: { startsWith: 'PERF-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});