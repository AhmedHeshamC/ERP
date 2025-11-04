import { Prisma } from '@prisma/client';
import { BaseDataFactory, TEST_DATA_CONSTANTS } from './base-data-factory';
import { ReportType, ReportCategory, ReportFormat } from '../../../modules/reports/dto/reports.dto';

/**
 * Reports Data Factory
 *
 * Generates comprehensive test data for reports module integration tests
 * Follows SOLID Single Responsibility principle
 * Implements KISS with clean, focused methods
 */
export class ReportsDataFactory extends BaseDataFactory {
  private readonly reportTypes = Object.values(ReportType);
  private readonly reportCategories = Object.values(ReportCategory);
  private readonly reportFormats = Object.values(ReportFormat);

  /**
   * Create comprehensive test data for reports
   */
  async createReportsTestData(): Promise<{
    users: any[];
    transactions: any[];
    orders: any[];
    customers: any[];
    products: any[];
    purchaseOrders: any[];
    reportDefinitions: any[];
  }> {
    const users = await this.createTestUsers();
    const customers = await this.createTestCustomers();
    const products = await this.createTestProducts();
    const transactions = await this.createTestTransactions(users);
    const orders = await this.createTestOrders(customers, products);
    const purchaseOrders = await this.createTestPurchaseOrders();
    const reportDefinitions = await this.createTestReportDefinitions();

    return {
      users,
      transactions,
      orders,
      customers,
      products,
      purchaseOrders,
      reportDefinitions
    };
  }

  /**
   * Create test users with different roles
   */
  async createTestUsers(): Promise<any[]> {
    const roles = ['ADMIN', 'MANAGER', 'USER', 'ACCOUNTANT', 'SALES_MANAGER'];
    const users = [];

    for (const role of roles) {
      const user = await this.createTestUser(role, {
        firstName: `${role} Test`,
        lastName: 'User',
        isActive: true
      });
      users.push(user);
    }

    return users;
  }

  /**
   * Create test customers for sales reports
   */
  async createTestCustomers(): Promise<any[]> {
    const customerData = [
      {
        name: 'Acme Corporation',
        email: 'billing@acme.com',
        phone: this.generatePhoneNumber(),
        address: this.generateAddress(),
        creditLimit: this.generateAmount(10000, 100000),
        isActive: true,
        customerId: this.generateReference('CUST')
      },
      {
        name: 'Global Industries LLC',
        email: 'accounts@globalindustries.com',
        phone: this.generatePhoneNumber(),
        address: this.generateAddress(),
        creditLimit: this.generateAmount(15000, 150000),
        isActive: true,
        customerId: this.generateReference('CUST')
      },
      {
        name: 'Tech Solutions Inc',
        email: 'finance@techsolutions.com',
        phone: this.generatePhoneNumber(),
        address: this.generateAddress(),
        creditLimit: this.generateAmount(20000, 200000),
        isActive: true,
        customerId: this.generateReference('CUST')
      }
    ];

    const customers = [];
    for (const data of customerData) {
      try {
        const customer = await this.prisma.customer.create({ data });
        customers.push(customer);
      } catch (error) {
        // Customer might exist, try to find existing
        const existing = await this.prisma.customer.findFirst({
          where: { email: data.email }
        });
        if (existing) customers.push(existing);
      }
    }

    return customers;
  }

  /**
   * Create test products for inventory reports
   */
  async createTestProducts(): Promise<any[]> {
    const productData = [
      {
        name: 'Laptop Computer Pro',
        description: 'High-performance laptop for business use',
        sku: this.generateReference('SKU'),
        price: this.generateAmount(800, 2000),
        cost: this.generateAmount(400, 1000),
        stockQuantity: Math.floor(Math.random() * 200) + 50,
        lowStockThreshold: 20,
        isActive: true,
        category: 'Electronics'
      },
      {
        name: 'Office Chair Deluxe',
        description: 'Ergonomic office chair with lumbar support',
        sku: this.generateReference('SKU'),
        price: this.generateAmount(200, 600),
        cost: this.generateAmount(80, 200),
        stockQuantity: Math.floor(Math.random() * 100) + 30,
        lowStockThreshold: 15,
        isActive: true,
        category: 'Furniture'
      },
      {
        name: 'Wireless Mouse',
        description: 'Bluetooth wireless mouse',
        sku: this.generateReference('SKU'),
        price: this.generateAmount(25, 80),
        cost: this.generateAmount(10, 30),
        stockQuantity: Math.floor(Math.random() * 500) + 100,
        lowStockThreshold: 50,
        isActive: true,
        category: 'Electronics'
      }
    ];

    const products = [];
    for (const data of productData) {
      try {
        const product = await this.prisma.product.create({ data });
        products.push(product);
      } catch (error) {
        // Product might exist, try to find existing
        const existing = await this.prisma.product.findFirst({
          where: { sku: data.sku }
        });
        if (existing) products.push(existing);
      }
    }

    return products;
  }

