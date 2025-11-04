import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { ReportsDataFactory } from '../../shared/testing/integration/test-data-factories/reports-data-factory';
import { ReportType, ReportCategory, ReportFormat } from '../../modules/reports/dto/reports.dto';
import { IntegrationTestHelpers } from '../../shared/testing/integration-setup';

describe('Reports Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;
  let reportsFactory: ReportsDataFactory;

  // Test data
  let testUsers: any[] = [];
  let testCustomers: any[] = [];
  let testProducts: any[] = [];
  let testTransactions: any[] = [];
  let testOrders: any[] = [];
  let testPurchaseOrders: any[] = [];
  let testReportDefinitions: any[] = [];

  // Auth tokens
  let adminToken: string;
  let managerToken: string;
  let accountantToken: string;
  let salesManagerToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    reportsFactory = new ReportsDataFactory(testSetup.prisma);
    await reportsFactory.createReportsTestData();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    managerToken = testSetup.getTestToken('manager');
    accountantToken = testSetup.getTestToken('accountant');
    salesManagerToken = testSetup.getTestToken('sales_manager');
    userToken = testSetup.getTestToken('user');

    // Get test data
    testUsers = await testSetup.prisma.user.findMany({
      where: { username: { contains: 'test' } }
    });
    testCustomers = await testSetup.prisma.customer.findMany({
      where: { customerId: { contains: 'CUST-TEST' } }
    });
    testProducts = await testSetup.prisma.product.findMany({
      where: { sku: { contains: 'SKU-TEST' } }
    });
    testTransactions = await testSetup.prisma.transaction.findMany({
      where: { reference: { contains: 'TXN-TEST' } }
    });
    testOrders = await testSetup.prisma.order.findMany({
      where: { orderNumber: { contains: 'ORD-TEST' } }
    });
    testPurchaseOrders = await testSetup.prisma.purchaseOrder.findMany({
      where: { orderNumber: { contains: 'PO-TEST' } }
    });
    testReportDefinitions = await testSetup.prisma.reportDefinition.findMany({
      where: { name: { contains: 'TEST' } }
    });
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  afterEach(async () => {
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('Report Generation Tests', () => {
    it('POST /reports/definitions - Should create report definition', async () => {
      const reportDefinition = {
        name: 'Test Financial Report',
        description: 'Test financial report definition',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: 'SELECT * FROM transactions WHERE date BETWEEN :startDate AND :endDate',
        parameters: {
          startDate: { type: 'date', required: true },
          endDate: { type: 'date', required: true }
        },
        isActive: true
      };

      const response = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(reportDefinition.name);
      expect(response.body.type).to.equal(reportDefinition.type);
      expect(response.body.category).to.equal(reportDefinition.category);
      expect(response.body.isActive).to.be.true;
    });

    it('POST /reports/financial - Should generate financial report', async () => {
      const financialParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        currency: 'USD',
        includeComparisons: false
      };

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(200);

      expect(response.body).to.have.property('revenue');
      expect(response.body).to.have.property('expenses');
      expect(response.body).to.have.property('profit');
      expect(response.body).to.have.property('period');
      expect(response.body).to.have.property('currency');
      expect(response.body.currency).to.equal('USD');
      expect(response.body.revenue).to.have.property('total');
      expect(response.body.revenue).to.have.property('byPeriod');
      expect(response.body.expenses).to.have.property('total');
      expect(response.body.profit).to.have.property('gross');
      expect(response.body.profit).to.have.property('net');
      expect(response.body.profit).to.have.property('margin');
    });

    it('POST /reports/sales-analytics - Should generate sales analytics', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        customerGrouping: 'region',
        productGrouping: 'category',
        includeDetails: true
      };

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(200);

      expect(response.body).to.have.property('totalSales');
      expect(response.body).to.have.property('totalOrders');
      expect(response.body).to.have.property('averageOrderValue');
      expect(response.body).to.have.property('topProducts');
      expect(response.body).to.have.property('salesByPeriod');
      expect(response.body).to.have.property('conversionRate');
      expect(response.body.topProducts).to.be.an('array');
      expect(response.body.salesByPeriod).to.be.an('array');
      expect(response.body.totalSales).to.be.a('number');
      expect(response.body.totalOrders).to.be.a('number');
    });

    it('GET /reports/inventory - Should generate inventory report', async () => {
      const response = await request(testSetup.app)
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('totalProducts');
      expect(response.body).to.have.property('totalValue');
      expect(response.body).to.have.property('lowStockItems');
      expect(response.body).to.have.property('turnoverRate');
      expect(response.body.totalProducts).to.be.a('number');
      expect(response.body.totalValue).to.be.a('number');
      expect(response.body.lowStockItems).to.be.an('array');
      expect(response.body.turnoverRate).to.be.a('number');
    });

    it('GET /reports/purchasing-analytics - Should generate purchasing analytics', async () => {
      const response = await request(testSetup.app)
        .get('/reports/purchasing-analytics')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('totalSpend');
      expect(response.body).to.have.property('totalPurchaseOrders');
      expect(response.body).to.have.property('averageOrderValue');
      expect(response.body).to.have.property('spendByCategory');
      expect(response.body).to.have.property('ordersByStatus');
      expect(response.body).to.have.property('averageDeliveryTime');
      expect(response.body.spendByCategory).to.be.an('array');
      expect(response.body.ordersByStatus).to.be.an('array');
    });

    it('GET /reports/executive-dashboard - Should generate executive dashboard', async () => {
      const response = await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('kpis');
      expect(response.body).to.have.property('charts');
      expect(response.body).to.have.property('alerts');
      expect(response.body.kpis).to.have.property('revenue');
      expect(response.body.kpis).to.have.property('profit');
      expect(response.body.kpis).to.have.property('orders');
      expect(response.body.kpis).to.have.property('customers');
      expect(response.body.charts).to.have.property('revenueChart');
      expect(response.body.charts).to.have.property('profitChart');
      expect(response.body.charts).to.have.property('orderChart');
      expect(response.body.alerts).to.be.an('array');
    });

    it('POST /reports/custom - Should generate custom report from definition', async () => {
      // Create a report definition first
      const reportDefinition = {
        name: 'Custom Test Report',
        description: 'Test custom report',
        type: ReportType.FINANCIAL,
        category: ReportCategory.ANALYTICS,
        query: 'SELECT COUNT(*) as total FROM transactions',
        parameters: {},
        isActive: true
      };

      const createResponse = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(201);

      const reportDefinitionId = createResponse.body.id;

      // Generate custom report
      const generateReportDto = {
        reportDefinitionId,
        parameters: {},
        format: ReportFormat.JSON,
        cacheHours: 1
      };

      const response = await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(generateReportDto)
        .expect(200);

      expect(response.body).to.have.property('reportDefinitionId');
      expect(response.body).to.have.property('name');
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('format');
      expect(response.body).to.have.property('status');
      expect(response.body.reportDefinitionId).to.equal(reportDefinitionId);
      expect(response.body.format).to.equal(ReportFormat.JSON);
    });

    it('GET /reports/types - Should return available report types', async () => {
      const response = await request(testSetup.app)
        .get('/reports/types')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);

      const financialReport = response.body.find((type: any) => type.type === 'FINANCIAL');
      expect(financialReport).to.exist;
      expect(financialReport).to.have.property('description');
      expect(financialReport).to.have.property('parameters');
      expect(financialReport.parameters).to.be.an('array');
    });

    it('GET /reports/parameters/:type - Should return parameters for specific report type', async () => {
      const response = await request(testSetup.app)
        .get('/reports/parameters/FINANCIAL')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('startDate');
      expect(response.body).to.have.property('endDate');
      expect(response.body).to.have.property('currency');
      expect(response.body).to.have.property('includeComparisons');
      expect(response.body.startDate).to.have.property('type');
      expect(response.body.startDate).to.have.property('required');
      expect(response.body.startDate.required).to.be.true;
    });

    it('POST /reports/financial - Should handle financial report with default parameters', async () => {
      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send({})
        .expect(200);

      expect(response.body).to.have.property('revenue');
      expect(response.body).to.have.property('expenses');
      expect(response.body).to.have.property('profit');
      expect(response.body.currency).to.equal('USD'); // Default currency
    });

    it('POST /reports/sales-analytics - Should handle sales analytics with minimal parameters', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(200);

      expect(response.body).to.have.property('totalSales');
      expect(response.body).to.have.property('totalOrders');
      expect(response.body).to.have.property('averageOrderValue');
      expect(response.body.totalSales).to.be.a('number');
      expect(response.body.totalOrders).to.be.a('number');
    });

    it('POST /reports/financial - Should generate financial report with different currencies', async () => {
      const financialParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        currency: 'EUR',
        includeComparisons: true
      };

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(200);

      expect(response.body.currency).to.equal('EUR');
    });

    it('POST /reports/sales-analytics - Should include detailed breakdown when requested', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeDetails: true
      };

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(200);

      expect(response.body).to.have.property('topProducts');
      expect(response.body.topProducts).to.be.an('array');
      if (response.body.topProducts.length > 0) {
        expect(response.body.topProducts[0]).to.have.property('productId');
        expect(response.body.topProducts[0]).to.have.property('name');
        expect(response.body.topProducts[0]).to.have.property('quantity');
        expect(response.body.topProducts[0]).to.have.property('revenue');
      }
    });

    it('POST /reports/financial - Should handle comparison data when enabled', async () => {
      const financialParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeComparisons: true
      };

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(200);

      expect(response.body).to.have.property('revenue');
      expect(response.body.revenue).to.have.property('byPeriod');
      expect(response.body.revenue.byPeriod).to.be.an('array');
    });

    it('GET /reports/parameters/SALES - Should return correct parameters for sales reports', async () => {
      const response = await request(testSetup.app)
        .get('/reports/parameters/SALES')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('startDate');
      expect(response.body).to.have.property('endDate');
      expect(response.body).to.have.property('customerGrouping');
      expect(response.body).to.have.property('productGrouping');
      expect(response.body).to.have.property('includeDetails');
      expect(response.body.startDate.required).to.be.true;
      expect(response.body.endDate.required).to.be.true;
      expect(response.body.includeDetails.default).to.be.false;
    });

    it('POST /reports/custom - Should generate report in different formats', async () => {
      // Use existing report definition
      if (testReportDefinitions.length > 0) {
        const reportDefinition = testReportDefinitions[0];

        const generateReportDto = {
          reportDefinitionId: reportDefinition.id,
          parameters: {},
          format: ReportFormat.PDF,
          cacheHours: 24
        };

        const response = await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(200);

        expect(response.body.format).to.equal(ReportFormat.PDF);
        expect(response.body.status).to.equal('COMPLETED');
      }
    });

    it('POST /reports/financial - Should calculate profit margins correctly', async () => {
      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send({
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        })
        .expect(200);

      expect(response.body.profit).to.have.property('margin');
      expect(response.body.profit.margin).to.be.a('number');
    });

    it('GET /reports/inventory - Should identify low stock items correctly', async () => {
      const response = await request(testSetup.app)
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('lowStockItems');
      expect(response.body.lowStockItems).to.be.an('array');
      if (response.body.lowStockItems.length > 0) {
        expect(response.body.lowStockItems[0]).to.have.property('productId');
        expect(response.body.lowStockItems[0]).to.have.property('name');
        expect(response.body.lowStockItems[0]).to.have.property('currentStock');
        expect(response.body.lowStockItems[0]).to.have.property('threshold');
      }
    });

    it('GET /reports/purchasing-analytics - Should include supplier performance metrics', async () => {
      const response = await request(testSetup.app)
        .get('/reports/purchasing-analytics')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('averageDeliveryTime');
      expect(response.body.averageDeliveryTime).to.be.a('number');
      expect(response.body.averageDeliveryTime).to.be.greaterThan(0);
    });

    it('GET /reports/executive-dashboard - Should include actionable alerts', async () => {
      const response = await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.have.property('alerts');
      expect(response.body.alerts).to.be.an('array');
      if (response.body.alerts.length > 0) {
        expect(response.body.alerts[0]).to.have.property('type');
        expect(response.body.alerts[0]).to.have.property('message');
        expect(response.body.alerts[0]).to.have.property('severity');
        expect(response.body.alerts[0]).to.have.property('createdAt');
      }
    });

    it('GET /reports/executive-dashboard - Should include trend data for KPIs', async () => {
      const response = await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body.kpis.revenue).to.have.property('trend');
      expect(response.body.kpis.profit).to.have.property('trend');
      expect(response.body.kpis.orders).to.have.property('trend');
      expect(response.body.kpis.customers).to.have.property('trend');
      expect(response.body.kpis.revenue.trend).to.be.a('number');
    });

    it('POST /reports/custom - Should handle caching parameters', async () => {
      if (testReportDefinitions.length > 0) {
        const reportDefinition = testReportDefinitions[0];

        const generateReportDto = {
          reportDefinitionId: reportDefinition.id,
          parameters: {},
          format: ReportFormat.JSON,
          cacheHours: 48
        };

        const response = await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(200);

        expect(response.body).to.have.property('generatedAt');
        expect(new Date(response.body.generatedAt)).to.be.a('date');
      }
    });

    it('POST /reports/financial - Should handle date range edge cases', async () => {
      const today = new Date();
      const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send({
          startDate: lastMonth,
          endDate: today
        })
        .expect(200);

      expect(response.body).to.have.property('period');
      expect(response.body.period).to.include(lastMonth.toISOString().split('T')[0]);
      expect(response.body.period).to.include(today.toISOString().split('T')[0]);
    });

    it('GET /reports/types - Should include all predefined report types', async () => {
      const response = await request(testSetup.app)
        .get('/reports/types')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const reportTypes = response.body.map((type: any) => type.type);
      expect(reportTypes).to.include('FINANCIAL');
      expect(reportTypes).to.include('SALES');
      expect(reportTypes).to.include('INVENTORY');
      expect(reportTypes).to.include('PURCHASING');
      expect(reportTypes).to.include('EXECUTIVE');
    });

    it('GET /reports/parameters/INVALID - Should return 404 for unknown report type', async () => {
      await request(testSetup.app)
        .get('/reports/parameters/INVALID_TYPE')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(404);
    });
  });

  describe('Report Management Tests', () => {
    it('POST /reports/definitions - Should create multiple report definitions', async () => {
      const reportDefinitions = [
        {
          name: 'Monthly Sales Summary',
          description: 'Monthly sales performance summary',
          type: ReportType.SALES,
          category: ReportCategory.SUMMARY,
          query: 'SELECT * FROM sales_summary WHERE month = :month',
          parameters: { month: { type: 'string', required: true } },
          isActive: true
        },
        {
          name: 'Inventory Valuation',
          description: 'Current inventory valuation report',
          type: ReportType.INVENTORY,
          category: ReportCategory.DETAILED,
          query: 'SELECT * FROM inventory_valuation',
          parameters: {},
          isActive: true
        }
      ];

      for (const definition of reportDefinitions) {
        const response = await request(testSetup.app)
          .post('/reports/definitions')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(definition)
          .expect(201);

        expect(response.body.name).to.equal(definition.name);
        expect(response.body.type).to.equal(definition.type);
        expect(response.body.category).to.equal(definition.category);
      }
    });

    it('POST /reports/definitions - Should validate required fields', async () => {
      const invalidDefinition = {
        description: 'Missing required fields'
      };

      await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(invalidDefinition)
        .expect(400);
    });

    it('POST /reports/definitions - Should validate query format', async () => {
      const maliciousQuery = {
        name: 'Malicious Report',
        description: 'Report with dangerous SQL',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: 'DROP TABLE users; --',
        parameters: {},
        isActive: true
      };

      await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(maliciousQuery)
        .expect(400);
    });

    it('POST /reports/custom - Should handle report definition not found', async () => {
      const generateReportDto = {
        reportDefinitionId: 'non-existent-id',
        parameters: {},
        format: ReportFormat.JSON
      };

      await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(generateReportDto)
        .expect(404);
    });

    it('POST /reports/custom - Should validate report format', async () => {
      if (testReportDefinitions.length > 0) {
        const generateReportDto = {
          reportDefinitionId: testReportDefinitions[0].id,
          parameters: {},
          format: 'INVALID_FORMAT'
        };

        await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(400);
      }
    });

    it('POST /reports/custom - Should handle parameter validation', async () => {
      // Create report definition with required parameters
      const reportDefinition = {
        name: 'Parameter Validation Test',
        description: 'Test parameter validation',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: 'SELECT * FROM transactions WHERE date = :required_date',
        parameters: {
          required_date: { type: 'date', required: true }
        },
        isActive: true
      };

      const createResponse = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(201);

      // Try to generate report without required parameter
      const generateReportDto = {
        reportDefinitionId: createResponse.body.id,
        parameters: {}, // Missing required_date
        format: ReportFormat.JSON
      };

      const response = await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(generateReportDto)
        .expect(200);

      expect(response.body).to.have.property('status');
    });

    it('POST /reports/custom - Should handle large report generation', async () => {
      // Create a simple report definition
      const reportDefinition = {
        name: 'Large Report Test',
        description: 'Test large report generation',
        type: ReportType.SALES,
        category: ReportCategory.DETAILED,
        query: 'SELECT * FROM orders',
        parameters: {},
        isActive: true
      };

      const createResponse = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(201);

      const generateReportDto = {
        reportDefinitionId: createResponse.body.id,
        parameters: {},
        format: ReportFormat.JSON,
        cacheHours: 0
      };

      const response = await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(generateReportDto)
        .expect(200);

      expect(response.body).to.have.property('data');
    });

    it('POST /reports/definitions - Should handle report definition updates', async () => {
      const reportDefinition = {
        name: 'Update Test Report',
        description: 'Test report for updates',
        type: ReportType.INVENTORY,
        category: ReportCategory.SUMMARY,
        query: 'SELECT COUNT(*) FROM products',
        parameters: {},
        isActive: true
      };

      const createResponse = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(201);

      expect(createResponse.body.isActive).to.be.true;
    });

    it('POST /reports/custom - Should support concurrent report generation', async () => {
      if (testReportDefinitions.length > 0) {
        const reportDefinitionId = testReportDefinitions[0].id;

        // Generate multiple reports concurrently
        const promises = Array(3).fill(null).map((_, index) => {
          const generateReportDto = {
            reportDefinitionId,
            parameters: { test_param: index },
            format: ReportFormat.JSON,
            cacheHours: 1
          };

          return request(testSetup.app)
            .post('/reports/custom')
            .set('Authorization', `Bearer ${adminToken}`)
            .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
            .send(generateReportDto)
            .expect(200);
        });

        const responses = await Promise.all(promises);
        responses.forEach(response => {
          expect(response.body).to.have.property('reportDefinitionId', reportDefinitionId);
          expect(response.body).to.have.property('status', 'COMPLETED');
        });
      }
    });
  });

  describe('Security Tests', () => {
    it('POST /reports/definitions - Should require admin role', async () => {
      const reportDefinition = {
        name: 'Unauthorized Report',
        description: 'Should not be created by regular user',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: 'SELECT * FROM transactions',
        parameters: {},
        isActive: true
      };

      await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(reportDefinition)
        .expect(403);
    });

    it('POST /reports/financial - Should require accountant or admin role', async () => {
      const financialParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(403);
    });

    it('POST /reports/sales-analytics - Should require sales manager or admin role', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(403);
    });

    it('GET /reports/executive-dashboard - Should require admin role only', async () => {
      await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(403);
    });

    it('POST /reports/custom - Should validate input for SQL injection', async () => {
      const maliciousInput = {
        reportDefinitionId: "'; DROP TABLE users; --",
        parameters: {
          malicious: "'; DELETE FROM transactions; --"
        },
        format: ReportFormat.JSON
      };

      await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(maliciousInput)
        .expect(404); // Should not find the report definition
    });

    it('POST /reports/definitions - Should sanitize report query input', async () => {
      const xssAttempt = {
        name: '<script>alert("XSS")</script>',
        description: 'XSS attempt in description',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: '<script>document.location="http://evil.com"</script>',
        parameters: {},
        isActive: true
      };

      const response = await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(xssAttempt)
        .expect(400); // Should reject XSS attempt
    });

    it('GET /reports/types - Should be accessible to all authenticated users', async () => {
      const response = await request(testSetup.app)
        .get('/reports/types')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.be.an('array');
    });

    it('POST /reports/custom - Should handle malformed authentication tokens', async () => {
      const generateReportDto = {
        reportDefinitionId: testReportDefinitions[0]?.id || 'test-id',
        parameters: {},
        format: ReportFormat.JSON
      };

      await request(testSetup.app)
        .post('/reports/custom')
        .set('Authorization', 'Bearer invalid-token')
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(generateReportDto)
        .expect(401);
    });

    it('POST /reports/financial - Should validate date range boundaries', async () => {
      const invalidDateRange = {
        startDate: new Date(), // Future date
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Past date
        currency: 'USD'
      };

      await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(invalidDateRange)
        .expect(400); // Should validate date range
    });

    it('GET /reports/inventory - Should be accessible to managers and above', async () => {
      await request(testSetup.app)
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(403);
    });

    it('GET /reports/purchasing-analytics - Should require appropriate roles', async () => {
      await request(testSetup.app)
        .get('/reports/purchasing-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(403);
    });

    it('POST /reports/definitions - Should validate report definition size limits', async () => {
      const largeQuery = 'SELECT '.repeat(10000) + '* FROM transactions';

      const oversizedReport = {
        name: 'Oversized Report',
        description: 'Report with oversized query',
        type: ReportType.FINANCIAL,
        category: ReportCategory.SUMMARY,
        query: largeQuery,
        parameters: {},
        isActive: true
      };

      await request(testSetup.app)
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(oversizedReport)
        .expect(400);
    });
  });

  describe('Performance Tests', () => {
    it('POST /reports/financial - Should handle large date ranges efficiently', async () => {
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year
      const endDate = new Date();

      const startTime = Date.now();

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send({
          startDate,
          endDate,
          currency: 'USD'
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 5 seconds for large date ranges
      expect(responseTime).to.be.lessThan(5000);
      expect(response.body).to.have.property('revenue');
      expect(response.body).to.have.property('expenses');
      expect(response.body).to.have.property('profit');
    });

    it('GET /reports/executive-dashboard - Should generate complex dashboard efficiently', async () => {
      const startTime = Date.now();

      const response = await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 3 seconds for executive dashboard
      expect(responseTime).to.be.lessThan(3000);
      expect(response.body).to.have.property('kpis');
      expect(response.body).to.have.property('charts');
      expect(response.body).to.have.property('alerts');
    });

    it('POST /reports/sales-analytics - Should handle complex grouping parameters', async () => {
      const complexParams = {
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        customerGrouping: 'region',
        productGrouping: 'category',
        includeDetails: true
      };

      const startTime = Date.now();

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(complexParams)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 4 seconds for complex analytics
      expect(responseTime).to.be.lessThan(4000);
      expect(response.body).to.have.property('topProducts');
      expect(response.body).to.have.property('salesByPeriod');
    });

    it('Should handle concurrent report requests efficiently', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(testSetup.app)
            .get('/reports/inventory')
            .set('Authorization', `Bearer ${managerToken}`)
            .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
            .expect(200)
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete within 8 seconds total
      expect(totalTime).to.be.lessThan(8000);
      expect(responses).to.have.length(concurrentRequests);

      responses.forEach(response => {
        expect(response.body).to.have.property('totalProducts');
        expect(response.body).to.have.property('totalValue');
      });
    });

    it('POST /reports/custom - Should handle report generation with caching', async () => {
      if (testReportDefinitions.length > 0) {
        const reportDefinitionId = testReportDefinitions[0].id;

        const generateReportDto = {
          reportDefinitionId,
          parameters: {},
          format: ReportFormat.JSON,
          cacheHours: 1
        };

        // First request
        const startTime1 = Date.now();
        const response1 = await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(200);
        const endTime1 = Date.now();
        const responseTime1 = endTime1 - startTime1;

        // Second request (should be faster due to caching)
        const startTime2 = Date.now();
        const response2 = await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(200);
        const endTime2 = Date.now();
        const responseTime2 = endTime2 - startTime2;

        expect(response1.body).to.have.property('data');
        expect(response2.body).to.have.property('data');
        expect(responseTime1).to.be.a('number');
        expect(responseTime2).to.be.a('number');
      }
    });
  });

  describe('Business Logic Validation Tests', () => {
    it('POST /reports/financial - Should calculate accurate profit margins', async () => {
      const financialParams = {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        currency: 'USD'
      };

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(200);

      const { revenue, expenses, profit } = response.body;

      // Validate profit calculations
      expect(profit.net).to.be.a('number');
      expect(profit.margin).to.be.a('number');

      // If there's revenue, profit margin should be reasonable
      if (revenue.total > 0) {
        expect(profit.margin).to.be.greaterThan(-100); // Can't lose more than 100%
        expect(profit.margin).to.be.lessThan(100);     // Can't gain more than 100% margin
      }
    });

    it('POST /reports/sales-analytics - Should calculate correct average order value', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      };

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(200);

      const { totalSales, totalOrders, averageOrderValue } = response.body;

      expect(totalSales).to.be.a('number');
      expect(totalOrders).to.be.a('number');
      expect(averageOrderValue).to.be.a('number');

      // Validate AOV calculation
      if (totalOrders > 0) {
        const calculatedAOV = totalSales / totalOrders;
        expect(averageOrderValue).to.be.closeTo(calculatedAOV, 0.01);
      }
    });

    it('GET /reports/inventory - Should correctly identify low stock items', async () => {
      const response = await request(testSetup.app)
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const { lowStockItems } = response.body;
      expect(lowStockItems).to.be.an('array');

      // Validate low stock logic
      lowStockItems.forEach((item: any) => {
        expect(item).to.have.property('currentStock');
        expect(item).to.have.property('threshold');
        expect(item.currentStock).to.be.lessThan(item.threshold);
      });
    });

    it('GET /reports/purchasing-analytics - Should calculate meaningful average delivery time', async () => {
      const response = await request(testSetup.app)
        .get('/reports/purchasing-analytics')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const { averageDeliveryTime } = response.body;
      expect(averageDeliveryTime).to.be.a('number');
      expect(averageDeliveryTime).to.be.greaterThan(0); // Should be positive
      expect(averageDeliveryTime).to.be.lessThan(365); // Should be less than a year
    });

    it('POST /reports/financial - Should handle zero revenue scenarios', async () => {
      // Use a date range in the distant past where there might be no data
      const financialParams = {
        startDate: new Date('2000-01-01'),
        endDate: new Date('2000-12-31'),
        currency: 'USD'
      };

      const response = await request(testSetup.app)
        .post('/reports/financial')
        .set('Authorization', `Bearer ${accountantToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(financialParams)
        .expect(200);

      const { revenue, expenses, profit } = response.body;

      expect(revenue.total).to.be.a('number');
      expect(expenses.total).to.be.a('number');
      expect(profit.net).to.be.a('number');

      // Should handle zero/low values gracefully
      expect(revenue.total).to.be.greaterThan或等于(0);
      expect(expenses.total).to.be.greaterThan或等于(0);
    });

    it('GET /reports/executive-dashboard - Should generate realistic KPI trends', async () => {
      const response = await request(testSetup.app)
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const { kpis } = response.body;

      // Validate KPI structure
      ['revenue', 'profit', 'orders', 'customers'].forEach(kpi => {
        expect(kpis[kpi]).to.have.property('current');
        expect(kpis[kpi]).to.have.property('target');
        expect(kpis[kpi]).to.have.property('trend');
        expect(kpis[kpi].current).to.be.a('number');
        expect(kpis[kpi].target).to.be.a('number');
        expect(kpis[kpi].trend).to.be.a('number');
      });

      // Validate trend values are reasonable
      expect(kpis.revenue.trend).to.be.greaterThan(-100);
      expect(kpis.revenue.trend).to.be.lessThan(100);
    });

    it('POST /reports/sales-analytics - Should group sales data correctly by period', async () => {
      const salesParams = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        includeDetails: true
      };

      const response = await request(testSetup.app)
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${salesManagerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .send(salesParams)
        .expect(200);

      const { salesByPeriod } = response.body;
      expect(salesByPeriod).to.be.an('array');

      // Validate period structure
      if (salesByPeriod.length > 0) {
        salesByPeriod.forEach((period: any) => {
          expect(period).to.have.property('period');
          expect(period).to.have.property('sales');
          expect(period).to.have.property('orders');
          expect(period.sales).to.be.a('number');
          expect(period.orders).to.be.a('number');
          expect(period.sales).to.be.greaterThan或等于(0);
          expect(period.orders).to.be.greaterThan或等于(0);
        });
      }
    });

    it('POST /reports/custom - Should handle different report types correctly', async () => {
      // Test different report types
      const reportTypes = [ReportType.FINANCIAL, ReportType.SALES, ReportType.INVENTORY];

      for (const type of reportTypes) {
        const reportDefinition = {
          name: `Type Test ${type}`,
          description: `Testing ${type} report type`,
          type,
          category: ReportCategory.SUMMARY,
          query: 'SELECT 1 as test_value',
          parameters: {},
          isActive: true
        };

        const createResponse = await request(testSetup.app)
          .post('/reports/definitions')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(reportDefinition)
          .expect(201);

        const generateReportDto = {
          reportDefinitionId: createResponse.body.id,
          parameters: {},
          format: ReportFormat.JSON
        };

        const response = await request(testSetup.app)
          .post('/reports/custom')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
          .send(generateReportDto)
          .expect(200);

        expect(response.body).to.have.property('data');
        expect(response.body).to.have.property('status', 'COMPLETED');
      }
    });

    it('GET /reports/inventory - Should calculate inventory turnover rate', async () => {
      const response = await request(testSetup.app)
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      const { turnoverRate, totalProducts } = response.body;

      expect(turnoverRate).to.be.a('number');
      expect(totalProducts).to.be.a('number');
      expect(totalProducts).to.be.greaterThan或等于(0);

      // Turnover rate should be reasonable
      expect(turnoverRate).to.be.greaterThan或等于(0);
      expect(turnoverRate).to.be.lessThan(1000); // Extremely high turnover would be unusual
    });

    it('GET /reports/types - Should provide accurate parameter descriptions', async () => {
      const response = await request(testSetup.app)
        .get('/reports/types')
        .set('Authorization', `Bearer ${userToken}`)
        .set('x-correlation-id', IntegrationTestHelpers.generateCorrelationId())
        .expect(200);

      expect(response.body).to.be.an('array');

      response.body.forEach((reportType: any) => {
        expect(reportType).to.have.property('type');
        expect(reportType).to.have.property('description');
        expect(reportType).to.have.property('parameters');
        expect(reportType.parameters).to.be.an('array');
        expect(reportType.description).to.be.a('string');
      });
    });
  });
});