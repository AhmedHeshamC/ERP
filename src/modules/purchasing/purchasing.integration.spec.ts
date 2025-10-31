import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { SupplierService } from './supplier.service';
import { PurchaseOrderService } from './purchase-order.service';
import { SupplierController } from './supplier.controller';
import { PurchaseOrderController } from './purchase-order.controller';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../../test/integration-setup';
import { CreateSupplierDto, SupplierStatus, PaymentTerms } from './dto/supplier.dto';
import { CreatePurchaseOrderDto, PurchaseOrderStatus } from './dto/purchase-order.dto';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Purchasing Module Integration Tests
 * Tests complete supplier and purchase order management workflows end-to-end
 * These tests validate the entire purchasing process including approval workflows
 * following enterprise-grade standards and OWASP security principles
 */
describe('Purchasing Module Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let supplierService: SupplierService;
  let purchaseOrderService: PurchaseOrderService;
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
      controllers: [SupplierController, PurchaseOrderController],
      providers: [SupplierService, PurchaseOrderService],
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
    supplierService = moduleFixture.get<SupplierService>(SupplierService);
    purchaseOrderService = moduleFixture.get<PurchaseOrderService>(PurchaseOrderService);

    // Create a test user and get auth token
    authToken = await getTestAuthToken();
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

  describe('Supplier Management', () => {
    it('should create a new supplier successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createSupplierDto: CreateSupplierDto = {
        code: `SUP-${timestamp}`,
        name: 'Test Supplier Company',
        email: `supplier${timestamp}@test.com`,
        phone: '+1234567890',
        address: '123 Supplier Street',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'Test Country',
        taxId: 'TAX-123456',
        paymentTerms: PaymentTerms.NET30,
        isActive: true,
        creditLimit: 10000,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/suppliers')
        .send(createSupplierDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.code).to.equal(createSupplierDto.code);
      expect(response.body.name).to.equal(createSupplierDto.name);
      expect(response.body.email).to.equal(createSupplierDto.email);
      expect(response.body.isActive).to.equal(true);
      expect(response.body.paymentTerms).to.equal(PaymentTerms.NET30);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should reject supplier creation with duplicate code', async () => {
      // Arrange - Create first supplier
      const timestamp = Date.now();
      const createSupplierDto: CreateSupplierDto = {
        code: `DUP-${timestamp}`,
        name: 'First Supplier',
        email: `first${timestamp}@test.com`,
        paymentTerms: PaymentTerms.NET30,
        isActive: true,
      };

      await request(app.getHttpServer())
        .post('/suppliers')
        .send(createSupplierDto)
        .expect(201);

      // Act - Try to create second supplier with same code
      const duplicateSupplierDto = {
        ...createSupplierDto,
        name: 'Second Supplier',
        email: `second${timestamp}@test.com`,
      };

      const response = await request(app.getHttpServer())
        .post('/suppliers')
        .send(duplicateSupplierDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should validate supplier creation data', async () => {
      // Arrange - Invalid data
      const invalidSupplierDto = {
        code: '', // Empty code
        name: '', // Empty name
        email: 'invalid-email', // Invalid email format
        paymentTerms: 'INVALID_TERMS', // Invalid payment terms
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/suppliers')
        .send(invalidSupplierDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should get supplier by ID successfully', async () => {
      // Arrange - Create a supplier first
      const createdSupplier = await createTestSupplier();

      // Act
      const response = await request(app.getHttpServer())
        .get(`/suppliers/${createdSupplier.id}`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdSupplier.id);
      expect(response.body.code).to.equal(createdSupplier.code);
      expect(response.body.name).to.equal(createdSupplier.name);
      expect(response.body.email).to.equal(createdSupplier.email);
    });

    it('should return 404 for non-existent supplier', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/suppliers/non-existent-id')
        .expect(404);

      expect(response.body.message).to.include('not found');
    });

    it('should update supplier successfully', async () => {
      // Arrange - Create a supplier first
      const createdSupplier = await createTestSupplier();

      const updateData = {
        name: 'Updated Supplier Name',
        email: 'updated@test.com',
        phone: '+9876543210',
        isActive: false,
        paymentTerms: PaymentTerms.NET60,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/suppliers/${createdSupplier.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdSupplier.id);
      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.email).to.equal(updateData.email);
      expect(response.body.isActive).to.equal(updateData.isActive);
      expect(response.body.paymentTerms).to.equal(updateData.paymentTerms);
      expect(response.body.updatedAt).to.not.equal(createdSupplier.updatedAt);
    });

    it('should get paginated supplier list', async () => {
      // Arrange - Create multiple suppliers
      await createMultipleTestSuppliers();

      // Act
      const response = await request(app.getHttpServer())
        .get('/suppliers?page=1&limit=5')
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

    it('should filter suppliers by status', async () => {
      // Arrange - Create suppliers with different statuses
      await createTestSupplier({ isActive: true });
      await createTestSupplier({ isActive: false });

      // Act
      const response = await request(app.getHttpServer())
        .get('/suppliers?isActive=true')
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((supplier: any) => {
          expect(supplier.isActive).to.equal(true);
        });
      }
    });
  });

  describe('Purchase Order Management', () => {
    let testSupplier: any;

    beforeEach(async () => {
      testSupplier = await createTestSupplier();
    });

    it('should create a new purchase order successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createPurchaseOrderDto: CreatePurchaseOrderDto = {
        supplierId: testSupplier.id,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        notes: 'Test purchase order for integration testing',
        requestedBy: 'test-user-id',
        items: [
          {
            productId: `product-${timestamp}-1`,
            description: 'Test Product 1',
            quantity: 10,
            unitPrice: 25.50,
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          {
            productId: `product-${timestamp}-2`,
            description: 'Test Product 2',
            quantity: 5,
            unitPrice: 45.75,
            expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          },
        ],
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(createPurchaseOrderDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.supplierId).to.equal(createPurchaseOrderDto.supplierId);
      expect(response.body.status).to.equal(PurchaseOrderStatus.DRAFT);
      expect(response.body).to.have.property('items');
      expect(response.body.items).to.have.length(2);
      expect(response.body).to.have.property('totalAmount');
      expect(response.body).to.have.property('createdAt');
    });

    it('should reject purchase order creation with duplicate order number', async () => {
      // Arrange - Create first purchase order
      const timestamp = Date.now();
      const duplicateOrderNumber = `DUP-PO-${timestamp}`;

      const createPurchaseOrderDto: CreatePurchaseOrderDto = {
        supplierId: testSupplier.id,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        requestedBy: 'test-user-id',
        items: [
          {
            productId: `product-${timestamp}-1`,
            description: 'Test Product',
            quantity: 1,
            unitPrice: 10.00,
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(createPurchaseOrderDto)
        .expect(201);

      // Act - Try to create second PO with same order number
      const duplicatePurchaseOrderDto = {
        ...createPurchaseOrderDto,
        items: [
          {
            productId: `product-${timestamp}-2`,
            description: 'Different Product',
            quantity: 1,
            unitPrice: 20.00,
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(duplicatePurchaseOrderDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should validate purchase order creation data', async () => {
      // Arrange - Invalid data
      const invalidPurchaseOrderDto = {
        supplierId: '', // Empty supplier ID
        orderNumber: '', // Empty order number
        expectedDeliveryDate: 'invalid-date', // Invalid date
        items: [], // Empty items array
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(invalidPurchaseOrderDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should get purchase order by ID successfully', async () => {
      // Arrange - Create a purchase order first
      const createdPurchaseOrder = await createTestPurchaseOrder(testSupplier.id);

      // Act
      const response = await request(app.getHttpServer())
        .get(`/purchase-orders/${createdPurchaseOrder.id}`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPurchaseOrder.id);
      // orderNumber property removed from DTO
      expect(response.body.supplierId).to.equal(testSupplier.id);
      expect(response.body).to.have.property('items');
      expect(response.body.items).to.have.length(createdPurchaseOrder.items.length);
    });

    it('should update purchase order successfully (only DRAFT status)', async () => {
      // Arrange - Create a draft purchase order
      const createdPurchaseOrder = await createTestPurchaseOrder(testSupplier.id);

      const updateData = {
        expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        notes: 'Updated purchase order notes',
        items: [
          {
            productId: 'updated-product-1',
            description: 'Updated Product 1',
            quantity: 15,
            unitPrice: 30.00,
            expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        ],
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/purchase-orders/${createdPurchaseOrder.id}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPurchaseOrder.id);
      expect(response.body.notes).to.equal(updateData.notes);
      expect(response.body.items).to.have.length(1);
      expect(response.body.items[0].description).to.equal('Updated Product 1');
      expect(response.body.updatedAt).to.not.equal(createdPurchaseOrder.updatedAt);
    });

    it('should submit purchase order for approval', async () => {
      // Arrange - Create a draft purchase order
      const createdPurchaseOrder = await createTestPurchaseOrder(testSupplier.id);

      // Act
      const response = await request(app.getHttpServer())
        .post(`/purchase-orders/${createdPurchaseOrder.id}/submit-for-approval`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPurchaseOrder.id);
      expect(response.body.status).to.equal(PurchaseOrderStatus.PENDING_APPROVAL);
      expect(response.body.submittedAt).to.not.be.null;
      expect(response.body.updatedAt).to.not.equal(createdPurchaseOrder.updatedAt);
    });

    it('should approve purchase order', async () => {
      // Arrange - Create and submit purchase order
      const createdPurchaseOrder = await createTestPurchaseOrder(testSupplier.id);
      await request(app.getHttpServer())
        .post(`/purchase-orders/${createdPurchaseOrder.id}/submit-for-approval`)
        .expect(200);

      const approvalAction = {
        action: 'APPROVE',
        notes: 'Purchase order approved for integration testing',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/purchase-orders/${createdPurchaseOrder.id}/approval-action`)
        .send(approvalAction)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPurchaseOrder.id);
      expect(response.body.status).to.equal(PurchaseOrderStatus.APPROVED);
      expect(response.body.approvedAt).to.not.be.null;
      expect(response.body.approvalNotes).to.equal(approvalAction.notes);
    });

    it('should reject purchase order', async () => {
      // Arrange - Create and submit purchase order
      const createdPurchaseOrder = await createTestPurchaseOrder(testSupplier.id);
      await request(app.getHttpServer())
        .post(`/purchase-orders/${createdPurchaseOrder.id}/submit-for-approval`)
        .expect(200);

      const rejectionAction = {
        action: 'REJECT',
        notes: 'Purchase order rejected due to budget constraints',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post(`/purchase-orders/${createdPurchaseOrder.id}/approval-action`)
        .send(rejectionAction)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPurchaseOrder.id);
      expect(response.body.status).to.equal(PurchaseOrderStatus.REJECTED);
      expect(response.body.rejectedAt).to.not.be.null;
      expect(response.body.rejectionReason).to.equal(rejectionAction.notes);
    });

    it('should get paginated purchase orders list', async () => {
      // Arrange - Create multiple purchase orders
      await createMultipleTestPurchaseOrders(testSupplier.id);

      // Act
      const response = await request(app.getHttpServer())
        .get('/purchase-orders?page=1&limit=5')
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

    it('should filter purchase orders by status', async () => {
      // Arrange - Create purchase orders with different statuses
      const draftPO = await createTestPurchaseOrder(testSupplier.id);
      const submittedPO = await createTestPurchaseOrder(testSupplier.id);

      await request(app.getHttpServer())
        .post(`/purchase-orders/${submittedPO.id}/submit-for-approval`)
        .expect(200);

      // Act
      const response = await request(app.getHttpServer())
        .get('/purchase-orders?status=DRAFT')
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((po: any) => {
          expect(po.status).to.equal('DRAFT');
        });
      }
    });

    it('should filter purchase orders by supplier', async () => {
      // Arrange - Create purchase orders for specific supplier
      await createTestPurchaseOrder(testSupplier.id);

      // Act
      const response = await request(app.getHttpServer())
        .get(`/purchase-orders?supplierId=${testSupplier.id}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((po: any) => {
          expect(po.supplierId).to.equal(testSupplier.id);
        });
      }
    });
  });

  describe('Cross-Module Workflows', () => {
    it('should handle procure-to-pay workflow', async () => {
      // 1. Create supplier
      const supplier = await createTestSupplier();

      // 2. Create purchase order
      const purchaseOrder = await createTestPurchaseOrder(supplier.id);

      // 3. Submit for approval
      await request(app.getHttpServer())
        .post(`/purchase-orders/${purchaseOrder.id}/submit-for-approval`)
        .expect(200);

      // 4. Approve purchase order
      await request(app.getHttpServer())
        .post(`/purchase-orders/${purchaseOrder.id}/approval-action`)
        .send({
          action: 'APPROVE',
          notes: 'Approved for integration test',
        })
        .expect(200);

      // 5. Verify purchase order is approved and ready for processing
      const approvedPO = await request(app.getHttpServer())
        .get(`/purchase-orders/${purchaseOrder.id}`)
        .expect(200);

      expect(approvedPO.body.status).to.equal(PurchaseOrderStatus.APPROVED);
      expect(approvedPO.body.approvedAt).to.not.be.null;

      // 6. Verify supplier relationship
      expect(approvedPO.body.supplier.id).to.equal(supplier.id);
      expect(approvedPO.body.supplier.name).to.equal(supplier.name);
    });

    it('should maintain data integrity across supplier and purchase order operations', async () => {
      // Arrange - Create supplier and purchase order
      const supplier = await createTestSupplier();
      const purchaseOrder = await createTestPurchaseOrder(supplier.id);

      // Act - Update supplier
      const updatedSupplier = await request(app.getHttpServer())
        .put(`/suppliers/${supplier.id}`)
        .send({
          name: 'Updated Supplier Name',
          status: SupplierStatus.INACTIVE,
        })
        .expect(200);

      // Assert - Purchase order should still reference the supplier
      const poWithSupplier = await request(app.getHttpServer())
        .get(`/purchase-orders/${purchaseOrder.id}`)
        .expect(200);

      expect(poWithSupplier.body.supplierId).to.equal(supplier.id);
      expect(poWithSupplier.body.supplier.name).to.equal('Updated Supplier Name');
      expect(poWithSupplier.body.supplier.status).to.equal(SupplierStatus.INACTIVE);
    });
  });

  describe('Security and Authorization', () => {
    it('should prevent SQL injection in supplier search', async () => {
      // Arrange - Malicious search term with SQL injection attempt
      const maliciousSearch = "'; DROP TABLE suppliers; --";

      // Act
      const response = await request(app.getHttpServer())
        .get(`/suppliers?search=${encodeURIComponent(maliciousSearch)}`)
        .expect(200);

      // Assert - Should return empty array or handle gracefully, not crash
      expect(response.body.data).to.be.an('array');

      // Verify suppliers table still exists
      const suppliers = await request(app.getHttpServer())
        .get('/suppliers')
        .expect(200);

      expect(suppliers.body).to.have.property('data');
    });

    it('should prevent XSS attacks in supplier names', async () => {
      // Arrange - Malicious input with XSS attempt
      const maliciousSupplierDto = {
        code: 'XSS-001',
        name: '<script>alert("xss")</script>Malicious Supplier',
        email: 'xss@test.com',
        isActive: true,
        paymentTerms: PaymentTerms.NET30,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/suppliers')
        .send(maliciousSupplierDto)
        .expect(201);

      // Assert - XSS should be sanitized
      expect(response.body.name).to.not.include('<script>');
      expect(response.body.name).to.include('Malicious Supplier');
    });

    it('should prevent XSS attacks in purchase order notes', async () => {
      // Arrange - Create supplier first
      const supplier = await createTestSupplier();

      const maliciousPurchaseOrderDto = {
        supplierId: supplier.id,
                expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        notes: '<img src=x onerror=alert("xss")>Malicious notes',
        items: [
          {
            productId: 'xss-product',
            description: 'Test product with XSS in description',
            quantity: 1,
            unitPrice: 10.00,
            expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        ],
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(maliciousPurchaseOrderDto)
        .expect(201);

      // Assert - XSS should be sanitized
      expect(response.body.notes).to.not.include('<img');
      expect(response.body.notes).to.not.include('onerror');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent supplier creation with unique constraints', async () => {
      // Arrange - Same supplier code for multiple suppliers (should cause conflict)
      const timestamp = Date.now();
      const commonSupplierCode = `CONCURRENT-${timestamp}`;

      const supplierDtos = [
        {
          code: commonSupplierCode,
          name: 'Supplier 1',
          email: 'supplier1@test.com',
          isActive: true,
          paymentTerms: PaymentTerms.NET30,
        },
        {
          code: commonSupplierCode,
          name: 'Supplier 2',
          email: 'supplier2@test.com',
          isActive: true,
          paymentTerms: PaymentTerms.NET30,
        },
      ];

      // Act - Create suppliers concurrently
      const creationPromises = supplierDtos.map(dto =>
        request(app.getHttpServer())
          .post('/suppliers')
          .send(dto)
      );

      const results = await Promise.allSettled(creationPromises);

      // Assert - One should succeed, one should fail
      const successfulCreations = results.filter(r => r.status === 'fulfilled');
      const failedCreations = results.filter(r => r.status === 'rejected');

      expect(successfulCreations.length).to.equal(1);
      expect(failedCreations.length).to.equal(1);

      // Verify only one supplier was created
      const suppliers = await request(app.getHttpServer())
        .get('/suppliers')
        .expect(200);

      const suppliersWithCode = suppliers.body.data.filter((s: any) => s.code === commonSupplierCode);
      expect(suppliersWithCode.length).to.equal(1);
    });

    it('should handle concurrent purchase order approval safely', async () => {
      // Arrange - Create supplier and purchase order
      const supplier = await createTestSupplier();
      const purchaseOrder = await createTestPurchaseOrder(supplier.id);

      // Submit for approval
      await request(app.getHttpServer())
        .post(`/purchase-orders/${purchaseOrder.id}/submit-for-approval`)
        .expect(200);

      const approvalActions = [
        { action: 'APPROVE', notes: 'Approval 1' },
        { action: 'REJECT', notes: 'Rejection 2' },
      ];

      // Act - Process approval actions concurrently
      const approvalPromises = approvalActions.map(action =>
        request(app.getHttpServer())
          .post(`/purchase-orders/${purchaseOrder.id}/approval-action`)
          .send(action)
      );

      const results = await Promise.allSettled(approvalPromises);

      // Assert - One should succeed, one should fail
      const successfulApprovals = results.filter(r => r.status === 'fulfilled');
      const failedApprovals = results.filter(r => r.status === 'rejected');

      expect(successfulApprovals.length).to.equal(1);
      expect(failedApprovals.length).to.equal(1);

      // Verify final state
      const finalPO = await request(app.getHttpServer())
        .get(`/purchase-orders/${purchaseOrder.id}`)
        .expect(200);

      expect(finalPO.body.status).to.be.oneOf([
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.REJECTED,
      ]);
    });
  });

  /**
   * Helper Functions
   */

  async function getTestAuthToken(): Promise<string> {
    // Create a test user with admin role
    const testUser = {
      email: 'purchasing-admin@test.com',
      password: 'AdminPassword123!',
      firstName: 'Purchasing',
      lastName: 'Admin',
      username: `purchasing-admin${Date.now()}`,
    };

    try {
      // Register user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser);
    } catch (error) {
      // User might already exist, continue with login
    }

    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    return loginResponse.body.accessToken;
  }

  async function createTestSupplier(overrides?: Partial<CreateSupplierDto>): Promise<any> {
    const timestamp = Date.now();
    const supplierData: CreateSupplierDto = {
      code: `SUP-${timestamp}`,
      name: `Test Supplier ${timestamp}`,
      email: `supplier${timestamp}@test.com`,
      phone: '+1234567890',
      address: '123 Supplier Street',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      isActive: true,
      paymentTerms: PaymentTerms.NET30,
      taxId: `TAX-${timestamp}`,
                  ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/suppliers')
      .send(supplierData);

    return response.body;
  }

  async function createTestPurchaseOrder(supplierId: string): Promise<any> {
    const timestamp = Date.now();
    const purchaseOrderData: CreatePurchaseOrderDto = {
      supplierId,
      orderDate: new Date(),
      requestedBy: 'test-user',
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: 'Test purchase order for integration testing',
      items: [
        {
          productId: `product-${timestamp}-1`,
          description: 'Test Product 1',
          quantity: 10,
          unitPrice: 25.50,
          expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          productId: `product-${timestamp}-2`,
          description: 'Test Product 2',
          quantity: 5,
          unitPrice: 45.75,
          expectedDeliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/purchase-orders')
      .send(purchaseOrderData);

    return response.body;
  }

  async function createMultipleTestSuppliers(): Promise<void> {
    const suppliers = [
      {
        code: `SUP-A-${Date.now()}`,
        name: 'Supplier Alpha',
        email: `alpha${Date.now()}@test.com`,
        isActive: true,
        paymentTerms: PaymentTerms.NET30,
      },
      {
        code: `SUP-B-${Date.now()}`,
        name: 'Supplier Beta',
        email: `beta${Date.now()}@test.com`,
        status: SupplierStatus.INACTIVE,
        paymentTerms: PaymentTerms.NET60,
      },
      {
        code: `SUP-C-${Date.now()}`,
        name: 'Supplier Gamma',
        email: `gamma${Date.now()}@test.com`,
        isActive: true,
        paymentTerms: PaymentTerms.COD,
      },
    ];

    for (const supplier of suppliers) {
      await request(app.getHttpServer())
        .post('/suppliers')
        .send(supplier);
    }
  }

  async function createMultipleTestPurchaseOrders(supplierId: string): Promise<void> {
    const baseTimestamp = Date.now();

    for (let i = 1; i <= 3; i++) {
      const purchaseOrderData: CreatePurchaseOrderDto = {
        supplierId,
        orderDate: new Date(),
        requestedBy: 'test-user',
        expectedDeliveryDate: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000),
        notes: `Test purchase order ${i} for integration testing`,
        items: [
          {
            productId: `product-${baseTimestamp}-${i}`,
            description: `Test Product ${i}`,
            quantity: i * 5,
            unitPrice: 10.00 * i,
            expectedDeliveryDate: new Date(Date.now() + (7 + i) * 24 * 60 * 60 * 1000),
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/purchase-orders')
        .send(purchaseOrderData);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in order of dependencies
      await prismaService.purchaseOrderItem.deleteMany({
        where: {
          purchaseOrder: {
                      },
        },
      });

      await prismaService.purchaseOrder.deleteMany({
        where: {
                  },
      });

      await prismaService.supplier.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'SUP-' } },
            { code: { startsWith: 'DUP-' } },
            { code: { startsWith: 'CONCURRENT-' } },
            { code: { startsWith: 'XSS-' } },
          ],
        },
      });

      // Clean up test users
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { startsWith: 'purchasing-admin@test.com' } },
            { username: { startsWith: 'purchasing-admin' } },
          ],
        },
      });
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
  }
});