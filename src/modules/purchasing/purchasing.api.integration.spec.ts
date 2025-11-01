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
import { Supplier, PurchaseOrder, Product } from '@prisma/client';
import 'chai/register-should';
import 'chai/register-expect';

// Declare Mocha globals for TypeScript
declare let before: any;
declare let after: any;
declare let beforeEach: any;
declare let _afterEach: any;

/**
 * Purchasing Module API Integration Tests
 *
 * Tests complete purchasing management functionality including:
 * - Supplier management (CRUD)
 * - Purchase order lifecycle management
 * - Supplier approval workflows
 * - Goods receipt processing
 * - Invoice validation
 * - Payment processing
 * - Security validation
 * - Procure-to-Pay workflow validation
 */
describe('Purchasing Module API Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  // let adminToken: string; // Unused - removed to fix TS6133
  let managerToken: string;
  let userToken: string;

  // Test data helpers
  let testSupplier: Supplier;
  let testProduct: Product;
  let testPurchaseOrder: PurchaseOrder;

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

  describe('Supplier Management API', () => {
    it('should create a new supplier', async () => {
      const supplierData = {
        code: `SUP-${Date.now()}`,
        name: 'Test Supplier Company',
        email: `supplier-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '456 Supplier Street',
        city: 'Supplier City',
        state: 'Supplier State',
        country: 'Supplier Country',
        postalCode: '54321',
        website: 'https://testsupplier.com',
        taxId: 'SUP-TAX123',
        paymentTerms: 'NET60',
        contactPerson: 'John Supplier',
        contactEmail: 'john@testsupplier.com',
        contactPhone: '+1234567891',
        notes: 'Test supplier notes',
        isActive: true,
      };

      const response = await request(app.getHttpServer())
        .post('/purchasing/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(supplierData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.code).to.equal(supplierData.code);
      expect(response.body.name).to.equal(supplierData.name);
      expect(response.body.email).to.equal(supplierData.email);
      expect(response.body.paymentTerms).to.equal(supplierData.paymentTerms);
      expect(response.body.isActive).to.be.true;
      expect(response.body.createdAt).to.be.a('string');

      testSupplier = response.body;
    });

    it('should get all suppliers with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/purchasing/suppliers?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(10);
    });

    it('should search suppliers by name and code', async () => {
      const response = await request(app.getHttpServer())
        .get('/purchasing/suppliers?search=Test Supplier')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        expect(response.body.data[0].name).to.include('Test Supplier');
      }
    });

    it('should update supplier details', async () => {
      const updateData = {
        name: 'Updated Supplier Name',
        paymentTerms: 'NET30',
        phone: '+0987654321',
        notes: 'Updated supplier notes',
      };

      const response = await request(app.getHttpServer())
        .patch(`/purchasing/suppliers/${testSupplier.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.paymentTerms).to.equal(updateData.paymentTerms);
      expect(response.body.phone).to.equal(updateData.phone);
    });

    it('should deactivate supplier', async () => {
      await request(app.getHttpServer())
        .patch(`/purchasing/suppliers/${testSupplier.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ isActive: false })
        .expect(200);

      // Verify supplier is inactive
      const response = await request(app.getHttpServer())
        .get(`/purchasing/suppliers/${testSupplier.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.isActive).to.be.false;
    });

    it('should validate supplier data', async () => {
      const invalidSupplier = {
        code: '', // Empty code
        name: 'Invalid Supplier',
        email: 'invalid-email', // Invalid email
        phone: '',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
      };

      await request(app.getHttpServer())
        .post('/purchasing/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidSupplier)
        .expect(400); // Should fail due to validation errors
    });
  });

  describe('Purchase Order Management API', () => {
    it('should create a new purchase order', async () => {
      const orderData = {
        supplierId: testSupplier.id,
        description: 'Test purchase order',
        currency: 'USD',
        expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            unitPrice: 25.00,
            expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 30.00,
            expectedDeliveryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        notes: 'Test purchase order notes',
      };

      const response = await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.supplierId).to.equal(orderData.supplierId);
      expect(response.body.status).to.equal('DRAFT');
      expect(response.body.currency).to.equal(orderData.currency);
      expect(response.body.items).to.have.length(2);
      expect(response.body.subtotal).to.be.a('number');
      expect(response.body.totalAmount).to.be.a('number');
      expect(response.body.createdAt).to.be.a('string');

      testPurchaseOrder = response.body;
    });

    it('should get all purchase orders with filtering', async () => {
      const response = await request(app.getHttpServer())
        .get('/purchasing/purchase-orders?status=DRAFT&supplierId=' + testSupplier.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
    });

    it('should update purchase order status through workflow', async () => {
      // Submit for approval
      let response = await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PENDING_APPROVAL' })
        .expect(200);

      expect(response.body.status).to.equal('PENDING_APPROVAL');

      // Approve order
      response = await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'APPROVED',
          approvedBy: 'manager-user-id',
          approvalNotes: 'Approved for immediate processing'
        })
        .expect(200);

      expect(response.body.status).to.equal('APPROVED');
      expect(response.body.approvedAt).to.be.a('string');

      // Send to supplier
      response = await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'SENT',
          notes: 'Sent via email to supplier'
        })
        .expect(200);

      expect(response.body.status).to.equal('SENT');
      expect(response.body.sentAt).to.be.a('string');
    });

    it('should reject purchase order', async () => {
      // Create new order for rejection test
      const rejectOrder = await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          supplierId: testSupplier.id,
          items: [{
            productId: testProduct.id,
            quantity: 1,
            unitPrice: 1000.00, // Too expensive
          }],
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${rejectOrder.body.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'REJECTED',
          rejectionReason: 'Price too high - exceeds budget'
        })
        .expect(200);

      expect(response.body.status).to.equal('REJECTED');
      expect(response.body.isActive).to.be.false;
      expect(response.body.rejectionReason).to.equal('Price too high - exceeds budget');
      expect(response.body.rejectedAt).to.be.a('string');
    });

    it('should calculate purchase order totals correctly', async () => {
      const orderData = {
        supplierId: testSupplier.id,
        items: [
          {
            productId: testProduct.id,
            quantity: 10,
            unitPrice: 25.00,
          },
          {
            productId: testProduct.id,
            quantity: 5,
            unitPrice: 30.00,
          },
        ],
        taxRate: 0.08,
        shippingCost: 50.00,
      };

      const response = await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(orderData)
        .expect(201);

      const expectedSubtotal = (10 * 25.00) + (5 * 30.00); // 250 + 150 = 400
      const expectedTax = expectedSubtotal * 0.08; // 32.00
      const expectedTotal = expectedSubtotal + expectedTax + 50.00; // 400 + 32 + 50 = 482.00

      expect(response.body.subtotal).to.equal(expectedSubtotal);
      expect(response.body.taxAmount).to.equal(expectedTax);
      expect(response.body.totalAmount).to.equal(expectedTotal);
    });
  });

  describe('Purchase Order Items Management', () => {
    it('should add items to existing purchase order', async () => {
      const newItem = {
        productId: testProduct.id,
        quantity: 3,
        unitPrice: 20.00,
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .post(`/purchasing/purchase-orders/${testPurchaseOrder.id}/items`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newItem)
        .expect(201);

      expect(response.body.productId).to.equal(newItem.productId);
      expect(response.body.quantity).to.equal(newItem.quantity);
      expect(response.body.unitPrice).to.equal(newItem.unitPrice);
    });

    it('should update purchase order item', async () => {
      const updateData = {
        quantity: 15,
        unitPrice: 22.00,
        expectedDeliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/items/${(testPurchaseOrder as any).orderItems?.[0]?.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.quantity).to.equal(updateData.quantity);
      expect(response.body.unitPrice).to.equal(updateData.unitPrice);
    });

    it('should remove purchase order item', async () => {
      await request(app.getHttpServer())
        .delete(`/purchasing/purchase-orders/${testPurchaseOrder.id}/items/${(testPurchaseOrder as any).orderItems?.[0]?.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(204);

      // Verify item is removed
      const response = await request(app.getHttpServer())
        .get(`/purchasing/purchase-orders/${testPurchaseOrder.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const removedItem = response.body.orderItems?.find((item: any) => item.id === (testPurchaseOrder as any).orderItems?.[0]?.id);
      expect(removedItem).to.be.undefined;
    });
  });

  describe('Goods Receipt Processing', () => {
    it('should record goods receipt for purchase order', async () => {
      // First approve and send the order
      await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/purchasing/purchase-orders/${testPurchaseOrder.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'SENT' })
        .expect(200);

      const receiptData = {
        receivedDate: new Date().toISOString(),
        receivedBy: 'warehouse-user-id',
        notes: 'Goods received in good condition',
        items: [
          {
            orderItemId: (testPurchaseOrder as any).orderItems?.[0]?.id,
            quantityReceived: (testPurchaseOrder as any).orderItems?.[0]?.quantity,
            condition: 'GOOD',
            batchNumber: 'BATCH001',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/purchasing/purchase-orders/${testPurchaseOrder.id}/goods-receipt`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(receiptData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.purchaseOrderId).to.equal(testPurchaseOrder.id);
      expect(response.body.receivedDate).to.be.a('string');
      expect(response.body.items).to.have.length(1);
    });

    it('should handle partial goods receipt', async () => {
      const partialReceiptData = {
        receivedDate: new Date().toISOString(),
        receivedBy: 'warehouse-user-id',
        notes: 'Partial delivery - remaining items to follow',
        items: [
          {
            orderItemId: (testPurchaseOrder as any).orderItems?.[0]?.id,
            quantityReceived: Math.floor((testPurchaseOrder as any).orderItems?.[0]?.quantity / 2), // Half the quantity
            condition: 'GOOD',
            notes: 'Partial delivery',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/purchasing/purchase-orders/${testPurchaseOrder.id}/goods-receipt`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(partialReceiptData)
        .expect(201);

      expect(response.body.items?.[0]?.quantityReceived).to.be.lessThan((testPurchaseOrder as any).orderItems?.[0]?.quantity);
    });
  });

  describe('Supplier Invoice Processing', () => {
    it('should record supplier invoice', async () => {
      const invoiceData = {
        invoiceNumber: `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: testPurchaseOrder.totalAmount,
        taxAmount: testPurchaseOrder.taxAmount,
        notes: 'Supplier invoice for test purchase order',
      };

      const response = await request(app.getHttpServer())
        .post(`/purchasing/purchase-orders/${testPurchaseOrder.id}/invoices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invoiceData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.purchaseOrderId).to.equal(testPurchaseOrder.id);
      expect(response.body.invoiceNumber).to.equal(invoiceData.invoiceNumber);
      expect(response.body.amount).to.equal(invoiceData.amount);
      expect(response.body.status).to.equal('DRAFT');
    });

    it('should validate invoice against purchase order', async () => {
      // Create invoice with amount higher than PO total
      const invalidInvoiceData = {
        invoiceNumber: `INVALID-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: Number(testPurchaseOrder.totalAmount) + 1000.00, // Much higher than PO total
        taxAmount: 100.00,
        notes: 'Invalid invoice amount',
      };

      await request(app.getHttpServer())
        .post(`/purchasing/purchase-orders/${testPurchaseOrder.id}/invoices`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidInvoiceData)
        .expect(400); // Should fail due to amount mismatch
    });
  });

  describe('Security and Validation', () => {
    it('should prevent XSS in supplier data', async () => {
      const maliciousSupplier = {
        code: `XSS-${Date.now()}`,
        name: '<script>alert("XSS")</script>Malicious Supplier',
        email: `xss-${Date.now()}@test.com`,
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
      };

      const response = await request(app.getHttpServer())
        .post('/purchasing/suppliers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(maliciousSupplier)
        .expect(201);

      // Supplier should be created but XSS should be sanitized
      expect(response.body.name).to.not.include('<script>');
      expect(response.body.name).to.include('Malicious Supplier');
    });

    it('should validate purchase order amounts', async () => {
      const invalidOrder = {
        supplierId: testSupplier.id,
        items: [{
          productId: testProduct.id,
          quantity: -5, // Negative quantity
          unitPrice: -100.00, // Negative price
        }],
      };

      await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidOrder)
        .expect(400); // Should fail due to negative values
    });

    it('should enforce authorization on purchase order creation', async () => {
      const orderData = {
        supplierId: testSupplier.id,
        items: [{
          productId: testProduct.id,
          quantity: 1,
          unitPrice: 100.00,
        }],
      };

      // Regular user should not be able to create purchase orders
      await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(403);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousSearch = "'; DROP TABLE suppliers; --";

      const response = await request(app.getHttpServer())
        .get(`/purchasing/suppliers?search=${encodeURIComponent(maliciousSearch)}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Should not crash and should return empty results or safe handling
      expect(response.body).to.have.property('data');
      expect(response.body.data).to.be.an('array');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent purchase order creation', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app.getHttpServer())
            .post('/purchasing/purchase-orders')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              supplierId: testSupplier.id,
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

    it('should handle large purchase order with many items', async () => {
      const manyItems = [];
      for (let i = 0; i < 10; i++) {
        manyItems.push({
          productId: testProduct.id,
          quantity: 1,
          unitPrice: 10.00 + i,
        });
      }

      const response = await request(app.getHttpServer())
        .post('/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          supplierId: testSupplier.id,
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
      // Create test supplier
      testSupplier = await prismaService.supplier.create({
        data: {
          code: `SUP-${Date.now()}`,
          name: `Test Supplier ${Date.now()}`,
          email: `supplier-${Date.now()}@test.com`,
          phone: '+1234567890',
          address: '456 Supplier Street',
          city: 'Supplier City',
          country: 'Supplier Country',
          paymentTerms: 'NET30',
          isActive: true,
        },
      });

      // Create test product
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
            purchaseOrder: {
              supplierId: { startsWith: 'SUP-' },
            },
          },
        },
      });

      // Clean up invoices
      await prismaService.invoice.deleteMany({
        where: {
          purchaseOrder: {
            supplierId: { startsWith: 'SUP-' },
          },
        },
      });

      // Clean up goods receipts
      await prismaService.goodsReceipt.deleteMany({
        where: {
          purchaseOrderId: {
            in: await prismaService.purchaseOrder.findMany({
              where: { supplierId: { startsWith: 'SUP-' } },
              select: { id: true },
            }).then((orders: { id: string }[]) => orders.map((o: { id: string }) => o.id))
          },
        },
      });

      // Clean up purchase order items
      await prismaService.purchaseOrderItem.deleteMany({
        where: {
          purchaseOrder: {
            supplierId: { startsWith: 'SUP-' },
          },
        },
      });

      // Clean up purchase orders
      await prismaService.purchaseOrder.deleteMany({
        where: {
          supplierId: { startsWith: 'SUP-' },
        },
      });

      // Clean up products
      await prismaService.product.deleteMany({
        where: {
          sku: { startsWith: 'PROD-' },
        },
      });

      // Clean up suppliers
      await prismaService.supplier.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'SUP-' } },
            { code: { startsWith: 'XSS-' } },
          ],
        },
      });
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  }
});