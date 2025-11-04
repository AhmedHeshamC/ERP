import { PrismaService } from '../../../database/prisma.service';
import { BaseDataFactory, ITestDataFactory, TEST_DATA_CONSTANTS } from './base-data-factory';
import { SupplierStatus, PaymentTerms } from '../../../modules/purchasing/dto/supplier.dto';
import { PurchaseOrderStatus } from '../../../modules/purchasing/dto/purchase-order.dto';

/**
 * Purchasing Data Factory
 *
 * Generates realistic test data for purchasing module integration tests
 * following SOLID Single Responsibility principle
 */
export class PurchasingDataFactory extends BaseDataFactory implements ITestDataFactory {
  private testSuppliers: any[] = [];
  private testProducts: any[] = [];
  private testUsers: any[] = [];
  private testPurchaseOrders: any[] = [];

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Create base test data required for purchasing tests
   */
  async createBaseData(): Promise<void> {
    await this.createTestUsers();
    await this.createTestProducts();
    await this.createTestSuppliers();
  }

  /**
   * Clean up all test data
   */
  async cleanupTestData(): Promise<void> {
    const patterns = ['purchasing-test', 'supplier-test', 'po-test'];
    await this.cleanupTestData(patterns);
  }

  /**
   * Create test users for purchasing workflows
   */
  private async createTestUsers(): Promise<void> {
    const roles = ['ADMIN', 'MANAGER', 'USER'];

    for (const role of roles) {
      for (let i = 1; i <= 2; i++) {
        const user = await this.createTestUser(`${role.toLowerCase()}-purchasing-${i}`, {
          firstName: `${role} Purchasing ${i}`,
          lastName: 'Test User',
          role: role
        });
        this.testUsers.push(user);
      }
    }
  }

  /**
   * Create test products for purchase orders
   */
  private async createTestProducts(): Promise<void> {
    const productCategories = [
      'Raw Materials', 'Office Supplies', 'Equipment', 'Components',
      'Services', 'Maintenance', 'Software', 'Hardware'
    ];

    const products = [
      { name: 'Office Paper', category: 'Office Supplies', price: 29.99 },
      { name: 'Laptop Computer', category: 'Hardware', price: 899.99 },
      { name: 'Desk Chair', category: 'Furniture', price: 249.99 },
      { name: 'Printer Ink', category: 'Office Supplies', price: 45.99 },
      { name: 'Network Cable', category: 'Hardware', price: 12.99 },
      { name: 'Software License', category: 'Software', price: 199.99 },
      { name: 'Cleaning Service', category: 'Services', price: 150.00 },
      { name: 'Raw Material A', category: 'Raw Materials', price: 15.50 },
      { name: 'Electronic Component', category: 'Components', price: 3.25 },
      { name: 'Maintenance Kit', category: 'Maintenance', price: 75.00 }
    ];

    for (const product of products) {
      try {
        // Create category if not exists
        let category = await this.prisma.productCategory.findFirst({
          where: { name: product.category }
        });

        if (!category) {
          category = await this.prisma.productCategory.create({
            data: {
              name: product.category,
              description: `${product.category} for testing`,
              level: 0,
              isActive: true
            }
          });
        }

        const productData = {
          name: product.name,
          sku: this.generateUniqueId('PROD'),
          description: `Test ${product.name} for purchasing integration`,
          price: product.price,
          categoryId: category.id,
          status: 'ACTIVE',
          stockQuantity: Math.floor(Math.random() * 1000) + 100,
          lowStockThreshold: 10,
          isActive: true
        };

        const createdProduct = await this.executeWithRetry(() =>
          this.prisma.product.create({ data: productData })
        );

        this.testProducts.push(createdProduct);
      } catch (error) {
        // Product might already exist, try to find it
        const existingProduct = await this.prisma.product.findFirst({
          where: { name: product.name }
        });
        if (existingProduct) {
          this.testProducts.push(existingProduct);
        }
      }
    }
  }

