import { PrismaService } from '../../../database/prisma.service';
import { BaseDataFactory, ITestDataFactory, TEST_DATA_CONSTANTS } from './base-data-factory';
import { IntegrationTestHelpers } from '../integration-setup';

/**
 * Sales Module Test Data Factory
 *
 * Creates realistic test data for sales module including
 * customers, quotes, orders, invoices, and sales analytics
 */
export class SalesDataFactory extends BaseDataFactory implements ITestDataFactory {
  private salesTestData: any = {};

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Create comprehensive base sales test data
   */
  async createBaseData(): Promise<void> {
    this.salesTestData = {
      customers: await this.createCustomerBase(),
      products: await this.createProductBase(),
      quotes: [],
      orders: [],
      invoices: [],
      salesAnalytics: {}
    };
  }

  /**
   * Clean up all sales test data
   */
  async cleanupTestData(): Promise<void> {
    const patterns = [
      'test-customer', 'test-quote', 'test-order', 'test-invoice',
      'test-payment', 'sales-test', 'customer-test', 'order-test'
    ];

    await this.cleanupTestData(patterns);
  }

  /**
   * Create customer base data
   */
  async createCustomerBase(): Promise<any[]> {
    const customers = [];

    for (let i = 0; i < 5; i++) {
      const customer = await this.createTestCustomer({
        company: this.selectRandom(TEST_DATA_CONSTANTS.COMPANIES),
        industry: this.selectRandom(TEST_DATA_CONSTANTS.INDUSTRIES)
      });
      customers.push(customer);
    }

    return customers;
  }

  /**
   * Create product base data
   */
  async createProductBase(): Promise<any[]> {
    const products = [];

    const productTypes = ['Physical', 'Digital', 'Service', 'Subscription'];
    const categories = ['Electronics', 'Software', 'Hardware', 'Services', 'Support'];

    for (let i = 0; i < 10; i++) {
      const product = await this.createTestProduct({
        type: this.selectRandom(productTypes),
        category: this.selectRandom(categories),
        price: this.generateAmount(50, 5000)
      });
      products.push(product);
    }

    return products;
  }

  /**
   * Create a test customer
   */
  async createTestCustomer(overrides?: any): Promise<any> {
    const timestamp = Date.now();
    const address = this.generateAddress();
    const customerData = {
      id: this.generateUniqueId('cust'),
      customerCode: this.generateReference('CUST'),
      companyName: overrides?.company || this.selectRandom(TEST_DATA_CONSTANTS.COMPANIES),
      industry: overrides?.industry || this.selectRandom(TEST_DATA_CONSTANTS.INDUSTRIES),
      contactPerson: this.generateLoremIpsum(2),
      email: this.generateTestEmail(`customer-${timestamp}`),
      phone: this.generatePhoneNumber(),
      website: `https://www.customer-${timestamp}.com`,
      billingAddress: {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country
      },
      shippingAddress: {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country
      },
      taxId: this.generateReference('TAX'),
      creditLimit: this.generateAmount(10000, 100000),
      paymentTerms: this.selectRandom(['Net 15', 'Net 30', 'Net 45', 'Net 60']),
      isActive: true,
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      return await this.prisma.customer.create({
        data: customerData
      });
    } catch (error) {
      // Customer might already exist, try to find it
      return await this.prisma.customer.findFirst({
        where: { email: customerData.email }
      });
    }
  }

  /**
   * Create a test product
   */
  async createTestProduct(overrides?: any): Promise<any> {
    const timestamp = Date.now();
    const productData = {
      id: this.generateUniqueId('prod'),
      productCode: this.generateReference('PROD'),
      name: this.generateLoremIpsum(3),
      description: this.generateLoremIpsum(15),
      type: overrides?.type || 'Physical',
      category: overrides?.category || 'Electronics',
      sku: `SKU-${timestamp}`,
      price: overrides?.price || this.generateAmount(50, 5000),
      cost: overrides?.price ? overrides.price * 0.6 : this.generateAmount(30, 3000),
      currency: this.selectRandom(TEST_DATA_CONSTANTS.CURRENCIES),
      unit: this.selectRandom(['Each', 'Box', 'Set', 'License', 'Hour']),
      isActive: true,
      isInStock: this.generateBoolean(0.8),
      stockQuantity: this.generateBoolean(0.7) ? this.generateAmount(10, 1000) : 0,
      reorderLevel: this.generateAmount(50, 100),
      tags: [this.generateLoremIpsum(1), this.generateLoremIpsum(1)],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      return await this.prisma.product.create({
        data: productData
      });
    } catch (error) {
      // Product might already exist, try to find it
      return await this.prisma.product.findFirst({
        where: { sku: productData.sku }
      });
    }
  }

