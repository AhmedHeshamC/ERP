/**
 * Purchase Requisition Service Test Suite
 * Following strict TDD methodology with RED-GREEN-REFACTOR cycle
 *
 * RED PHASE: Write failing tests before implementation
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { SinonSandbox, createSandbox } from 'sinon';
import { PurchaseRequisitionService } from '../services/requisition.service';
import {
  IP2PWorkflowService,
  IP2PEventService,
  IP2PConfigurationService
} from '../interfaces/p2p.service.interface';
import {
  PurchaseRequisition,
  RequisitionApproval,
  CreateRequisitionDto,
  RequisitionQueryDto,
  RequisitionPriority,
  RequisitionType,
  P2PProcessState,
  RequisitionValidationError
} from '../types/p2p.types';

describe('PurchaseRequisitionService - TDD RED Phase', () => {
  let sandbox: SinonSandbox;
  let requisitionService: PurchaseRequisitionService;
  let mockPrismaService: any;
  let mockWorkflowService: IP2PWorkflowService;
  let mockEventService: IP2PEventService;
  let mockConfigService: IP2PConfigurationService;
  let mockSecurityService: any;
  let mockAuditService: any;

  // Test data fixtures
  const validCreateRequisitionDto: CreateRequisitionDto = {
    title: 'Office Supplies Purchase',
    description: 'Monthly office supplies replenishment',
    departmentId: 'dept-001',
    priority: RequisitionPriority.NORMAL,
    type: RequisitionType.STOCK,
    requiredDate: '2024-12-15',
    justification: 'Regular office supplies needed for operations',
    items: [
      {
        productId: 'prod-001',
        description: 'Office Paper A4',
        quantity: 10,
        unitPrice: 25.00,
        estimatedPrice: 250.00,
        currency: 'USD',
        uom: 'REAM',
        specifications: '80gsm, white',
        preferredSupplier: 'sup-001',
        suggestedSuppliers: ['sup-001', 'sup-002'],
        category: 'Stationery',
        requestedDeliveryDate: '2024-12-15',
        notes: 'Standard office paper'
      },
      {
        description: 'Printer Ink Cartridges',
        quantity: 5,
        estimatedPrice: 300.00,
        currency: 'USD',
        uom: 'PIECE',
        specifications: 'HP LaserJet Pro',
        category: 'Stationery',
        requestedDeliveryDate: '2024-12-15',
        suggestedSuppliers: []
      }
    ]
  };

  const mockRequisition: PurchaseRequisition = {
    id: 'req-001',
    requestNumber: 'REQ-2024-001',
    title: 'Office Supplies Purchase',
    description: 'Monthly office supplies replenishment',
    requestorId: 'user-001',
    departmentId: 'dept-001',
    priority: RequisitionPriority.NORMAL,
    type: RequisitionType.STOCK,
    status: P2PProcessState.DRAFT,
    totalAmount: 550.00,
    currency: 'USD',
    requiredDate: new Date('2024-12-15'),
    justification: 'Regular office supplies needed for operations',
    items: [],
    approvals: [],
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    sandbox = createSandbox();

    // Mock dependencies
    mockPrismaService = {
      purchaseRequisition: {
        create: sandbox.stub().resolves(mockRequisition),
        findUnique: sandbox.stub().resolves(mockRequisition),
        findMany: sandbox.stub().resolves([mockRequisition]),
        update: sandbox.stub().resolves(mockRequisition),
        delete: sandbox.stub().resolves(mockRequisition),
        count: sandbox.stub().resolves(1)
      },
      requisitionItem: {
        create: sandbox.stub(),
        findMany: sandbox.stub().resolves([]),
        update: sandbox.stub(),
        delete: sandbox.stub()
      },
      requisitionApproval: {
        create: sandbox.stub(),
        findMany: sandbox.stub().resolves([]),
        update: sandbox.stub()
      },
      $transaction: sandbox.stub().resolves(mockRequisition)
    };

    mockWorkflowService = {
      startWorkflow: sandbox.stub().resolves('workflow-001'),
      advanceWorkflow: sandbox.stub().resolves(),
      getWorkflowStatus: sandbox.stub().resolves({ status: 'active' })
    } as any;

    mockEventService = {
      publishEvent: sandbox.stub().resolves(),
      getEvents: sandbox.stub().resolves([])
    } as any;

    mockConfigService = {
      getConfiguration: sandbox.stub().resolves({
        approvalRules: [
          {
            processType: 'REQUISITION',
            condition: 'totalAmount > 1000',
            approvers: [{ userId: 'manager-001', level: 1, required: true }],
            isActive: true,
            priority: 1
          }
        ]
      })
    } as any;

    mockSecurityService = {
      hasPermission: sandbox.stub().resolves(true),
      validateInput: sandbox.stub().resolves({ valid: true })
    };

    mockAuditService = {
      logEvent: sandbox.stub().resolves(),
      createAuditLog: sandbox.stub().resolves()
    };

    requisitionService = new PurchaseRequisitionService(
      mockPrismaService,
      mockWorkflowService,
      mockEventService,
      mockConfigService,
      mockSecurityService,
      mockAuditService
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createRequisition - Core Business Logic', () => {
    it('should create a purchase requisition with valid data', async () => {
      // Arrange
      const expectedRequisition = {
        ...mockRequisition,
        id: 'req-002',
        requestNumber: 'REQ-2024-002',
        items: expect.any(Array)
      };
      mockPrismaService.purchaseRequisition.create.resolves(expectedRequisition);

      // Act
      const result = await requisitionService.createRequisition(validCreateRequisitionDto, 'user-001');

      // Assert
      expect(result).to.exist;
      expect(result.id).to.equal('req-002');
      expect(result.requestNumber).to.equal('REQ-2024-002');
      expect(result.title).to.equal(validCreateRequisitionDto.title);
      expect(result.requestorId).to.equal('user-001');
      expect(result.status).to.equal(P2PProcessState.DRAFT);
      expect(result.totalAmount).to.equal(550.00);

      // Verify interactions
      expect(mockPrismaService.$transaction).to.have.been.calledOnce;
      expect(mockAuditService.logEvent).to.have.been.calledOnce;
      expect(mockEventService.publishEvent).to.have.been.calledOnce;
    });

    it('should generate unique requisition number automatically', async () => {
      // Arrange
      const expectedNumber = 'REQ-2024-003';
      mockPrismaService.purchaseRequisition.create.resolves({
        ...mockRequisition,
        id: 'req-003',
        requestNumber: expectedNumber
      });

      // Act
      const result = await requisitionService.createRequisition(validCreateRequisitionDto, 'user-001');

      // Assert
      expect(result.requestNumber).to.match(/^REQ-\d{4}-\d{3}$/);
      expect(result.requestNumber).to.equal(expectedNumber);
    });

    it('should calculate total amount from all items', async () => {
      // Arrange
      const dtoWithHigherAmount = {
        ...validCreateRequisitionDto,
        items: [
          ...validCreateRequisitionDto.items,
          {
            description: 'Laptop Computer',
            quantity: 2,
            estimatedPrice: 1500.00,
            currency: 'USD',
            uom: 'PIECE',
            category: 'Electronics',
            requestedDeliveryDate: '2024-12-15'
          }
        ]
      };

      const expectedTotal = 550.00 + 3000.00; // Previous items + laptops
      mockPrismaService.purchaseRequisition.create.resolves({
        ...mockRequisition,
        totalAmount: expectedTotal
      });

      // Act
      const result = await requisitionService.createRequisition(dtoWithHigherAmount, 'user-001');

      // Assert
      expect(result.totalAmount).to.equal(expectedTotal);
    });

    it('should throw validation error for empty items list', async () => {
      // Arrange
      const invalidDto = {
        ...validCreateRequisitionDto,
        items: []
      };

      // Act & Assert
      try {
        await requisitionService.createRequisition(invalidDto, 'user-001');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(RequisitionValidationError);
        expect(error.message).to.include('at least one item');
      }
    });

    it('should throw validation error for past required date', async () => {
      // Arrange
      const invalidDto = {
        ...validCreateRequisitionDto,
        requiredDate: '2023-01-01' // Past date
      };

      // Act & Assert
      try {
        await requisitionService.createRequisition(invalidDto, 'user-001');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(RequisitionValidationError);
        expect(error.message).to.include('future date');
      }
    });

    it('should throw validation error for invalid item quantities', async () => {
      // Arrange
      const invalidDto = {
        ...validCreateRequisitionDto,
        items: [
          {
            ...validCreateRequisitionDto.items[0],
            quantity: 0 // Invalid quantity
          }
        ]
      };

      // Act & Assert
      try {
        await requisitionService.createRequisition(invalidDto, 'user-001');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(RequisitionValidationError);
        expect(error.message).to.include('positive quantity');
      }
    });
  });

  describe('submitRequisition - Workflow Integration', () => {
    it('should submit requisition and start approval workflow', async () => {
      // Arrange
      const draftRequisition = { ...mockRequisition, status: P2PProcessState.DRAFT };
      mockPrismaService.purchaseRequisition.findUnique.resolves(draftRequisition);
      mockPrismaService.purchaseRequisition.update.resolves({
        ...draftRequisition,
        status: P2PProcessState.SUBMITTED,
        submittedAt: new Date()
      });

      // Act
      const result = await requisitionService.submitRequisition('req-001', 'user-001');

      // Assert
      expect(result.status).to.equal(P2PProcessState.SUBMITTED);
      expect(result.submittedAt).to.be.a('date');

      // Verify workflow integration
      expect(mockWorkflowService.startWorkflow).to.have.been.calledOnce;
      expect(mockEventService.publishEvent).to.have.been.calledWith({
        eventType: 'REQUISITION_SUBMITTED',
        entityId: 'req-001',
        entityType: 'REQUISITION',
        data: expect.any(Object),
        userId: 'user-001'
      });
    });

    it('should throw error if requisition not found', async () => {
      // Arrange
      mockPrismaService.purchaseRequisition.findUnique.resolves(null);

      // Act & Assert
      try {
        await requisitionService.submitRequisition('nonexistent', 'user-001');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });

    it('should throw error if requisition already submitted', async () => {
      // Arrange
      const submittedRequisition = { ...mockRequisition, status: P2PProcessState.SUBMITTED };
      mockPrismaService.purchaseRequisition.findUnique.resolves(submittedRequisition);

      // Act & Assert
      try {
        await requisitionService.submitRequisition('req-001', 'user-001');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('already submitted');
      }
    });
  });

  describe('approveRequisition - Approval Workflow', () => {
    it('should approve requisition when all required approvals completed', async () => {
      // Arrange
      const submittedRequisition = { ...mockRequisition, status: P2PProcessState.SUBMITTED };
      const approvals: RequisitionApproval[] = [
        {
          id: 'app-001',
          requisitionId: 'req-001',
          approverId: 'manager-001',
          approverName: 'John Manager',
          approverRole: 'DEPARTMENT_MANAGER',
          status: 'PENDING',
          level: 1,
          isRequired: true
        }
      ];

      mockPrismaService.purchaseRequisition.findUnique.resolves(submittedRequisition);
      mockPrismaService.requisitionApproval.findMany.resolves(approvals);
      mockPrismaService.requisitionApproval.update.resolves({
        ...approvals[0],
        status: 'APPROVED',
        approvedAt: new Date()
      });
      mockPrismaService.purchaseRequisition.update.resolves({
        ...submittedRequisition,
        status: P2PProcessState.APPROVED,
        approvedAt: new Date()
      });

      // Act
      const result = await requisitionService.approveRequisition('req-001', 'manager-001', 'Approved for office supplies');

      // Assert
      expect(result.status).to.equal(P2PProcessState.APPROVED);
      expect(result.approvedAt).to.be.a('date');

      // Verify approval was recorded
      expect(mockPrismaService.requisitionApproval.update).to.have.been.calledWith({
        where: { id: 'app-001' },
        data: {
          status: 'APPROVED',
          comments: 'Approved for office supplies',
          approvedAt: expect.any(Date)
        }
      });
    });

    it('should throw error if user is not authorized to approve', async () => {
      // Arrange
      const submittedRequisition = { ...mockRequisition, status: P2PProcessState.SUBMITTED };
      mockPrismaService.purchaseRequisition.findUnique.resolves(submittedRequisition);
      mockPrismaService.requisitionApproval.findMany.resolves([]); // No pending approvals for this user

      // Act & Assert
      try {
        await requisitionService.approveRequisition('req-001', 'unauthorized-user');
        expect.fail('Should have thrown authorization error');
      } catch (error) {
        expect(error.message).to.include('not authorized');
      }
    });
  });

  describe('queryRequisitions - Search and Filtering', () => {
    it('should return filtered requisitions with pagination', async () => {
      // Arrange
      const query: RequisitionQueryDto = {
        status: P2PProcessState.SUBMITTED,
        priority: RequisitionPriority.HIGH,
        departmentId: 'dept-001',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const mockResults = [mockRequisition, { ...mockRequisition, id: 'req-002' }];
      mockPrismaService.purchaseRequisition.findMany.resolves(mockResults);
      mockPrismaService.purchaseRequisition.count.resolves(2);

      // Act
      const result = await requisitionService.queryRequisitions(query);

      // Assert
      expect(result.items).to.have.length(2);
      expect(result.total).to.equal(2);

      // Verify correct query parameters
      expect(mockPrismaService.purchaseRequisition.findMany).to.have.been.calledWith({
        where: expect.objectContaining({
          status: P2PProcessState.SUBMITTED,
          priority: RequisitionPriority.HIGH,
          departmentId: 'dept-001'
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      });
    });

    it('should handle search across multiple fields', async () => {
      // Arrange
      const query: RequisitionQueryDto = {
        search: 'office supplies',
        page: 1,
        limit: 5
      };

      mockPrismaService.purchaseRequisition.findMany.resolves([mockRequisition]);
      mockPrismaService.purchaseRequisition.count.resolves(1);

      // Act
      const result = await requisitionService.queryRequisitions(query);

      // Assert
      expect(result.items).to.have.length(1);

      // Verify search includes multiple fields
      expect(mockPrismaService.purchaseRequisition.findMany).to.have.been.calledWithMatch({
        where: {
          OR: expect.arrayContaining([
            expect.objectContaining({ title: expect.any(Object) }),
            expect.objectContaining({ description: expect.any(Object) }),
            expect.objectContaining({ requestNumber: expect.any(Object) })
          ])
        }
      });
    });
  });

  describe('validateRequisition - Business Rules', () => {
    it('should validate requisition against business rules', async () => {
      // Arrange
      const validRequisition = { ...mockRequisition, status: P2PProcessState.DRAFT };
      mockPrismaService.purchaseRequisition.findUnique.resolves(validRequisition);
      mockPrismaService.requisitionItem.findMany.resolves([
        {
          id: 'item-001',
          quantity: 10,
          estimatedPrice: 250.00,
          currency: 'USD'
        }
      ]);

      // Act
      const result = await requisitionService.validateRequisition('req-001');

      // Assert
      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should detect duplicate requisitions for same items', async () => {
      // Arrange
      mockPrismaService.purchaseRequisition.findUnique.resolves(mockRequisition);
      mockPrismaService.purchaseRequisition.findMany.resolves([
        { ...mockRequisition, id: 'req-002', status: P2PProcessState.APPROVED }
      ]);
      mockPrismaService.requisitionItem.findMany.resolves([
        { description: 'Office Paper A4', quantity: 10 }
      ]);

      // Act
      const result = await requisitionService.validateRequisition('req-001');

      // Assert
      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Duplicate requisition found for similar items');
    });

    it('should validate budget availability', async () => {
      // Arrange
      const highValueRequisition = { ...mockRequisition, totalAmount: 50000.00 };
      mockPrismaService.purchaseRequisition.findUnique.resolves(highValueRequisition);

      // Act
      const result = await requisitionService.checkBudgetAvailability('req-001');

      // Assert
      expect(result).to.have.property('available');
      expect(result).to.have.property('amount');
      expect(typeof result.amount).to.equal('number');
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should handle large number of requisition items efficiently', async () => {
      // Arrange
      const largeRequisition = {
        ...validCreateRequisitionDto,
        items: Array.from({ length: 50 }, (_, i) => ({
          description: `Item ${i + 1}`,
          quantity: 10,
          estimatedPrice: 100.00,
          currency: 'USD',
          uom: 'PIECE',
          category: 'General',
          requestedDeliveryDate: '2024-12-15'
        }))
      };

      const expectedTotal = 50 * 1000.00; // 50 items * 10 * 100
      mockPrismaService.purchaseRequisition.create.resolves({
        ...mockRequisition,
        totalAmount: expectedTotal
      });

      // Act
      const startTime = Date.now();
      const result = await requisitionService.createRequisition(largeRequisition, 'user-001');
      const duration = Date.now() - startTime;

      // Assert
      expect(result.totalAmount).to.equal(expectedTotal);
      expect(duration).to.be.below(1000); // Should complete within 1 second

      // Verify transaction is used for data consistency
      expect(mockPrismaService.$transaction).to.have.been.calledOnce;
    });

    it('should handle concurrent requisition creation safely', async () => {
      // Arrange
      const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
        requisitionService.createRequisition(
          { ...validCreateRequisitionDto, title: `Requisition ${i + 1}` },
          `user-${i + 1}`
        )
      );

      mockPrismaService.purchaseRequisition.create.callsFake((data: any) =>
        Promise.resolve({
          ...mockRequisition,
          id: `req-${Math.random()}`,
          requestNumber: `REQ-2024-${Math.floor(Math.random() * 999) + 1}`,
          ...data.data
        })
      );

      // Act
      const results = await Promise.all(concurrentPromises);

      // Assert
      expect(results).to.have.length(5);
      results.forEach((result, index) => {
        expect(result.title).to.equal(`Requisition ${index + 1}`);
        expect(result.id).to.be.a('string');
        expect(result.requestNumber).to.be.a('string');
      });

      // All requisitions should have unique IDs and numbers
      const ids = results.map(r => r.id);
      const numbers = results.map(r => r.requestNumber);
      expect(new Set(ids).size).to.equal(5);
      expect(new Set(numbers).size).to.equal(5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Arrange
      mockPrismaService.purchaseRequisition.create.rejects(new Error('Database connection failed'));

      // Act & Assert
      try {
        await requisitionService.createRequisition(validCreateRequisitionDto, 'user-001');
        expect.fail('Should have thrown database error');
      } catch (error) {
        expect(error.message).to.include('Database connection failed');
      }
    });

    it('should handle workflow service failures gracefully', async () => {
      // Arrange
      mockWorkflowService.startWorkflow.rejects(new Error('Workflow service unavailable'));
      const draftRequisition = { ...mockRequisition, status: P2PProcessState.DRAFT };
      mockPrismaService.purchaseRequisition.findUnique.resolves(draftRequisition);
      mockPrismaService.purchaseRequisition.update.resolves({
        ...draftRequisition,
        status: P2PProcessState.SUBMITTED
      });

      // Act
      const result = await requisitionService.submitRequisition('req-001', 'user-001');

      // Assert
      // Should still update requisition status but log workflow error
      expect(result.status).to.equal(P2PProcessState.SUBMITTED);
      expect(mockEventService.publishEvent).to.have.been.calledWithMatch({
        eventType: 'WORKFLOW_ERROR'
      });
    });

    it('should handle malformed input data gracefully', async () => {
      // Arrange
      const malformedDto = {
        ...validCreateRequisitionDto,
        items: [
          {
            // Missing required fields
            description: 'Test Item'
          }
        ]
      } as any;

      // Act & Assert
      try {
        await requisitionService.createRequisition(malformedDto, 'user-001');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(RequisitionValidationError);
        expect(error.message).to.include('validation');
      }
    });
  });
});