  /**
   * Create test transactions for financial reports
   */
  async createTestTransactions(users: any[]): Promise<any[]> {
    const transactions = [];
    const transactionTypes = ['SALE', 'PURCHASE', 'PAYMENT', 'REFUND'];
    const statuses = ['POSTED', 'PENDING', 'CANCELLED'];

    // Generate transactions over the last 12 months
    for (let i = 0; i < 50; i++) {
      const date = this.generatePastDate(Math.floor(Math.random() * 365));
      const transaction = {
        type: this.selectRandom(transactionTypes),
        amount: this.generateAmount(100, 10000),
        date,
        status: this.selectRandom(statuses),
        description: this.generateLoremIpsum(5),
        reference: this.generateReference('TXN'),
        userId: this.selectRandom(users).id,
        createdAt: date,
        updatedAt: date
      };

      try {
        const created = await this.prisma.transaction.create({ data: transaction });
        transactions.push(created);
      } catch (error) {
        // Transaction might exist, continue
      }
    }

    return transactions;
  }

  /**
   * Create test orders for sales reports
   */
  async createTestOrders(customers: any[], products: any[]): Promise<any[]> {
    const orders = [];
    const statuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    for (let i = 0; i < 30; i++) {
      const orderDate = this.generatePastDate(Math.floor(Math.random() * 180));
      const status = this.selectRandom(statuses);

      const orderData = {
        orderNumber: this.generateReference('ORD'),
        customerId: this.selectRandom(customers).id,
        orderDate,
        status,
        totalAmount: this.generateAmount(500, 15000),
        shippingAddress: this.generateAddress(),
        billingAddress: this.generateAddress(),
        notes: this.generateLoremIpsum(8),
        createdAt: orderDate,
        updatedAt: orderDate
      };

      try {
        const order = await this.prisma.order.create({ data: orderData });

        // Create order items
        await this.createOrderItems(order.id, products);
        orders.push(order);
      } catch (error) {
        // Order might exist, continue
      }
    }

    return orders;
  }

  /**
   * Create order items for a test order
   */
  private async createOrderItems(orderId: string, products: any[]): Promise<void> {
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedProducts = this.selectRandomItems(products, numItems);

    for (const product of selectedProducts) {
      const quantity = Math.floor(Math.random() * 5) + 1;
      const unitPrice = product.price;
      const totalPrice = quantity * unitPrice;

      try {
        await this.prisma.orderItem.create({
          data: {
            orderId,
            productId: product.id,
            quantity,
            unitPrice,
            totalPrice
          }
        });
      } catch (error) {
        // Order item might exist, continue
      }
    }
  }

  /**
   * Create test purchase orders for purchasing reports
   */
  async createTestPurchaseOrders(): Promise<any[]> {
    const purchaseOrders = [];
    const statuses = ['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED'];

    for (let i = 0; i < 20; i++) {
      const orderDate = this.generatePastDate(Math.floor(Math.random() * 120));
      const status = this.selectRandom(statuses);

      const purchaseOrderData = {
        orderNumber: this.generateReference('PO'),
        supplierId: this.generateUniqueId('SUPP'),
        orderDate,
        expectedDeliveryDate: this.generateFutureDate(Math.floor(Math.random() * 30) + 7),
        status,
        totalAmount: this.generateAmount(1000, 25000),
        currency: this.selectRandom(TEST_DATA_CONSTANTS.CURRENCIES),
        notes: this.generateLoremIpsum(6),
        createdAt: orderDate,
        updatedAt: orderDate
      };

      try {
        const purchaseOrder = await this.prisma.purchaseOrder.create({
          data: purchaseOrderData
        });
        purchaseOrders.push(purchaseOrder);
      } catch (error) {
        // Purchase order might exist, continue
      }
    }

    return purchaseOrders;
  }

