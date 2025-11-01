import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { JwtStrategy } from '../authentication/jwt.strategy';
import { LocalStrategy } from '../authentication/local.strategy';
import { AuthService } from '../authentication/auth.service';
import { AuthHelpers, UserRole } from '../../shared/testing/auth-helpers';
import {
  CreateReportDefinitionDto,
  ReportType,
  ReportCategory,
  ReportFormat,
  KpiCategory,
  FinancialReportParamsDto,
  SalesReportParamsDto,
} from './dto/reports.dto';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Reports Module Integration Tests
 * Tests complete reporting and analytics workflows end-to-end
 * These tests validate the entire reporting system including financial,
 * sales, inventory, and purchasing analytics with KPI calculations
 * following enterprise-grade standards and OWASP security principles
 */
describe('Reports Module Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
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
      controllers: [ReportsController],
      providers: [ReportsService, AuthService, JwtStrategy, LocalStrategy],
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
    
    // Create test data for reporting
    await createTestDataForReports();

    // Create a test user and get auth token using direct generation
    authToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
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

  describe('Report Definition Management', () => {
    it('should create a new report definition successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createReportDto: CreateReportDefinitionDto = {
        name: `Monthly Sales Report ${timestamp}`,
        description: 'Comprehensive monthly sales analysis with KPI metrics',
        type: ReportType.SALES,
        category: ReportCategory.ANALYTICS,
        query: 'SELECT * FROM sales WHERE period = :period',
        parameters: {
          includeKpis: true,
          includeCharts: true,
          period: 'monthly',
        },
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createReportDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(createReportDto.name);
      expect(response.body.type).to.equal(ReportType.SALES);
      expect(response.body.category).to.equal(ReportCategory.ANALYTICS);
      expect(response.body.query).to.equal(createReportDto.query);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should validate report definition creation data', async () => {
      // Arrange - Invalid data
      const invalidReportDto = {
        name: '', // Empty name
        type: 'INVALID_TYPE', // Invalid type
        category: 'INVALID_CATEGORY', // Invalid category
        query: '', // Empty query
        parameters: 'invalid-parameters', // Should be object
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/reports/definitions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidReportDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should get report definitions by type', async () => {
      // Arrange - Create report definitions of different types
      await createTestReportDefinition(ReportType.FINANCIAL);
      await createTestReportDefinition(ReportType.SALES);
      await createTestReportDefinition(ReportType.INVENTORY);

      // Act
      const response = await request(app.getHttpServer())
        .get(`/reports/definitions?type=${ReportType.SALES}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        response.body.forEach((report: any) => {
          expect(report.type).to.equal(ReportType.SALES);
        });
      }
    });

    it('should update report definition successfully', async () => {
      // Arrange - Create a report definition first
      const createdReport = await createTestReportDefinition(ReportType.FINANCIAL);

      const updateData = {
        name: 'Updated Financial Report',
        description: 'Updated description for financial report',
        isActive: false,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/reports/definitions/${createdReport.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdReport.id);
      expect(response.body.name).to.equal(updateData.name);
      expect(response.body.description).to.equal(updateData.description);
      expect(response.body.isActive).to.equal(updateData.isActive);
      expect(response.body.updatedAt).to.not.equal(createdReport.updatedAt);
    });

    it('should delete report definition successfully', async () => {
      // Arrange - Create a report definition first
      const createdReport = await createTestReportDefinition(ReportType.INVENTORY);

      // Act
      await request(app.getHttpServer())
        .delete(`/reports/definitions/${createdReport.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert - Verify report is no longer accessible
      await request(app.getHttpServer())
        .get(`/reports/definitions/${createdReport.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Financial Reports', () => {
    it('should generate financial report (P&L) successfully', async () => {
      // Arrange
      const financialParams: FinancialReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        currency: 'USD',
        includeComparisons: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/financial')
        .set('Authorization', `Bearer ${authToken}`)
        .send(financialParams)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('revenue');
      expect(response.body).to.have.property('expenses');
      expect(response.body).to.have.property('profit');
      expect(response.body).to.have.property('period');
      expect(response.body).to.have.property('currency');

      // If comparisons are included
      if (financialParams.includeComparisons) {
        expect(response.body.revenue).to.have.property('byPeriod');
        expect(response.body.expenses).to.have.property('byPeriod');
      }
    });

    it('should generate balance sheet report successfully', async () => {
      // Arrange
      const financialParams: FinancialReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        currency: 'USD',
        includeComparisons: false,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/financial')
        .set('Authorization', `Bearer ${authToken}`)
        .send(financialParams)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('revenue');
      expect(response.body).to.have.property('expenses');
      expect(response.body).to.have.property('profit');
      expect(response.body).to.have.property('period');
      expect(response.body).to.have.property('currency');
      expect(response.body.currency).to.equal('USD');
    });

    it('should validate financial report parameters', async () => {
      // Arrange - Invalid parameters
      const invalidParams = {
        startDate: 'invalid-date',
        endDate: 'invalid-date',
        currency: 'INVALID',
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/reports/financial')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidParams)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });
  });

  describe('Sales Analytics Reports', () => {
    it('should generate sales analytics report successfully', async () => {
      // Arrange
      const salesParams: SalesReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        customerGrouping: 'region',
        productGrouping: 'category',
        includeDetails: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(salesParams)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('totalSales');
      expect(response.body).to.have.property('totalOrders');
      expect(response.body).to.have.property('averageOrderValue');
      expect(response.body).to.have.property('topCustomers');
      expect(response.body).to.have.property('topProducts');
      expect(response.body).to.have.property('salesByPeriod');

      // If details are included
      if (salesParams.includeDetails) {
        expect(response.body.topCustomers).to.be.an('array');
        expect(response.body.topProducts).to.be.an('array');
      }
    });

    it('should generate sales report grouped by product', async () => {
      // Arrange
      const salesParams: SalesReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        productGrouping: 'category',
        includeDetails: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(salesParams)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('topProducts');
      if (response.body.topProducts.length > 0) {
        response.body.topProducts.forEach((product: any) => {
          expect(product).to.have.property('productId');
          expect(product).to.have.property('name');
          expect(product).to.have.property('quantity');
          expect(product).to.have.property('revenue');
        });
      }
    });

    it('should calculate sales KPIs correctly', async () => {
      // Arrange
      const salesParams: SalesReportParamsDto = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        customerGrouping: 'region',
        includeDetails: false,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/sales-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .send(salesParams)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('conversionRate');
      expect(response.body.topCustomers).to.be.an('array');
      expect(response.body.topProducts).to.be.an('array');
    });
  });

  describe('Inventory Reports', () => {
    it('should generate inventory report successfully', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalProducts');
      expect(response.body.summary).to.have.property('totalStockValue');
      expect(response.body.summary).to.have.property('lowStockProducts');
      expect(response.body.summary).to.have.property('outOfStockProducts');
      expect(response.body).to.have.property('categories');
      expect(response.body).to.have.property('generatedAt');

      // Check categories breakdown
      if (response.body.categories.length > 0) {
        response.body.categories.forEach((category: any) => {
          expect(category).to.have.property('name');
          expect(category).to.have.property('productCount');
          expect(category).to.have.property('totalValue');
        });
      }
    });

    it('should include low stock alerts in inventory report', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/inventory')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('lowStockItems');
      if (response.body.lowStockItems.length > 0) {
        response.body.lowStockItems.forEach((item: any) => {
          expect(item).to.have.property('productId');
          expect(item).to.have.property('productName');
          expect(item).to.have.property('currentStock');
          expect(item).to.have.property('lowStockThreshold');
          expect(item.currentStock).to.be.lessThanOrEqual(item.lowStockThreshold);
        });
      }
    });
  });

  describe('Purchasing Analytics', () => {
    it('should generate purchasing analytics report successfully', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/purchasing-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalPurchaseOrders');
      expect(response.body.summary).to.have.property('totalSpend');
      expect(response.body.summary).to.have.property('averageOrderValue');
      expect(response.body).to.have.property('topSuppliers');
      expect(response.body).to.have.property('generatedAt');

      // Check top suppliers
      if (response.body.topSuppliers.length > 0) {
        response.body.topSuppliers.forEach((supplier: any) => {
          expect(supplier).to.have.property('supplierId');
          expect(supplier).to.have.property('supplierName');
          expect(supplier).to.have.property('totalSpend');
          expect(supplier).to.have.property('orderCount');
        });
      }
    });

    it('should include supplier performance metrics', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/purchasing-analytics')
        .query({ includePerformance: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('supplierPerformance');
      if (response.body.supplierPerformance.length > 0) {
        response.body.supplierPerformance.forEach((performance: any) => {
          expect(performance).to.have.property('supplierId');
          expect(performance).to.have.property('onTimeDeliveryRate');
          expect(performance).to.have.property('qualityRating');
          expect(performance).to.have.property('averageLeadTime');
        });
      }
    });
  });

  describe('Executive Dashboard', () => {
    it('should generate comprehensive executive dashboard', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalRevenue');
      expect(response.body.summary).to.have.property('totalExpenses');
      expect(response.body.summary).to.have.property('netIncome');
      expect(response.body.summary).to.have.property('totalOrders');
      expect(response.body.summary).to.have.property('totalCustomers');
      expect(response.body.summary).to.have.property('totalProducts');

      expect(response.body).to.have.property('kpis');
      expect(response.body.kpis).to.be.an('array');

      expect(response.body).to.have.property('charts');
      expect(response.body.charts).to.be.an('array');

      expect(response.body).to.have.property('alerts');
      expect(response.body.alerts).to.be.an('array');

      expect(response.body).to.have.property('generatedAt');
    });

    it('should calculate executive KPIs across all modules', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      if (response.body.kpis.length > 0) {
        const kpiCategories = response.body.kpis.map((kpi: any) => kpi.category);
        expect(kpiCategories).to.include.members([
          KpiCategory.FINANCIAL,
          KpiCategory.SALES,
          KpiCategory.INVENTORY,
          KpiCategory.PURCHASING,
        ]);

        response.body.kpis.forEach((kpi: any) => {
          expect(kpi).to.have.property('name');
          expect(kpi).to.have.property('value');
          expect(kpi).to.have.property('target');
          expect(kpi).to.have.property('trend');
          expect(kpi).to.have.property('category');
        });
      }
    });

    it('should include business alerts and warnings', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/executive-dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      if (response.body.alerts.length > 0) {
        response.body.alerts.forEach((alert: any) => {
          expect(alert).to.have.property('type');
          expect(alert).to.have.property('severity');
          expect(alert).to.have.property('message');
          expect(alert).to.have.property('module');
          expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).to.include(alert.severity);
        });
      }
    });
  });

  describe('Scheduled Reports', () => {
    it('should create scheduled report successfully', async () => {
      // Arrange
      const scheduledReportDto = {
        name: `Weekly Sales Report ${Date.now()}`,
        type: ReportType.SALES,
        schedule: {
          frequency: 'WEEKLY',
          dayOfWeek: 1, // Monday
          time: '09:00',
        },
        parameters: {
          includeKpis: true,
          includeTrends: true,
        },
        recipients: ['manager@test.com', 'sales@test.com'],
        format: ReportFormat.PDF,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduledReportDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal(scheduledReportDto.name);
      expect(response.body.schedule).to.deep.equal(scheduledReportDto.schedule);
      expect(response.body.recipients).to.deep.equal(scheduledReportDto.recipients);
      expect(response.body.isActive).to.be.true;
    });

    it('should list scheduled reports', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/reports/scheduled')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        response.body.forEach((report: any) => {
          expect(report).to.have.property('id');
          expect(report).to.have.property('name');
          expect(report).to.have.property('schedule');
          expect(report).to.have.property('nextRun');
        });
      }
    });
  });

  describe('Security and Authorization', () => {
    it('should reject requests without authentication', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/reports/inventory')
        .expect(401);

      await request(app.getHttpServer())
        .post('/reports/financial')
        .send({})
        .expect(401);

      await request(app.getHttpServer())
        .get('/reports/executive-dashboard')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      // Act & Assert
      await request(app.getHttpServer())
        .get('/reports/inventory')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should prevent XSS attacks in report parameters', async () => {
      // Arrange - Malicious parameters with XSS attempt
      const maliciousParams = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        reportType: 'PROFIT_LOSS',
        customTitle: '<script>alert("xss")</script>Financial Report',
        includeKpis: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/financial')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousParams)
        .expect(200);

      // Assert - XSS should be sanitized or handled safely
      expect(response.body).to.not.include('<script>');
      expect(response.body).to.not.include('alert("xss")');
    });

    it('should handle large date ranges safely', async () => {
      // Arrange - Very large date range (potential performance issue)
      const largeRangeParams = {
        startDate: new Date('2020-01-01'),
        endDate: new Date('2024-12-31'),
        reportType: 'PROFIT_LOSS',
        includeKpis: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/reports/financial')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeRangeParams)
        .expect(200);

      // Assert - Should handle gracefully without timeout
      expect(response.body).to.have.property('reportType');
      expect(response.body).to.have.property('generatedAt');
    });
  });

  describe('Concurrent Report Generation', () => {
    it('should handle concurrent report generation safely', async () => {
      // Arrange - Multiple report types to generate concurrently
      const reportRequests = [
        request(app.getHttpServer())
          .post('/reports/financial')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            reportType: 'PROFIT_LOSS',
            includeKpis: true,
          }),
        request(app.getHttpServer())
          .get('/reports/inventory')
          .set('Authorization', `Bearer ${authToken}`),
        request(app.getHttpServer())
          .post('/reports/sales-analytics')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-01-31'),
            groupBy: 'CUSTOMER',
            includeKpis: true,
          }),
      ];

      // Act - Generate reports concurrently
      const results = await Promise.allSettled(reportRequests);

      // Assert - All reports should generate successfully
      const successfulReports = results.filter(r => r.status === 'fulfilled');
      const failedReports = results.filter(r => r.status === 'rejected');

      expect(successfulReports.length).to.equal(3);
      expect(failedReports.length).to.equal(0);

      // Verify each report has expected structure
      successfulReports.forEach((result: any) => {
        expect(result.value.body).to.have.property('generatedAt');
      });
    });
  });

  /**
   * Helper Functions
   */

  // NOTE: getTestAuthToken function replaced with AuthHelpers.createTestToken()
// AuthHelpers provides standardized token creation with proper role management

  async function createTestReportDefinition(type: ReportType): Promise<any> {
    const timestamp = Date.now();
    const reportDto: CreateReportDefinitionDto = {
      name: `Test ${type} Report ${timestamp}`,
      description: `Test ${type} report for integration testing`,
      type,
      category: ReportCategory.ANALYTICS,
      query: `SELECT * FROM ${type.toLowerCase()} WHERE test = true`,
      parameters: {
        includeKpis: true,
        testMode: true,
      },
    };

    const response = await request(app.getHttpServer())
      .post('/reports/definitions')
      .set('Authorization', `Bearer ${authToken}`)
      .send(reportDto);

    return response.body;
  }

  async function createTestDataForReports(): Promise<void> {
    try {
      // Create test chart of accounts for financial reports
      const timestamp = Date.now();
      await prismaService.chartOfAccounts.createMany({
        data: [
          {
            id: `revenue-${timestamp}`,
            code: `4001-${timestamp}`,
            name: 'Sales Revenue',
            type: 'REVENUE',
            category: 'Operating Revenue',
          },
          {
            id: `expense-${timestamp}`,
            code: `5001-${timestamp}`,
            name: 'Operating Expenses',
            type: 'EXPENSE',
            category: 'Operating Expenses',
          },
          {
            id: `asset-${timestamp}`,
            code: `1001-${timestamp}`,
            name: 'Cash',
            type: 'ASSET',
            category: 'Current Assets',
          },
        ],
      });

      // Create test transactions
      await prismaService.transaction.createMany({
        data: [
          {
            id: `txn-revenue-${timestamp}`,
            reference: `REV-${timestamp}`,
            description: 'Test revenue transaction',
            amount: 10000,
            type: 'SALE',
            status: 'POSTED',
            createdAt: new Date('2024-01-15'),
          },
          {
            id: `txn-expense-${timestamp}`,
            reference: `EXP-${timestamp}`,
            description: 'Test expense transaction',
            amount: 5000,
            type: 'EXPENSE',
            status: 'POSTED',
            createdAt: new Date('2024-01-20'),
          },
        ],
      });

      // Create test products for inventory reports
      await prismaService.product.createMany({
        data: [
          {
            id: `product-${timestamp}-1`,
            name: 'Test Product 1',
            sku: `TP-${timestamp}-1`,
            price: 100.00,
            categoryId: 'test-category',
            stockQuantity: 50,
            lowStockThreshold: 10,
            status: 'ACTIVE',
            createdAt: new Date(),
          },
          {
            id: `product-${timestamp}-2`,
            name: 'Test Product 2',
            sku: `TP-${timestamp}-2`,
            price: 200.00,
            categoryId: 'test-category',
            stockQuantity: 5, // Low stock
            lowStockThreshold: 10,
            status: 'ACTIVE',
            createdAt: new Date(),
          },
        ],
      });

    } catch (error) {
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in order of dependencies
      await prismaService.reportDefinition.deleteMany({
        where: {
          name: { startsWith: 'Test' },
        },
      });

      await prismaService.transaction.deleteMany({
        where: {
          reference: { startsWith: 'REV-' },
        },
      });

      await prismaService.product.deleteMany({
        where: {
          sku: { startsWith: 'TP-' },
        },
      });

      await prismaService.chartOfAccounts.deleteMany({
        where: {
          code: { startsWith: '4001-' },
        },
      });

      // Clean up test users
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { startsWith: 'reports-admin@test.com' } },
            { username: { startsWith: 'reports-admin' } },
          ],
        },
      });
    } catch (error) {
    }
  }
});