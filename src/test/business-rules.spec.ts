import { expect } from 'chai';
import { describe, it, before, after, beforeEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../shared/security/security.service';

// Import all business rule services
import { UserWorkflowService } from '../modules/users/business-rules/user-workflow.service';
import { TransactionValidationService } from '../modules/accounting/business-rules/transaction-validation.service';
import { TransactionType } from '../modules/accounting/enums/accounting.enum';
import { InventoryBusinessRulesService } from '../modules/inventory/business-rules/inventory-business-rules.service';
import { SalesOrderValidationService } from '../modules/sales/business-rules/sales-order-validation.service';
import { PurchaseOrderWorkflowService } from '../modules/purchasing/business-rules/purchase-order-workflow.service';
import { ReportValidationService } from '../modules/reports/business-rules/report-validation.service';

/**
 * Comprehensive Business Rules Test Suite
 * Tests all enhanced business rule implementations
 */
describe('Business Rules Implementation', () => {
  let app: TestingModule;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let userWorkflowService: UserWorkflowService;
  let transactionValidationService: TransactionValidationService;
  let inventoryBusinessRulesService: InventoryBusinessRulesService;
  let salesOrderValidationService: SalesOrderValidationService;
  let purchaseOrderWorkflowService: PurchaseOrderWorkflowService;
  let reportValidationService: ReportValidationService;

  // Test data
  let testUserId: string;
  let testProductId: string;
  let testCustomerId: string;
  let testSupplierId: string;
  let testRoleId: string;

  before(async () => {
    // Create testing module with all services
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        SecurityService,
        UserWorkflowService,
        TransactionValidationService,
        InventoryBusinessRulesService,
        SalesOrderValidationService,
        PurchaseOrderWorkflowService,
        ReportValidationService,
      ],
    }).compile();

    app = moduleRef;
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    securityService = moduleRef.get<SecurityService>(SecurityService);
    userWorkflowService = moduleRef.get<UserWorkflowService>(UserWorkflowService);
    transactionValidationService = moduleRef.get<TransactionValidationService>(TransactionValidationService);
    inventoryBusinessRulesService = moduleRef.get<InventoryBusinessRulesService>(InventoryBusinessRulesService);
    salesOrderValidationService = moduleRef.get<SalesOrderValidationService>(SalesOrderValidationService);
    purchaseOrderWorkflowService = moduleRef.get<PurchaseOrderWorkflowService>(PurchaseOrderWorkflowService);
    reportValidationService = moduleRef.get<ReportValidationService>(ReportValidationService);

    // Setup test data
    await setupTestData();
  });

  after(async () => {
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Ensure clean state before each test
    await prismaService.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.approvalRequest.deleteMany();
    });
  });

  describe('User Workflow Business Rules', () => {
    it('should validate role assignment with proper hierarchy enforcement', async () => {
      const validation = await userWorkflowService.validateRoleAssignment(
        testUserId,
        'MANAGER',
        'admin-user-id', // Admin user making the request
      );

      expect(validation.isValid).to.be.true;
      expect(validation.requiresApproval).to.be.false;
      expect(validation.reasons).to.be.empty;
    });

    it('should prevent role assignment to equal or higher roles', async () => {
      const validation = await userWorkflowService.validateRoleAssignment(
        testUserId,
        'SUPER_ADMIN',
        testUserId, // User trying to assign role to themselves
      );

      expect(validation.isValid).to.be.false;
      expect(validation.reasons).to.include('Users cannot assign roles to themselves');
    });

    it('should enforce admin count limits', async () => {
      // First, create maximum number of admin users
      await createMaxAdminUsers();

      const validation = await userWorkflowService.validateRoleAssignment(
        'new-user-id',
        'ADMIN',
        'super-admin-id',
      );

      expect(validation.isValid).to.be.false;
      expect(validation.reasons).to.include('Maximum number of admin users (3) reached');
    });

    it('should validate user creation against business rules', async () => {
      const userData = {
        email: 'test@company.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        department: 'IT',
        proposedRole: 'USER',
        managerId: 'manager-id',
        justification: 'New developer needed for project expansion',
      };

      const validation = await userWorkflowService.validateUserCreation(userData, 'admin-user-id');

      expect(validation.isValid).to.be.true;
      expect(validation.requiresApproval).to.be.false;
    });

    it('should validate user deactivation with responsibility checks', async () => {
      // Create user with active responsibilities
      await createUserWithActiveResponsibilities(testUserId);

      const validation = await userWorkflowService.validateUserDeactivation(
        testUserId,
        'admin-user-id',
        'End of contract - project completed',
      );

      expect(validation.requiresApproval).to.be.true;
      expect(validation.reasons.some(reason => reason.includes('active responsibilities'))).to.be.true;
    });
  });

  describe('Financial Transaction Validation Rules', () => {
    it('should validate double-entry bookkeeping rules', async () => {
      const transactionData = {
        reference: 'TXN-001',
        description: 'Test transaction',
        amount: 1000,
        type: 'JOURNAL',
        entries: [
          { accountId: 'cash-account', debitAmount: 1000, creditAmount: 0 },
          { accountId: 'revenue-account', debitAmount: 0, creditAmount: 1000 },
        ],
      };

      const validation = await transactionValidationService.validateTransaction(transactionData, testUserId);

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
    });

    it('should reject transactions with unequal debits and credits', async () => {
      const transactionData = {
        reference: 'TXN-002',
        description: 'Invalid transaction',
        amount: 1000,
        type: 'JOURNAL',
        entries: [
          { accountId: 'cash-account', debitAmount: 1000, creditAmount: 0 },
          { accountId: 'revenue-account', debitAmount: 0, creditAmount: 900 }, // Mismatch
        ],
      };

      const validation = await transactionValidationService.validateTransaction(transactionData, testUserId);

      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(error => error.includes('Total debits (1000) must equal total credits (900)'))).to.be.true;
    });

    it('should enforce segregation of duties', async () => {
      // Create transaction with user who has approval privileges
      const transactionData = {
        reference: 'TXN-003',
        description: 'High-value transaction',
        amount: 50000,
        type: 'PAYMENT',
        entries: [
          { accountId: 'bank-account', debitAmount: 0, creditAmount: 50000 },
          { accountId: 'expense-account', debitAmount: 50000, creditAmount: 0 },
        ],
      };

      const validation = await transactionValidationService.validateTransaction(transactionData, 'approver-user-id');

      expect(validation.warnings.some(warning => warning.includes('additional review'))).to.be.true;
    });

    it('should validate amount limits based on user role', async () => {
      const transactionData = {
        reference: 'TXN-004',
        description: 'Large transaction',
        amount: 2000000, // Exceeds all limits
        type: 'PAYMENT',
        entries: [
          { accountId: 'bank-account', debitAmount: 0, creditAmount: 2000000 },
          { accountId: 'expense-account', debitAmount: 2000000, creditAmount: 0 },
        ],
      };

      const validation = await transactionValidationService.validateTransaction(transactionData, 'user-id');

      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(error => error.includes('exceeds user limit'))).to.be.true;
    });

    it('should detect suspicious transaction patterns', async () => {
      const suspiciousTransaction = {
        reference: 'TXN-005',
        description: 'Weekend transaction',
        amount: 10000, // Round number
        type: 'PAYMENT',
        date: new Date('2024-01-06'), // Saturday
        entries: [
          { accountId: 'bank-account', debitAmount: 0, creditAmount: 10000 },
          { accountId: 'expense-account', debitAmount: 10000, creditAmount: 0 },
        ],
      };

      const validation = await transactionValidationService.validateTransaction(suspiciousTransaction, testUserId);

      expect(validation.warnings.some(warning => warning.includes('Weekend transaction'))).to.be.true;
      expect(validation.warnings.some(warning => warning.includes('Round amount'))).to.be.true;
    });
  });

  describe('Inventory Management Business Rules', () => {
    it('should validate stock movement with availability checks', async () => {
      const validation = await inventoryBusinessRulesService.validateStockMovement(
        testProductId,
        'OUT',
        10,
        'Customer order fulfillment',
        testUserId,
      );

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
    });

    it('should prevent stock movement beyond available quantity', async () => {
      // Create product with limited stock
      await createProductWithLimitedStock(testProductId, 5);

      const validation = await inventoryBusinessRulesService.validateStockMovement(
        testProductId,
        'OUT',
        10, // More than available
        'Attempted over-shipment',
        testUserId,
      );

      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(error => error.includes('Insufficient stock'))).to.be.true;
    });

    it('should calculate reorder points and safety stock', async () => {
      const recommendations = await inventoryBusinessRulesService.calculateReorderPoints(testProductId);

      expect(recommendations.reorderPoint).to.be.a('number');
      expect(recommendations.safetyStock).to.be.a('number');
      expect(recommendations.economicOrderQuantity).to.be.a('number');
      expect(recommendations.recommendations).to.be.an('array');
    });

    it('should generate inventory recommendations for low stock', async () => {
      // Create product with low stock
      await createProductWithLowStock(testProductId);

      const recommendations = await inventoryBusinessRulesService.generateInventoryRecommendations();

      expect(recommendations.criticalStock).to.be.an('array');
      expect(recommendations.reorderRequired).to.be.an('array');
      expect(recommendations.totalRecommendations).to.be.a('number');
    });

    it('should validate inventory valuation methods', async () => {
      const validation = await inventoryBusinessRulesService.validateInventoryValuation('FIFO');

      expect(validation.isValid).to.be.true;
      expect(validation.totalValue).to.be.a('number');
      expect(validation.breakdown).to.be.an('array');
    });

    it('should enforce movement limits based on user role', async () => {
      const largeMovement = {
        quantity: 20000,
        reason: 'Large inventory adjustment',
      };

      const validation = await inventoryBusinessRulesService.validateStockMovement(
        testProductId,
        'ADJUSTMENT',
        largeMovement.quantity,
        largeMovement.reason,
        'user-id', // Regular user
      );

      expect(validation.requiresApproval).to.be.true;
    });
  });

  describe('Sales Order Processing Rules', () => {
    it('should validate sales order with credit limit check', async () => {
      const orderData = {
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 5, unitPrice: 100 },
        ],
        orderValue: 500,
      };

      const validation = await salesOrderValidationService.validateSalesOrder(orderData, testUserId);

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
      expect(validation.creditCheck).to.exist;
    });

    it('should enforce customer credit limits', async () => {
      // Create customer with low credit limit
      const lowCreditCustomer = await createCustomerWithLowCreditLimit();

      const largeOrder = {
        customerId: lowCreditCustomer.id,
        items: [
          { productId: testProductId, quantity: 100, unitPrice: 100 },
        ],
        orderValue: 10000,
      };

      const validation = await salesOrderValidationService.validateSalesOrder(largeOrder, testUserId);

      expect(validation.isValid).to.be.false;
      expect(validation.errors.some(error => error.includes('exceeds available credit'))).to.be.true;
    });

    it('should validate discount approval matrix', async () => {
      const orderWithHighDiscount = {
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 1, unitPrice: 50 }, // 50% discount
        ],
        orderValue: 50,
      };

      const validation = await salesOrderValidationService.validateSalesOrder(orderWithHighDiscount, 'user-id');

      expect(validation.requiresApproval).to.be.true;
      expect(validation.warnings.some(warning => warning.includes('requires approval'))).to.be.true;
    });

    it('should perform risk assessment for high-value orders', async () => {
      const highValueOrder = {
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 1000, unitPrice: 100 },
        ],
        orderValue: 100000,
        paymentMethod: 'CASH_ON_DELIVERY',
      };

      const validation = await salesOrderValidationService.validateSalesOrder(highValueOrder, testUserId);

      expect(validation.riskAssessment).to.exist;
      expect(validation.riskAssessment.isHighRisk).to.be.true;
      expect(validation.riskAssessment.riskScore).to.be.greaterThan(50);
    });

    it('should validate product availability and backordering', async () => {
      const orderWithBackorder = {
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 1000, unitPrice: 100 }, // Exceeds stock
        ],
        orderValue: 100000,
      };

      const validation = await salesOrderValidationService.validateSalesOrder(orderWithBackorder, testUserId);

      expect(validation.isValid).to.be.true; // Backorder allowed
      expect(validation.warnings.some(warning => warning.includes('backordered'))).to.be.true;
    });
  });

  describe('Purchase Order Approval Workflows', () => {
    it('should validate purchase order with budget constraints', async () => {
      const purchaseOrder = {
        supplierId: testSupplierId,
        items: [
          { productId: testProductId, quantity: 10, unitPrice: 100 },
        ],
        totalAmount: 1000,
        budgetCategory: 'GENERAL',
      };

      const validation = await purchaseOrderWorkflowService.validatePurchaseOrder(purchaseOrder, testUserId);

      expect(validation.isValid).to.be.true;
      expect(validation.errors).to.be.empty;
      expect(validation.budgetValidation).to.exist;
    });

    it('should enforce multi-tier approval matrix', async () => {
      const largePurchaseOrder = {
        supplierId: testSupplierId,
        items: [
          { productId: testProductId, quantity: 1000, unitPrice: 100 },
        ],
        totalAmount: 100000,
        budgetCategory: 'GENERAL',
      };

      const validation = await purchaseOrderWorkflowService.validatePurchaseOrder(largePurchaseOrder, 'user-id');

      expect(validation.requiresApproval).to.be.true;
      expect(validation.approvalPath.length).to.be.greaterThan(0);
    });

    it('should validate supplier performance requirements', async () => {
      // Create supplier with poor performance
      const poorPerformanceSupplier = await createSupplierWithPoorPerformance();

      const purchaseOrder = {
        supplierId: poorPerformanceSupplier.id,
        items: [
          { productId: testProductId, quantity: 10, unitPrice: 100 },
        ],
        totalAmount: 1000,
      };

      const validation = await purchaseOrderWorkflowService.validatePurchaseOrder(purchaseOrder, testUserId);

      expect(validation.supplierValidation.performanceIssues.length).to.be.greaterThan(0);
      expect(validation.requiresApproval).to.be.true;
    });

    it('should enforce competitive bidding requirements', async () => {
      const highValuePurchase = {
        supplierId: testSupplierId,
        items: [
          { productId: testProductId, quantity: 500, unitPrice: 100 },
        ],
        totalAmount: 50000, // Above competitive bidding threshold
        quotationReferences: [], // No quotations provided
      };

      const validation = await purchaseOrderWorkflowService.validatePurchaseOrder(highValuePurchase, testUserId);

      expect(validation.complianceChecks.policyViolations.some(violation =>
        violation.includes('Competitive bidding required')
      )).to.be.true;
    });

    it('should validate contract coverage requirements', async () => {
      const contractRequiredPurchase = {
        supplierId: testSupplierId,
        items: [
          { productId: testProductId, quantity: 2000, unitPrice: 100 },
        ],
        totalAmount: 200000, // Above contract threshold
      };

      const validation = await purchaseOrderWorkflowService.validatePurchaseOrder(contractRequiredPurchase, testUserId);

      expect(validation.warnings.some(warning =>
        warning.includes('High-value purchase without active contract')
      )).to.be.true;
    });
  });

  describe('Report Generation Validations', () => {
    it('should validate report access based on user role', async () => {
      const reportRequest = {
        reportType: 'FINANCIAL_SUMMARY',
        fields: ['amount', 'date', 'description'],
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      };

      const validation = await reportValidationService.validateReportRequest(reportRequest, 'user-id');

      expect(validation.accessLevel).to.equal('SENSITIVE');
      expect(validation.requiresApproval).to.be.true;
    });

    it('should apply role-based data filters', async () => {
      const reportRequest = {
        reportType: 'TEAM_PERFORMANCE',
        fields: ['name', 'performance', 'department'],
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      };

      const validation = await reportValidationService.validateReportRequest(reportRequest, 'manager-id');

      expect(validation.dataFilters.some(filter =>
        filter.field === 'departmentId'
      )).to.be.true;
    });

    it('should mask sensitive data for unauthorized users', async () => {
      const sensitiveReportRequest = {
        reportType: 'EMPLOYEE_COMPENSATION',
        fields: ['name', 'salary', 'department'],
        includesSensitiveData: true,
      };

      const validation = await reportValidationService.validateReportRequest(sensitiveReportRequest, 'user-id');

      expect(validation.auditMetadata.includesSensitiveData).to.be.true;
      // Note: Actual masking would be implemented in the report generation service
    });

    it('should validate compliance requirements', async () => {
      const gdprReportRequest = {
        reportType: 'CUSTOMER_DATA',
        fields: ['name', 'email', 'address'],
        includesPersonalData: true,
        userConsent: false,
      };

      const validation = await reportValidationService.validateReportRequest(gdprReportRequest, 'user-id');

      expect(validation.auditMetadata.complianceFlags).to.include('GDPR');
      expect(validation.errors.some(error =>
        error.includes('GDPR: User consent required')
      )).to.be.true;
    });

    it('should validate scheduled report limits', async () => {
      const scheduledReportRequest = {
        reportType: 'SALES_SUMMARY',
        isScheduled: true,
        schedule: {
          frequency: 'HOURLY',
          nextRunTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      };

      const validation = await reportValidationService.validateReportRequest(scheduledReportRequest, 'user-id');

      expect(validation.errors.some(error =>
        error.includes('Hourly scheduling requires administrative privileges')
      )).to.be.true;
    });

    it('should validate report distribution security', async () => {
      const distributionReportRequest = {
        reportType: 'FINANCIAL_SUMMARY',
        distribution: {
          emailRecipients: new Array(60).fill('test@example.com'), // Exceeds limit
          includeExternalRecipients: true,
          isConfidential: true,
          isEncrypted: false,
        },
      };

      const validation = await reportValidationService.validateReportRequest(distributionReportRequest, 'admin-id');

      expect(validation.errors.some(error =>
        error.includes('Number of email recipients exceeds limit')
      )).to.be.true;
      expect(validation.errors.some(error =>
        error.includes('Confidential reports must be encrypted')
      )).to.be.true;
    });
  });

  // Integration tests
  describe('Cross-Module Business Rule Integration', () => {
    it('should validate complete sales-to-purchase workflow', async () => {
      // 1. Create sales order
      const salesOrder = {
        customerId: testCustomerId,
        items: [
          { productId: testProductId, quantity: 100, unitPrice: 100 },
        ],
        orderValue: 10000,
      };

      const salesValidation = await salesOrderValidationService.validateSalesOrder(salesOrder, testUserId);
      expect(salesValidation.isValid).to.be.true;

      // 2. Create purchase order for inventory replenishment
      const purchaseOrder = {
        supplierId: testSupplierId,
        items: [
          { productId: testProductId, quantity: 150, unitPrice: 80 },
        ],
        totalAmount: 12000,
      };

      const purchaseValidation = await purchaseOrderWorkflowService.validatePurchaseOrder(purchaseOrder, testUserId);
      expect(purchaseValidation.isValid).to.be.true;

      // 3. Validate inventory movement
      const inventoryValidation = await inventoryBusinessRulesService.validateStockMovement(
        testProductId,
        'IN',
        150,
        'Replenishment stock',
        testUserId,
      );
      expect(inventoryValidation.isValid).to.be.true;
    });

    it('should enforce consistent audit logging across modules', async () => {
      const auditEvents = [];

      // Perform actions across different modules
      await userWorkflowService.validateRoleAssignment(testUserId, 'MANAGER', 'admin-user-id');
      await transactionValidationService.validateTransaction(testTransactionData, testUserId);
      await salesOrderValidationService.validateSalesOrder(testSalesOrderData, testUserId);

      // Check audit logs
      const auditLogs = await prismaService.auditLog.findMany({
        where: { userId: testUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      expect(auditLogs.length).to.be.greaterThan(0);
      expect(auditLogs.every(log => log.action && log.timestamp)).to.be.true;
    });
  });

  // Helper functions for test setup
  async function setupTestData(): Promise<void> {
    // Create test users
    testUserId = await createTestUser('testuser', 'USER');
    await createTestUser('adminuser', 'ADMIN');
    await createTestUser('manageruser', 'MANAGER');

    // Create test products
    testProductId = await createTestProduct('Test Product', 100);

    // Create test customers
    testCustomerId = await createTestCustomer('Test Customer', 'STANDARD');

    // Create test suppliers
    testSupplierId = await createTestSupplier('Test Supplier');
  }

  async function cleanupTestData(): Promise<void> {
    await prismaService.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await tx.approvalRequest.deleteMany();
      await tx.user.deleteMany({ where: { email: { contains: 'test' } } });
      await tx.product.deleteMany({ where: { name: { contains: 'Test' } } });
      await tx.customer.deleteMany({ where: { name: { contains: 'Test' } } });
      await tx.supplier.deleteMany({ where: { name: { contains: 'Test' } } });
    });
  }

  async function createTestUser(username: string, role: string): Promise<string> {
    const user = await prismaService.user.create({
      data: {
        username,
        email: `${username}@test.com`,
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedPassword',
        role,
        isActive: true,
      },
    });
    return user.id;
  }

  async function createTestProduct(name: string, price: number): Promise<string> {
    const product = await prismaService.product.create({
      data: {
        name,
        sku: `TEST-${Date.now()}`,
        price,
        costPrice: price * 0.7,
        stockQuantity: 100,
        isActive: true,
      },
    });
    return product.id;
  }

  async function createTestCustomer(name: string, tier: string): Promise<string> {
    const customer = await prismaService.customer.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(' ', '')}@test.com`,
        tier,
        creditScore: 750,
        isActive: true,
      },
    });
    return customer.id;
  }

  async function createTestSupplier(name: string): Promise<string> {
    const supplier = await prismaService.supplier.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(' ', '')}@supplier.com`,
        isActive: true,
        isPreferred: true,
        isApprovedVendor: true,
      },
    });
    return supplier.id;
  }

  // Additional helper functions for specific test scenarios
  async function createMaxAdminUsers(): Promise<void> {
    const adminUsers = ['admin1', 'admin2', 'admin3'];
    for (const username of adminUsers) {
      await createTestUser(username, 'ADMIN');
    }
  }

  async function createUserWithActiveResponsibilities(userId: string): Promise<void> {
    await prismaService.approvalRequest.createMany({
      data: [
        { approverId: userId, status: 'PENDING', type: 'TEST' },
        { approverId: userId, status: 'PENDING', type: 'TEST2' },
      ],
    });
  }

  async function createProductWithLimitedStock(productId: string, quantity: number): Promise<void> {
    await prismaService.product.update({
      where: { id: productId },
      data: { stockQuantity: quantity },
    });
  }

  async function createProductWithLowStock(productId: string): Promise<void> {
    await prismaService.product.update({
      where: { id: productId },
      data: { stockQuantity: 5, minStockLevel: 10 },
    });
  }

  async function createCustomerWithLowCreditLimit(): Promise<any> {
    return await prismaService.customer.create({
      data: {
        name: 'Low Credit Customer',
        email: 'lowcredit@test.com',
        tier: 'BRONZE',
        creditScore: 500,
        isActive: true,
      },
    });
  }

  async function createSupplierWithPoorPerformance(): Promise<any> {
    return await prismaService.supplier.create({
      data: {
        name: 'Poor Performance Supplier',
        email: 'poor@supplier.com',
        isActive: true,
        isPreferred: false,
        performanceMetrics: {
          onTimeDeliveryRate: 0.85,
          qualityAcceptanceRate: 0.90,
          priceVariance: 0.25,
        },
      },
    });
  }

  const testTransactionData = {
    reference: 'TEST-TXN',
    description: 'Test transaction',
    amount: 1000,
    type: 'JOURNAL',
    entries: [
      { accountId: 'test-account-1', debitAmount: 1000, creditAmount: 0 },
      { accountId: 'test-account-2', debitAmount: 0, creditAmount: 1000 },
    ],
  };

  const testSalesOrderData = {
    customerId: 'test-customer',
    items: [
      { productId: 'test-product', quantity: 5, unitPrice: 100 },
    ],
    orderValue: 500,
  };
});