  /**
   * Create test report definitions
   */
  async createTestReportDefinitions(): Promise<any[]> {
    const reportDefinitions = [];

    const definitionData = [
      {
        name: 'Monthly Financial Summary',
        description: 'Comprehensive monthly financial report with P&L and balance sheet',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: 'SELECT * FROM financial_summary WHERE date BETWEEN :startDate AND :endDate',
        parameters: {
          startDate: { type: 'date', required: true },
          endDate: { type: 'date', required: true },
          currency: { type: 'string', default: 'USD' }
        },
        isActive: true,
        isSystem: false
      },
      {
        name: 'Sales Performance Analytics',
        description: 'Detailed sales analytics with customer and product breakdowns',
        type: ReportType.SALES,
        category: ReportCategory.ANALYTICS,
        query: 'SELECT * FROM sales_analytics WHERE period BETWEEN :startDate AND :endDate',
        parameters: {
          startDate: { type: 'date', required: true },
          endDate: { type: 'date', required: true },
          customerGrouping: { type: 'string', required: false },
          productGrouping: { type: 'string', required: false }
        },
        isActive: true,
        isSystem: false
      },
      {
        name: 'Inventory Status Report',
        description: 'Current inventory levels and stock movement analysis',
        type: ReportType.INVENTORY,
        category: ReportCategory.DETAILED,
        query: 'SELECT * FROM inventory_status WHERE as_of_date = :reportDate',
        parameters: {
          reportDate: { type: 'date', required: true },
          includeLowStock: { type: 'boolean', default: true }
        },
        isActive: true,
        isSystem: false
      },
      {
        name: 'Executive KPI Dashboard',
        description: 'Executive dashboard with key performance indicators',
        type: ReportType.EXECUTIVE,
        category: ReportCategory.KPI,
        query: 'SELECT * FROM executive_kpis WHERE period = :reportPeriod',
        parameters: {
          reportPeriod: { type: 'string', required: true },
          includeComparisons: { type: 'boolean', default: true }
        },
        isActive: true,
        isSystem: false
      }
    ];

    for (const data of definitionData) {
      try {
        const reportDefinition = await this.prisma.reportDefinition.create({
          data: {
            ...data,
            parameters: data.parameters as Prisma.InputJsonValue
          }
        });
        reportDefinitions.push(reportDefinition);
      } catch (error) {
        // Report definition might exist, try to find existing
        const existing = await this.prisma.reportDefinition.findFirst({
          where: { name: data.name }
        });
        if (existing) reportDefinitions.push(existing);
      }
    }

    return reportDefinitions;
  }

  /**
   * Create test stock movements for inventory reports
   */
  async createTestStockMovements(products: any[]): Promise<any[]> {
    const movements = [];
    const movementTypes = ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'];

    for (let i = 0; i < 40; i++) {
      const movement = {
        productId: this.selectRandom(products).id,
        type: this.selectRandom(movementTypes),
        quantity: Math.floor(Math.random() * 100) + 1,
        reference: this.generateReference('MOV'),
        reason: this.generateLoremIpsum(4),
        date: this.generatePastDate(Math.floor(Math.random() * 90)),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        const created = await this.prisma.stockMovement.create({ data: movement });
        movements.push(created);
      } catch (error) {
        // Movement might exist, continue
      }
    }

    return movements;
  }

  /**
   * Generate specific data for financial reports
   */
  async generateFinancialReportData(): Promise<{
    startDate: Date;
    endDate: Date;
    transactions: any[];
  }> {
    const startDate = this.generatePastDate(365);
    const endDate = new Date();

    // Create additional transactions for financial reports
    const transactions = [];
    for (let i = 0; i < 20; i++) {
      const transaction = {
        type: Math.random() > 0.3 ? 'SALE' : 'PURCHASE',
        amount: this.generateAmount(1000, 25000),
        date: new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime())),
        status: 'POSTED',
        description: `Financial test transaction ${i + 1}`,
        reference: this.generateReference('FIN'),
        userId: this.generateUniqueId('USER'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        const created = await this.prisma.transaction.create({ data: transaction });
        transactions.push(created);
      } catch (error) {
        // Transaction might exist, continue
      }
    }

