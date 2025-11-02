import { expect } from 'chai';
import { describe, it } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { SecurityModule } from '../../shared/security/security.module';
import { AuditModule } from '../../shared/audit/audit.module';
import { CommonModule } from '../../shared/common/common.module';
import { InventoryModule } from '../../modules/inventory/inventory.module';
import { AuthenticationModule } from '../../modules/authentication/authentication.module';
import { UsersModule } from '../../modules/users/users.module';
import { ProductionErrorFilter } from '../../shared/filters/production-error.filter';
import { CorrelationIdMiddleware } from '../../shared/middleware/correlation-id.middleware';
import { SecurityHeadersMiddleware } from '../../shared/middleware/security-headers.middleware';

describe('Inventory Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;

  // Test data
  let testProductCategory: any;
  let testProduct: any;
  let testWarehouse: any;
  let testCostLayer: any;
  let testStockMovement: any;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            NODE_ENV: 'test',
            JWT_SECRET: 'test-secret-key-for-inventory-tests',
            JWT_EXPIRATION: '1h',
            RATE_LIMIT_WINDOW_MS: 60000,
            RATE_LIMIT_MAX_REQUESTS: 1000,
            DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_erp',
          })],
          validationOptions: {
            allowUnknown: true,
            abortEarly: true,
          },
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 1000,
          },
        ]),
        SecurityModule,
        AuditModule,
        CommonModule,
        AuthenticationModule,
        UsersModule,
        InventoryModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply middleware
    app.use(CorrelationIdMiddleware);
    app.use(SecurityHeadersMiddleware);

    // Apply global pipes and filters
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );
    app.useGlobalFilters(new ProductionErrorFilter(app.get(ConfigService)));

    await app.init();

    // Get authentication token
    authToken = await getAuthToken(app);
  });

  after(async () => {
    // Cleanup test data
    await cleanupTestData();
    await app.close();
  });

  describe('Product Management Workflow', () => {
    it('should create product category', async () => {
      const categoryData = {
        name: 'Test Electronics',
        description: 'Electronic devices for testing',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData)
        .expect(201);

      testProductCategory = response.body;
      expect(testProductCategory.name).to.equal(categoryData.name);
      expect(testProductCategory.description).to.equal(categoryData.description);
    });

    it('should create a new product', async () => {
      const productData = {
        name: 'Test Laptop',
        sku: 'LAPTOP-TEST-001',
        description: 'High-performance test laptop',
        price: 999.99,
        costPrice: 750.00,
        categoryId: testProductCategory.id,
        initialStock: 100,
        lowStockThreshold: 10,
        status: 'ACTIVE',
        attributes: { brand: 'TestBrand', model: 'TX1000' },
        specifications: { cpu: 'Test CPU', ram: '16GB', storage: '512GB SSD' },
        tags: ['test', 'laptop', 'electronics'],
        weight: 1.5,
        dimensions: '35x25x2',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      testProduct = response.body;
      expect(testProduct.name).to.equal(productData.name);
      expect(testProduct.sku).to.equal(productData.sku);
      expect(testProduct.stockQuantity).to.equal(productData.initialStock);
      expect(testProduct.isLowStock).to.be.false;
    });

    it('should retrieve product by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).to.equal(testProduct.id);
      expect(response.body.name).to.equal(testProduct.name);
    });

    it('should retrieve product by SKU', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/products/sku/${testProduct.sku}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).to.equal(testProduct.id);
      expect(response.body.sku).to.equal(testProduct.sku);
    });

    it('should update product information', async () => {
      const updateData = {
        name: 'Updated Test Laptop',
        description: 'Updated description for test laptop',
        price: 1099.99,
        lowStockThreshold: 15,
      };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.price).to.equal(updateData.price);
      expect(response.body.lowStockThreshold).to.equal(updateData.lowStockThreshold);
    });

    it('should get product statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/products/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('totalProducts');
      expect(response.body).to.have.property('activeProducts');
      expect(response.body).to.have.property('totalStockItems');
      expect(response.body.totalProducts).to.be.at.least(1);
    });
  });

  describe('Stock Management Workflow', () => {
    it('should create a stock movement (IN)', async () => {
      const movementData = {
        productId: testProduct.id,
        type: 'IN',
        quantity: 50,
        reason: 'Purchase order receipt',
        reference: 'PO-TEST-001',
        sourceLocation: 'Supplier Warehouse',
        destinationLocation: 'Main Store',
        unitCost: 75.00,
        metadata: { supplier: 'Test Supplier', invoice: 'INV-001' },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send(movementData)
        .expect(201);

      testStockMovement = response.body;
      expect(testStockMovement.productId).to.equal(testProduct.id);
      expect(testStockMovement.type).to.equal('IN');
      expect(testStockMovement.quantity).to.equal(movementData.quantity);
    });

    it('should retrieve stock movements', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/stock/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ productId: testProduct.id })
        .expect(200);

      expect(response.body.movements).to.be.an('array');
      expect(response.body.movements.length).to.be.at.least(1);
      expect(response.body.total).to.be.at.least(1);
    });

    it('should create a stock adjustment', async () => {
      const adjustmentData = {
        productId: testProduct.id,
        quantity: -5,
        reason: 'Damaged items found during quality check',
        reference: 'ADJ-TEST-001',
        adjustmentCost: 375.00,
        notes: '5 items damaged in transit',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/adjustments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(adjustmentData)
        .expect(201);

      expect(response.body.productId).to.equal(testProduct.id);
      expect(response.body.type).to.equal('ADJUSTMENT');
      expect(response.body.reason).to.equal(adjustmentData.reason);
    });

    it('should get product stock history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/stock/products/${testProduct.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.at.least(2); // Movement + Adjustment
    });

    it('should get stock summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/stock/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.at.least(1);
      expect(response.body[0]).to.have.property('productId');
      expect(response.body[0]).to.have.property('currentStock');
    });
  });

  describe('Warehouse Management Workflow', () => {
    it('should create a new warehouse', async () => {
      const warehouseData = {
        name: 'Test Distribution Center',
        code: 'TDC-001',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        postalCode: '12345',
        contactPerson: 'John Manager',
        contactPhone: '+1234567890',
        contactEmail: 'manager@testwarehouse.com',
        maxCapacity: 10000,
        operatingHours: 'Mon-Fri 8AM-6PM',
        status: 'ACTIVE',
        notes: 'Primary test distribution center',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/warehouses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(warehouseData)
        .expect(201);

      testWarehouse = response.body;
      expect(testWarehouse.name).to.equal(warehouseData.name);
      expect(testWarehouse.code).to.equal(warehouseData.code);
      expect(testWarehouse.maxCapacity).to.equal(warehouseData.maxCapacity);
    });

    it('should retrieve warehouse by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/warehouses/${testWarehouse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).to.equal(testWarehouse.id);
      expect(response.body.name).to.equal(testWarehouse.name);
    });

    it('should retrieve warehouse by code', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/warehouses/code/${testWarehouse.code}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).to.equal(testWarehouse.id);
      expect(response.body.code).to.equal(testWarehouse.code);
    });

    it('should update warehouse utilization', async () => {
      const utilizationData = { utilization: 2500 };

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/warehouses/${testWarehouse.id}/utilization`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(utilizationData)
        .expect(200);

      expect(response.body.currentUtilization).to.equal(utilizationData.utilization);
    });

    it('should get warehouse capacity information', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/warehouses/${testWarehouse.id}/capacity`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.warehouseId).to.equal(testWarehouse.id);
      expect(response.body.maxCapacity).to.equal(testWarehouse.maxCapacity);
      expect(response.body.currentUtilization).to.be.at.most(testWarehouse.maxCapacity);
      expect(response.body.utilizationPercentage).to.be.at.least(0);
    });

    it('should get warehouse statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/warehouses/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('totalWarehouses');
      expect(response.body).to.have.property('activeWarehouses');
      expect(response.body).to.have.property('totalCapacity');
      expect(response.body.totalWarehouses).to.be.at.least(1);
    });
  });

  describe('Inventory Valuation Workflow', () => {
    it('should add cost layer for product', async () => {
      const costLayerData = {
        productId: testProduct.id,
        batchNumber: 'BATCH-TEST-001',
        quantity: 100,
        unitCost: 75.00,
        acquisitionDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        supplierId: 'supplier-test-001',
        purchaseOrderId: 'PO-TEST-002',
        location: 'Main Warehouse',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/valuation/cost-layers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(costLayerData)
        .expect(201);

      testCostLayer = response.body;
      expect(testCostLayer.productId).to.equal(testProduct.id);
      expect(testCostLayer.unitCost).to.equal(costLayerData.unitCost);
      expect(testCostLayer.remainingQuantity).to.equal(costLayerData.quantity);
    });

    it('should calculate inventory value using FIFO method', async () => {
      const valuationData = {
        productId: testProduct.id,
        method: 'FIFO',
        valuationDate: new Date().toISOString(),
        includeInactive: false,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/valuation/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(valuationData)
        .expect(200);

      expect(response.body.method).to.equal('FIFO');
      expect(response.body.totalValue).to.be.a('number');
      expect(response.body.totalQuantity).to.be.a('number');
      expect(response.body.productCount).to.equal(1);
      expect(response.body.productValuations).to.be.an('array');
      expect(response.body.productValuations.length).to.equal(1);
    });

    it('should calculate inventory value using Weighted Average method', async () => {
      const valuationData = {
        productId: testProduct.id,
        method: 'WEIGHTED_AVERAGE',
        valuationDate: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/valuation/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(valuationData)
        .expect(200);

      expect(response.body.method).to.equal('WEIGHTED_AVERAGE');
      expect(response.body.totalValue).to.be.a('number');
    });

    it('should get inventory valuation report', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/valuation/report')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ method: 'FIFO' })
        .expect(200);

      expect(response.body.method).to.equal('FIFO');
      expect(response.body.totalValue).to.be.a('number');
      expect(response.body.totalQuantity).to.be.a('number');
      expect(response.body.productCount).to.be.at.least(1);
    });

    it('should get cost of goods sold', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const endDate = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/valuation/products/${testProduct.id}/cogs`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ startDate, endDate, method: 'FIFO' })
        .expect(200);

      expect(response.body).to.have.property('quantity');
      expect(response.body).to.have.property('cost');
      expect(response.body).to.have.property('method');
      expect(response.body.method).to.equal('FIFO');
    });
  });

  describe('Low Stock Alert Workflow', () => {
    it('should check and create low stock alerts', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/alerts/check')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      // Alerts may or may not be created depending on current stock levels
    });

    it('should get active low stock alerts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
    });

    it('should get alert statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/alerts/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('totalAlerts');
      expect(response.body).to.have.property('activeAlerts');
      expect(response.body).to.have.property('alertsBySeverity');
      expect(response.body.alertsBySeverity).to.have.property('CRITICAL');
      expect(response.body.alertsBySeverity).to.have.property('HIGH');
      expect(response.body.alertsBySeverity).to.have.property('MEDIUM');
      expect(response.body.alertsBySeverity).to.have.property('LOW');
    });

    it('should get reorder suggestions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/alerts/reorder-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      // Each suggestion should have required fields
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('productId');
        expect(response.body[0]).to.have.property('suggestedReorderQuantity');
        expect(response.body[0]).to.have.property('priority');
      }
    });

    it('should get alert dashboard data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/alerts/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('statistics');
      expect(response.body).to.have.property('activeAlerts');
      expect(response.body).to.have.property('topReorderSuggestions');
      expect(response.body).to.have.property('urgencyBreakdown');
    });
  });

  describe('Cross-Module Integration Tests', () => {
    it('should handle complete inventory workflow end-to-end', async () => {
      // 1. Create additional products for comprehensive testing
      const product2Data = {
        name: 'Test Mouse',
        sku: 'MOUSE-TEST-001',
        price: 29.99,
        costPrice: 15.00,
        categoryId: testProductCategory.id,
        initialStock: 200,
        lowStockThreshold: 25,
      };

      const product2Response = await request(app.getHttpServer())
        .post('/api/v1/inventory/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(product2Data)
        .expect(201);

      // 2. Create stock movements for both products
      await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: product2Response.body.id,
          type: 'IN',
          quantity: 100,
          reason: 'Initial stock setup',
          unitCost: 15.00,
        })
        .expect(201);

      // 3. Calculate total inventory value
      const valuationResponse = await request(app.getHttpServer())
        .post('/api/v1/inventory/valuation/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'WEIGHTED_AVERAGE',
          categoryId: testProductCategory.id,
        })
        .expect(200);

      expect(valuationResponse.body.productCount).to.be.at.least(2);
      expect(valuationResponse.body.totalValue).to.be.greaterThan(0);

      // 4. Create warehouse transfer
      await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/transfers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productId: testProduct.id,
          sourceLocation: 'Main Store',
          destinationLocation: 'Branch Store',
          quantity: 10,
          reason: 'Branch inventory replenishment',
        })
        .expect(201);

      // 5. Check for low stock alerts after transfers
      await request(app.getHttpServer())
        .post('/api/v1/inventory/alerts/check')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 6. Generate comprehensive reports
      const stockSummary = await request(app.getHttpServer())
        .get('/api/v1/inventory/stock/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(stockSummary.body).to.be.an('array');
      expect(stockSummary.body.length).to.be.at.least(2);

      // 7. Get final statistics
      const finalStats = await request(app.getHttpServer())
        .get('/api/v1/inventory/products/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalStats.body.totalProducts).to.be.at.least(2);
    });
  });

  describe('Security and Validation Tests', () => {
    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory/products')
        .expect(401);
    });

    it('should reject requests with invalid authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory/products')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should validate product creation data', async () => {
      const invalidProductData = {
        name: '', // Invalid: empty name
        sku: 'INVALID-SKU',
        price: -10, // Invalid: negative price
        categoryId: 'invalid-id', // Invalid: non-existent category
      };

      await request(app.getHttpServer())
        .post('/api/v1/inventory/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProductData)
        .expect(400);
    });

    it('should validate stock movement data', async () => {
      const invalidMovementData = {
        productId: 'invalid-id',
        type: 'INVALID_TYPE',
        quantity: -10,
        reason: '', // Invalid: empty reason
      };

      await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMovementData)
        .expect(400);
    });

    it('should prevent duplicate SKU creation', async () => {
      const duplicateProductData = {
        name: 'Duplicate Product',
        sku: testProduct.sku, // Same SKU as existing product
        price: 99.99,
        categoryId: testProductCategory.id,
      };

      await request(app.getHttpServer())
        .post('/api/v1/inventory/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicateProductData)
        .expect(409); // Conflict
    });

    it('should prevent stock movement that exceeds available stock', async () => {
      const excessiveMovementData = {
        productId: testProduct.id,
        type: 'OUT',
        quantity: 99999, // More than available stock
        reason: 'Excessive movement test',
      };

      await request(app.getHttpServer())
        .post('/api/v1/inventory/stock/movements')
        .set('Authorization', `Bearer ${authToken}`)
        .send(excessiveMovementData)
        .expect(400); // Bad Request
    });
  });

  // Helper functions
  async function getAuthToken(app: INestApplication): Promise<string> {
    // Create a test user first if needed
    const loginData = {
      email: 'inventory.test@example.com',
      password: 'testpassword123',
    };

    try {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      return response.body.accessToken;
    } catch (error) {
      // If login fails, try to register the user first
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          ...loginData,
          firstName: 'Inventory',
          lastName: 'Test',
          role: 'ADMIN',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      return response.body.accessToken;
    }
  }

  async function cleanupTestData() {
    // Clean up in reverse order of creation to avoid foreign key constraints
    if (testStockMovement) {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/stock/movements/${testStockMovement.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {}); // Ignore errors during cleanup
    }

    if (testCostLayer) {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/valuation/cost-layers/${testCostLayer.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    if (testWarehouse) {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/warehouses/${testWarehouse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    if (testProduct) {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }

    if (testProductCategory) {
      await request(app.getHttpServer())
        .delete(`/api/v1/inventory/categories/${testProductCategory.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .catch(() => {});
    }
  }
});