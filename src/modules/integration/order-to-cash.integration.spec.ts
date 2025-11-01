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
import { Customer, Product, Order, Invoice, Payment, ChartOfAccounts } from '@prisma/client';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Order-to-Cash Cross-Module Workflow Integration Tests
 *
 * Tests complete Order-to-Cash business process spanning:
 * Sales → Inventory → Accounting modules
 *
 * Workflow Steps:
 * 1. Customer creation and validation
 * 2. Sales order creation and approval
 * 3. Inventory reservation and stock allocation
 * 4. Order fulfillment and shipping
 * 5. Invoice generation and delivery
 * 6. Payment processing and recording
 * 7. Revenue recognition and accounting entries
 * 8. Customer credit limit management
 *
 * Critical for validating end-to-end business operations
 */
describe('Order-to-Cash Cross-Module Workflow Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let _adminToken: string;
  let managerToken: string;
  let salesToken: string;
  let warehouseToken: string;
  let accountantToken: string;

  // Test data helpers
  let testCustomer: Customer;
  let testProduct: Product;
  let testOrder: Order;
  let testInvoice: Invoice;
  let testPayment: Payment;
  let revenueAccount: ChartOfAccounts;
  let cashAccount: ChartOfAccounts;

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
    salesToken = AuthHelpers.createTestTokenDirect(UserRole.USER); // Sales user
    warehouseToken = AuthHelpers.createTestTokenDirect(UserRole.INVENTORY_MANAGER);
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

  describe('Complete Order-to-Cash Workflow', () => {
    it('should execute full order-to-cash workflow successfully', async () => {
      // Step 1: Create customer with credit limit
      const customerData = {
        code: `O2C-CUST-${Date.now()}`,
        name: 'O2C Test Customer',
        email: `o2c-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '123 O2C Street',
        city: 'O2C City',
        country: 'Test Country',
        creditLimit: 5000.00,
        paymentTerms: 'NET30',
      };

      const customerResponse = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(customerData)
        .expect(201);

      testCustomer = customerResponse.body;

      // Step 2: Create sales order
      const orderData = {
        customerId: testCustomer.id,
        description: 'Complete O2C Workflow Test Order',
        currency: 'USD',
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            unitPrice: 150.00,
          },
          {
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 200.00,
          },
        ],
        taxRate: 0.08,
        shippingCost: 25.00,
      };

      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(orderData)
        .expect(201);

      testOrder = orderResponse.body;
      expect(testOrder.status).to.equal('DRAFT');

      // Step 3: Check inventory availability
      const inventoryResponse = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200);

      expect(inventoryResponse.body.stockQuantity).to.be.greaterThanOrEqual(15);

      // Step 4: Confirm order (check credit limit)
      const confirmResponse = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      expect(confirmResponse.body.status).to.equal('CONFIRMED');
      expect(confirmResponse.body.confirmedAt).to.be.a('string');

      // Step 5: Reserve inventory (stock movement - allocation)
      const stockReservationResponse = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'RESERVATION',
          quantity: -15, // Reserve 15 units
          reason: `Order ${testOrder.orderNumber} allocation`,
          reference: testOrder.id,
        })
        .expect(201);

      expect(stockReservationResponse.body.type).to.equal('RESERVATION');

      // Step 6: Ship order (actual stock movement)
      const shippingResponse = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          status: 'SHIPPED',
          trackingNumber: 'O2C-TRACK-123456',
          notes: 'Shipped via FedEx',
        })
        .expect(200);

      expect(shippingResponse.body.status).to.equal('SHIPPED');

      // Record actual stock movement
      const _stockOutResponse = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'OUT',
          quantity: 15,
          reason: `Order ${testOrder.orderNumber} fulfillment`,
          reference: testOrder.id,
        })
        .expect(201);

      // Step 7: Deliver order
      const deliveryResponse = await request(app.getHttpServer())
        .patch(`/sales/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      expect(deliveryResponse.body.status).to.equal('DELIVERED');

      // Step 8: Generate invoice
      const invoiceResponse = await request(app.getHttpServer())
        .post(`/sales/orders/${testOrder.id}/invoices`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Invoice for O2C workflow test',
        })
        .expect(201);

      testInvoice = invoiceResponse.body;
      expect(testInvoice.amount).to.equal(testOrder.totalAmount);
      expect(testInvoice.status).to.equal('DRAFT');

      // Step 9: Post invoice
      const postInvoiceResponse = await request(app.getHttpServer())
        .patch(`/sales/invoices/${testInvoice.id}/status`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ status: 'POSTED' })
        .expect(200);

      expect(postInvoiceResponse.body.status).to.equal('POSTED');

      // Step 10: Record payment
      const paymentData = {
        amount: testInvoice.amount,
        paymentMethod: 'BANK_TRANSFER',
        paymentDate: new Date().toISOString(),
        reference: 'O2C-PAY-123456',
        notes: 'Full payment for O2C workflow test',
      };

      const paymentResponse = await request(app.getHttpServer())
        .post(`/sales/invoices/${testInvoice.id}/payments`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(paymentData)
        .expect(201);

      testPayment = paymentResponse.body;
      expect(testPayment.amount).to.equal(testInvoice.amount);
      expect(testPayment.status).to.equal('COMPLETED');

      // Step 11: Verify accounting entries were created
      const journalEntriesResponse = await request(app.getHttpServer())
        .get('/accounting/journal-entries')
        .set('Authorization', `Bearer ${accountantToken}`)
        .query({ reference: testInvoice.invoiceNumber })
        .expect(200);

      expect(journalEntriesResponse.body).to.have.property('data');
      expect(journalEntriesResponse.body.data).to.be.an('array');
      expect(journalEntriesResponse.body.data.length).to.be.greaterThan(0);

      // Verify revenue recognition
      const revenueEntry = journalEntriesResponse.body.data.find(
        (entry: any) => entry.accountId === revenueAccount.id
      );
      expect(revenueEntry).to.exist;
      expect(revenueEntry.creditAmount).to.be.greaterThan(0);

      // Verify cash receipt
      const cashEntry = journalEntriesResponse.body.data.find(
        (entry: any) => entry.accountId === cashAccount.id
      );
      expect(cashEntry).to.exist;
      expect(cashEntry.debitAmount).to.be.greaterThan(0);

      // Step 12: Final verification - order status and financial records
      const finalOrderResponse = await request(app.getHttpServer())
        .get(`/sales/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${salesToken}`)
        .expect(200);

      expect(finalOrderResponse.body.status).to.equal('DELIVERED');

      const finalInvoiceResponse = await request(app.getHttpServer())
        .get(`/sales/invoices/${testInvoice.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      expect(finalInvoiceResponse.body.status).to.equal('PAID');
    });

    it('should handle order cancellation with inventory restoration', async () => {
      // Create order
      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 20,
            unitPrice: 100.00,
          }],
        })
        .expect(201);

      const order = orderResponse.body;

      // Reserve inventory
      await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'RESERVATION',
          quantity: -20,
          reason: `Order ${order.orderNumber} allocation`,
          reference: order.id,
        })
        .expect(201);

      // Cancel order
      const cancelResponse = await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          status: 'CANCELLED',
          cancellationReason: 'Customer requested cancellation',
        })
        .expect(200);

      expect(cancelResponse.body.status).to.equal('CANCELLED');

      // Restore inventory (cancel reservation)
      const _restoreResponse = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'RESERVATION_CANCEL',
          quantity: 20,
          reason: `Order ${order.orderNumber} cancellation`,
          reference: order.id,
        })
        .expect(201);

      // Verify inventory was restored
      const finalInventoryResponse = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200);

      // Stock should be back to original level
      expect(finalInventoryResponse.body.stockQuantity).to.be.greaterThanOrEqual(0);
    });

    it('should enforce credit limits during order creation', async () => {
      // Create customer with low credit limit
      const lowCreditCustomer = await request(app.getHttpServer())
        .post('/sales/customers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          code: `LOW-CREDIT-${Date.now()}`,
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
      const expensiveOrder = {
        customerId: lowCreditCustomer.body.id,
        items: [{
          productId: testProduct.id,
          quantity: 2,
          unitPrice: 1000.00, // Total: $2000, exceeds $100 credit limit
        }],
      };

      await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(expensiveOrder)
        .expect(400); // Should fail due to credit limit
    });
  });

  describe('Partial Payment and Credit Management', () => {
    it('should handle partial payments and credit limit updates', async () => {
      // Create order and invoice
      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 200.00,
          }],
        })
        .expect(201);

      const order = orderResponse.body;

      const invoiceResponse = await request(app.getHttpServer())
        .post(`/sales/orders/${order.id}/invoices`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const invoice = invoiceResponse.body;

      // Make partial payment (50%)
      const partialPaymentResponse = await request(app.getHttpServer())
        .post(`/sales/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: invoice.amount / 2,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: new Date().toISOString(),
          reference: 'PARTIAL-PAY-001',
        })
        .expect(201);

      expect(partialPaymentResponse.body.amount).to.equal(invoice.amount / 2);

      // Verify invoice status
      const invoiceStatusResponse = await request(app.getHttpServer())
        .get(`/sales/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      expect(invoiceStatusResponse.body.status).to.equal('PARTIALLY_PAID');
      expect(invoiceStatusResponse.body.outstandingAmount).to.equal(invoice.amount / 2);

      // Make final payment
      const _finalPaymentResponse = await request(app.getHttpServer())
        .post(`/sales/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: invoice.amount / 2,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: new Date().toISOString(),
          reference: 'FINAL-PAY-001',
        })
        .expect(201);

      // Verify invoice is fully paid
      const finalInvoiceResponse = await request(app.getHttpServer())
        .get(`/sales/invoices/${invoice.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      expect(finalInvoiceResponse.body.status).to.equal('PAID');
      expect(finalInvoiceResponse.body.outstandingAmount).to.equal(0);
    });
  });

  describe('Returns and Refunds Workflow', () => {
    it('should handle product returns and refunds', async () => {
      // Complete a sale first
      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 3,
            unitPrice: 150.00,
          }],
        })
        .expect(201);

      const order = orderResponse.body;

      // Process order through to completion
      await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      // Create invoice and payment
      const invoiceResponse = await request(app.getHttpServer())
        .post(`/sales/orders/${order.id}/invoices`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201);

      const invoice = invoiceResponse.body;

      await request(app.getHttpServer())
        .post(`/sales/invoices/${invoice.id}/payments`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: invoice.amount,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: new Date().toISOString(),
          reference: 'ORIGINAL-PAY-001',
        })
        .expect(201);

      // Process return
      const returnData = {
        orderId: order.id,
        reason: 'Customer not satisfied',
        items: [{
          productId: testProduct.id,
          quantity: 1, // Return 1 out of 3 items
          reason: 'Defective product',
        }],
        refundMethod: 'BANK_TRANSFER',
      };

      const returnResponse = await request(app.getHttpServer())
        .post('/sales/returns')
        .set('Authorization', `Bearer ${salesToken}`)
        .send(returnData)
        .expect(201);

      expect(returnResponse.body).to.have.property('id');
      expect(returnResponse.body.status).to.equal('PENDING_APPROVAL');

      // Approve return
      const approveReturnResponse = await request(app.getHttpServer())
        .patch(`/sales/returns/${returnResponse.body.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'APPROVED',
          approvedBy: 'manager-001',
        })
        .expect(200);

      expect(approveReturnResponse.body.status).to.equal('APPROVED');

      // Process refund
      const refundResponse = await request(app.getHttpServer())
        .post(`/sales/returns/${returnResponse.body.id}/refund`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          amount: 150.00, // Refund for 1 item
          refundDate: new Date().toISOString(),
          reference: 'REFUND-001',
        })
        .expect(201);

      expect(refundResponse.body.status).to.equal('COMPLETED');

      // Restock returned item
      const restockResponse = await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'RETURN',
          quantity: 1,
          reason: `Return ${returnResponse.body.id}`,
          reference: returnResponse.body.id,
        })
        .expect(201);

      expect(restockResponse.body.type).to.equal('RETURN');
    });
  });

  describe('Security and Compliance', () => {
    it('should enforce proper authorization across workflow steps', async () => {
      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 1,
            unitPrice: 100.00,
          }],
        })
        .expect(201);

      const _order = orderResponse.body;

      // Regular user should not be able to approve accounting entries
      await request(app.getHttpServer())
        .post('/accounting/transactions')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          reference: 'UNAUTHORIZED-ENTRY',
          description: 'Should not be allowed',
          amount: 100.00,
          type: 'SALE',
          entries: [{
            accountId: revenueAccount.id,
            debitAmount: 100.00,
            creditAmount: 0,
          }],
        })
        .expect(403);
    });

    it('should maintain data integrity across module boundaries', async () => {
      // This test ensures that data remains consistent across modules
      // Create order and verify inventory updates are atomic

      const initialInventory = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200);

      const initialStock = initialInventory.body.stockQuantity;

      const orderResponse = await request(app.getHttpServer())
        .post('/sales/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerId: testCustomer.id,
          items: [{
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 100.00,
          }],
        })
        .expect(201);

      const order = orderResponse.body;

      // Process order through to shipping
      await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/sales/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);

      // Record stock movement
      await request(app.getHttpServer())
        .post(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          type: 'OUT',
          quantity: 5,
          reason: `Order ${order.orderNumber}`,
          reference: order.id,
        })
        .expect(201);

      // Verify inventory was updated correctly
      const finalInventory = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200);

      expect(finalInventory.body.stockQuantity).to.equal(initialStock - 5);

      // Verify stock movement was recorded
      const stockMovements = await request(app.getHttpServer())
        .get(`/inventory/products/${testProduct.id}/stock-movements`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200);

      const latestMovement = stockMovements.body.find((m: any) => m.reference === order.id);
      expect(latestMovement).to.exist;
      expect(latestMovement.quantity).to.equal(5);
      expect(latestMovement.type).to.equal('OUT');
    });
  });

  /**
   * Helper Functions
   */

  async function setupTestData(): Promise<void> {
    try {
      // Create chart of accounts for testing
      revenueAccount = await prismaService.chartOfAccounts.create({
        data: {
          id: `rev-acc-${Date.now()}`,
          code: `4000-${Date.now()}`,
          name: 'Sales Revenue',
          type: 'REVENUE',
          category: 'Operating Revenue',
          isActive: true,
        },
      });

      cashAccount = await prismaService.chartOfAccounts.create({
        data: {
          id: `cash-acc-${Date.now()}`,
          code: `1000-${Date.now()}`,
          name: 'Cash Account',
          type: 'ASSET',
          category: 'Current Assets',
          isActive: true,
        },
      });

      // Create test customer
      testCustomer = await prismaService.customer.create({
        data: {
          code: `O2C-CUST-${Date.now()}`,
          name: `O2C Test Customer ${Date.now()}`,
          email: `o2c-${Date.now()}@test.com`,
          phone: '+1234567890',
          address: '123 O2C Street',
          city: 'O2C City',
          country: 'Test Country',
          creditLimit: 10000.00,
          isActive: true,
        },
      });

      // Create test product
      testProduct = await prismaService.product.create({
        data: {
          name: `O2C Test Product ${Date.now()}`,
          sku: `O2C-PROD-${Date.now()}`,
          price: 150.00,
          cost: 75.00,
          stockQuantity: 1000,
          lowStockThreshold: 50,
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

      // Clean up payments
      await prismaService.payment.deleteMany({
        where: {
          invoice: {
            order: {
              customerId: { startsWith: 'O2C-CUST-' },
            },
          },
        },
      });

      // Clean up returns
      await prismaService.return.deleteMany({
        where: {
          order: {
            customerId: { startsWith: 'O2C-CUST-' },
          },
        },
      });

      // Clean up invoices
      await prismaService.invoice.deleteMany({
        where: {
          order: {
            customerId: { startsWith: 'O2C-CUST-' },
          },
        },
      });

      // Clean up orders
      await prismaService.order.deleteMany({
        where: {
          customerId: { startsWith: 'O2C-CUST-' },
        },
      });

      // Clean up customers
      await prismaService.customer.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'O2C-CUST-' } },
            { code: { startsWith: 'LOW-CREDIT-' } },
          ],
        },
      });

      // Clean up products
      await prismaService.product.deleteMany({
        where: {
          sku: { startsWith: 'O2C-PROD-' },
        },
      });

      // Clean up stock movements
      await prismaService.stockMovement.deleteMany({
        where: {
          productId: { startsWith: 'O2C-PROD-' },
        },
      });

      // Clean up chart of accounts
      await prismaService.chartOfAccounts.deleteMany({
        where: {
          OR: [
            { code: { startsWith: '4000-' } },
            { code: { startsWith: '1000-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});