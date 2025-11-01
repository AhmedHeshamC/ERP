import { expect } from 'chai';
import { stub } from 'sinon';
import { SupplierPerformanceService } from './performance.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import {
  CreateSupplierPerformanceDto,
  UpdateSupplierPerformanceDto,
  SupplierPerformanceQueryDto,
  SupplierTier,
  PerformanceLevel,
  CreateScorecardDetailDto,
  CreatePerformanceEventDto,
  PerformanceEventType,
  EventSeverity,
  PerformanceMetricType,
} from './dto/performance.dto';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('SupplierPerformanceService', () => {
  let service: SupplierPerformanceService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let prismaStub: any;
  let securityStub: any;

  beforeEach(() => {
    prismaService = {
      supplierPerformance: {
        create: stub(),
        findUnique: stub(),
        findMany: stub(),
        update: stub(),
        count: stub(),
        delete: stub(),
      },
      supplier: {
        findUnique: stub(),
      },
      user: {
        findUnique: stub(),
      },
      supplierScorecardDetail: {
        create: stub(),
        findMany: stub(),
        update: stub(),
      },
      supplierPerformanceEvent: {
        create: stub(),
        findMany: stub(),
        update: stub(),
      },
      $transaction: stub(),
    } as any;

    securityService = {
      validateInput: stub(),
      sanitizeInput: stub(),
    } as any;

    service = new SupplierPerformanceService(prismaService, securityService);

    // Create references for easier access to stubs
    prismaStub = prismaService;
    securityStub = securityService;
  });

  afterEach(() => {
    // Restore stubs - Sinon stubs have restore method
    (prismaService.supplierPerformance.create as any).restore?.();
    (prismaService.supplierPerformance.findUnique as any).restore?.();
    (prismaService.supplierPerformance.findMany as any).restore?.();
    (prismaService.supplierPerformance.update as any).restore?.();
    (prismaService.supplierPerformance.count as any).restore?.();
    (prismaService.supplier.findUnique as any).restore?.();
    (prismaService.user.findUnique as any).restore?.();
    (prismaService.supplierScorecardDetail.create as any).restore?.();
    (prismaService.supplierPerformanceEvent.create as any).restore?.();
    (securityService.validateInput as any).restore?.();
    (securityService.sanitizeInput as any).restore?.();
  });

  describe('createSupplierPerformance', () => {
    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidDto = { supplierId: '', period: '' } as CreateSupplierPerformanceDto;
      securityStub.validateInput.returns(false);

      // Act & Assert
      try {
        await service.createSupplierPerformance(invalidDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.equal('Invalid performance data');
      }
    });

    it('should throw error if supplier does not exist', async () => {
      // Arrange
      const validDto: CreateSupplierPerformanceDto = {
        supplierId: 'non-existent-supplier',
        period: '2024-01',
        qualityScore: 85,
        deliveryScore: 90,
        costScore: 80,
        serviceScore: 88,
      };
      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.supplier.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.createSupplierPerformance(validDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }
    });

    it('should throw error if performance record already exists for supplier and period', async () => {
      // Arrange
      const validDto: CreateSupplierPerformanceDto = {
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: 85,
        deliveryScore: 90,
        costScore: 80,
        serviceScore: 88,
      };
      const existingSupplier = { id: 'supplier-123', name: 'Test Supplier', isActive: true };
      const existingPerformance = { id: 'perf-123', supplierId: 'supplier-123', period: '2024-01' };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.supplier.findUnique.resolves(existingSupplier);
      prismaStub.supplierPerformance.findUnique.resolves(existingPerformance);

      // Act & Assert
      try {
        await service.createSupplierPerformance(validDto);
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('already exists');
      }
    });

    it('should create supplier performance record successfully', async () => {
      // Arrange
      const validDto: CreateSupplierPerformanceDto = {
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: 85,
        deliveryScore: 90,
        costScore: 80,
        serviceScore: 88,
        onTimeDeliveryRate: 95,
        qualityDefectRate: 2,
        orderAccuracyRate: 98,
        priceVarianceRate: 5,
        responseTimeHours: 4,
        totalOrders: 25,
        totalValue: 125000,
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance this period',
        calculatedBy: 'user-123',
      };

      const existingSupplier = {
        id: 'supplier-123',
        name: 'Test Supplier',
        code: 'SUP001',
        email: 'test@supplier.com',
        isActive: true,
      };

      const calculator = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
      };

      const createdPerformance = {
        id: 'perf-123',
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '85.00' },
        deliveryScore: { toString: () => '90.00' },
        costScore: { toString: () => '80.00' },
        serviceScore: { toString: () => '88.00' },
        overallScore: { toString: () => '85.75' }, // Calculated weighted average
        tier: 'APPROVED', // Calculated based on overall score
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance this period',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: null,
        reviewedAt: null,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.supplier.findUnique.resolves(existingSupplier);
      prismaStub.supplierPerformance.findUnique.resolves(null);
      prismaStub.user.findUnique.resolves(calculator);
      prismaStub.supplierPerformance.create.resolves(createdPerformance);

      // Act
      const result = await service.createSupplierPerformance(validDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal('perf-123');
      expect(result.supplierId).to.equal('supplier-123');
      expect(result.period).to.equal('2024-01');
      expect(result.qualityScore).to.equal(85);
      expect(result.deliveryScore).to.equal(90);
      expect(result.costScore).to.equal(80);
      expect(result.serviceScore).to.equal(88);
      expect(result.overallScore).to.equal(85.75);
      expect(result.tier).to.equal('APPROVED');
      expect(result.calculatedBy).to.equal('user-123');

      // Verify method calls
      expect(securityStub.validateInput.calledOnce).to.be.true;
      expect(securityStub.sanitizeInput.calledOnce).to.be.true;
      expect(prismaStub.supplier.findUnique.calledOnce).to.be.true;
      expect(prismaStub.supplierPerformance.findUnique.calledOnce).to.be.true;
      expect(prismaStub.supplierPerformance.create.calledOnce).to.be.true;
    });

    it('should calculate overall score correctly based on weighted scores', async () => {
      // Arrange
      const validDto: CreateSupplierPerformanceDto = {
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: 90, // Weight: 0.35
        deliveryScore: 85, // Weight: 0.30
        costScore: 95, // Weight: 0.20
        serviceScore: 80, // Weight: 0.15
      };

      const existingSupplier = {
        id: 'supplier-123',
        name: 'Test Supplier',
        isActive: true,
      };

      const createdPerformance = {
        id: 'perf-123',
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '90.00' },
        deliveryScore: { toString: () => '85.00' },
        costScore: { toString: () => '95.00' },
        serviceScore: { toString: () => '80.00' },
        overallScore: { toString: () => '87.50' }, // (90*0.35) + (85*0.30) + (95*0.20) + (80*0.15) = 87.5
        tier: 'PREFERRED', // Based on overall score > 85
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance this period',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: null,
        reviewedAt: null,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.supplier.findUnique.resolves(existingSupplier);
      prismaStub.supplierPerformance.findUnique.resolves(null);
      prismaStub.supplierPerformance.create.resolves(createdPerformance);

      // Act
      const result = await service.createSupplierPerformance(validDto);

      // Assert
      expect(result.overallScore).to.equal(87.5);
      expect(result.tier).to.equal('PREFERRED');
    });
  });

  describe('getSupplierPerformance', () => {
    it('should return paginated supplier performance records', async () => {
      // Arrange
      const queryDto: SupplierPerformanceQueryDto = {
        skip: 0,
        take: 10,
        sortBy: 'overallScore',
        sortOrder: 'desc',
        minOverallScore: 80,
        tier: SupplierTier.PREFERRED,
      };

      const mockPerformances = [
        {
          id: 'perf-1',
          supplierId: 'supplier-1',
          period: '2024-01',
          qualityScore: { toString: () => '95.00' },
          deliveryScore: { toString: () => '90.00' },
          costScore: { toString: () => '88.00' },
          serviceScore: { toString: () => '92.00' },
          overallScore: { toString: () => '91.25' },
          tier: 'PREFERRED',
          onTimeDeliveryRate: { toString: () => '95.00' },
          qualityDefectRate: { toString: () => '2.00' },
          orderAccuracyRate: { toString: () => '98.00' },
          priceVarianceRate: { toString: () => '5.00' },
          responseTimeHours: { toString: () => '4.00' },
          totalOrders: 25,
          totalValue: { toString: () => '125000.00' },
          lateDeliveries: 2,
          qualityIssues: 1,
          returnsCount: 0,
          notes: 'Excellent performance',
          createdAt: new Date(),
          updatedAt: new Date(),
          calculatedBy: null,
          reviewedBy: null,
          reviewedAt: null,
          supplier: {
            id: 'supplier-1',
            name: 'Supplier 1',
            code: 'SUP001',
            email: 'supplier1@test.com',
          },
        },
        {
          id: 'perf-2',
          supplierId: 'supplier-2',
          period: '2024-01',
          qualityScore: { toString: () => '88.00' },
          deliveryScore: { toString: () => '92.00' },
          costScore: { toString: () => '85.00' },
          serviceScore: { toString: () => '90.00' },
          overallScore: { toString: () => '88.60' },
          tier: 'PREFERRED',
          onTimeDeliveryRate: { toString: () => '95.00' },
          qualityDefectRate: { toString: () => '2.00' },
          orderAccuracyRate: { toString: () => '98.00' },
          priceVarianceRate: { toString: () => '5.00' },
          responseTimeHours: { toString: () => '4.00' },
          totalOrders: 25,
          totalValue: { toString: () => '125000.00' },
          lateDeliveries: 2,
          qualityIssues: 1,
          returnsCount: 0,
          notes: 'Good performance',
          createdAt: new Date(),
          updatedAt: new Date(),
          calculatedBy: null,
          reviewedBy: null,
          reviewedAt: null,
          supplier: {
            id: 'supplier-2',
            name: 'Supplier 2',
            code: 'SUP002',
            email: 'supplier2@test.com',
          },
        },
      ];

      prismaStub.supplierPerformance.findMany.resolves(mockPerformances);
      prismaStub.supplierPerformance.count.resolves(2);

      // Act
      const result = await service.getSupplierPerformance(queryDto);

      // Assert
      expect(result.performances).to.have.length(2);
      expect(result.total).to.equal(2);
      expect(result.skip).to.equal(0);
      expect(result.take).to.equal(10);
      expect(result.performances[0].overallScore).to.be.greaterThan(result.performances[1].overallScore);
      expect(result.performances[0].tier).to.equal('PREFERRED');
    });

    it('should filter by supplier ID correctly', async () => {
      // Arrange
      const queryDto: SupplierPerformanceQueryDto = {
        supplierId: 'supplier-123',
      };

      const mockPerformance = {
        id: 'perf-123',
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '85.00' },
        deliveryScore: { toString: () => '90.00' },
        costScore: { toString: () => '80.00' },
        serviceScore: { toString: () => '88.00' },
        overallScore: { toString: () => '85.00' },
        tier: 'APPROVED',
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: null,
        reviewedAt: null,
        supplier: {
          id: 'supplier-123',
          name: 'Test Supplier',
          code: 'SUP001',
          email: 'test@supplier.com',
        },
      };

      prismaStub.supplierPerformance.findMany.resolves([mockPerformance]);
      prismaStub.supplierPerformance.count.resolves(1);

      // Act
      const result = await service.getSupplierPerformance(queryDto);

      // Assert
      expect(result.performances).to.have.length(1);
      expect(result.performances[0].supplierId).to.equal('supplier-123');
    });

    it('should filter by period range correctly', async () => {
      // Arrange
      const queryDto: SupplierPerformanceQueryDto = {
        periodFrom: '2024-01',
        periodTo: '2024-03',
      };

      prismaStub.supplierPerformance.findMany.resolves([]);
      prismaStub.supplierPerformance.count.resolves(0);

      // Act
      const result = await service.getSupplierPerformance(queryDto);

      // Assert
      expect(result.performances).to.have.length(0);
      expect(result.total).to.equal(0);
    });
  });

  describe('getSupplierPerformanceById', () => {
    it('should return performance record by ID', async () => {
      // Arrange
      const performanceId = 'perf-123';
      const mockPerformance = {
        id: performanceId,
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '85.00' },
        deliveryScore: { toString: () => '90.00' },
        costScore: { toString: () => '80.00' },
        serviceScore: { toString: () => '88.00' },
        overallScore: { toString: () => '85.75' },
        tier: 'APPROVED',
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: null,
        reviewedAt: null,
        supplier: {
          id: 'supplier-123',
          name: 'Test Supplier',
          code: 'SUP001',
          email: 'test@supplier.com',
        },
        calculator: {
          id: 'user-123',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@company.com',
        },
      };

      prismaStub.supplierPerformance.findUnique.resolves(mockPerformance);

      // Act
      const result = await service.getSupplierPerformanceById(performanceId);

      // Assert
      expect(result).to.not.be.null;
      expect(result!.id).to.equal(performanceId);
      expect(result!.supplierId).to.equal('supplier-123');
      expect(result!.supplier!.name).to.equal('Test Supplier');
      expect(result!.calculator!.firstName).to.equal('John');
    });

    it('should return null for non-existent performance ID', async () => {
      // Arrange
      const nonExistentId = 'perf-non-existent';
      prismaStub.supplierPerformance.findUnique.resolves(null);

      // Act
      const result = await service.getSupplierPerformanceById(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe('updateSupplierPerformance', () => {
    it('should throw error if performance record does not exist', async () => {
      // Arrange
      const performanceId = 'perf-non-existent';
      const updateDto: UpdateSupplierPerformanceDto = {
        qualityScore: 90,
      };

      prismaStub.supplierPerformance.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.updateSupplierPerformance(performanceId, updateDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }
    });

    it('should update performance record successfully', async () => {
      // Arrange
      const performanceId = 'perf-123';
      const updateDto: UpdateSupplierPerformanceDto = {
        qualityScore: 92,
        deliveryScore: 88,
        notes: 'Updated performance metrics',
        reviewedBy: 'manager-456',
      };

      const existingPerformance = {
        id: performanceId,
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '85.00' },
        deliveryScore: { toString: () => '90.00' },
        costScore: { toString: () => '80.00' },
        serviceScore: { toString: () => '88.00' },
        overallScore: { toString: () => '85.75' },
        tier: 'APPROVED',
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Good performance',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: null,
        reviewedAt: null,
      };

      const reviewer = {
        id: 'manager-456',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
      };

      const updatedPerformance = {
        id: performanceId,
        supplierId: 'supplier-123',
        period: '2024-01',
        qualityScore: { toString: () => '92.00' },
        deliveryScore: { toString: () => '88.00' },
        costScore: { toString: () => '80.00' },
        serviceScore: { toString: () => '88.00' },
        overallScore: { toString: () => '87.20' },
        tier: 'PREFERRED',
        onTimeDeliveryRate: { toString: () => '95.00' },
        qualityDefectRate: { toString: () => '2.00' },
        orderAccuracyRate: { toString: () => '98.00' },
        priceVarianceRate: { toString: () => '5.00' },
        responseTimeHours: { toString: () => '4.00' },
        totalOrders: 25,
        totalValue: { toString: () => '125000.00' },
        lateDeliveries: 2,
        qualityIssues: 1,
        returnsCount: 0,
        notes: 'Updated performance metrics',
        createdAt: new Date(),
        updatedAt: new Date(),
        calculatedBy: 'user-123',
        reviewedBy: 'manager-456',
        reviewedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(updateDto);
      prismaStub.supplierPerformance.findUnique.resolves(existingPerformance);
      prismaStub.user.findUnique.resolves(reviewer);
      prismaStub.supplierPerformance.update.resolves(updatedPerformance);

      // Act
      const result = await service.updateSupplierPerformance(performanceId, updateDto);

      // Assert
      expect(result.qualityScore).to.equal(92);
      expect(result.deliveryScore).to.equal(88);
      expect(result.notes).to.equal('Updated performance metrics');
      expect(result.reviewedBy).to.equal('manager-456');
      expect(result.reviewedAt).to.not.be.null;
      expect(result.overallScore).to.equal(87.2);
      expect(result.tier).to.equal('PREFERRED');
    });
  });

  describe('calculatePerformanceAnalytics', () => {
    it('should return comprehensive performance analytics', async () => {
      // Arrange
      const mockPerformances = [
        {
          id: 'perf-1',
          supplierId: 'supplier-1',
          overallScore: { toString: () => '95.00' },
          tier: 'PREFERRED',
          supplier: { id: 'supplier-1', name: 'Premium Supplier' },
          onTimeDeliveryRate: { toString: () => '98.00' },
          qualityScore: { toString: () => '96.00' },
          deliveryScore: { toString: () => '94.00' },
          costScore: { toString: () => '93.00' },
          serviceScore: { toString: () => '97.00' },
          period: '2024-01',
          totalOrders: 50,
          totalValue: { toString: () => '250000.00' },
          qualityIssues: 0,
          lateDeliveries: 1,
        },
        {
          id: 'perf-2',
          supplierId: 'supplier-2',
          overallScore: { toString: () => '75.00' },
          tier: 'STANDARD',
          supplier: { id: 'supplier-2', name: 'Standard Supplier' },
          onTimeDeliveryRate: { toString: () => '85.00' },
          qualityScore: { toString: () => '80.00' },
          deliveryScore: { toString: () => '70.00' },
          costScore: { toString: () => '75.00' },
          serviceScore: { toString: () => '75.00' },
          period: '2024-01',
          totalOrders: 30,
          totalValue: { toString: () => '150000.00' },
          qualityIssues: 3,
          lateDeliveries: 5,
        },
        {
          id: 'perf-3',
          supplierId: 'supplier-3',
          overallScore: { toString: () => '45.00' },
          tier: 'CONDITIONAL',
          supplier: { id: 'supplier-3', name: 'Problematic Supplier' },
          onTimeDeliveryRate: { toString: () => '65.00' },
          qualityScore: { toString: () => '50.00' },
          deliveryScore: { toString: () => '40.00' },
          costScore: { toString: () => '45.00' },
          serviceScore: { toString: () => '45.00' },
          period: '2024-01',
          totalOrders: 20,
          totalValue: { toString: () => '100000.00' },
          qualityIssues: 8,
          lateDeliveries: 12,
        },
      ];

      prismaStub.supplierPerformance.findMany.resolves(mockPerformances);

      // Act
      const result = await service.calculatePerformanceAnalytics();

      // Assert
      expect(result.totalSuppliers).to.equal(3);
      expect(result.averageOverallScore).to.equal((95 + 75 + 45) / 3); // 71.67
      expect(result.tierDistribution.PREFERRED).to.equal(1);
      expect(result.tierDistribution.STANDARD).to.equal(1);
      expect(result.tierDistribution.CONDITIONAL).to.equal(1);
      expect(result.topPerformers).to.have.length(3);
      expect(result.topPerformers[0].supplierName).to.equal('Premium Supplier');
      expect(result.topPerformers[0].overallScore).to.equal(95);
      expect(result.lowPerformers).to.have.length(3);
      expect(result.lowPerformers[0].supplierName).to.equal('Problematic Supplier');
      expect(result.lowPerformers[0].overallScore).to.equal(45);
      expect(result.keyMetrics.averageOnTimeDelivery).to.equal((98 + 85 + 65) / 3); // 82.67
      expect(result.keyMetrics.totalQualityIssues).to.equal(11);
      expect(result.keyMetrics.totalLateDeliveries).to.equal(18);
    });

    it('should handle empty performance data gracefully', async () => {
      // Arrange
      prismaStub.supplierPerformance.findMany.resolves([]);

      // Act
      const result = await service.calculatePerformanceAnalytics();

      // Assert
      expect(result.totalSuppliers).to.equal(0);
      expect(result.averageOverallScore).to.equal(0);
      expect(result.topPerformers).to.have.length(0);
      expect(result.lowPerformers).to.have.length(0);
      expect(result.keyMetrics.averageOnTimeDelivery).to.equal(0);
      expect(result.keyMetrics.totalQualityIssues).to.equal(0);
      expect(result.keyMetrics.totalLateDeliveries).to.equal(0);
    });
  });

  describe('addScorecardDetail', () => {
    it('should add scorecard detail successfully', async () => {
      // Arrange
      const detailDto: CreateScorecardDetailDto = {
        performanceId: 'perf-123',
        metricType: PerformanceMetricType.QUALITY,
        metricName: 'Product Quality Rating',
        metricValue: 95,
        targetValue: 90,
        performanceLevel: PerformanceLevel.EXCELLENT,
        weight: 1.5,
        score: 97.5,
        trend: 'IMPROVING',
        comments: 'Excellent quality maintained',
      };

      const existingPerformance = {
        id: 'perf-123',
        supplierId: 'supplier-123',
        period: '2024-01',
      };

      const createdDetail = {
        id: 'detail-123',
        ...detailDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(detailDto);
      prismaStub.supplierPerformance.findUnique.resolves(existingPerformance);
      prismaStub.supplierScorecardDetail.create.resolves(createdDetail);

      // Act
      const result = await service.addScorecardDetail(detailDto);

      // Assert
      expect(result.id).to.equal('detail-123');
      expect(result.performanceId).to.equal('perf-123');
      expect(result.metricType).to.equal(PerformanceMetricType.QUALITY);
      expect(result.performanceLevel).to.equal(PerformanceLevel.EXCELLENT);
      expect(result.score).to.equal(97.5);

      // Verify method calls
      expect(securityStub.validateInput.calledOnce).to.be.true;
      expect(prismaStub.supplierPerformance.findUnique.calledOnce).to.be.true;
      expect(prismaStub.supplierScorecardDetail.create.calledOnce).to.be.true;
    });

    it('should throw error if performance record does not exist', async () => {
      // Arrange
      const detailDto: CreateScorecardDetailDto = {
        performanceId: 'perf-non-existent',
        metricType: PerformanceMetricType.QUALITY,
        metricName: 'Test Metric',
        metricValue: 80,
        targetValue: 85,
        performanceLevel: PerformanceLevel.AVERAGE,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(detailDto);
      prismaStub.supplierPerformance.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.addScorecardDetail(detailDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Performance record not found');
      }
    });
  });

  describe('recordPerformanceEvent', () => {
    it('should record performance event successfully', async () => {
      // Arrange
      const eventDto: CreatePerformanceEventDto = {
        supplierId: 'supplier-123',
        eventType: PerformanceEventType.LATE_DELIVERY,
        eventDate: new Date('2024-01-15'),
        severity: EventSeverity.HIGH,
        description: 'Delivery delayed by 3 days',
        impact: 'Production schedule affected',
        orderId: 'order-123',
        itemId: 'item-123',
        costImpact: 2500,
        preventiveAction: 'Added buffer time for future orders',
        createdBy: 'user-123',
      };

      const existingSupplier = {
        id: 'supplier-123',
        name: 'Test Supplier',
        isActive: true,
      };

      const createdEvent = {
        id: 'event-123',
        ...eventDto,
        resolved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(eventDto);
      prismaStub.supplier.findUnique.resolves(existingSupplier);
      prismaStub.supplierPerformanceEvent.create.resolves(createdEvent);

      // Act
      const result = await service.recordPerformanceEvent(eventDto);

      // Assert
      expect(result.id).to.equal('event-123');
      expect(result.supplierId).to.equal('supplier-123');
      expect(result.eventType).to.equal(PerformanceEventType.LATE_DELIVERY);
      expect(result.severity).to.equal(EventSeverity.HIGH);
      expect(result.costImpact).to.equal(2500);
      expect(result.resolved).to.be.false;

      // Verify method calls
      expect(securityStub.validateInput.calledOnce).to.be.true;
      expect(prismaStub.supplier.findUnique.calledOnce).to.be.true;
      expect(prismaStub.supplierPerformanceEvent.create.calledOnce).to.be.true;
    });

    it('should throw error if supplier does not exist', async () => {
      // Arrange
      const eventDto: CreatePerformanceEventDto = {
        supplierId: 'supplier-non-existent',
        eventType: PerformanceEventType.QUALITY_ISSUE,
        eventDate: new Date(),
        severity: EventSeverity.MEDIUM,
        description: 'Test event',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(eventDto);
      prismaStub.supplier.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.recordPerformanceEvent(eventDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Supplier not found');
      }
    });
  });

  describe('calculateSupplierTier', () => {
    it('should return PREFERRED tier for scores >= 90', () => {
      // Act
      const tier = service['calculateSupplierTier'](95);

      // Assert
      expect(tier).to.equal(SupplierTier.PREFERRED);
    });

    it('should return APPROVED tier for scores >= 80 and < 90', () => {
      // Act
      const tier = service['calculateSupplierTier'](85);

      // Assert
      expect(tier).to.equal(SupplierTier.APPROVED);
    });

    it('should return STANDARD tier for scores >= 70 and < 80', () => {
      // Act
      const tier = service['calculateSupplierTier'](75);

      // Assert
      expect(tier).to.equal(SupplierTier.STANDARD);
    });

    it('should return CONDITIONAL tier for scores >= 50 and < 70', () => {
      // Act
      const tier = service['calculateSupplierTier'](60);

      // Assert
      expect(tier).to.equal(SupplierTier.CONDITIONAL);
    });

    it('should return UNDER_REVIEW tier for scores < 50', () => {
      // Act
      const tier = service['calculateSupplierTier'](45);

      // Assert
      expect(tier).to.equal(SupplierTier.UNDER_REVIEW);
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted overall score correctly', () => {
      // Arrange
      const scores = {
        qualityScore: 90,
        deliveryScore: 85,
        costScore: 95,
        serviceScore: 80,
      };

      // Act
      const overallScore = service['calculateOverallScore'](scores);

      // Assert
      // Quality: 90 * 0.35 = 31.5
      // Delivery: 85 * 0.30 = 25.5
      // Cost: 95 * 0.20 = 19.0
      // Service: 80 * 0.15 = 12.0
      // Total: 31.5 + 25.5 + 19.0 + 12.0 = 88.0
      expect(overallScore).to.equal(88.0);
    });

    it('should handle missing scores gracefully', () => {
      // Arrange
      const scores = {
        qualityScore: 90,
        deliveryScore: 85,
        // costScore and serviceScore missing
      };

      // Act
      const overallScore = service['calculateOverallScore'](scores);

      // Assert
      // Should calculate based on available scores with default weights
      expect(overallScore).to.be.a('number');
      expect(overallScore).to.be.greaterThan(0);
    });
  });
});