    return { startDate, endDate, transactions };
  }

  /**
   * Generate specific data for sales reports
   */
  async generateSalesReportData(): Promise<{
    startDate: Date;
    endDate: Date;
    orders: any[];
  }> {
    const startDate = this.generatePastDate(180);
    const endDate = new Date();

    // Create additional orders for sales reports
    const customers = await this.prisma.customer.findMany({ take: 5 });
    const products = await this.prisma.product.findMany({ take: 10 });

    const orders = [];
    for (let i = 0; i < 15; i++) {
      const orderDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));

      const order = {
        orderNumber: this.generateReference('SALE'),
        customerId: this.selectRandom(customers).id,
        orderDate,
        status: this.selectRandom(['CONFIRMED', 'SHIPPED', 'DELIVERED']),
        totalAmount: this.generateAmount(2000, 15000),
        shippingAddress: this.generateAddress(),
        billingAddress: this.generateAddress(),
        notes: `Sales test order ${i + 1}`,
        createdAt: orderDate,
        updatedAt: orderDate
      };

      try {
        const created = await this.prisma.order.create({ data: order });
        await this.createOrderItems(created.id, products);
        orders.push(created);
      } catch (error) {
        // Order might exist, continue
      }
    }

    return { startDate, endDate, orders };
  }

  /**
   * Clean up all test reports data
   */
  async cleanupReportsTestData(): Promise<void> {
    const patterns = [
      'TEST-',
      'ORD-TEST',
      'CUST-TEST',
      'TXN-TEST',
      'PO-TEST',
      'SKU-TEST',
      'MOV-TEST',
      'FIN-TEST',
      'SALE-TEST',
      'SUPP-TEST',
      'USER-test'
    ];

    await this.cleanupTestData(patterns);

    // Clean up specific reports tables
    try {
      await this.prisma.generatedReport.deleteMany({
        where: {
          name: { contains: 'TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.reportDefinition.deleteMany({
        where: {
          name: { contains: 'TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.stockMovement.deleteMany({
        where: {
          reference: { contains: 'MOV-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.orderItem.deleteMany({
        where: {
          order: {
            orderNumber: { contains: 'ORD-TEST' }
          }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.order.deleteMany({
        where: {
          orderNumber: { contains: 'ORD-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.transaction.deleteMany({
        where: {
          reference: { contains: 'TXN-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.purchaseOrder.deleteMany({
        where: {
          orderNumber: { contains: 'PO-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.product.deleteMany({
        where: {
          sku: { contains: 'SKU-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      await this.prisma.customer.deleteMany({
        where: {
          customerId: { contains: 'CUST-TEST' }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Generate performance test data (large datasets)
   */
  async generatePerformanceTestData(): Promise<{
    largeTransactionSet: any[];
    largeOrderSet: any[];
    largeProductSet: any[];
  }> {
    // Generate large dataset for performance testing
    const largeTransactionSet = [];
    const largeOrderSet = [];
    const largeProductSet = [];

    // Create 1000 transactions
    for (let i = 0; i < 1000; i++) {
      const transaction = {
        type: this.selectRandom(['SALE', 'PURCHASE', 'PAYMENT']),
        amount: this.generateAmount(100, 50000),
        date: this.generatePastDate(Math.floor(Math.random() * 730)),
        status: 'POSTED',
        description: `Performance test transaction ${i}`,
        reference: this.generateReference('PERF'),
        userId: this.generateUniqueId('USER'),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        const created = await this.prisma.transaction.create({ data: transaction });
        largeTransactionSet.push(created);
      } catch (error) {
        // Continue on error
      }
    }

    // Create 500 products
    for (let i = 0; i < 500; i++) {
      const product = {
        name: `Performance Test Product ${i}`,
        description: `Product for performance testing ${i}`,
        sku: this.generateReference('PERF'),
        price: this.generateAmount(10, 5000),
        cost: this.generateAmount(5, 2500),
        stockQuantity: Math.floor(Math.random() * 1000),
        lowStockThreshold: 50,
        isActive: true,
        category: `Category ${i % 20}`
      };

      try {
        const created = await this.prisma.product.create({ data: product });
        largeProductSet.push(created);
      } catch (error) {
        // Continue on error
      }
    }

    return { largeTransactionSet, largeOrderSet, largeProductSet };
  }
}