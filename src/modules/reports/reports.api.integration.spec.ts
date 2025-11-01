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
import { Product, ProductCategory, Customer, Order, Supplier, PurchaseOrder } from '@prisma/client';
import { ReportsModule } from './reports.module';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Reports Module API Integration Tests
 *
 * Tests complete reporting functionality including:
 * - Sales reports and analytics
 * - Inventory reports
 * - Purchasing reports
 * - Financial reports
 * - Customer and supplier reports
 * - Scheduled reports
 * - Report export functionality
 * - Security and authorization
 * - Performance with large datasets
 */
describe('Reports Module API Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let accountantToken: string;

  // Test data helpers
  const testProducts: Product[] = [];
  const testCustomers: Customer[] = [];
  const testOrders: Order[] = [];
  const testSuppliers: Supplier[] = [];
  const testPurchaseOrders: PurchaseOrder[] = [];

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
        ReportsModule,
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
    accountantToken = AuthHelpers.createTestTokenDirect(UserRole.ACCOUNTANT);
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

  describe('Sales Reports API', () => {
    it('should generate sales summary report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        endDate: new Date().toISOString(),
        groupBy: 'day',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.data).to.be.an('array');
      expect(response.body.summary).to.have.property('totalRevenue');
      expect(response.body.summary).to.have.property('totalOrders');
      expect(response.body.summary).to.have.property('averageOrderValue');
    });

    it('should generate top customers report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        limit: 10,
        sortBy: 'revenue',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/top-customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('customer');
        expect(response.body[0]).to.have.property('totalRevenue');
        expect(response.body[0]).to.have.property('orderCount');
      }
    });

    it('should generate product sales performance report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        categoryId: testProducts[0]?.categoryId || null,
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/product-performance')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('product');
        expect(response.body[0]).to.have.property('quantitySold');
        expect(response.body[0]).to.have.property('revenue');
      }
    });

    it('should generate sales by region report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupBy: 'country',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/by-region')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('region');
        expect(response.body[0]).to.have.property('revenue');
        expect(response.body[0]).to.have.property('orderCount');
      }
    });
  });

  describe('Inventory Reports API', () => {
    it('should generate inventory valuation report', async () => {
      const reportParams = {
        asOfDate: new Date().toISOString(),
        includeInactive: false,
      };

      const response = await request(app.getHttpServer())
        .post('/reports/inventory/valuation')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalValue');
      expect(response.body.summary).to.have.property('totalItems');
      expect(response.body).to.have.property('categories');
      expect(response.body.categories).to.be.an('array');
    });

    it('should generate low stock report', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/inventory/low-stock')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('product');
        expect(response.body[0]).to.have.property('currentStock');
        expect(response.body[0]).to.have.property('lowStockThreshold');
        expect(response.body[0]).to.have.property('recommendedOrder');
      }
    });

    it('should generate stock movement report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        movementType: 'ALL',
        productId: testProducts[0]?.id || null,
      };

      const response = await request(app.getHttpServer())
        .post('/reports/inventory/stock-movements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.data).to.be.an('array');
      expect(response.body.summary).to.have.property('totalIn');
      expect(response.body.summary).to.have.property('totalOut');
    });

    it('should generate inventory turnover report', async () => {
      const reportParams = {
        period: 'monthly',
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post('/reports/inventory/turnover')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('product');
        expect(response.body[0]).to.have.property('turnoverRatio');
        expect(response.body[0]).to.have.property('averageStock');
      }
    });
  });

  describe('Purchasing Reports API', () => {
    it('should generate purchasing summary report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupBy: 'supplier',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/purchasing/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalSpend');
      expect(response.body.summary).to.have.property('totalOrders');
      expect(response.body.summary).to.have.property('averageOrderValue');
    });

    it('should generate supplier performance report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        metrics: ['onTimeDelivery', 'quality', 'price'],
      };

      const response = await request(app.getHttpServer())
        .post('/reports/purchasing/supplier-performance')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('supplier');
        expect(response.body[0]).to.have.property('totalSpend');
        expect(response.body[0]).to.have.property('orderCount');
        expect(response.body[0]).to.have.property('performance');
      }
    });

    it('should generate purchase order status report', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/purchasing/po-status')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('draft');
      expect(response.body.summary).to.have.property('pending');
      expect(response.body.summary).to.have.property('approved');
      expect(response.body.summary).to.have.property('sent');
      expect(response.body.summary).to.have.property('completed');
    });
  });

  describe('Financial Reports API', () => {
    it('should generate revenue report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupBy: 'month',
        includeProjections: true,
      };

      const response = await request(app.getHttpServer())
        .post('/reports/financial/revenue')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalRevenue');
      expect(response.body.summary).to.have.property('growthRate');
    });

    it('should generate profit and loss report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        groupBy: 'quarter',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/financial/profit-loss')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalRevenue');
      expect(response.body.summary).to.have.property('totalExpenses');
      expect(response.body.summary).to.have.property('netProfit');
    });

    it('should generate cash flow report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        type: 'monthly',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/financial/cash-flow')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('openingBalance');
      expect(response.body.summary).to.have.property('closingBalance');
      expect(response.body.summary).to.have.property('netCashFlow');
    });
  });

  describe('Customer Reports API', () => {
    it('should generate customer analysis report', async () => {
      const reportParams = {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        includeInactive: false,
      };

      const response = await request(app.getHttpServer())
        .post('/reports/customers/analysis')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalCustomers');
      expect(response.body.summary).to.have.property('activeCustomers');
      expect(response.body.summary).to.have.property('newCustomers');
      expect(response.body).to.have.property('churnedCustomers');
    });

    it('should generate customer lifetime value report', async () => {
      const reportParams = {
        minOrders: 1,
        groupBy: 'cohort',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/customers/lifetime-value')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(reportParams)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('cohort');
        expect(response.body[0]).to.have.property('averageLifetimeValue');
        expect(response.body[0]).to.have.property('customerCount');
      }
    });
  });

  describe('Report Export and Scheduling', () => {
    it('should export sales report to CSV', async () => {
      const exportParams = {
        reportType: 'sales-summary',
        format: 'csv',
        parameters: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
      };

      const response = await request(app.getHttpServer())
        .post('/reports/export')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(exportParams)
        .expect(200);

      expect(response.headers['content-type']).to.include('text/csv');
      expect(response.headers['content-disposition']).to.include('attachment');
    });

    it('should export report to PDF', async () => {
      const exportParams = {
        reportType: 'inventory-valuation',
        format: 'pdf',
        parameters: {
          asOfDate: new Date().toISOString(),
        },
      };

      const response = await request(app.getHttpServer())
        .post('/reports/export')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(exportParams)
        .expect(200);

      expect(response.headers['content-type']).to.include('application/pdf');
      expect(response.headers['content-disposition']).to.include('attachment');
    });

    it('should create scheduled report', async () => {
      const scheduleData = {
        name: 'Monthly Sales Report',
        reportType: 'sales-summary',
        schedule: {
          frequency: 'monthly',
          dayOfMonth: 1,
          time: '09:00',
        },
        parameters: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        recipients: ['manager@test.com', 'sales@test.com'],
        format: 'pdf',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(scheduleData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(scheduleData.name);
      expect(response.body.isActive).to.be.true;
    });

    it('should get list of scheduled reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).to.be.an('array');
    });

    it('should update scheduled report', async () => {
      // First create a scheduled report
      const schedule = await request(app.getHttpServer())
        .post('/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Schedule',
          reportType: 'sales-summary',
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 1,
            time: '10:00',
          },
        })
        .expect(201);

      // Update it
      const updateData = {
        name: 'Updated Test Schedule',
        schedule: {
          frequency: 'monthly',
          dayOfMonth: 15,
          time: '14:00',
        },
      };

      const response = await request(app.getHttpServer())
        .patch(`/reports/schedule/${schedule.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.schedule.frequency).to.equal(updateData.schedule.frequency);
    });
  });

  describe('Security and Authorization', () => {
    it('should restrict financial reports to accountants and admins', async () => {
      await request(app.getHttpServer())
        .post('/reports/financial/revenue')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        })
        .expect(403); // Regular user should not have access
    });

    it('should allow managers to access sales and inventory reports', async () => {
      const response = await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body).to.have.property('data');
    });

    it('should validate report parameters', async () => {
      const invalidParams = {
        startDate: 'invalid-date',
        endDate: new Date().toISOString(),
      };

      await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidParams)
        .expect(400); // Should fail due to invalid date
    });

    it('should prevent SQL injection in report filters', async () => {
      const maliciousParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        customerId: "'; DROP TABLE customers; --",
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(maliciousParams)
        .expect(200);

      // Should not crash and should return empty or safe results
      expect(response.body).to.have.property('data');
    });
  });

  describe('Performance and Large Datasets', () => {
    it('should handle reports with large date ranges', async () => {
      const largeRangeParams = {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        endDate: new Date().toISOString(),
        groupBy: 'month',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(largeRangeParams)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
    });

    it('should handle concurrent report requests', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/reports/inventory/valuation')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              asOfDate: new Date().toISOString(),
            })
        );
      }

      const results = await Promise.allSettled(promises);

      // All requests should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.equal(concurrentRequests);
    });

    it('should handle report generation timeout gracefully', async () => {
      // Create a complex report that might take time
      const complexParams = {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        includeDetails: true,
        includeProjections: true,
        groupBy: 'day',
      };

      const response = await request(app.getHttpServer())
        .post('/reports/sales/summary')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(complexParams)
        .timeout(30000) // 30 second timeout
        .expect(200);

      expect(response.body).to.have.property('data');
    });
  });

  /**
   * Helper Functions
   */

  async function setupTestData(): Promise<void> {
    try {
      // Create test categories first
      const testCategories: ProductCategory[] = [];
      for (let i = 0; i < 5; i++) {
        const category = await prismaService.productCategory.create({
          data: {
            name: `Reports Test Category ${i + 1}`,
            description: `Test category ${i + 1} for reports integration tests`,
            isActive: true,
          },
        });
        testCategories.push(category);
      }

      // Create test products
      for (let i = 0; i < 5; i++) {
        const product = await prismaService.product.create({
          data: {
            name: `Test Product ${i + 1}`,
            sku: `PROD-${Date.now()}-${i}`,
            price: 100.00 + (i * 10),
            stockQuantity: 100 + (i * 20),
            categoryId: testCategories[i].id,
            isActive: true,
          },
        });
        testProducts.push(product);
      }

      // Create test customers
      for (let i = 0; i < 3; i++) {
        const customer = await prismaService.customer.create({
          data: {
            code: `CUST-${Date.now()}-${i}`,
            name: `Test Customer ${i + 1}`,
            email: `customer${i + 1}-${Date.now()}@test.com`,
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 10000.00,
            isActive: true,
          },
        });
        testCustomers.push(customer);
      }

      // Create test orders
      for (let i = 0; i < testCustomers.length; i++) {
        const order = await prismaService.order.create({
          data: {
            customerId: testCustomers[i].id,
            orderNumber: `ORD-${Date.now()}-${i}`,
            status: 'DELIVERED',
            currency: 'USD',
            totalAmount: 500.00 + (i * 100),
            createdAt: new Date(Date.now() - (i * 5) * 24 * 60 * 60 * 1000), // Different dates
            deliveredAt: new Date(Date.now() - (i * 5) * 24 * 60 * 60 * 1000),
          },
        });
        testOrders.push(order);
      }

      // Create test suppliers
      for (let i = 0; i < 2; i++) {
        const supplier = await prismaService.supplier.create({
          data: {
            code: `SUP-${Date.now()}-${i}`,
            name: `Test Supplier ${i + 1}`,
            email: `supplier${i + 1}-${Date.now()}@test.com`,
            phone: '+1234567890',
            address: '456 Supplier St',
            city: 'Supplier City',
            country: 'Supplier Country',
            paymentTerms: 'NET30',
            isActive: true,
          },
        });
        testSuppliers.push(supplier);
      }

      // Create test purchase orders
      for (let i = 0; i < testSuppliers.length; i++) {
        const po = await prismaService.purchaseOrder.create({
          data: {
            supplierId: testSuppliers[i].id,
            status: 'COMPLETED',
            currency: 'USD',
            totalAmount: 300.00 + (i * 50),
            createdAt: new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - (i * 3) * 24 * 60 * 60 * 1000),
          },
        });
        testPurchaseOrders.push(po);
      }
    } catch (error) {
      console.error('Error setting up test data:', error);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in correct order to respect foreign key constraints
      const timestampPattern = Date.now().toString().substring(0, 9);

      // Clean up orders and related data
      await prismaService.order.deleteMany({
        where: {
          orderNumber: { contains: `ORD-${timestampPattern}` },
        },
      });

      // Clean up purchase orders
      await prismaService.purchaseOrder.deleteMany({
        where: {
          supplierId: { startsWith: 'SUP-' },
        },
      });

      // Clean up customers
      await prismaService.customer.deleteMany({
        where: {
          code: { startsWith: 'CUST-' },
        },
      });

      // Clean up suppliers
      await prismaService.supplier.deleteMany({
        where: {
          code: { startsWith: 'SUP-' },
        },
      });

      // Clean up products
      await prismaService.product.deleteMany({
        where: {
          sku: { startsWith: 'PROD-' },
        },
      });

      // Clean up categories
      await prismaService.productCategory.deleteMany({
        where: {
          name: { startsWith: 'Reports Test Category' },
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});