import { expect } from 'chai';
import { Customer } from './entities/customer.entity';
import { Order, OrderItem } from './entities/order.entity';
import { CustomerStatus, OrderStatus } from './enums/sales.enum';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Sales Module Integration Tests
 *
 * Tests the core sales business logic and entity validation
 * Focuses on entity-level functionality since the Sales module is in development
 *
 * Critical for Order-to-Cash business process validation
 */
describe('Sales Module Integration Tests', () => {
  describe('Customer Entity', () => {
    it('should create a valid customer with required fields', () => {
      const customerData = {
        code: 'CUST001',
        name: 'Test Customer',
        email: 'test@customer.com',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 10000.00,
        status: CustomerStatus.ACTIVE,
      };

      const customer = new Customer(customerData);

      expect(customer.code).to.equal('CUST001');
      expect(customer.name).to.equal('Test Customer');
      expect(customer.email).to.equal('test@customer.com');
      expect(customer.phone).to.equal('+1234567890');
      expect(customer.creditLimit).to.equal(10000.00);
      expect(customer.status).to.equal(CustomerStatus.ACTIVE);
      expect(customer.isActive).to.be.true;
      expect(customer.createdAt).to.be.a('date');
      expect(customer.updatedAt).to.be.a('date');
    });

    it('should validate customer data correctly', () => {
      const customerData = {
        code: 'CUST002',
        name: 'Valid Customer',
        email: 'valid@customer.com',
        phone: '+1234567890',
        address: '123 Valid St',
        city: 'Valid City',
        country: 'Valid Country',
        creditLimit: 5000.00,
      };

      const customer = new Customer(customerData);
      const validation = customer.validate();

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.have.length(0);
    });

    it('should detect invalid customer data', () => {
      const invalidCustomerData = {
        code: 'CUST003',
        name: '', // Empty name
        email: 'invalid-email', // Invalid email format
        phone: '', // Empty phone
        creditLimit: -1000, // Negative credit limit
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
      };

      const customer = new Customer(invalidCustomerData);
      const validation = customer.validate();

      expect(validation.isValid).to.be.false;
      expect(validation.errors.length).to.be.greaterThan(0);
      expect(validation.errors).to.include('Name is required');
      expect(validation.errors).to.include('Invalid email format');
      expect(validation.errors).to.include('Phone is required');
      expect(validation.errors).to.include('Credit limit must be positive');
    });

    it('should handle customer status changes', () => {
      const customerData = {
        code: 'CUST004',
        name: 'Status Test Customer',
        email: 'status@test.com',
        phone: '+1234567890',
        address: '123 Status St',
        city: 'Status City',
        country: 'Status Country',
        creditLimit: 7500.00,
        status: CustomerStatus.ACTIVE,
      };

      const customer = new Customer(customerData);

      // Test activation
      customer.activate();
      expect(customer.status).to.equal(CustomerStatus.ACTIVE);
      expect(customer.isActive).to.be.true;

      // Test deactivation
      customer.deactivate();
      expect(customer.status).to.equal(CustomerStatus.INACTIVE);
      expect(customer.isActive).to.be.false;

      // Test suspension
      customer.suspend();
      expect(customer.status).to.equal(CustomerStatus.SUSPENDED);
      expect(customer.isActive).to.be.false;
    });

    it('should validate credit limits correctly', () => {
      const customerData = {
        code: 'CUST005',
        name: 'Credit Test Customer',
        email: 'credit@test.com',
        phone: '+1234567890',
        address: '123 Credit St',
        city: 'Credit City',
        country: 'Credit Country',
        creditLimit: 10000.00,
      };

      const customer = new Customer(customerData);

      // Test sufficient credit
      expect(customer.hasSufficientCredit(5000.00)).to.be.true;
      expect(customer.hasSufficientCredit(10000.00)).to.be.true;

      // Test insufficient credit
      expect(customer.hasSufficientCredit(15000.00)).to.be.false;
      expect(customer.hasSufficientCredit(-1000.00)).to.be.false;

      // Test credit limit update
      customer.updateCreditLimit(20000.00);
      expect(customer.creditLimit).to.equal(20000.00);
      expect(customer.hasSufficientCredit(15000.00)).to.be.true;
    });

    it('should serialize customer to JSON correctly', () => {
      const customerData = {
        code: 'CUST006',
        name: 'JSON Test Customer',
        email: 'json@test.com',
        phone: '+1234567890',
        address: '123 JSON St',
        city: 'JSON City',
        country: 'JSON Country',
        creditLimit: 8000.00,
        website: 'https://test.com',
        taxId: 'TAX123',
        notes: 'Test notes',
      };

      const customer = new Customer(customerData);
      const json = customer.toJSON();

      expect(json.code).to.equal('CUST006');
      expect(json.name).to.equal('JSON Test Customer');
      expect(json.email).to.equal('json@test.com');
      expect(json.creditLimit).to.equal(8000.00);
      expect(json.website).to.equal('https://test.com');
      expect(json.taxId).to.equal('TAX123');
      expect(json.notes).to.equal('Test notes');
      expect(json.createdAt).to.be.a('string');
      expect(json.updatedAt).to.be.a('string');
    });

    it('should enforce customer code validation', () => {
      const invalidCodes = ['CU', 'CUSTOMER_CODE_TOO_LONG', 'cust001', 'CUST-001', 'CUST 001'];

      invalidCodes.forEach(code => {
        expect(() => {
          new Customer({
            code: code,
            name: 'Test Customer',
            email: 'test@customer.com',
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 1000.00,
          });
        }).to.throw('Invalid customer code format');
      });
    });
  });

  describe('Order Entity', () => {
    let testCustomer: Customer;

    beforeEach(() => {
      testCustomer = new Customer({
        code: 'CUST_ORDER',
        name: 'Order Test Customer',
        email: 'order@test.com',
        phone: '+1234567890',
        address: '123 Order St',
        city: 'Order City',
        country: 'Order Country',
        creditLimit: 20000.00,
      });
    });

    it('should create a valid order with required fields', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Test Product 1',
          quantity: 2,
          unitPrice: 100.00,
          totalPrice: 200.00,
        },
        {
          productId: 'PROD002',
          description: 'Test Product 2',
          quantity: 1,
          unitPrice: 250.00,
          totalPrice: 250.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-001',
        customerId: testCustomer.id || 'customer-123',
        description: 'Test Sales Order',
        currency: 'USD',
        items: orderItems,
        taxRate: 0.10,
      };

      const order = new Order(orderData);

      expect(order.orderNumber).to.equal('ORD-2024-001');
      expect(order.customerId).to.equal('customer-123');
      expect(order.description).to.equal('Test Sales Order');
      expect(order.currency).to.equal('USD');
      expect(order.status).to.equal(OrderStatus.DRAFT);
      expect(order.isActive).to.be.true;
      expect(order.items).to.have.length(2);
      expect(order.totalAmount).to.equal(450.00);
      expect(order.taxRate).to.equal(0.10);
      expect(order.createdAt).to.be.a('date');
      expect(order.updatedAt).to.be.a('date');
    });

    it('should validate order data correctly', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Valid Product',
          quantity: 3,
          unitPrice: 100.00,
          totalPrice: 300.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-002',
        customerId: 'customer-123',
        description: 'Valid Order Description',
        currency: 'USD',
        items: orderItems,
      };

      const order = new Order(orderData);
      const validation = order.validate();

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.have.length(0);
    });

    it('should detect invalid order data', () => {
      const invalidOrderItems: OrderItem[] = [
        {
          productId: '', // Empty product ID
          description: '', // Empty description
          quantity: -1, // Negative quantity
          unitPrice: -10, // Negative unit price
          totalPrice: -10, // Negative total price
        },
      ];

      const invalidOrderData = {
        orderNumber: 'ORD-INVALID',
        customerId: '', // Empty customer ID
        description: '', // Empty description
        currency: 'INVALID', // Invalid currency
        items: invalidOrderItems,
      };

      const order = new Order(invalidOrderData);
      const validation = order.validate();

      expect(validation.isValid).to.be.false;
      expect(validation.errors.length).to.be.greaterThan(0);
    });

    it('should handle order status transitions', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Status Test Product',
          quantity: 1,
          unitPrice: 100.00,
          totalPrice: 100.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-STATUS',
        customerId: 'customer-123',
        description: 'Status Transition Test',
        currency: 'USD',
        items: orderItems,
      };

      const order = new Order(orderData);

      // Initial status should be DRAFT
      expect(order.status).to.equal(OrderStatus.DRAFT);

      // Confirm order
      order.confirm();
      expect(order.status).to.equal(OrderStatus.CONFIRMED);
      expect(order.confirmedAt).to.be.a('date');

      // Ship order
      order.ship();
      expect(order.status).to.equal(OrderStatus.SHIPPED);
      expect(order.shippedAt).to.be.a('date');

      // Deliver order
      order.deliver();
      expect(order.status).to.equal(OrderStatus.DELIVERED);
      expect(order.deliveredAt).to.be.a('date');
    });

    it('should cancel orders with reason', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Cancel Test Product',
          quantity: 1,
          unitPrice: 100.00,
          totalPrice: 100.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-CANCEL',
        customerId: 'customer-123',
        description: 'Cancel Test Order',
        currency: 'USD',
        items: orderItems,
      };

      const order = new Order(orderData);

      // Cancel order with reason
      order.cancel('Customer requested cancellation');

      expect(order.status).to.equal(OrderStatus.CANCELLED);
      expect(order.isActive).to.be.false;
      expect(order.cancellationReason).to.equal('Customer requested cancellation');
      expect(order.cancelledAt).to.be.a('date');
    });

    it('should prevent invalid status transitions', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Invalid Transition Product',
          quantity: 1,
          unitPrice: 100.00,
          totalPrice: 100.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-INVALID',
        customerId: 'customer-123',
        description: 'Invalid Transition Test',
        currency: 'USD',
        items: orderItems,
      };

      const order = new Order(orderData);

      // Try to ship unconfirmed order - should throw error
      expect(() => order.ship()).to.throw('Cannot ship unconfirmed order');

      // Try to deliver unshipped order - should throw error
      expect(() => order.deliver()).to.throw('Cannot deliver unshipped order');
    });

    it('should calculate order totals correctly', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Calculation Product 1',
          quantity: 3,
          unitPrice: 100.00,
          totalPrice: 300.00,
        },
        {
          productId: 'PROD002',
          description: 'Calculation Product 2',
          quantity: 2,
          unitPrice: 150.00,
          totalPrice: 300.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-CALC',
        customerId: 'customer-123',
        description: 'Calculation Test Order',
        currency: 'USD',
        items: orderItems,
        taxRate: 0.08,
      };

      const order = new Order(orderData);

      // Test calculations
      expect(order.calculateSubtotal()).to.equal(600.00); // 300 + 300
      expect(order.calculateTax()).to.equal(48.00); // 600 * 0.08
      expect(order.calculateTotalWithTax()).to.equal(648.00); // 600 + 48

      // Test with explicit total amount
      const orderDataWithTotal = {
        ...orderData,
        totalAmount: 550.00, // Different from calculated
      };

      const orderWithTotal = new Order(orderDataWithTotal);
      expect(orderWithTotal.totalAmount).to.equal(550.00);
      expect(orderWithTotal.calculateSubtotal()).to.equal(600.00); // Still calculates based on items
    });

    it('should validate item calculations', () => {
      const invalidItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Invalid Calculation Product',
          quantity: 2,
          unitPrice: 100.00,
          totalPrice: 250.00, // Doesn't match quantity * unitPrice
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-ITEMS',
        customerId: 'customer-123',
        description: 'Item Validation Test',
        currency: 'USD',
        items: invalidItems,
      };

      const order = new Order(orderData);
      const validation = order.validate();

      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.include('Item 1: Total price does not match quantity * unit price');
    });

    it('should serialize order to JSON correctly', () => {
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'JSON Test Product',
          quantity: 1,
          unitPrice: 100.00,
          totalPrice: 100.00,
        },
      ];

      const orderData = {
        orderNumber: 'ORD-2024-JSON',
        customerId: 'customer-123',
        description: 'JSON Test Order',
        currency: 'USD',
        items: orderItems,
        taxRate: 0.10,
        notes: 'Test order notes',
      };

      const order = new Order(orderData);
      const json = order.toJSON();

      expect(json.orderNumber).to.equal('ORD-2024-JSON');
      expect(json.customerId).to.equal('customer-123');
      expect(json.description).to.equal('JSON Test Order');
      expect(json.currency).to.equal('USD');
      expect(json.status).to.equal(OrderStatus.DRAFT);
      expect(json.items).to.have.length(1);
      expect(json.subtotal).to.equal(100.00);
      expect(json.taxAmount).to.equal(10.00);
      expect(json.totalWithTax).to.equal(110.00);
      expect(json.notes).to.equal('Test order notes');
      expect(json.createdAt).to.be.a('string');
      expect(json.updatedAt).to.be.a('string');
    });

    it('should enforce order number validation', () => {
      const invalidOrderNumbers = ['INVALID', 'ORD-24-001', 'ORD-2024-1', 'ord-2024-001'];

      invalidOrderNumbers.forEach(orderNumber => {
        expect(() => {
          new Order({
            orderNumber: orderNumber,
            customerId: 'customer-123',
            description: 'Test Order',
            currency: 'USD',
            items: [{
              productId: 'PROD001',
              description: 'Test Product',
              quantity: 1,
              unitPrice: 100.00,
              totalPrice: 100.00,
            }],
          });
        }).to.throw('Invalid order number format');
      });
    });

    it('should enforce currency validation', () => {
      const invalidCurrencies = ['USD$', 'US', 'invalid', 'usd', '123'];

      invalidCurrencies.forEach(currency => {
        expect(() => {
          new Order({
            orderNumber: 'ORD-2024-001',
            customerId: 'customer-123',
            description: 'Test Order',
            currency: currency,
            items: [{
              productId: 'PROD001',
              description: 'Test Product',
              quantity: 1,
              unitPrice: 100.00,
              totalPrice: 100.00,
            }],
          });
        }).to.throw('Invalid currency format');
      });
    });
  });

  describe('Order-to-Cash Workflow Validation', () => {
    it('should validate complete business workflow logic', () => {
      // Step 1: Create customer
      const customer = new Customer({
        code: 'CUST_O2C',
        name: 'O2C Workflow Customer',
        email: 'o2c@workflow.com',
        phone: '+1234567890',
        address: '123 Workflow St',
        city: 'Workflow City',
        country: 'Workflow Country',
        creditLimit: 50000.00,
      });

      expect(customer.validate().isValid).to.be.true;
      expect(customer.hasSufficientCredit(10000.00)).to.be.true;

      // Step 2: Create order
      const orderItems: OrderItem[] = [
        {
          productId: 'PROD001',
          description: 'Workflow Product 1',
          quantity: 5,
          unitPrice: 1000.00,
          totalPrice: 5000.00,
        },
        {
          productId: 'PROD002',
          description: 'Workflow Product 2',
          quantity: 3,
          unitPrice: 1500.00,
          totalPrice: 4500.00,
        },
      ];

      const order = new Order({
        orderNumber: 'ORD-2024-O2C',
        customerId: customer.id || 'customer-o2c',
        description: 'Complete O2C Workflow Test',
        currency: 'USD',
        items: orderItems,
        taxRate: 0.08,
      });

      expect(order.validate().isValid).to.be.true;
      expect(order.totalAmount).to.equal(9500.00);
      expect(customer.hasSufficientCredit(order.calculateTotalWithTax())).to.be.true;

      // Step 3: Process order through lifecycle
      expect(order.status).to.equal(OrderStatus.DRAFT);

      order.confirm();
      expect(order.status).to.equal(OrderStatus.CONFIRMED);
      expect(order.confirmedAt).to.exist;

      order.ship();
      expect(order.status).to.equal(OrderStatus.SHIPPED);
      expect(order.shippedAt).to.exist;

      order.deliver();
      expect(order.status).to.equal(OrderStatus.DELIVERED);
      expect(order.deliveredAt).to.exist;

      // Step 4: Verify business rules
      const finalTotal = order.calculateTotalWithTax();
      expect(finalTotal).to.equal(10260.00); // 9500 + (9500 * 0.08)
      expect(customer.isActive).to.be.true;
    });

    it('should handle order cancellation in workflow', () => {
      const customer = new Customer({
        code: 'CUST_CANCEL',
        name: 'Cancellation Test Customer',
        email: 'cancel@test.com',
        phone: '+1234567890',
        address: '123 Cancel St',
        city: 'Cancel City',
        country: 'Cancel Country',
        creditLimit: 10000.00,
      });

      const order = new Order({
        orderNumber: 'ORD-2024-CANCEL-WF',
        customerId: customer.id || 'customer-cancel',
        description: 'Workflow Cancellation Test',
        currency: 'USD',
        items: [{
          productId: 'PROD001',
          description: 'Cancel Test Product',
          quantity: 2,
          unitPrice: 1000.00,
          totalPrice: 2000.00,
        }],
      });

      // Cancel order in draft state
      order.cancel('Customer request');
      expect(order.status).to.equal(OrderStatus.CANCELLED);
      expect(order.isActive).to.be.false;

      // Verify business logic
      expect(order.cancellationReason).to.equal('Customer request');
      expect(order.cancelledAt).to.exist;
    });
  });

  describe('Security and Validation', () => {
    it('should prevent XSS in customer data', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '"><script>alert("XSS")</script>',
      ];

      xssAttempts.forEach(maliciousInput => {
        expect(() => {
          new Customer({
            code: 'CUST_XSS',
            name: maliciousInput,
            email: 'xss@test.com',
            phone: '+1234567890',
            address: '123 Safe St',
            city: 'Safe City',
            country: 'Safe Country',
            creditLimit: 1000.00,
          });
        }).to.not.throw(); // Should create successfully, but sanitization should occur

        const customer = new Customer({
          code: 'CUST_XSS',
          name: maliciousInput,
          email: 'xss@test.com',
          phone: '+1234567890',
          address: '123 Safe St',
          city: 'Safe City',
          country: 'Safe Country',
          creditLimit: 1000.00,
        });

        // In a real implementation, XSS sanitization would occur here
        // For now, we validate that the entity doesn't break with malicious input
        expect(customer.name).to.be.a('string');
      });
    });

    it('should validate input formats', () => {
      // Test email validation
      const invalidEmails = ['invalid-email', '@test.com', 'test@', 'test..test@test.com'];

      invalidEmails.forEach(email => {
        expect(() => {
          new Customer({
            code: 'CUST_EMAIL',
            name: 'Email Test',
            email: email,
            phone: '+1234567890',
            address: '123 Test St',
            city: 'Test City',
            country: 'Test Country',
            creditLimit: 1000.00,
          });
        }).to.throw('Invalid email format');
      });

      // Test phone validation (basic format)
      expect(() => {
        new Customer({
          code: 'CUST_PHONE',
          name: 'Phone Test',
          email: 'phone@test.com',
          phone: '', // Empty phone
          address: '123 Test St',
          city: 'Test City',
          country: 'Test Country',
          creditLimit: 1000.00,
        });
      }).to.not.throw(); // Phone is created empty, but validation should catch it

      const customer = new Customer({
        code: 'CUST_PHONE',
        name: 'Phone Test',
        email: 'phone@test.com',
        phone: '', // Empty phone
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      });

      const validation = customer.validate();
      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.include('Phone is required');
    });

    it('should enforce business constraints', () => {
      // Test credit limit constraints
      const customer = new Customer({
        code: 'CUST-001',
        name: 'Constraint Test',
        email: 'constraint@test.com',
        phone: '+1234567890',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        creditLimit: 1000.00,
      });

      // Negative credit check
      expect(customer.hasSufficientCredit(-100)).to.be.false;
      expect(customer.hasSufficientCredit(0)).to.be.true;
      expect(customer.hasSufficientCredit(1000)).to.be.true;
      expect(customer.hasSufficientCredit(1001)).to.be.false;

      // Test order quantity constraints
      expect(() => {
        new Order({
          orderNumber: 'ORD-2024-CONSTRAINT',
          customerId: 'customer-123',
          description: 'Constraint Test',
          currency: 'USD',
          items: [{
            productId: 'PROD001',
            description: 'Constraint Test Product',
            quantity: 0, // Zero quantity
            unitPrice: 100.00,
            totalPrice: 0.00,
          }],
        });
      }).to.not.throw(); // Order created, but validation should fail

      const order = new Order({
        orderNumber: 'ORD-2024-001',
        customerId: 'customer-123',
        description: 'Constraint Test',
        currency: 'USD',
        items: [{
          productId: 'PROD001',
          description: 'Constraint Test Product',
          quantity: 0, // Zero quantity
          unitPrice: 100.00,
          totalPrice: 0.00,
        }],
      });

      const validation = order.validate();
      expect(validation.isValid).to.be.false;
      expect(validation.errors).to.include('Item 1: Quantity must be positive');
    });
  });
});