  /**
   * Create test suppliers
   */
  private async createTestSuppliers(): Promise<void> {
    const suppliers = [
      {
        name: 'Global Office Supplies Inc',
        email: 'contact@globaloffice.com',
        phone: '+1-555-0101',
        address: '123 Supply St, Suite 100',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'USA',
        paymentTerms: PaymentTerms.NET30,
        creditLimit: 50000.00
      },
      {
        name: 'Tech Components Ltd',
        email: 'orders@techcomponents.com',
        phone: '+1-555-0102',
        address: '456 Technology Blvd',
        city: 'San Jose',
        state: 'CA',
        postalCode: '95110',
        country: 'USA',
        paymentTerms: PaymentTerms.NET15,
        creditLimit: 100000.00
      },
      {
        name: 'Industrial Equipment Co',
        email: 'sales@industrial.com',
        phone: '+1-555-0103',
        address: '789 Industrial Way',
        city: 'Houston',
        state: 'TX',
        postalCode: '77002',
        country: 'USA',
        paymentTerms: PaymentTerms.NET60,
        creditLimit: 250000.00
      },
      {
        name: 'Service Pro Solutions',
        email: 'info@servicepro.com',
        phone: '+1-555-0104',
        address: '321 Service Rd',
        city: 'Phoenix',
        state: 'AZ',
        postalCode: '85001',
        country: 'USA',
        paymentTerms: PaymentTerms.COD,
        creditLimit: 25000.00
      },
      {
        name: 'Raw Materials Direct',
        email: 'orders@rawmaterials.com',
        phone: '+1-555-0105',
        address: '654 Material Ave',
        city: 'Detroit',
        state: 'MI',
        postalCode: '48201',
        country: 'USA',
        paymentTerms: PaymentTerms.NET30,
        creditLimit: 150000.00
      }
    ];

    for (const supplierData of suppliers) {
      try {
        const data = {
          code: this.generateUniqueId('SUPP'),
          ...supplierData,
          isActive: true,
          taxId: `TAX-${this.generateRandomString(8)}`
        };

        const supplier = await this.executeWithRetry(() =>
          this.prisma.supplier.create({ data })
        );

        this.testSuppliers.push(supplier);
      } catch (error) {
        // Supplier might already exist, try to find it
        const existingSupplier = await this.prisma.supplier.findFirst({
          where: { email: supplierData.email }
        });
        if (existingSupplier) {
          this.testSuppliers.push(existingSupplier);
        }
      }
    }
  }

  /**
   * Create a test supplier with optional overrides
   */
  async createTestSupplier(overrides?: any): Promise<any> {
    const supplierData = {
      code: this.generateUniqueId('SUPP'),
      name: `Test Supplier ${Date.now()}`,
      email: this.generateTestEmail('supplier'),
      phone: this.generatePhoneNumber(),
      address: this.generateAddress().street,
      city: this.generateAddress().city,
      state: this.generateAddress().state,
      postalCode: this.generateAddress().zipCode,
      country: this.generateAddress().country,
      isActive: true,
      paymentTerms: this.selectRandom(Object.values(PaymentTerms)),
      creditLimit: this.generateAmount(10000, 100000),
      taxId: `TAX-${this.generateRandomString(8)}`,
      ...overrides
    };

    return await this.executeWithRetry(() =>
      this.prisma.supplier.create({ data: supplierData })
    );
  }

  /**
   * Create a test purchase order with realistic data
   */
  async createTestPurchaseOrder(overrides?: any): Promise<any> {
    if (this.testSuppliers.length === 0 || this.testProducts.length === 0) {
      await this.createBaseData();
    }

    const supplier = this.selectRandom(this.testSuppliers);
    const requester = this.selectRandom(this.testUsers.filter(u => u.role !== 'USER'));

    // Generate 1-5 items for the purchase order
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const selectedProducts = this.selectRandomItems(this.testProducts, itemCount);

    const items = selectedProducts.map(product => ({
      productId: product.id,
      description: `Purchase of ${product.name}`,
      quantity: Math.floor(Math.random() * 50) + 1,
      unitPrice: parseFloat(product.price.toString()),
      totalPrice: 0 // Will be calculated by the service
    }));

    const totalAmount = items.reduce((sum, item) =>
      sum + (item.quantity * item.unitPrice), 0
    );

    const orderData = {
      orderNumber: this.generateReference('PO'),
      supplierId: supplier.id,
      reference: `TEST-REF-${Date.now()}`,
      description: `Test Purchase Order for integration testing`,
      status: PurchaseOrderStatus.DRAFT,
      orderDate: new Date(),
      expectedDate: this.generateFutureDate(14),
      subtotal: totalAmount,
      taxAmount: totalAmount * 0.08, // 8% tax
      totalAmount: totalAmount * 1.08,
      requestedBy: requester.id,
      notes: 'Test purchase order created for integration testing',
      internalNotes: 'Internal test notes - not visible to supplier',
      deliveryAddress: 'Main Warehouse, 123 Warehouse St',
      paymentTerms: supplier.paymentTerms,
      items: {
        create: items
      }
    };

    const purchaseOrder = await this.executeWithRetry(() =>
      this.prisma.purchaseOrder.create({
        data: orderData,
        include: { items: true }
      })
    );

    this.testPurchaseOrders.push(purchaseOrder);
    return purchaseOrder;
  }

