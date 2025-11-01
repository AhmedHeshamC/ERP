import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { ProductController } from './product.controller';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { JwtStrategy } from '../authentication/jwt.strategy';
import { LocalStrategy } from '../authentication/local.strategy';
import { AuthService } from '../authentication/auth.service';
import { AuthHelpers, UserRole } from '../../shared/testing/auth-helpers';
import { CreateProductDto, ProductStatus } from './dto/product.dto';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Inventory Module Integration Tests
 * Tests complete product management workflows end-to-end
 * These tests validate the complete inventory management system
 * following enterprise-grade standards and OWASP security principles
 */
describe('Inventory Module Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let authToken: string;

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
      controllers: [ProductController],
      providers: [AuthService, JwtStrategy, LocalStrategy],
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
    
    // Create a test user and get auth token using direct generation
    authToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
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

  describe('Product CRUD Operations', () => {
    it('should create a new product successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createProductDto: CreateProductDto = {
        name: `Test Product ${timestamp}`,
        sku: `TEST-${timestamp}`,
        description: 'Test product description',
        price: 29.99,
        categoryId: 'test-category-id',
        status: ProductStatus.ACTIVE,
        initialStock: 100,
        lowStockThreshold: 10,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createProductDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(createProductDto.name);
      expect(response.body.sku).to.equal(createProductDto.sku);
      expect(response.body.price).to.equal(createProductDto.price);
      expect(response.body.stockQuantity).to.equal(createProductDto.initialStock);
      expect(response.body.status).to.equal(ProductStatus.ACTIVE);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should reject product creation with duplicate SKU', async () => {
      // Arrange - Create first product
      const timestamp = Date.now();
      const createProductDto: CreateProductDto = {
        name: `First Product ${timestamp}`,
        sku: `DUPLICATE-${timestamp}`,
        description: 'First product',
        price: 19.99,
        categoryId: 'test-category-id',
        status: ProductStatus.ACTIVE,
        initialStock: 50,
        lowStockThreshold: 5,
      };

      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createProductDto)
        .expect(201);

      // Act - Try to create second product with same SKU
      const duplicateProductDto = {
        ...createProductDto,
        name: `Second Product ${timestamp}`,
      };

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateProductDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should validate product creation data', async () => {
      // Arrange - Invalid data
      const invalidProductDto = {
        name: '', // Empty name
        sku: 'invalid', // Invalid format
        price: -10, // Negative price
        categoryId: '', // Empty category
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProductDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should get product by ID successfully', async () => {
      // Arrange - Create a product first
      const createdProduct = await createTestProduct();

      // Act
      const response = await request(app.getHttpServer())
        .get(`/products/${createdProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdProduct.id);
      expect(response.body.name).to.equal(createdProduct.name);
      expect(response.body.sku).to.equal(createdProduct.sku);
      expect(response.body.stockQuantity).to.equal(createdProduct.stockQuantity);
    });

    it('should return 404 for non-existent product', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/products/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).to.include('not found');
    });

    it('should update product successfully', async () => {
      // Arrange - Create a product first
      const createdProduct = await createTestProduct();

      const updateData = {
        name: 'Updated Product Name',
        description: 'Updated description',
        price: 39.99,
        status: ProductStatus.INACTIVE,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/products/${createdProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdProduct.id);
      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.description).to.equal(updateData.description);
      expect(response.body.price).to.equal(updateData.price);
      expect(response.body.status).to.equal(updateData.status);
      expect(response.body.updatedAt).to.not.equal(createdProduct.updatedAt);
    });

    it('should delete product (soft delete) successfully', async () => {
      // Arrange - Create a product first
      const createdProduct = await createTestProduct();

      // Act
      const response = await request(app.getHttpServer())
        .delete(`/products/${createdProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdProduct.id);
      expect(response.body.isActive).to.be.false;

      // Verify product is no longer active
      const getResponse = await request(app.getHttpServer())
        .get(`/products/${createdProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.isActive).to.be.false;
    });
  });

  describe('Product Listing and Search', () => {
    beforeEach(async () => {
      // Create test products for listing/search tests
      await createMultipleTestProducts();
    });

    it('should get paginated product list', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(5);
      expect(response.body.pagination.total).to.be.greaterThan(0);
      expect(response.body.data.length).to.be.lessThanOrEqual(5);
    });

    it('should search products by name', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/products/search?q=Wireless')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        response.body.forEach((product: any) => {
          expect(product.name.toLowerCase()).to.include('wireless');
        });
      }
    });

    it('should filter products by status', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/products?status=ACTIVE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('data');
      if (response.body.data.length > 0) {
        response.body.data.forEach((product: any) => {
          expect(product.status).to.equal('ACTIVE');
        });
      }
    });

    it('should get products by category', async () => {
      // Arrange
      const categoryId = 'electronics-category';

      // Act
      const response = await request(app.getHttpServer())
        .get(`/products/category/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        response.body.forEach((product: any) => {
          expect(product.categoryId).to.equal(categoryId);
        });
      }
    });
  });

  describe('Stock Management', () => {
    let testProduct: any;

    beforeEach(async () => {
      testProduct = await createTestProduct();
    });

    it('should get product stock information', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get(`/products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('productId', testProduct.id);
      expect(response.body).to.have.property('currentStock');
      expect(response.body).to.have.property('lowStockThreshold');
      expect(response.body).to.have.property('isLowStock');
    });

    it('should adjust stock quantity (increase)', async () => {
      // Arrange
      const stockAdjustment = {
        quantity: 50,
        type: 'IN',
        reason: 'Purchase order receipt',
        reference: 'PO-001',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(stockAdjustment)
        .expect(200);

      // Assert
      expect(response.body.newStock).to.equal(testProduct.stockQuantity + 50);
      expect(response.body.previousStock).to.equal(testProduct.stockQuantity);
      expect(response.body.adjustment).to.equal(50);

      // Verify product stock was updated
      const stockResponse = await request(app.getHttpServer())
        .get(`/products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stockResponse.body.currentStock).to.equal(testProduct.stockQuantity + 50);
    });

    it('should adjust stock quantity (decrease)', async () => {
      // Arrange
      const stockAdjustment = {
        quantity: 20,
        type: 'OUT',
        reason: 'Sale',
        reference: 'SO-001',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(stockAdjustment)
        .expect(200);

      // Assert
      expect(response.body.newStock).to.equal(testProduct.stockQuantity - 20);
      expect(response.body.previousStock).to.equal(testProduct.stockQuantity);
      expect(response.body.adjustment).to.equal(-20);
    });

    it('should get low stock products', async () => {
      // Arrange - Create a product with low stock
      const lowStockProduct = await createTestProduct({
        initialStock: 5,
        lowStockThreshold: 10,
      });

      // Act
      const response = await request(app.getHttpServer())
        .get('/products/low-stock')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      const lowStockIds = response.body.map((p: any) => p.id);
      expect(lowStockIds).to.include(lowStockProduct.id);
    });
  });

  describe('Security and Authorization', () => {
    it('should reject requests without authentication', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/products')
        .expect(401);

      await request(app.getHttpServer())
        .post('/products')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .put('/products/test-id')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .delete('/products/test-id')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should enforce RBAC for admin-only operations', async () => {
      // Arrange - Create user token with limited permissions using direct generation
      const userToken = AuthHelpers.createTestTokenDirect(UserRole.USER);

      // Act & Assert - User should not be able to create products
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403);

      // Act & Assert - User should not be able to delete products
      await request(app.getHttpServer())
        .delete('/products/test-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      // Act & Assert - User should not be able to adjust stock
      await request(app.getHttpServer())
        .post('/products/test-id/stock')
        .set('Authorization', `Bearer ${userToken}`)
        .send({})
        .expect(403);
    });

    it('should prevent XSS attacks in product names', async () => {
      // Arrange - Malicious input with XSS attempt
      const maliciousProductDto = {
        name: '<script>alert("xss")</script>Malicious Product',
        sku: 'XSS-001',
        description: 'Description with <img src=x onerror=alert(1)> XSS',
        price: 10.00,
        categoryId: 'test-category',
        status: ProductStatus.ACTIVE,
        initialStock: 1,
        lowStockThreshold: 1,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousProductDto)
        .expect(201);

      // Assert - XSS should be sanitized
      expect(response.body.name).to.not.include('<script>');
      expect(response.body.description).to.not.include('<img');
      expect(response.body.name).to.include('Malicious Product');
    });

    it('should prevent SQL injection in search parameters', async () => {
      // Arrange - Malicious search term with SQL injection attempt
      const maliciousSearch = "'; DROP TABLE products; --";

      // Act
      const response = await request(app.getHttpServer())
        .get(`/products/search?q=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert - Should return empty array or handle gracefully, not crash
      expect(response.body).to.be.an('array');

      // Verify products table still exists
      const products = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(products.body).to.have.property('data');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent stock adjustments safely', async () => {
      // Arrange
      const testProduct = await createTestProduct({ initialStock: 100 });
      const stockAdjustments = [
        { quantity: 10, type: 'OUT', reason: 'Sale 1', reference: 'SO-001' },
        { quantity: 15, type: 'OUT', reason: 'Sale 2', reference: 'SO-002' },
        { quantity: 25, type: 'OUT', reason: 'Sale 3', reference: 'SO-003' },
      ];

      // Act - Process stock adjustments concurrently
      const adjustmentPromises = stockAdjustments.map(adjustment =>
        request(app.getHttpServer())
          .post(`/products/${testProduct.id}/stock`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(adjustment)
      );

      const results = await Promise.allSettled(adjustmentPromises);

      // Assert - All adjustments should complete successfully
      const successfulAdjustments = results.filter(r => r.status === 'fulfilled');
      expect(successfulAdjustments.length).to.equal(3);

      // Verify final stock quantity
      const stockResponse = await request(app.getHttpServer())
        .get(`/products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const expectedFinalStock = 100 - 10 - 15 - 25; // 50
      expect(stockResponse.body.currentStock).to.equal(expectedFinalStock);
    });

    it('should handle concurrent product creation with unique constraints', async () => {
      // Arrange - Same SKU for multiple products (should cause conflict)
      const timestamp = Date.now();
      const commonSku = `CONCURRENT-${timestamp}`;

      const productDtos = [
        {
          name: 'Product 1',
          sku: commonSku,
          price: 10.00,
          categoryId: 'test-category',
          status: ProductStatus.ACTIVE,
          initialStock: 10,
          lowStockThreshold: 2,
        },
        {
          name: 'Product 2',
          sku: commonSku,
          price: 20.00,
          categoryId: 'test-category',
          status: ProductStatus.ACTIVE,
          initialStock: 20,
          lowStockThreshold: 5,
        },
      ];

      // Act - Create products concurrently
      const creationPromises = productDtos.map(dto =>
        request(app.getHttpServer())
          .post('/products')
          .set('Authorization', `Bearer ${authToken}`)
          .send(dto)
      );

      const results = await Promise.allSettled(creationPromises);

      // Assert - One should succeed, one should fail
      const successfulCreations = results.filter(r => r.status === 'fulfilled');
      const failedCreations = results.filter(r => r.status === 'rejected');

      expect(successfulCreations.length).to.equal(1);
      expect(failedCreations.length).to.equal(1);

      // Verify only one product was created
      const products = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const productsWithSku = products.body.data.filter((p: any) => p.sku === commonSku);
      expect(productsWithSku.length).to.equal(1);
    });
  });

  /**
   * Helper Functions
   */

  // NOTE: getTestAuthToken() and getUserToken() functions replaced with AuthHelpers.createTestToken()
// AuthHelpers provides standardized token creation for all roles

  async function createTestProduct(overrides?: Partial<CreateProductDto>): Promise<any> {
    const timestamp = Date.now();
    const productData: CreateProductDto = {
      name: `Test Product ${timestamp}`,
      sku: `TEST-${timestamp}`,
      description: 'Test product for integration testing',
      price: 29.99,
      categoryId: 'test-category-id',
      status: ProductStatus.ACTIVE,
      initialStock: 100,
      lowStockThreshold: 10,
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send(productData);

    return response.body;
  }

  async function createMultipleTestProducts(): Promise<void> {
    const products = [
      {
        name: 'Wireless Mouse',
        sku: `WM-${Date.now()}`,
        description: 'Ergonomic wireless mouse',
        price: 29.99,
        categoryId: 'electronics-category',
        status: ProductStatus.ACTIVE,
        initialStock: 50,
        lowStockThreshold: 10,
      },
      {
        name: 'Mechanical Keyboard',
        sku: `KB-${Date.now()}`,
        description: 'RGB mechanical keyboard',
        price: 89.99,
        categoryId: 'electronics-category',
        status: ProductStatus.ACTIVE,
        initialStock: 25,
        lowStockThreshold: 5,
      },
      {
        name: 'USB-C Hub',
        sku: `HUB-${Date.now()}`,
        description: '7-in-1 USB-C hub',
        price: 49.99,
        categoryId: 'electronics-category',
        status: ProductStatus.INACTIVE,
        initialStock: 15,
        lowStockThreshold: 3,
      },
    ];

    for (const product of products) {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(product);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up test products in order of dependencies
      await prismaService.stockMovement.deleteMany({
        where: {
          product: {
            sku: { startsWith: 'TEST-' },
          },
        },
      });

      await prismaService.product.deleteMany({
        where: {
          OR: [
            { sku: { startsWith: 'TEST-' } },
            { sku: { startsWith: 'DUPLICATE-' } },
            { sku: { startsWith: 'CONCURRENT-' } },
            { sku: { startsWith: 'WM-' } },
            { sku: { startsWith: 'KB-' } },
            { sku: { startsWith: 'HUB-' } },
            { sku: { startsWith: 'XSS-' } },
          ],
        },
      });

      // Clean up test users
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { startsWith: 'admin@test.com' } },
            { email: { startsWith: 'user@test.com' } },
            { username: { startsWith: 'admin' } },
            { username: { startsWith: 'user' } },
          ],
        },
      });
    } catch (error) {
    }
  }
});