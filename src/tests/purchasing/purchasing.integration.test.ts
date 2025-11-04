import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { PurchasingDataFactory } from '../../shared/testing/integration/test-data-factories/purchasing-data-factory';
import { PurchaseOrderStatus } from '../../modules/purchasing/dto/purchase-order.dto';
import { PaymentTerms } from '../../modules/purchasing/dto/supplier.dto';

describe('Purchasing Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;
  let purchasingFactory: PurchasingDataFactory;

  // Test data
  let testSuppliers: any[] = [];
  let testProducts: any[] = [];
  let testPurchaseOrders: any[] = [];
  let testUsers: any[] = [];
  let adminToken: string;
  let managerToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    purchasingFactory = new PurchasingDataFactory(testSetup.prisma);
    await purchasingFactory.createBaseData();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    managerToken = testSetup.getTestToken('manager');
    userToken = testSetup.getTestToken('user');

    // Get test data
    testSuppliers = purchasingFactory.getTestSuppliers();
    testProducts = purchasingFactory.getTestProducts();
    testUsers = purchasingFactory.getTestUsers();
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testPurchaseOrders = [];

    for (let i = 0; i < 3; i++) {
      const order = await purchasingFactory.createTestPurchaseOrder();
      testPurchaseOrders.push(order);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('Supplier Management', () => {
    describe('POST /purchasing/suppliers', () => {
      it('should create a new supplier as admin', async () => {
        const newSupplier = {
          code: 'SUP-TEST-001',
          name: 'Test Supplier Corporation',
          email: 'test@suppliercorp.com',
          phone: '+1-555-0200',
          address: '456 Supplier Lane',
          city: 'Supplier City',
          state: 'SC',
          postalCode: '54321',
          country: 'USA',
          taxId: 'TAX-12345678',
          paymentTerms: PaymentTerms.NET30,
          creditLimit: 75000.00,
          isActive: true
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newSupplier)
          .expect(201);

        expect(response.body).to.have.property('id');
        expect(response.body.code).to.equal(newSupplier.code);
        expect(response.body.name).to.equal(newSupplier.name);
        expect(response.body.email).to.equal(newSupplier.email);
        expect(response.body.isActive).to.be.true;
        expect(response.body.createdAt).to.not.be.null;
      });

      it('should reject supplier creation as regular user', async () => {
        const newSupplier = {
          code: 'SUP-TEST-002',
          name: 'Unauthorized Supplier',
          email: 'unauthorized@test.com',
          paymentTerms: PaymentTerms.NET30
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newSupplier)
          .expect(403);
      });

      it('should validate required fields for supplier creation', async () => {
        const invalidSupplier = {
          phone: '+1-555-0200'
          // Missing required fields: code, name, email
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidSupplier)
          .expect(400);
      });

      it('should prevent duplicate supplier codes', async () => {
        const existingSupplier = testSuppliers[0];
        const duplicateSupplier = {
          code: existingSupplier.code,
          name: 'Different Name',
          email: 'different@test.com',
          paymentTerms: PaymentTerms.NET30
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(duplicateSupplier)
          .expect(400);
      });

      it('should prevent duplicate supplier emails', async () => {
        const existingSupplier = testSuppliers[0];
        const duplicateSupplier = {
          code: 'UNIQUE-CODE',
          name: 'Different Name',
          email: existingSupplier.email,
          paymentTerms: PaymentTerms.NET30
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(duplicateSupplier)
          .expect(400);
      });
    });

    describe('GET /purchasing/suppliers', () => {
      it('should list suppliers as admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/suppliers')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).to.have.property('suppliers');
        expect(response.body).to.have.property('total');
        expect(response.body).to.have.property('skip');
        expect(response.body).to.have.property('take');
        expect(response.body.suppliers).to.be.an('array');
        expect(response.body.suppliers.length).to.be.greaterThan(0);
      });

      it('should filter suppliers by search term', async () => {
        const searchTerm = testSuppliers[0].name.substring(0, 5);

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/suppliers?search=${searchTerm}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.suppliers).to.be.an('array');
        response.body.suppliers.forEach((supplier: any) => {
          expect(supplier.name.toLowerCase()).to.include(searchTerm.toLowerCase());
        });
      });

      it('should paginate supplier results', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/suppliers?skip=0&take=2')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.suppliers.length).to.be.at.most(2);
        expect(response.body.skip).to.equal(0);
        expect(response.body.take).to.equal(2);
      });

      it('should sort suppliers by name', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/suppliers?sortBy=name&sortOrder=asc')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const suppliers = response.body.suppliers;
        for (let i = 1; i < suppliers.length; i++) {
          expect(suppliers[i-1].name.toLowerCase()).to.be.at.most(suppliers[i].name.toLowerCase());
        }
      });
    });

    describe('GET /purchasing/suppliers/:id', () => {
      it('should get supplier by ID as admin', async () => {
        const supplier = testSuppliers[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.id).to.equal(supplier.id);
        expect(response.body.code).to.equal(supplier.code);
        expect(response.body.name).to.equal(supplier.name);
        expect(response.body.email).to.equal(supplier.email);
      });

      it('should return 404 for non-existent supplier', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/suppliers/non-existent-id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should deny access to non-admin users', async () => {
        const supplier = testSuppliers[0];

        await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('PUT /purchasing/suppliers/:id', () => {
      it('should update supplier as admin', async () => {
        const supplier = testSuppliers[0];
        const updateData = {
          name: 'Updated Supplier Name',
          phone: '+1-555-9999',
          creditLimit: 100000.00,
          paymentTerms: PaymentTerms.NET60
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.name).to.equal(updateData.name);
        expect(response.body.phone).to.equal(updateData.phone);
        expect(response.body.creditLimit).to.equal(updateData.creditLimit);
        expect(response.body.paymentTerms).to.equal(updateData.paymentTerms);
        expect(response.body.updatedAt).to.not.be.null;
      });

      it('should reject supplier update as regular user', async () => {
        const supplier = testSuppliers[0];
        const updateData = { name: 'Hacked Name' };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect(403);
      });

      it('should validate email format on update', async () => {
        const supplier = testSuppliers[0];
        const updateData = { email: 'invalid-email-format' };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(400);
      });
    });

    describe('DELETE /purchasing/suppliers/:id', () => {
      it('should deactivate supplier as admin', async () => {
        const supplier = await purchasingFactory.createTestSupplier();

        await request(testSetup.getHttpServer())
          .delete(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Verify supplier is deactivated
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.isActive).to.be.false;
      });

      it('should reject supplier deactivation as regular user', async () => {
        const supplier = testSuppliers[0];

        await request(testSetup.getHttpServer())
          .delete(`/api/v1/purchasing/suppliers/${supplier.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });

  describe('Purchase Order Management', () => {
    describe('POST /purchasing/purchase-orders', () => {
      it('should create a new purchase order as manager', async () => {
        const supplier = testSuppliers[0];
        const requester = testUsers.find(u => u.role === 'MANAGER');
        const selectedProducts = testProducts.slice(0, 3);

        const newOrder = {
          supplierId: supplier.id,
          orderDate: new Date().toISOString(),
          expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          items: selectedProducts.map(product => ({
            productId: product.id,
            quantity: Math.floor(Math.random() * 20) + 1,
            unitPrice: parseFloat(product.price.toString()),
            description: `Purchase of ${product.name}`
          })),
          notes: 'Test purchase order for integration testing',
          internalNotes: 'Internal notes for testing',
          requestedBy: requester.id,
          deliveryAddress: 'Main Warehouse, 123 Warehouse St',
          shippingMethod: 'Standard Ground',
          paymentTerms: PaymentTerms.NET30
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(newOrder)
          .expect(201);

        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('orderNumber');
        expect(response.body.supplierId).to.equal(newOrder.supplierId);
        expect(response.body.status).to.equal(PurchaseOrderStatus.DRAFT);
        expect(response.body.items).to.be.an('array');
        expect(response.body.items.length).to.equal(newOrder.items.length);
        expect(response.body.totalAmount).to.be.greaterThan(0);
      });

      it('should validate required fields for purchase order creation', async () => {
        const invalidOrder = {
          // Missing supplierId, items, requestedBy
          orderDate: new Date().toISOString(),
          notes: 'Invalid order without required fields'
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(invalidOrder)
          .expect(400);
      });

      it('should reject purchase order creation as regular user', async () => {
        const supplier = testSuppliers[0];
        const newOrder = {
          supplierId: supplier.id,
          orderDate: new Date().toISOString(),
          items: [{
            productId: testProducts[0].id,
            quantity: 10,
            unitPrice: 50.00,
            description: 'Test item'
          }],
          requestedBy: testUsers[0].id
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newOrder)
          .expect(403);
      });

      it('should validate items are not empty', async () => {
        const supplier = testSuppliers[0];
        const newOrder = {
          supplierId: supplier.id,
          orderDate: new Date().toISOString(),
          items: [], // Empty items array
          requestedBy: testUsers[0].id
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(newOrder)
          .expect(400);
      });

      it('should validate supplier exists', async () => {
        const newOrder = {
          supplierId: 'non-existent-supplier-id',
          orderDate: new Date().toISOString(),
          items: [{
            productId: testProducts[0].id,
            quantity: 10,
            unitPrice: 50.00,
            description: 'Test item'
          }],
          requestedBy: testUsers[0].id
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(newOrder)
          .expect(400);
      });
    });

    describe('GET /purchasing/purchase-orders', () => {
      it('should list purchase orders as manager', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body).to.have.property('orders');
        expect(response.body).to.have.property('total');
        expect(response.body.orders).to.be.an('array');
        expect(response.body.orders.length).to.be.greaterThan(0);
      });

      it('should filter purchase orders by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/purchase-orders?status=${PurchaseOrderStatus.DRAFT}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.orders).to.be.an('array');
        response.body.orders.forEach((order: any) => {
          expect(order.status).to.equal(PurchaseOrderStatus.DRAFT);
        });
      });

      it('should filter purchase orders by supplier', async () => {
        const supplier = testSuppliers[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/purchase-orders?supplierId=${supplier.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.orders).to.be.an('array');
        response.body.orders.forEach((order: any) => {
          expect(order.supplierId).to.equal(supplier.id);
        });
      });

      it('should search purchase orders by order number or notes', async () => {
        const searchTerm = 'TEST';

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/purchase-orders?search=${searchTerm}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.orders).to.be.an('array');
      });

      it('should paginate purchase order results', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders?skip=0&take=2')
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.orders.length).to.be.at.most(2);
        expect(response.body.skip).to.equal(0);
        expect(response.body.take).to.equal(2);
      });

      it('should deny access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /purchasing/purchase-orders/:id', () => {
      it('should get purchase order by ID as manager', async () => {
        const order = testPurchaseOrders[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.id).to.equal(order.id);
        expect(response.body.orderNumber).to.equal(order.orderNumber);
        expect(response.body.supplierId).to.equal(order.supplierId);
        expect(response.body.items).to.be.an('array');
        expect(response.body.items.length).to.be.greaterThan(0);
      });

      it('should include supplier details in purchase order response', async () => {
        const order = testPurchaseOrders[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body).to.have.property('supplier');
        expect(response.body.supplier).to.have.property('id');
        expect(response.body.supplier).to.have.property('name');
        expect(response.body.supplier).to.have.property('email');
      });

      it('should return 404 for non-existent purchase order', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders/non-existent-id')
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(404);
      });
    });

    describe('PUT /purchasing/purchase-orders/:id', () => {
      it('should update purchase order in DRAFT status', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const updateData = {
          expectedDeliveryDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Updated notes for testing',
          deliveryAddress: 'Updated delivery address'
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.expectedDeliveryDate).to.include(updateData.expectedDeliveryDate.substring(0, 10));
        expect(response.body.notes).to.equal(updateData.notes);
        expect(response.body.deliveryAddress).to.equal(updateData.deliveryAddress);
      });

      it('should reject update of approved purchase order', async () => {
        const order = await purchasingFactory.createTestPurchaseOrder();

        // First approve the order
        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'APPROVE',
            approvedBy: testUsers.find(u => u.role === 'ADMIN').id,
            comments: 'Approved for testing'
          });

        // Then try to update
        const updateData = { notes: 'Should not update' };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(updateData)
          .expect(400);
      });

      it('should validate items on update', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const updateData = {
          items: [{
            productId: testProducts[0].id,
            quantity: -5, // Invalid negative quantity
            unitPrice: 50.00,
            description: 'Invalid item'
          }]
        };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(updateData)
          .expect(400);
      });
    });

    describe('POST /purchasing/purchase-orders/:id/approve', () => {
      it('should approve purchase order as admin', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const admin = testUsers.find(u => u.role === 'ADMIN');

        const approvalData = {
          action: 'APPROVE',
          approvedBy: admin.id,
          comments: 'Approved for integration testing'
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(approvalData)
          .expect(200);

        expect(response.body.status).to.equal(PurchaseOrderStatus.APPROVED);
        expect(response.body.approvedBy).to.equal(admin.id);
        expect(response.body.approvedAt).to.not.be.null;
        expect(response.body.approvalComments).to.equal(approvalData.comments);
      });

      it('should reject purchase order as admin', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const admin = testUsers.find(u => u.role === 'ADMIN');

        const rejectionData = {
          action: 'REJECT',
          approvedBy: admin.id,
          comments: 'Rejected for integration testing - insufficient budget'
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(rejectionData)
          .expect(200);

        expect(response.body.status).to.equal(PurchaseOrderStatus.REJECTED);
        expect(response.body.approvedBy).to.equal(admin.id);
        expect(response.body.approvedAt).to.not.be.null;
        expect(response.body.approvalComments).to.equal(rejectionData.comments);
      });

      it('should deny approval by non-admin users', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);

        const approvalData = {
          action: 'APPROVE',
          approvedBy: testUsers[0].id,
          comments: 'Trying to approve without permission'
        };

        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(approvalData)
          .expect(403);
      });

      it('should prevent approval of already approved order', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const admin = testUsers.find(u => u.role === 'ADMIN');

        // First approval
        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'APPROVE',
            approvedBy: admin.id,
            comments: 'First approval'
          });

        // Second approval attempt
        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'APPROVE',
            approvedBy: admin.id,
            comments: 'Second approval'
          })
          .expect(400);
      });
    });

    describe('POST /purchasing/purchase-orders/:id/send', () => {
      it('should send approved purchase order to supplier', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const admin = testUsers.find(u => u.role === 'ADMIN');

        // First approve the order
        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'APPROVE',
            approvedBy: admin.id,
            comments: 'Approved for sending'
          });

        // Then send to supplier
        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/send`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.status).to.equal(PurchaseOrderStatus.SENT);
        expect(response.body.sentAt).to.not.be.null;
      });

      it('should reject sending of non-approved purchase order', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);

        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/send`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(400);
      });
    });

    describe('DELETE /purchasing/purchase-orders/:id', () => {
      it('should cancel purchase order in DRAFT status', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);

        const response = await request(testSetup.getHttpServer())
          .delete(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(200);

        expect(response.body.status).to.equal(PurchaseOrderStatus.CANCELLED);
        expect(response.body.cancelledAt).to.not.be.null;
      });

      it('should reject cancellation of approved purchase order', async () => {
        const order = testPurchaseOrders.find(o => o.status === PurchaseOrderStatus.DRAFT);
        const admin = testUsers.find(u => u.role === 'ADMIN');

        // First approve the order
        await request(testSetup.getHttpServer())
          .post(`/api/v1/purchasing/purchase-orders/${order.id}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            action: 'APPROVE',
            approvedBy: admin.id,
            comments: 'Approved order'
          });

        // Then try to cancel
        await request(testSetup.getHttpServer())
          .delete(`/api/v1/purchasing/purchase-orders/${order.id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .expect(400);
      });
    });

    describe('GET /purchasing/purchase-orders/analytics', () => {
      it('should get purchase order analytics as admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders/analytics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).to.have.property('period');
        expect(response.body).to.have.property('totalOrders');
        expect(response.body).to.have.property('totalValue');
        expect(response.body).to.have.property('averageOrderValue');
        expect(response.body).to.have.property('ordersByStatus');
        expect(response.body).to.have.property('ordersBySupplier');
        expect(response.body).to.have.property('monthlyTrends');
        expect(response.body).to.have.property('approvalMetrics');
      });

      it('should deny analytics access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/purchasing/purchase-orders/analytics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent purchase order creation', async () => {
      const supplier = testSuppliers[0];
      const requester = testUsers.find(u => u.role === 'MANAGER');
      const selectedProducts = testProducts.slice(0, 2);

      const orderPromises = Array(5).fill(null).map(async (_, index) => {
        const newOrder = {
          supplierId: supplier.id,
          orderDate: new Date().toISOString(),
          items: selectedProducts.map(product => ({
            productId: product.id,
            quantity: Math.floor(Math.random() * 10) + 1,
            unitPrice: parseFloat(product.price.toString()),
            description: `Concurrent test order ${index + 1}`
          })),
          requestedBy: requester.id
        };

        return request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(newOrder);
      });

      const responses = await Promise.all(orderPromises);

      responses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('orderNumber');
      });
    }).timeout(10000);

    it('should maintain response time standards for supplier listing', async () => {
      const startTime = Date.now();

      await request(testSetup.getHttpServer())
        .get('/api/v1/purchasing/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).to.be.lessThan(500); // Response should be under 500ms
    });

    it('should handle large datasets in purchase order queries', async () => {
      // Create additional test data
      const additionalOrders = [];
      for (let i = 0; i < 10; i++) {
        additionalOrders.push(await purchasingFactory.createTestPurchaseOrder());
      }

      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/purchasing/purchase-orders?take=20')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.orders).to.be.an('array');
      expect(response.body.orders.length).to.be.greaterThan(10);
    }).timeout(15000);
  });

  describe('Security Testing', () => {
    it('should prevent SQL injection in supplier search', async () => {
      const maliciousInput = "'; DROP TABLE suppliers; --";

      const response = await request(testSetup.getHttpServer())
        .get(`/api/v1/purchasing/suppliers?search=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Should return empty results, not crash
      expect(response.body.suppliers).to.be.an('array');
    });

    it('should sanitize HTML in supplier notes', async () => {
      const supplier = testSuppliers[0];
      const maliciousNotes = '<script>alert("xss")</script>Malicious content';

      const response = await request(testSetup.getHttpServer())
        .put(`/api/v1/purchasing/suppliers/${supplier.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: maliciousNotes })
        .expect(200);

      // Notes should be sanitized
      expect(response.body.notes).to.not.include('<script>');
    });

    it('should validate JWT token authenticity', async () => {
      const fakeToken = 'fake.jwt.token';

      await request(testSetup.getHttpServer())
        .get('/api/v1/purchasing/suppliers')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('should enforce rate limiting on purchase order creation', async () => {
      const supplier = testSuppliers[0];
      const requester = testUsers.find(u => u.role === 'MANAGER');

      const newOrder = {
        supplierId: supplier.id,
        orderDate: new Date().toISOString(),
        items: [{
          productId: testProducts[0].id,
          quantity: 10,
          unitPrice: 50.00,
          description: 'Rate limit test'
        }],
        requestedBy: requester.id
      };

      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/purchasing/purchase-orders')
          .set('Authorization', `Bearer ${managerToken}`)
          .send(newOrder)
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    }).timeout(10000);
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require temporarily breaking the database connection
      // For now, we'll test with invalid IDs that would cause database errors
      await request(testSetup.getHttpServer())
        .get('/api/v1/purchasing/suppliers/invalid-uuid-format')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return proper error format for validation errors', async () => {
      const invalidSupplier = {
        name: '', // Empty name should fail validation
        email: 'invalid-email', // Invalid email format
        paymentTerms: 'INVALID_TERM' // Invalid enum value
      };

      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/purchasing/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidSupplier)
        .expect(400);

      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('error');
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/purchasing/suppliers/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Should include correlation ID for tracking
      expect(response.headers).to.have.property('x-correlation-id');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate purchase order total amount calculation', async () => {
      const supplier = testSuppliers[0];
      const requester = testUsers.find(u => u.role === 'MANAGER');
      const selectedProducts = testProducts.slice(0, 2);

      const items = selectedProducts.map(product => ({
        productId: product.id,
        quantity: 10,
        unitPrice: parseFloat(product.price.toString()),
        description: `Purchase of ${product.name}`
      }));

      const expectedTotal = items.reduce((sum, item) =>
        sum + (item.quantity * item.unitPrice), 0
      );

      const newOrder = {
        supplierId: supplier.id,
        orderDate: new Date().toISOString(),
        items: items,
        requestedBy: requester.id
      };

      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newOrder)
        .expect(201);

      expect(parseFloat(response.body.totalAmount.toString())).to.be.closeTo(expectedTotal, 0.01);
    });

    it('should enforce business rules for order approval limits', async () => {
      // This would test order amount limits based on user roles
      // Implementation depends on specific business rules
      const supplier = testSuppliers[0];
      const requester = testUsers.find(u => u.role === 'USER'); // Regular user

      const newOrder = {
        supplierId: supplier.id,
        orderDate: new Date().toISOString(),
        items: [{
          productId: testProducts[0].id,
          quantity: 1000, // Large quantity
          unitPrice: 1000.00, // High unit price
          description: 'High value order'
        }],
        requestedBy: requester.id
      };

      // Should be rejected due to approval limits
      await request(testSetup.getHttpServer())
        .post('/api/v1/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newOrder)
        .expect(400); // Or specific business logic error
    });

    it('should validate supplier credit limits', async () => {
      // Test order creation that would exceed supplier credit limit
      const supplier = await purchasingFactory.createTestSupplier({
        creditLimit: 100.00 // Low credit limit
      });

      const newOrder = {
        supplierId: supplier.id,
        orderDate: new Date().toISOString(),
        items: [{
          productId: testProducts[0].id,
          quantity: 100,
          unitPrice: 50.00, // Total would be 5000, exceeding credit limit
          description: 'Order exceeding credit limit'
        }],
        requestedBy: testUsers[0].id
      };

      // Should be rejected due to credit limit exceeded
      await request(testSetup.getHttpServer())
        .post('/api/v1/purchasing/purchase-orders')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(newOrder)
        .expect(400); // Or specific business logic error
    });
  });
});