import { expect } from 'chai';
import { Customer } from './entities/customer.entity';
import { CustomerStatus } from './enums/sales.enum';
import 'chai/register-should';
import 'chai/register-expect';

describe('Customer Entity Tests', () => {
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
  });
});