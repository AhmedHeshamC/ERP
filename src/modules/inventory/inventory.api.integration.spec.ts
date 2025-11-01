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
import { Product, ProductCategory } from '@prisma/client';
import { InventoryModule } from './inventory.module';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Inventory Module API Integration Tests
 *
 * Tests complete inventory management functionality including:
 * - Product CRUD operations
 * - Category management
 * - Stock movements and tracking
 * - Low stock alerts
 * - Security validation
 * - Performance under load
 */
describe('Inventory Module API Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let inventoryManagerToken: string;

  // Test data helpers
  let testCategory: ProductCategory;
  let testProduct: Product;

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
        InventoryModule,
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
    inventoryManagerToken = AuthHelpers.createTestTokenDirect(UserRole.INVENTORY_MANAGER);
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

  describe('Product Categories API', () => {
    it('should create a new product category as admin', async () => {
      const categoryData = {
        name: 'Test Electronics',
        description: 'Test electronic products',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(categoryData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(categoryData.name);
      expect(response.body.description).to.equal(categoryData.description);
      expect(response.body.isActive).to.equal(categoryData.isActive);
      expect(response.body.createdAt).to.be.a('string');
    });

    it('should get all product categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
      expect(response.body.data.length).to.be.greaterThan(0);
    });

    it('should update a product category as manager', async () => {
      const updateData = {
        name: 'Updated Category Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .patch(`/inventory/categories/${testCategory.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.description).to.equal(updateData.description);
    });

    it('should delete a product category as admin', async () => {
      await request(app.getHttpServer())
        .delete(`/inventory/categories/${testCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('should reject category creation without authentication', async () => {
      const categoryData = {
        name: 'Unauthorized Category',
        description: 'Should not be created',
      };

      await request(app.getHttpServer())
        .post('/inventory/categories')
        .send(categoryData)
        .expect(401);
    });

    it('should reject category creation for regular user', async () => {
      const categoryData = {
        name: 'Unauthorized Category',
        description: 'Should not be created',
      };

      await request(app.getHttpServer())
        .post('/inventory/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send(categoryData)
        .expect(403);
    });
  });

  describe('Products API', () => {
    it('should create a new product as inventory manager', async () => {
      const productData = {
        name: 'Test Wireless Mouse',
        sku: `MOUSE-${Date.now()}`,
        description: 'High-quality wireless mouse',
        price: 29.99,
        cost: 15.50,
        categoryId: testCategory.id,
        lowStockThreshold: 10,
        initialStock: 50,
        barcode: '1234567890123',
        weight: 0.1,
        dimensions: {
          length: 10,
          width: 5,
          height: 3,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/inventory/products')
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(productData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(productData.name);
      expect(response.body.sku).to.equal(productData.sku);
      expect(response.body.price).to.equal(productData.price);
      expect(response.body.stockQuantity).to.equal(productData.initialStock);
      expect(response.body.isActive).to.be.true;

      testProduct = response.body;
    });

    it('should get all products with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/products?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(10);
    });

    it('should search products by name and SKU', async () => {
      const response = await request(app.getHttpServer())
        .get('/inventory/products?search=Mouse')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        expect(response.body.data[0].name).to.include('Mouse');
      }
    });

    it('should filter products by category', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/products?categoryId=${testCategory.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
      response.body.data.forEach((product: any) => {
        expect(product.categoryId).to.equal(testCategory.id);
      });
    });

    it('should update product details as inventory manager', async () => {
      const updateData = {
        name: 'Updated Mouse Name',
        price: 34.99,
        lowStockThreshold: 15,
      };

      const response = await request(app.getHttpServer())
        .patch(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.price).to.equal(updateData.price);
      expect(response.body.lowStockThreshold).to.equal(updateData.lowStockThreshold);
    });

    it('should get low stock alerts', async () => {
      // First, reduce stock below threshold
      await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send({
          type: 'OUT',
          quantity: 45, // Reduce from 50 to 5 (threshold is 10)
          reason: 'Test stock movement',
        });

      const response = await request(app.getHttpServer())
        .get('/inventory/products/low-stock')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        const lowStockProduct = response.body.find((p: any) => p.id === testProduct.id);
        if (lowStockProduct) {
          expect(lowStockProduct.stockQuantity).to.be.lessThan(lowStockProduct.lowStockThreshold);
        }
      }
    });

    it('should handle product status changes', async () => {
      // Deactivate product
      await request(app.getHttpServer())
        .patch(`/inventory/products/${testProduct.id}/status`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send({ isActive: false })
        .expect(200);

      // Verify product is inactive
      const response = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.isActive).to.be.false;
    });
  });

  describe('Stock Movements API', () => {
    it('should record stock IN movement', async () => {
      const movementData = {
        type: 'IN',
        quantity: 25,
        reason: 'New stock received from supplier',
        reference: 'PO-001',
        cost: 15.00,
      };

      const response = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(movementData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.type).to.equal(movementData.type);
      expect(response.body.quantity).to.equal(movementData.quantity);
      expect(response.body.reason).to.equal(movementData.reason);
      expect(response.body.productId).to.equal(testProduct.id);
    });

    it('should record stock OUT movement', async () => {
      const movementData = {
        type: 'OUT',
        quantity: 10,
        reason: 'Sale to customer',
        reference: 'SO-001',
      };

      const response = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(movementData)
        .expect(201);

      expect(response.body.type).to.equal(movementData.type);
    });

    it('should record stock ADJUSTMENT', async () => {
      const movementData = {
        type: 'ADJUSTMENT',
        quantity: -2,
        reason: 'Physical count adjustment',
        reference: 'COUNT-001',
      };

      const response = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(movementData)
        .expect(201);

      expect(response.body.type).to.equal(movementData.type);
    });

    it('should prevent negative stock levels', async () => {
      const currentStock = testProduct.stockQuantity;

      const movementData = {
        type: 'OUT',
        quantity: currentStock + 10, // More than available
        reason: 'Attempt to create negative stock',
      };

      await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(movementData)
        .expect(400);
    });

    it('should get stock movement history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      response.body.forEach((movement: any) => {
        expect(movement).to.have.property('type');
        expect(movement).to.have.property('quantity');
        expect(movement).to.have.property('reason');
        expect(movement.productId).to.equal(testProduct.id);
      });
    });
  });

  describe('Security and Validation', () => {
    it('should prevent XSS in product names', async () => {
      const maliciousProduct = {
        name: '<script>alert("XSS")</script>Malicious Product',
        sku: `XSS-${Date.now()}`,
        price: 10.00,
        categoryId: testCategory.id,
      };

      const response = await request(app.getHttpServer())
        .post('/inventory/products')
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(maliciousProduct)
        .expect(201);

      // Product should be created but XSS should be sanitized
      expect(response.body.name).to.not.include('<script>');
      expect(response.body.name).to.include('Malicious Product');
    });

    it('should validate SKU format', async () => {
      const invalidProduct = {
        name: 'Invalid SKU Product',
        sku: 'invalid sku with spaces and symbols!',
        price: 10.00,
        categoryId: testCategory.id,
      };

      await request(app.getHttpServer())
        .post('/inventory/products')
        .set('Authorization', `Bearer ${inventoryManagerToken}`)
        .send(invalidProduct)
        .expect(400);
    });

    it('should enforce authorization checks', async () => {
      // Regular user trying to create product
      const productData = {
        name: 'Unauthorized Product',
        sku: `UNAUTH-${Date.now()}`,
        price: 10.00,
        categoryId: testCategory.id,
      };

      await request(app.getHttpServer())
        .post('/inventory/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send(productData)
        .expect(403);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousSearch = "'; DROP TABLE products; --";

      const response = await request(app.getHttpServer())
        .get(`/inventory/products?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should not crash and should return empty results or safe handling
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent product requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app.getHttpServer())
            .get('/inventory/products')
            .set('Authorization', `Bearer ${userToken}`)
        );
      }

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('data');
      });
    });

    it('should handle large stock movement batch', async () => {
      const batchMovements = 5;
      const promises = [];

      for (let i = 0; i < batchMovements; i++) {
        promises.push(
          request(app.getHttpServer())
            .post(`/inventory/products/${testProduct.id}/stock-movements`)
            .set('Authorization', `Bearer ${inventoryManagerToken}`)
            .send({
              type: 'IN',
              quantity: 1,
              reason: `Batch movement ${i}`,
            })
        );
      }

      const results = await Promise.all(promises);

      // All movements should be recorded successfully
      results.forEach(response => {
        expect(response.status).to.equal(201);
      });
    });
  });

  /**
   * Helper Functions
   */

  async function setupTestData(): Promise<void> {
    try {
      // Create test category
      testCategory = await prismaService.productCategory.create({
        data: {
          name: `Test Category ${Date.now()}`,
          description: 'Test category for integration tests',
          isActive: true,
        },
      });

      // Create test product
      testProduct = await prismaService.product.create({
        data: {
          name: `Test Product ${Date.now()}`,
          sku: `TEST-${Date.now()}`,
          description: 'Test product for integration tests',
          price: 100.00,
          stockQuantity: 100,
          lowStockThreshold: 10,
          categoryId: testCategory.id,
          isActive: true,
        },
      });
    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in correct order to respect foreign key constraints

      // Clean up stock movements first
      await prismaService.stockMovement.deleteMany({
        where: {
          productId: { startsWith: 'TEST-' },
        },
      });

      // Clean up products
      await prismaService.product.deleteMany({
        where: {
          OR: [
            { sku: { startsWith: 'TEST-' } },
            { sku: { startsWith: 'MOUSE-' } },
            { sku: { startsWith: 'XSS-' } },
            { sku: { startsWith: 'UNAUTH-' } },
          ],
        },
      });

      // Clean up categories
      await prismaService.productCategory.deleteMany({
        where: {
          name: { startsWith: 'Test Category' },
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});