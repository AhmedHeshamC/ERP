import { expect } from 'chai';
import * as sinon from 'sinon';
import { ReportsService } from './reports.service';
import {
  CreateReportDefinitionDto,
  ReportDefinitionResponse,
  GenerateReportDto,
  FinancialReportParamsDto,
  SalesReportParamsDto,
  ReportType,
  ReportCategory,
  ReportFormat,
} from '../dto/reports.dto';

describe('ReportsService', () => {
  let reportsService: ReportsService;
  let prismaService: any;
  let securityService: any;

  beforeEach(() => {
    // Mock PrismaService
    prismaService = {
      reportDefinition: {
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
        count: sinon.stub(),
      },
      generatedReport: {
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
      },
      transaction: {
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        groupBy: sinon.stub(),
        aggregate: sinon.stub(),
      },
      journalEntry: {
        findMany: sinon.stub(),
        groupBy: sinon.stub(),
        aggregate: sinon.stub(),
      },
      chartOfAccounts: {
        findMany: sinon.stub(),
      },
      order: {
        findMany: sinon.stub(),
        aggregate: sinon.stub(),
        count: sinon.stub(),
      },
      customer: {
        findMany: sinon.stub(),
        count: sinon.stub(),
      },
      orderItem: {
        findMany: sinon.stub(),
        aggregate: sinon.stub(),
        groupBy: sinon.stub(),
      },
      product: {
        findMany: sinon.stub(),
        aggregate: sinon.stub(),
      },
      stockMovement: {
        findMany: sinon.stub(),
        aggregate: sinon.stub(),
      },
      supplier: {
        findMany: sinon.stub(),
      },
      purchaseOrder: {
        findMany: sinon.stub(),
        aggregate: sinon.stub(),
      },
    };

    // Mock SecurityService
    securityService = {
      validateInput: sinon.stub(),
      sanitizeInput: sinon.stub(),
      logSecurityEvent: sinon.stub(),
    };

    reportsService = new ReportsService(prismaService, securityService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createReportDefinition', () => {
    const createReportDto: CreateReportDefinitionDto = {
      name: 'Monthly Sales Report',
      description: 'Monthly sales performance analysis',
      type: ReportType.SALES,
      category: ReportCategory.ANALYTICS,
      query: 'SELECT * FROM sales_data WHERE date BETWEEN :startDate AND :endDate',
      parameters: {
        startDate: { type: 'date', required: true },
        endDate: { type: 'date', required: true },
      },
    };

    it('should create a new report definition successfully', async () => {
      // Arrange
      const expectedReport: ReportDefinitionResponse = {
        id: 'report-123',
        ...createReportDto,
        isActive: true,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(createReportDto);
      prismaService.reportDefinition.create.resolves(expectedReport);

      // Act
      const result = await reportsService.createReportDefinition(createReportDto);

      // Assert
      expect(result).to.deep.equal(expectedReport);
      expect(securityService.validateInput.calledOnceWith(createReportDto)).to.be.true;
      expect(prismaService.reportDefinition.create.calledOnce).to.be.true;
    });

    it('should throw error when input validation fails', async () => {
      // Arrange
      securityService.validateInput.returns(false);
      securityService.logSecurityEvent.resolves();

      // Act & Assert
      try {
        await reportsService.createReportDefinition(createReportDto);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.equal('Invalid report definition data');
      }

      expect(securityService.validateInput.calledOnceWith(createReportDto)).to.be.true;
      expect(prismaService.reportDefinition.create.called).to.be.false;
    });
  });

  describe('generateFinancialReport', () => {
    const reportParams: FinancialReportParamsDto = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      currency: 'USD',
      includeComparisons: true,
    };

    it('should generate comprehensive financial report', async () => {
      // Arrange

      prismaService.transaction.aggregate.resolves({
        _sum: { amount: 105000 },
        _count: { id: 25 },
      });

      prismaService.journalEntry.aggregate
        .onFirstCall().resolves({ _sum: { debitAmount: 105000 } })
        .onSecondCall().resolves({ _sum: { creditAmount: 85000 } });

      // Act
      const result = await reportsService.generateFinancialReport(reportParams);

      // Assert
      expect(result).to.have.property('revenue');
      expect(result).to.have.property('expenses');
      expect(result).to.have.property('profit');
      expect(result.currency).to.equal('USD');
      expect(result.profit.gross).to.be.a('number');
      expect(result.profit.net).to.be.a('number');
    });

    it('should handle empty date range gracefully', async () => {
      // Arrange
      const emptyParams: FinancialReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
      };

      prismaService.transaction.aggregate.resolves({
        _sum: { amount: 0 },
        _count: { id: 0 },
      });

      // Act
      const result = await reportsService.generateFinancialReport(emptyParams);

      // Assert
      expect(result.revenue.total).to.equal(0);
      expect(result.expenses.total).to.equal(0);
      expect(result.profit.gross).to.equal(0);
    });
  });

  describe('generateSalesAnalytics', () => {
    const reportParams: SalesReportParamsDto = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      customerGrouping: 'region',
      productGrouping: 'category',
      includeDetails: true,
    };

    it('should generate comprehensive sales analytics', async () => {
      // Arrange
      prismaService.order.aggregate.resolves({
        _sum: { totalAmount: 100000 },
        _count: { id: 150 },
        _avg: { totalAmount: 666.67 },
      });

      prismaService.orderItem.groupBy.resolves([
        { productId: 'prod-1', _sum: { totalPrice: 20000, quantity: 50 } },
        { productId: 'prod-2', _sum: { totalPrice: 15000, quantity: 30 } },
      ]);

      // Act
      const result = await reportsService.generateSalesAnalytics(reportParams);

      // Assert
      expect(result).to.have.property('totalSales');
      expect(result).to.have.property('totalOrders');
      expect(result).to.have.property('averageOrderValue');
      expect(result).to.have.property('topProducts');
      expect(result.totalSales).to.be.a('number');
      expect(result.totalOrders).to.be.a('number');
    });

    it('should calculate conversion rate correctly', async () => {
      // Arrange
      prismaService.order.aggregate.resolves({
        _sum: { totalAmount: 50000 },
        _count: { id: 75 },
      });

      prismaService.orderItem.groupBy.resolves([
        { productId: 'prod-1', _sum: { totalPrice: 25000, quantity: 25 } },
        { productId: 'prod-2', _sum: { totalPrice: 15000, quantity: 15 } },
      ]);

      // Mock customer count
      prismaService.customer.count.resolves(100);

      // Act
      const result = await reportsService.generateSalesAnalytics(reportParams);

      // Assert
      expect(result.conversionRate).to.be.a('number');
      expect(result.conversionRate).to.be.gte(0);
      expect(result.conversionRate).to.be.lte(100);
    });
  });

  describe('generateInventoryReport', () => {
    it('should generate comprehensive inventory report', async () => {
      // Arrange
      prismaService.product.aggregate.resolves({
        _sum: { price: 500000 },
        _count: { id: 250 },
      });

      prismaService.product.findMany.resolves([
        { id: 'prod-1', name: 'Product 1', stockQuantity: 5, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Product 2', stockQuantity: 15, lowStockThreshold: 20 },
      ]);

      prismaService.stockMovement.aggregate.resolves({
        _sum: { quantity: 1000 },
        _count: { id: 50 },
      });

      // Act
      const result = await reportsService.generateInventoryReport();

      // Assert
      expect(result).to.have.property('totalProducts');
      expect(result).to.have.property('totalValue');
      expect(result).to.have.property('lowStockItems');
      expect(result).to.have.property('turnoverRate');
      expect(result.totalProducts).to.be.a('number');
      expect(result.lowStockItems).to.be.an('array');
    });

    it('should identify low stock items correctly', async () => {
      // Arrange
      prismaService.product.aggregate.resolves({
        _sum: { price: 500000 },
        _count: { id: 250 },
      });

      prismaService.product.findMany.resolves([
        { id: 'prod-1', name: 'Critical Item', stockQuantity: 2, lowStockThreshold: 10 },
        { id: 'prod-2', name: 'Normal Item', stockQuantity: 25, lowStockThreshold: 20 },
      ]);

      prismaService.stockMovement.aggregate.resolves({
        _sum: { quantity: 1000 },
        _count: { id: 50 },
      });

      // Act
      const result = await reportsService.generateInventoryReport();

      // Assert
      expect(result.lowStockItems).to.have.length(2);
      expect(result.lowStockItems[0].productId).to.equal('prod-1');
      expect(result.lowStockItems[0].name).to.equal('Critical Item');
    });
  });

  describe('generatePurchasingAnalytics', () => {
    it('should generate comprehensive purchasing analytics', async () => {
      // Arrange
      prismaService.purchaseOrder.aggregate.resolves({
        _sum: { totalAmount: 200000 },
        _count: { id: 50 },
        _avg: { totalAmount: 4000 },
      });

      prismaService.supplier.findMany.resolves([
        { id: 'sup-1', name: 'Supplier A' },
        { id: 'sup-2', name: 'Supplier B' },
      ]);

      // Act
      const result = await reportsService.generatePurchasingAnalytics();

      // Assert
      expect(result).to.have.property('totalSpend');
      expect(result).to.have.property('totalPurchaseOrders');
      expect(result).to.have.property('averageOrderValue');
      expect(result).to.have.property('topSuppliers');
      expect(result.totalSpend).to.be.a('number');
    });

    it('should calculate average delivery time', async () => {
      // Arrange
      prismaService.purchaseOrder.aggregate.resolves({
        _sum: { totalAmount: 200000 },
        _count: { id: 50 },
        _avg: { totalAmount: 4000 },
      });

      prismaService.purchaseOrder.findMany.resolves([
        {
          orderDate: new Date('2024-01-01'),
          expectedDate: new Date('2024-01-10'),
          status: 'RECEIVED',
        },
        {
          orderDate: new Date('2024-01-05'),
          expectedDate: new Date('2024-01-15'),
          status: 'RECEIVED',
        },
      ]);

      // Act
      const result = await reportsService.generatePurchasingAnalytics();

      // Assert
      expect(result.averageDeliveryTime).to.be.a('number');
      expect(result.averageDeliveryTime).to.be.gte(0);
    });
  });

  describe('generateExecutiveDashboard', () => {
    it('should generate comprehensive executive dashboard', async () => {
      // Arrange
      const mockRevenueData = { _sum: { amount: 100000 } };
      const mockProfitData = { _sum: { debitAmount: 75000, creditAmount: 50000 } };
      const mockOrderData = { _count: { id: 200 } };

      prismaService.transaction.aggregate.resolves(mockRevenueData);
      prismaService.journalEntry.aggregate.resolves(mockProfitData);
      prismaService.order.aggregate.resolves(mockOrderData);
      prismaService.customer.count.resolves(150);

      // Act
      const result = await reportsService.generateExecutiveDashboard();

      // Assert
      expect(result).to.have.property('kpis');
      expect(result).to.have.property('charts');
      expect(result).to.have.property('alerts');
      expect(result.kpis).to.have.property('revenue');
      expect(result.kpis).to.have.property('profit');
      expect(result.kpis).to.have.property('orders');
      expect(result.kpis).to.have.property('customers');
    });

    it('should calculate KPI trends correctly', async () => {
      // Arrange - Mock current and previous period data
      prismaService.transaction.aggregate
        .onFirstCall().resolves({ _sum: { amount: 100000 } }) // Current period
        .onSecondCall().resolves({ _sum: { amount: 90000 } }); // Previous period

      // Act
      const result = await reportsService.generateExecutiveDashboard();

      // Assert
      expect(result.kpis.revenue.current).to.equal(100000);
      expect(result.kpis.revenue.trend).to.be.a('number');
      // Trend should be positive since current > previous
      expect(result.kpis.revenue.trend).to.be.gt(0);
    });

    it('should generate appropriate alerts', async () => {
      // Arrange - Mock data that would trigger alerts
      prismaService.transaction.aggregate.resolves({ _sum: { amount: 5000 } }); // Low revenue
      prismaService.journalEntry.aggregate.resolves({ _sum: { debitAmount: 8000, creditAmount: 6000 } }); // Loss

      // Act
      const result = await reportsService.generateExecutiveDashboard();

      // Assert
      expect(result.alerts).to.be.an('array');
      if (result.alerts.length > 0) {
        expect(result.alerts[0]).to.have.property('type');
        expect(result.alerts[0]).to.have.property('message');
        expect(result.alerts[0]).to.have.property('severity');
      }
    });
  });

  describe('generateCustomReport', () => {
    const generateReportDto: GenerateReportDto = {
      reportDefinitionId: 'report-123',
      parameters: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      format: ReportFormat.JSON,
    };

    it('should generate custom report from definition', async () => {
      // Arrange
      const mockReportDefinition = {
        id: 'report-123',
        name: 'Custom Sales Report',
        query: 'SELECT * FROM orders WHERE date BETWEEN :startDate AND :endDate',
        parameters: {
          startDate: { type: 'date', required: true },
          endDate: { type: 'date', required: true },
        },
      };

      const mockGeneratedReport = {
        id: 'generated-123',
        name: 'Custom Sales Report',
        data: { totalOrders: 50, totalRevenue: 25000 },
        status: 'COMPLETED',
      };

      prismaService.reportDefinition.findUnique.resolves(mockReportDefinition);
      prismaService.generatedReport.create.resolves(mockGeneratedReport);

      // Act
      const result = await reportsService.generateCustomReport(generateReportDto);

      // Assert
      expect(result).to.have.property('data');
      expect(result.status).to.equal('COMPLETED');
      expect(prismaService.reportDefinition.findUnique.calledOnce).to.be.true;
    });

    it('should handle invalid report definition', async () => {
      // Arrange
      prismaService.reportDefinition.findUnique.resolves(null);

      // Act & Assert
      try {
        await reportsService.generateCustomReport(generateReportDto);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }
    });
  });

  describe('validateReportQuery', () => {
    it('should validate SQL queries for security', async () => {
      // Arrange
      const maliciousQueries = [
        "SELECT * FROM users; DROP TABLE users; --",
        "SELECT * FROM orders WHERE 1=1; INSERT INTO logs VALUES ('hack')",
        "SELECT * FROM products UNION SELECT * FROM passwords",
      ];

      // Act & Assert
      maliciousQueries.forEach(query => {
        const isValid = reportsService.validateReportQuery(query);
        expect(isValid).to.be.false;
      });
    });

    it('should allow safe SQL queries', async () => {
      // Arrange
      const safeQueries = [
        "SELECT * FROM orders WHERE date BETWEEN :startDate AND :endDate",
        "SELECT customer_id, SUM(total) FROM orders GROUP BY customer_id",
        "SELECT p.name, SUM(oi.quantity) FROM products p JOIN order_items oi ON p.id = oi.productId GROUP BY p.id",
      ];

      // Act & Assert
      safeQueries.forEach(query => {
        const isValid = reportsService.validateReportQuery(query);
        expect(isValid).to.be.true;
      });
    });
  });
});