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
import { Customer, Order, Product } from '@prisma/client';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Sales Module API Integration Tests
 *
 * Tests complete sales management functionality including:
 * - Customer management (CRUD)
 * - Order management lifecycle
 * - Order processing and fulfillment
 * - Invoice generation
 * - Payment processing
 * - Credit limit management
 * - Security validation
 * - Business workflow validation
 */
describe('Sales Module API Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  // let adminToken: string; // Unused - removed to fix TS6133
  let managerToken: string;
  let userToken: string;

  // Test data helpers
  let testCustomer: Customer;
  let testProduct: Product;
  let testOrder: Order;

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
    // adminToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN); // Unused - removed to fix TS6133
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

  describe('Customer Management API', () => {
    it('should create a new customer', async () => {
      const customerData = {
        code: `CUST-${Date.now()}`,
        name: 'Test Customer Company',
        email: `test-${Date.now()}@customer.com`,
        phone: '+1234567890',
        address: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        country: 'Test Country',
        postalCode: '12345',
        website: 'https://testcustomer.com',
        taxId: 'TAX123456',
        creditLimit: 10000.00,
        paymentTerms: 'NET30',
        notes: 'Test customer notes',
      };

      const response = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(customerData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.code).to.equal(customerData.code);
      expect(response.body.name).to.equal(customerData.name);
      expect(response.body.email).to.equal(customerData.email);
      expect(response.body.creditLimit).to.equal(customerData.creditLimit);
      expect(response.body.isActive).to.be.true;
      expect(response.body.createdAt).to.be.a('string');

      testCustomer = response.body;
    });

    it('should get all customers with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/sales/customers?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(10);
    });

    it('should search customers by name and email', async () => {
      const response = await request(app.getHttpServer())
        .get('/sales/customers?search=Test Customer')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        expect(response.body.data[0].name).to.include('Test Customer');
      }
    });

    it('should update customer details', async () => {
      const updateData = {
        name: 'Updated Customer Name',
        creditLimit: 15000.00,
        phone: '+0987654321',
      };

      const response = await request(app.getHttpServer())
        .patch(`/sales/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.creditLimit).to.equal(updateData.creditLimit);
      expect(response.body.phone).to.equal(updateData.phone);
    });

    it('should deactivate customer', async () => {
      await request(app.getHttpServer())
        .patch(`/sales/customers/${testCustomer.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ isActive: false })
        .expect(200);

      // Verify customer is inactive
      const response = await request(app.getHttpServer())
        .get(`/sales/customers/${testCustomer.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.isActive).to.be.false;
    });

    it('should validate customer credit limits', async () => {
      // Create customer with low credit limit
      const lowCreditCustomer = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: `LOWCREDIT-${Date.now()}`,
          name: 'Low Credit Customer',
          email: `lowcredit-${Date.now()}@test.com`,
          phone: '+1234567890',
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
          creditLimit: 100.00,
        })
        .expect(201);

      // Try to create order exceeding credit limit
      const orderData = {
        customerId: lowCreditCustomer.body.id,
        items: [{
          productId: testProduct.id,
          quantity: 2,
          unitPrice: 100.00, // Total: $200, exceeds $100 credit limit
        }],
      };

      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(orderData)
        .expect(400); // Should fail due to credit limit
    });
  });

  describe('Order Management API', () => {
    it('should create a new sales order', async () => {
      const orderData = {
        customerId: testCustomer.id,
        description: 'Test sales order',
        currency: 'USD',
        items: [
          {
            productId: testProduct.id,
            quantity: 2,
            unitPrice: 150.00,
            discount: 10.00,
          },
          {
            productId: testProduct.id,
            quantity: 1,
            unitPrice: 200.00,
          },
        ],
        taxRate: 0.08,
        notes: 'Test order notes',
      };

      const response = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.customerId).to.equal(orderData.customerId);
      expect(response.body.status).to.equal('DRAFT');
      expect(response.body.currency).to.equal(orderData.currency);
      expect(response.body.items).to.have.length(2);
      expect(response.body.subtotal).to.be.a('number');
      expect(response.body.totalAmount).to.be.a('number');
      expect(response.body.createdAt).to.be.a('string');

      testOrder = response.body;
    });

    it('should get all orders with filtering', async () => {
      const response = await request(app.getHttpServer())
        .get('/sales/orders?status=DRAFT&customerId=' + testCustomer.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
    });

    it('should update order status through workflow', async () => {
      // Confirm order
      let response = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(response.body.status).to.equal('CONFIRMED');
      expect(response.body.confirmedAt).to.be.a('string');

      // Ship order
      response = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'SHIPPED',
          trackingNumber: 'TRACK123456',
          notes: 'Shipped via UPS'
        })
        .expect(200);

      expect(response.body.status).to.equal('SHIPPED');
      expect(response.body.shippedAt).to.be.a('string');
      expect(response.body.trackingNumber).to.equal('TRACK123456');

      // Deliver order
      response = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(response.body.status).to.equal('DELIVERED');
      expect(response.body.deliveredAt).to.be.a('string');
    });

    it('should cancel order with reason', async () => {
      // Create new order for cancellation test
      const cancelOrder = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 1,
            unitPrice: 100.00,
          }],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/sales/orders/${cancelOrder.body.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'CANCELLED',
          cancellationReason: 'Customer requested cancellation'
        })
        .expect(200);

      expect(response.body.status).to.equal('CANCELLED');
      expect(response.body.isActive).to.be.false;
      expect(response.body.cancellationReason).to.equal('Customer requested cancellation');
      expect(response.body.cancelledAt).to.be.a('string');
    });

    it('should prevent invalid status transitions', async () => {
      // Try to ship unconfirmed order
      await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'SHIPPED' })
        .expect(400); // Should fail - cannot ship unconfirmed order
    });

    it('should calculate order totals correctly', async () => {
      const orderData = {
        customerId: testCustomer.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 3,
            unitPrice: 100.00,
            discount: 10.00,
          },
        ],
        taxRate: 0.10,
        shippingCost: 15.00,
      };

      const response = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(orderData)
        .expect(201);

      const expectedSubtotal = (3 * 100.00) - 10.00; // 300 - 10 = 290
      const expectedTax = expectedSubtotal * 0.10; // 29.00
      const expectedTotal = expectedSubtotal + expectedTax + 15.00; // 290 + 29 + 15 = 334.00

      expect(response.body.subtotal).to.equal(expectedSubtotal);
      expect(response.body.taxAmount).to.equal(expectedTax);
      expect(response.body.totalAmount).to.equal(expectedTotal);
    });
  });

  describe('Order Items Management', () => {
    it('should add items to existing order', async () => {
      const newItem = {
        productId: testProduct.id,
        quantity: 1,
        unitPrice: 75.00,
      };

      const response = await request(app.getHttpServer())
        .post(`/sales/orders/${testOrder.id}/items`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newItem)
        .expect(201);

      expect(response.body.productId).to.equal(newItem.productId);
      expect(response.body.quantity).to.equal(newItem.quantity);
      expect(response.body.unitPrice).to.equal(newItem.unitPrice);
    });

    it('should update order item quantity', async () => {
      const updateData = {
        quantity: 5,
        unitPrice: 120.00,
      };

      const response = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/items/${(testOrder as any).orderItems?.[0]?.id || 'unknown'}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.quantity).to.equal(updateData.quantity);
      expect(response.body.unitPrice).to.equal(updateData.unitPrice);
    });

    it('should remove order item', async () => {
      await request(app.getHttpServer())
        .delete(`/sales/orders/${testOrder.id}/items/${(testOrder as any).orderItems?.[0]?.id || 'unknown'}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(204);

      // Verify item is removed
      const response = await request(app.getHttpServer())
        .get(`/sales/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const removedItem = response.body.orderItems?.find((item: any) => item.id === (testOrder as any).orderItems?.[0]?.id);
      expect(removedItem).to.be.undefined;
    });
  });

  describe('Invoice and Payment Processing', () => {
    it('should generate invoice for order', async () => {
      // First confirm the order
      await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/sales/orders/${testOrder.id}/invoices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          notes: 'Invoice for test order',
        })
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.orderId).to.equal(testOrder.id);
      expect(response.body.invoiceNumber).to.be.a('string');
      expect(response.body.amount).to.equal(testOrder.totalAmount);
      expect(response.body.status).to.equal('DRAFT');
      expect(response.body.dueDate).to.be.a('string');
    });

    it('should record payment for invoice', async () => {
      // Create invoice first
      const invoice = await request(app.getHttpServer())
        .post(`/sales/orders/${testOrder.id}/invoices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const paymentData = {
        amount: invoice.body.amount,
        paymentMethod: 'CREDIT_CARD',
        paymentDate: new Date().toISOString(),
        reference: 'PAY-12345',
        notes: 'Payment via credit card',
      };

      const response = await request(app.getHttpServer())
        .post(`/sales/invoices/${invoice.body.id}/payments`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(paymentData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.invoiceId).to.equal(invoice.body.id);
      expect(response.body.amount).to.equal(paymentData.amount);
      expect(response.body.paymentMethod).to.equal(paymentData.paymentMethod);
      expect(response.body.status).to.equal('COMPLETED');
    });
  });

  describe('Security and Validation', () => {
    it('should prevent XSS in customer data', async () => {
      const maliciousCustomer = {
        code: `XSS-${Date.now()}`,
        name: '<script>alert("XSS")</script>Malicious Customer',
        email: `xss-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      };

      const response = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(maliciousCustomer)
        .expect(201);

      // Customer should be created but XSS should be sanitized
      expect(response.body.name).to.not.include('<script>');
      expect(response.body.name).to.include('Malicious Customer');
    });

    it('should validate email formats', async () => {
      const invalidCustomer = {
        code: `INVALID-${Date.now()}`,
        name: 'Invalid Email Customer',
        email: 'invalid-email-format',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      };

      await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidCustomer)
        .expect(400); // Should fail due to invalid email
    });

    it('should enforce authorization on order creation', async () => {
      const orderData = {
        customerId: testCustomer.id,
        items: [{
          productId: testProduct.id,
          quantity: 1,
          unitPrice: 100.00,
        }],
      };

      // Regular user should not be able to create orders
      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(403);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousSearch = "'; DROP TABLE customers; --";

      const response = await request(app.getHttpServer())
        .get(`/sales/customers?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should not crash and should return empty results or safe handling
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent order creation', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/sales/orders')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              customerId: testCustomer.id,
              items: [{
                productId: testProduct.id,
                quantity: 1,
                unitPrice: 100.00,
              }],
            })
        );
      }

      const results = await Promise.allSettled(promises);

      // Most requests should succeed (some might fail due to concurrency)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.be.greaterThan(0);
    });

    it('should handle large order with many items', async () => {
      const manyItems = [];
      for (let i = 0; i < 10; i++) {
        manyItems.push({
          productId: testProduct.id,
          quantity: 1,
          unitPrice: 10.00 + i,
        });
      }

      const response = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          customerId: testCustomer.id,
          items: manyItems,
        })
        .expect(201);

      expect(response.body.items).to.have.length(10);
      expect(response.body.totalAmount).to.be.a('number');
    });
  });

  /**
   * Helper Functions
   */

  async function setupTestData(): Promise<void> {
    try {
      // Create test customer
      testCustomer = await prismaService.customer.create({
        data: {
          code: `CUST-${Date.now()}`,
          name: `Test Customer ${Date.now()}`,
          email: `test-${Date.now()}@customer.com`,
          phone: '+1234567890',
          address: '123 Test Street',
          city: 'Test City',
          country: 'Test Country',
          creditLimit: 10000.00,
          isActive: true,
        },
      });

      // Create test product (assuming products exist or creating minimal product)
      testProduct = await prismaService.product.create({
        data: {
          name: `Test Product ${Date.now()}`,
          sku: `PROD-${Date.now()}`,
          price: 100.00,
          stockQuantity: 1000,
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

      // Clean up payments first
      await prismaService.payment.deleteMany({
        where: {
          invoice: {
            order: {
              customerId: { startsWith: 'CUST-' },
            },
          },
        },
      });

      // Clean up invoices
      await prismaService.invoice.deleteMany({
        where: {
          order: {
            customerId: { startsWith: 'CUST-' },
          },
        },
      });

      // Clean up order items
      await prismaService.orderItem.deleteMany({
        where: {
          order: {
            customerId: { startsWith: 'CUST-' },
          },
        },
      });

      // Clean up orders
      await prismaService.order.deleteMany({
        where: {
          customerId: { startsWith: 'CUST-' },
        },
      });

      // Clean up products
      await prismaService.product.deleteMany({
        where: {
          sku: { startsWith: 'PROD-' },
        },
      });

      // Clean up customers
      await prismaService.customer.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'CUST-' } },
            { code: { startsWith: 'XSS-' } },
            { code: { startsWith: 'INVALID-' } },
            { code: { startsWith: 'LOWCREDIT-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});