  /**
   * Create multiple test purchase orders with different statuses
   */
  async createTestPurchaseOrdersWithStatuses(): Promise<any[]> {
    const statuses = Object.values(PurchaseOrderStatus);
    const orders = [];

    for (const status of statuses) {
      const order = await this.createTestPurchaseOrder();

      // Update the order status
      await this.prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status,
          approvedAt: status === PurchaseOrderStatus.APPROVED ? new Date() : null,
          approvedBy: status === PurchaseOrderStatus.APPROVED ?
            this.selectRandom(this.testUsers.filter(u => u.role === 'ADMIN')).id : null,
          sentAt: status === PurchaseOrderStatus.SENT ? new Date() : null,
          completedAt: status === PurchaseOrderStatus.COMPLETED ? new Date() : null,
          cancelledAt: status === PurchaseOrderStatus.CANCELLED ? new Date() : null
        }
      });

      orders.push({ ...order, status });
    }

    return orders;
  }

  /**
   * Create test purchase order items for goods receipt testing
   */
  async createTestPurchaseOrderWithItems(overrides?: any): Promise<any> {
    const order = await this.createTestPurchaseOrder(overrides);

    // Update some items as partially received for testing
    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { orderId: order.id }
    });

    for (const item of items) {
      const receivedQty = Math.floor(Math.random() * item.quantity);
      await this.prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty }
      });
    }

    return await this.prisma.purchaseOrder.findUnique({
      where: { id: order.id },
      include: { items: true }
    });
  }

  /**
   * Get test suppliers
   */
  getTestSuppliers(): any[] {
    return this.testSuppliers;
  }

  /**
   * Get test products
   */
  getTestProducts(): any[] {
    return this.testProducts;
  }

  /**
   * Get test users
   */
  getTestUsers(): any[] {
    return this.testUsers;
  }

  /**
   * Get test purchase orders
   */
  getTestPurchaseOrders(): any[] {
    return this.testPurchaseOrders;
  }

  /**
   * Generate test data for specific scenarios
   */
  generateTestData(overrides?: any): any {
    return {
      supplier: {
        name: 'Test Supplier Corp',
        email: this.generateTestEmail('supplier'),
        phone: '+1-555-9999',
        address: '123 Test Supplier St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'USA',
        paymentTerms: PaymentTerms.NET30,
        creditLimit: 50000.00,
        ...overrides?.supplier
      },
      purchaseOrder: {
        expectedDate: this.generateFutureDate(14),
        notes: 'Test purchase order notes',
        internalNotes: 'Internal test notes',
        deliveryAddress: 'Test Delivery Address',
        shippingMethod: 'Standard Ground',
        paymentTerms: PaymentTerms.NET30,
        ...overrides?.purchaseOrder
      },
      ...overrides
    };
  }

  /**
   * Create test data for performance testing
   */
  async createPerformanceTestData(count: number = 100): Promise<any[]> {
    const orders = [];

    for (let i = 0; i < count; i++) {
      const order = await this.createTestPurchaseOrder();
      orders.push(order);
    }

    return orders;
  }

  /**
   * Create test data for supplier performance testing
   */
  async createSupplierPerformanceTestData(): Promise<any> {
    const supplier = await this.createTestSupplier();

    // Create performance data
    const performanceData = {
      supplierId: supplier.id,
      period: '2024-Q1',
      qualityScore: this.generateAmount(80, 100),
      deliveryScore: this.generateAmount(70, 100),
      costScore: this.generateAmount(75, 100),
      serviceScore: this.generateAmount(80, 100),
      overallScore: 0, // Will be calculated
      tier: 'GOLD',
      onTimeDeliveryRate: this.generatePercentage(70, 100),
      orderAccuracyRate: this.generatePercentage(85, 100),
      invoiceAccuracyRate: this.generatePercentage(90, 100),
      responsivenessScore: this.generateAmount(70, 100),
      calculatedBy: this.selectRandom(this.testUsers)?.id,
      reviewedBy: this.selectRandom(this.testUsers.filter(u => u.role === 'ADMIN'))?.id,
      calculatedAt: new Date(),
      reviewedAt: new Date()
    };

    performanceData.overallScore = (
      parseFloat(performanceData.qualityScore.toString()) +
      parseFloat(performanceData.deliveryScore.toString()) +
      parseFloat(performanceData.costScore.toString()) +
      parseFloat(performanceData.serviceScore.toString())
    ) / 4;

    return await this.executeWithRetry(() =>
      this.prisma.supplierPerformance.create({ data: performanceData })
    );
  }
}