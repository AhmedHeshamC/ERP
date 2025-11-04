import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { SalesDataFactory } from '../../shared/testing/integration/test-data-factories/sales-data-factory';
import { IntegrationTestHelpers } from '../../shared/testing/integration-setup';

describe('Sales Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;
  let salesFactory: SalesDataFactory;

  // Test data
  let testCustomers: any[] = [];
  let testProducts: any[] = [];
  let testQuotes: any[] = [];
  let testOrders: any[] = [];
  let testInvoices: any[] = [];
  let adminToken: string;
  let salesToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    salesFactory = new SalesDataFactory(testSetup.prisma);
    await salesFactory.createBaseData();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    salesToken = testSetup.getTestToken('sales');
    userToken = testSetup.getTestToken('user');

    // Get test data
    testCustomers = await salesFactory.getTestCustomers();
    testProducts = await salesFactory.getTestProducts();
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  beforeEach(async () => {
    // Create fresh test data
    testQuotes = [];
    testOrders = [];
    testInvoices = [];

    for (let i = 0; i < 3; i++) {
      const quote = await salesFactory.createSalesQuote();
      testQuotes.push(quote);
    }

    for (let i = 0; i < 3; i++) {
      const order = await salesFactory.createSalesOrder();
      testOrders.push(order);
    }

    for (let i = 0; i < 3; i++) {
      const invoice = await salesFactory.createSalesInvoice();
      testInvoices.push(invoice);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('Customer Management', () => {
    describe('POST /sales/customers', () => {
      it('should create a new customer as admin', async () => {
        const newCustomer = {
          companyName: 'Test Customer Corp',
          contactPerson: 'John Doe',
          email: 'john.doe@testcustomer.com',
          phone: '+1-555-0123',
          website: 'https://testcustomer.com',
          industry: 'Technology',
          creditLimit: 50000.00,
          paymentTerms: 'Net 30',
          billingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'CA',
            zipCode: '12345',
            country: 'USA'
          },
          shippingAddress: {
            street: '123 Test St',
            city: 'Test City',
            state: 'CA',
            zipCode: '12345',
            country: 'USA'
          }
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newCustomer)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.companyName).to.equal(newCustomer.companyName);
        expect(response.body.data.email).to.equal(newCustomer.email);
        expect(response.body.data).to.have.property('correlationId');
      });

      it('should create customer as sales user', async () => {
        const newCustomer = {
          companyName: 'Sales Test Customer',
          contactPerson: 'Jane Smith',
          email: 'jane.smith@salestest.com',
          phone: '+1-555-0124',
          industry: 'Healthcare',
          creditLimit: 25000.00
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(newCustomer)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.companyName).to.equal(newCustomer.companyName);
      });

      it('should reject customer creation as regular user', async () => {
        const newCustomer = {
          companyName: 'Unauthorized Customer',
          email: 'unauthorized@test.com'
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newCustomer)
          .expect(403);
      });

      it('should validate required fields', async () => {
        const invalidCustomer = {
          contactPerson: 'Invalid Customer'
          // Missing required fields
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidCustomer)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body).to.have.property('message');
      });
    });

    describe('GET /sales/customers', () => {
      it('should retrieve all customers', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.greaterThanOrEqual(testCustomers.length);

        // Verify customer structure
        const customer = response.body.data[0];
        expect(customer).to.have.property('id');
        expect(customer).to.have.property('companyName');
        expect(customer).to.have.property('email');
        expect(customer).to.have.property('creditLimit');
        expect(customer).to.have.property('isActive');
      });

      it('should filter customers by industry', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/customers')
          .query({ industry: 'Technology' })
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');

        // All returned customers should be in Technology industry
        response.body.data.forEach((customer: any) => {
          expect(customer.industry).to.equal('Technology');
        });
      });

      it('should search customers by name or email', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/customers')
          .query({ search: 'test' })
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
      });
    });

    describe('PUT /sales/customers/:id', () => {
      it('should update customer information', async () => {
        const customerToUpdate = testCustomers[0];
        const updateData = {
          companyName: 'Updated Customer Name',
          creditLimit: 75000.00,
          notes: 'Updated customer information'
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/sales/customers/${customerToUpdate.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.companyName).to.equal(updateData.companyName);
        expect(response.body.data.creditLimit).to.equal(updateData.creditLimit);
      });

      it('should reject update as regular user', async () => {
        const customerToUpdate = testCustomers[0];
        const updateData = {
          companyName: 'Unauthorized Update'
        };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/sales/customers/${customerToUpdate.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect(403);
      });
    });
  });

  describe('Sales Quotes Management', () => {
    describe('POST /sales/quotes', () => {
      it('should create a new sales quote', async () => {
        const customer = testCustomers[0];
        const quoteData = {
          customerId: customer.id,
          validUntil: IntegrationTestHelpers.generateFutureDate(30).toISOString(),
          notes: 'Test quote for integration testing',
          terms: 'Standard terms and conditions',
          items: [
            {
              productId: testProducts[0].id,
              quantity: 5,
              unitPrice: 100.00,
              discount: 10
            },
            {
              productId: testProducts[1].id,
              quantity: 2,
              unitPrice: 250.00,
              discount: 5
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/quotes')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(quoteData)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.customerId).to.equal(quoteData.customerId);
        expect(response.body.data).to.have.property('quoteNumber');
        expect(response.body.data).to.have.property('items');
        expect(response.body.data.items).to.be.an('array').with.lengthOf(2);
        expect(response.body.data).to.have.property('totalAmount');
        expect(response.body.totalAmount).to.be.greaterThan(0);
      });

      it('should validate quote items and calculate totals', async () => {
        const customer = testCustomers[0];
        const invalidQuoteData = {
          customerId: customer.id,
          items: [
            {
              productId: testProducts[0].id,
              quantity: -5, // Invalid negative quantity
              unitPrice: 100.00
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/quotes')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(invalidQuoteData)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('quantity');
      });
    });

    describe('GET /sales/quotes', () => {
      it('should retrieve all sales quotes', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/quotes')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.greaterThanOrEqual(testQuotes.length);

        // Verify quote structure
        const quote = response.body.data[0];
        expect(quote).to.have.property('id');
        expect(quote).to.have.property('quoteNumber');
        expect(quote).to.have.property('customerId');
        expect(quote).to.have.property('totalAmount');
        expect(quote).to.have.property('status');
      });

      it('should filter quotes by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/quotes')
          .query({ status: 'Draft' })
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');

        // All returned quotes should be in Draft status
        response.body.data.forEach((quote: any) => {
          expect(quote.status).to.equal('Draft');
        });
      });
    });

    describe('POST /sales/quotes/:id/convert-to-order', () => {
      it('should convert quote to sales order', async () => {
        const quote = testQuotes[0];

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/sales/quotes/${quote.id}/convert-to-order`)
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('order');
        expect(response.body.data.order).to.have.property('id');
        expect(response.body.data.order).to.have.property('orderNumber');
        expect(response.body.data.order.customerId).to.equal(quote.customerId);
      });
    });
  });

  describe('Sales Orders Management', () => {
    describe('POST /sales/orders', () => {
      it('should create a new sales order', async () => {
        const customer = testCustomers[0];
        const orderData = {
          customerId: customer.id,
          expectedDeliveryDate: IntegrationTestHelpers.generateFutureDate(14).toISOString(),
          priority: 'High',
          shippingAddress: customer.shippingAddress,
          notes: 'Urgent order for integration testing',
          items: [
            {
              productId: testProducts[0].id,
              quantity: 10,
              unitPrice: 150.00,
              discount: 15
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/orders')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(orderData)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data).to.have.property('orderNumber');
        expect(response.body.data.priority).to.equal(orderData.priority);
        expect(response.body.data).to.have.property('totalAmount');
      });

      it('should validate inventory availability', async () => {
        const customer = testCustomers[0];
        const orderData = {
          customerId: customer.id,
          items: [
            {
              productId: testProducts[0].id,
              quantity: 9999, // Excessive quantity
              unitPrice: 100.00
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/orders')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(orderData)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('inventory');
      });
    });

    describe('PUT /sales/orders/:id/status', () => {
      it('should update order status', async () => {
        const order = testOrders[0];
        const statusUpdate = {
          status: 'Confirmed',
          notes: 'Order confirmed by customer'
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/sales/orders/${order.id}/status`)
          .set('Authorization', `Bearer ${salesToken}`)
          .send(statusUpdate)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.status).to.equal(statusUpdate.status);
      });

      it('should reject status update as regular user', async () => {
        const order = testOrders[0];
        const statusUpdate = {
          status: 'Confirmed'
        };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/sales/orders/${order.id}/status`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(statusUpdate)
          .expect(403);
      });
    });
  });

  describe('Sales Invoices Management', () => {
    describe('POST /sales/invoices', () => {
      it('should create a new sales invoice', async () => {
        const customer = testCustomers[0];
        const order = testOrders[0];
        const invoiceData = {
          customerId: customer.id,
          orderId: order.id,
          dueDate: IntegrationTestHelpers.generateFutureDate(30).toISOString(),
          terms: 'Payment due within 30 days',
          billingAddress: customer.billingAddress,
          items: [
            {
              productId: testProducts[0].id,
              quantity: 8,
              unitPrice: 200.00,
              discount: 5
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/invoices')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(invoiceData)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data).to.have.property('invoiceNumber');
        expect(response.body.data.customerId).to.equal(invoiceData.customerId);
        expect(response.body.data).to.have.property('totalAmount');
        expect(response.body.data).to.have.property('balanceDue');
        expect(response.body.data.balanceDue).to.equal(response.body.data.totalAmount);
      });

      it('should calculate taxes correctly', async () => {
        const customer = testCustomers[0];
        const invoiceData = {
          customerId: customer.id,
          items: [
            {
              productId: testProducts[0].id,
              quantity: 5,
              unitPrice: 100.00
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/sales/invoices')
          .set('Authorization', `Bearer ${salesToken}`)
          .send(invoiceData)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('subtotal');
        expect(response.body.data).to.have.property('taxAmount');
        expect(response.body.data).to.have.property('totalAmount');

        // Verify tax calculation (8% tax rate)
        const expectedTax = response.body.data.subtotal * 0.08;
        expect(Math.abs(response.body.data.taxAmount - expectedTax)).to.be.lessThan(0.01);
      });
    });

    describe('GET /sales/invoices', () => {
      it('should retrieve all sales invoices', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/invoices')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.greaterThanOrEqual(testInvoices.length);

        // Verify invoice structure
        const invoice = response.body.data[0];
        expect(invoice).to.have.property('id');
        expect(invoice).to.have.property('invoiceNumber');
        expect(invoice).to.have.property('customerId');
        expect(invoice).to.have.property('totalAmount');
        expect(invoice).to.have.property('balanceDue');
        expect(invoice).to.have.property('status');
      });

      it('should filter invoices by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/invoices')
          .query({ status: 'Unpaid' })
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');

        // All returned invoices should be Unpaid
        response.body.data.forEach((invoice: any) => {
          expect(invoice.status).to.equal('Unpaid');
        });
      });
    });
  });

  describe('Sales Analytics', () => {
    describe('GET /sales/analytics/dashboard', () => {
      it('should retrieve sales dashboard data', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/analytics/dashboard')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('totalRevenue');
        expect(response.body.data).to.have.property('totalOrders');
        expect(response.body.data).to.have.property('averageOrderValue');
        expect(response.body.data).to.have.property('conversionRate');
        expect(response.body.data).to.have.property('topCustomers');
        expect(response.body.data).to.have.property('recentOrders');
      });

      it('should filter analytics by date range', async () => {
        const startDate = IntegrationTestHelpers.generatePastDate(30);
        const endDate = new Date();

        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/analytics/dashboard')
          .query({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          })
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('period');
        expect(response.body.data.period.startDate).to.include(startDate.toISOString().split('T')[0]);
      });
    });

    describe('GET /sales/analytics/reports/sales-by-product', () => {
      it('should generate sales by product report', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/sales/analytics/reports/sales-by-product')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('reportData');
        expect(response.body.data.reportData).to.be.an('array');

        if (response.body.data.reportData.length > 0) {
          const product = response.body.data.reportData[0];
          expect(product).to.have.property('productId');
          expect(product).to.have.property('productName');
          expect(product).to.have.property('quantitySold');
          expect(product).to.have.property('revenue');
        }
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(testSetup.getHttpServer())
        .get('/api/v1/sales/customers')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(testSetup.getHttpServer())
        .get('/api/v1/sales/customers')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should include correlation ID in all responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/sales/customers')
        .set('Authorization', `Bearer ${salesToken}`)
        .expect(200);

      expect(response.headers).to.have.property('x-correlation-id');
      expect(response.body).to.have.property('correlationId');
    });

    it('should sanitize error responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/sales/customers/invalid-id')
        .set('Authorization', `Bearer ${salesToken}`)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('correlationId');
      // Should not contain stack traces or internal details
      expect(response.body.message).to.not.include('prisma');
      expect(response.body.message).to.not.include('sql');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to customer requests within acceptable time', async () => {
      const { result, executionTime } = await IntegrationTestHelpers.measureExecutionTime(async () => {
        return await request(testSetup.getHttpServer())
          .get('/api/v1/sales/customers')
          .set('Authorization', `Bearer ${salesToken}`)
          .expect(200);
      });

      expect(executionTime).to.be.lessThan(1000); // Less than 1 second
      expect(result.body).to.have.property('success', true);
    });

    it('should handle concurrent order creation', async () => {
      const customer = testCustomers[0];
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/sales/orders')
          .set('Authorization', `Bearer ${salesToken}`)
          .send({
            customerId: customer.id,
            items: [
              {
                productId: testProducts[0].id,
                quantity: 5,
                unitPrice: 100.00
              }
            ]
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('success', true);
      });

      // All orders should have unique order numbers
      const orderNumbers = responses.map(r => r.body.data.orderNumber);
      const uniqueOrderNumbers = new Set(orderNumbers);
      expect(uniqueOrderNumbers.size).to.equal(orderNumbers.length);
    });
  });
});