  /**
   * Create a sales quote
   */
  async createSalesQuote(customerId?: string, overrides?: any): Promise<any> {
    const customers = await this.getTestCustomers();
    const products = await this.getTestProducts();

    const selectedCustomer = customerId ?
      customers.find(c => c.id === customerId) :
      this.selectRandom(customers);

    const selectedProducts = this.selectRandomItems(products, 3);

    const quoteData = {
      id: this.generateUniqueId('quote'),
      quoteNumber: this.generateReference('QTE'),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.companyName,
      quoteDate: new Date(),
      validUntil: this.generateFutureDate(30),
      status: 'Draft',
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      notes: this.generateLoremIpsum(10),
      terms: this.generateLoremIpsum(5),
      salesRepId: this.generateUniqueId('user'),
      salesRepName: 'Test Sales Rep',
      items: selectedProducts.map(product => ({
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        description: product.description,
        quantity: this.generateAmount(1, 10),
        unitPrice: product.price,
        discount: this.generateAmount(0, 10),
        total: 0
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    // Calculate totals
    let subtotal = 0;
    quoteData.items.forEach((item: any) => {
      item.total = item.quantity * item.unitPrice * (1 - item.discount / 100);
      subtotal += item.total;
    });

    quoteData.subtotal = subtotal;
    quoteData.taxAmount = subtotal * 0.08; // 8% tax
    quoteData.totalAmount = subtotal + quoteData.taxAmount;

    try {
      return await this.prisma.salesQuote.create({
        data: quoteData
      });
    } catch (error) {
      throw new Error(`Failed to create sales quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a sales order
   */
  async createSalesOrder(customerId?: string, overrides?: any): Promise<any> {
    const customers = await this.getTestCustomers();
    const products = await this.getTestProducts();

    const selectedCustomer = customerId ?
      customers.find(c => c.id === customerId) :
      this.selectRandom(customers);

    const selectedProducts = this.selectRandomItems(products, 4);

    const orderData = {
      id: this.generateUniqueId('order'),
      orderNumber: this.generateReference('ORD'),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.companyName,
      orderDate: new Date(),
      expectedDeliveryDate: this.generateFutureDate(14),
      status: 'Pending',
      priority: this.selectRandom(['Low', 'Medium', 'High']),
      subtotal: 0,
      taxAmount: 0,
      shippingAmount: this.generateAmount(0, 100),
      totalAmount: 0,
      notes: this.generateLoremIpsum(8),
      shippingAddress: selectedCustomer.shippingAddress,
      billingAddress: selectedCustomer.billingAddress,
      items: selectedProducts.map(product => ({
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        description: product.description,
        quantity: this.generateAmount(1, 20),
        unitPrice: product.price,
        discount: this.generateAmount(0, 15),
        total: 0,
        status: 'Pending'
      })),
      createdBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    // Calculate totals
    let subtotal = 0;
    orderData.items.forEach((item: any) => {
      item.total = item.quantity * item.unitPrice * (1 - item.discount / 100);
      subtotal += item.total;
    });

    orderData.subtotal = subtotal;
    orderData.taxAmount = subtotal * 0.08;
    orderData.totalAmount = subtotal + orderData.taxAmount + orderData.shippingAmount;

    try {
      return await this.prisma.salesOrder.create({
        data: orderData
      });
    } catch (error) {
      throw new Error(`Failed to create sales order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a sales invoice
   */
  async createSalesInvoice(customerId?: string, orderId?: string, overrides?: any): Promise<any> {
    const customers = await this.getTestCustomers();
    const products = await this.getTestProducts();

    const selectedCustomer = customerId ?
      customers.find(c => c.id === customerId) :
      this.selectRandom(customers);

    const selectedProducts = this.selectRandomItems(products, 5);

    const invoiceData = {
      id: this.generateUniqueId('invoice'),
      invoiceNumber: this.generateReference('INV'),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.companyName,
      orderId: orderId || null,
      invoiceDate: new Date(),
      dueDate: this.generateFutureDate(30),
      status: 'Unpaid',
      subtotal: 0,
      taxAmount: 0,
      shippingAmount: this.generateAmount(0, 150),
      totalAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
      notes: this.generateLoremIpsum(6),
      terms: 'Payment due within 30 days',
      billingAddress: selectedCustomer.billingAddress,
      shippingAddress: selectedCustomer.shippingAddress,
      items: selectedProducts.map(product => ({
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        description: product.description,
        quantity: this.generateAmount(1, 25),
        unitPrice: product.price,
        discount: this.generateAmount(0, 20),
        total: 0
      })),
      createdBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    // Calculate totals
    let subtotal = 0;
    invoiceData.items.forEach((item: any) => {
      item.total = item.quantity * item.unitPrice * (1 - item.discount / 100);
      subtotal += item.total;
    });

    invoiceData.subtotal = subtotal;
    invoiceData.taxAmount = subtotal * 0.08;
    invoiceData.totalAmount = subtotal + invoiceData.taxAmount + invoiceData.shippingAmount;
    invoiceData.balanceDue = invoiceData.totalAmount;

    try {
      return await this.prisma.salesInvoice.create({
        data: invoiceData
      });
    } catch (error) {
      throw new Error(`Failed to create sales invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a payment record
   */
  async createPayment(invoiceId: string, overrides?: any): Promise<any> {
    const paymentMethods = ['Cash', 'Credit Card', 'Bank Transfer', 'Check', 'PayPal'];
    const paymentStatuses = ['Pending', 'Completed', 'Failed', 'Refunded'];

    const paymentData = {
      id: this.generateUniqueId('payment'),
      paymentNumber: this.generateReference('PAY'),
      invoiceId: invoiceId,
      paymentDate: new Date(),
      amount: overrides?.amount || this.generateAmount(100, 10000),
      method: this.selectRandom(paymentMethods),
      status: this.selectRandom(paymentStatuses),
      transactionId: this.generateReference('TXN'),
      notes: this.generateLoremIpsum(5),
      processedBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      return await this.prisma.payment.create({
        data: paymentData
      });
    } catch (error) {
      throw new Error(`Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get test customers
   */
  async getTestCustomers(): Promise<any[]> {
    try {
      return await this.prisma.customer.findMany({
        where: {
          OR: [
            { companyName: { contains: 'test' } },
            { email: { contains: 'customer-test' } }
          ]
        },
        take: 20
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Get test products
   */
  async getTestProducts(): Promise<any[]> {
    try {
      return await this.prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: 'test' } },
            { sku: { startsWith: 'SKU-' } }
          ]
        },
        take: 20
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Create sales opportunity
   */
  async createSalesOpportunity(overrides?: any): Promise<any> {
    const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
    const sources = ['Website', 'Referral', 'Cold Call', 'Email', 'Trade Show', 'Partner'];

    const opportunityData = {
      id: this.generateUniqueId('opp'),
      opportunityName: this.generateLoremIpsum(4),
      customerId: this.generateUniqueId('customer'),
      contactName: this.generateLoremIpsum(2),
      stage: this.selectRandom(stages),
      source: this.selectRandom(sources),
      estimatedValue: this.generateAmount(5000, 100000),
      probability: this.generatePercentage(10, 90),
      expectedCloseDate: this.generateFutureDate(90),
      description: this.generateLoremIpsum(20),
      assignedTo: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      return await this.prisma.salesOpportunity.create({
        data: opportunityData
      });
    } catch (error) {
      throw new Error(`Failed to create sales opportunity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate sales analytics data
   */
  async generateSalesAnalytics(): Promise<any> {
    const customers = await this.getTestCustomers();
    const startDate = this.generatePastDate(30);
    const endDate = new Date();

    return {
      totalRevenue: this.generateAmount(50000, 500000),
      totalOrders: this.generateAmount(100, 1000),
      averageOrderValue: this.generateAmount(500, 5000),
      topCustomers: customers.slice(0, 5).map(customer => ({
        customerId: customer.id,
        customerName: customer.companyName,
        totalSpent: this.generateAmount(5000, 50000),
        orderCount: this.generateAmount(5, 50)
      })),
      salesByProduct: await this.generateSalesByProduct(),
      salesByRegion: await this.generateSalesByRegion(),
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };
  }

  /**
   * Generate sales by product data
   */
  private async generateSalesByProduct(): Promise<any[]> {
    const products = await this.getTestProducts();

    return products.slice(0, 10).map(product => ({
      productId: product.id,
      productName: product.name,
      quantitySold: this.generateAmount(10, 500),
      revenue: this.generateAmount(1000, 50000),
      profit: this.generateAmount(200, 15000)
    }));
  }

  /**
   * Generate sales by region data
   */
  private async generateSalesByRegion(): Promise<any[]> {
    const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];

    return regions.map(region => ({
      region: region,
      revenue: this.generateAmount(10000, 100000),
      orders: this.generateAmount(20, 200),
      customers: this.generateAmount(5, 50)
    }));
  }

  /**
   * Generate test data for specific scenario
   */
  generateTestData(overrides?: any): any {
    return {
      customerData: {
        companyName: this.selectRandom(TEST_DATA_CONSTANTS.COMPANIES),
        email: this.generateTestEmail('customer'),
        creditLimit: this.generateAmount(10000, 100000),
        ...overrides?.customer
      },
      orderData: {
        orderNumber: this.generateReference('ORD'),
        priority: this.selectRandom(['Low', 'Medium', 'High']),
        ...overrides?.order
      },
      invoiceData: {
        invoiceNumber: this.generateReference('INV'),
        dueDate: this.generateFutureDate(30),
        ...overrides?.invoice
      }
    };
  }

  /**
   * Create complete sales workflow (Quote -> Order -> Invoice -> Payment)
   */
  async createCompleteSalesWorkflow(customerId?: string): Promise<{
    quote: any;
    order: any;
    invoice: any;
    payment: any;
  }> {
    // Create customer if not provided
    let customer = customerId;
    if (!customerId) {
      const newCustomer = await this.createTestCustomer();
      customer = newCustomer.id;
    }

    // Create quote
    const quote = await this.createSalesQuote(customer);

    // Convert quote to order
    const order = await this.createSalesOrder(customer, {
      quoteId: quote.id,
      status: 'Confirmed'
    });

    // Create invoice from order
    const invoice = await this.createSalesInvoice(customer, order.id);

    // Create payment
    const payment = await this.createPayment(invoice.id, {
      amount: invoice.totalAmount,
      status: 'Completed'
    });

    return { quote, order, invoice, payment };
  }
}