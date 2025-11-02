import { expect, use } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from '../services/warehouse.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseStatus,
} from '../dto/inventory.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Warehouse } from '@prisma/client';
import * as sinon from 'sinon';

use(require('sinon-chai'));
use(require('chai-as-promised'));

describe('WarehouseService', () => {
  let service: WarehouseService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let auditService: AuditService;

  const mockWarehouse: Warehouse = {
    id: 'wh-1',
    name: 'Main Warehouse',
    code: 'MAIN-001',
    address: '123 Storage Street',
    city: 'Industrial City',
    state: 'Manufacturing State',
    country: 'Country',
    postalCode: '12345',
    contactPerson: 'John Manager',
    contactPhone: '+1234567890',
    contactEmail: 'manager@warehouse.com',
    maxCapacity: 10000,
    currentUtilization: 2500,
    operatingHours: 'Mon-Fri 8AM-6PM',
    status: WarehouseStatus.ACTIVE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    notes: 'Main distribution center',
  };

  const createWarehouseDto: CreateWarehouseDto = {
    name: 'New Warehouse',
    code: 'NEW-001',
    address: '456 New Street',
    city: 'Logistics City',
    state: 'Distribution State',
    country: 'Country',
    postalCode: '67890',
    contactPerson: 'Jane Supervisor',
    contactPhone: '+0987654321',
    contactEmail: 'supervisor@newwarehouse.com',
    maxCapacity: 5000,
    operatingHours: '24/7',
    status: WarehouseStatus.ACTIVE,
    notes: 'New distribution facility',
  };

  const updateWarehouseDto: UpdateWarehouseDto = {
    name: 'Updated Warehouse',
    contactPerson: 'Updated Manager',
    maxCapacity: 7500,
    status: WarehouseStatus.MAINTENANCE,
  };

  beforeEach(async () => {
    const prismaMock = {
      warehouse: {
        findUnique: sinon.stub(),
        findMany: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
        count: sinon.stub(),
      },
      product: {
        findMany: sinon.stub(),
      },
      stockMovement: {
        findMany: sinon.stub(),
      },
      $transaction: sinon.stub(),
    };

    const securityServiceMock = {
      sanitizeInput: sinon.stub().callsFake((data: any) => data),
    };

    const auditServiceMock = {
      logEvent: sinon.stub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: SecurityService,
          useValue: securityServiceMock,
        },
        {
          provide: AuditService,
          useValue: auditServiceMock,
        },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('create', () => {
    it('should create warehouse successfully', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);
      (prismaService.warehouse.create as any).resolves(mockWarehouse);
      (securityService.sanitizeInput as any).returns(createWarehouseDto);

      // Act
      const result = await service.create(createWarehouseDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockWarehouse);
      sinon.assert.calledWith(prismaService.warehouse.findUnique as any, {
        where: { code: 'NEW-001' },
      });
      sinon.assert.calledWith(prismaService.warehouse.create as any, {
        data: sinon.match({
          name: 'New Warehouse',
          code: 'NEW-001',
          createdBy: 'user-1',
          updatedBy: 'user-1',
        }),
      });
      sinon.assert.called(auditService.logEvent as any);
    });

    it('should throw ConflictException if warehouse code already exists', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (securityService.sanitizeInput as any).returns(createWarehouseDto);

      // Act & Assert
      await expect(service.create(createWarehouseDto, 'user-1')).to.be.rejectedWith(ConflictException);
    });

    it('should handle email validation', async () => {
      // Arrange
      const invalidEmailDto = { ...createWarehouseDto, contactEmail: 'invalid-email' };
      (prismaService.warehouse.findUnique as any).resolves(null);
      (securityService.sanitizeInput as any).returns(invalidEmailDto);

      // Act & Assert
      await expect(service.create(invalidEmailDto, 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated warehouses', async () => {
      // Arrange
      const mockWarehouses = [mockWarehouse];
      const mockTotal = 1;

      (prismaService.warehouse.findMany as any).resolves(mockWarehouses);
      (prismaService.warehouse.count as any).resolves(mockTotal);

      // Act
      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      // Assert
      expect(result.warehouses).to.have.length(1);
      expect(result.total).to.equal(1);
      expect(result.page).to.equal(1);
      expect(result.limit).to.equal(10);
      expect(result.totalPages).to.equal(1);
      sinon.assert.calledWith(prismaService.warehouse.findMany as any, {
        where: {},
        orderBy: { name: 'asc' },
        skip: 0,
        take: 10,
      });
    });

    it('should filter warehouses by status', async () => {
      // Arrange
      (prismaService.warehouse.findMany as any).resolves([mockWarehouse]);
      (prismaService.warehouse.count as any).resolves(1);

      // Act
      await service.findAll({
        status: WarehouseStatus.ACTIVE,
      });

      // Assert
      sinon.assert.calledWith(prismaService.warehouse.findMany as any, {
        where: { status: WarehouseStatus.ACTIVE },
        orderBy: { createdAt: 'desc' },
        skip: sinon.match.number,
        take: sinon.match.number,
      });
    });

    it('should search warehouses by name or code', async () => {
      // Arrange
      (prismaService.warehouse.findMany as any).resolves([mockWarehouse]);
      (prismaService.warehouse.count as any).resolves(1);

      // Act
      await service.findAll({
        search: 'Main',
      });

      // Assert
      sinon.assert.calledWith(prismaService.warehouse.findMany as any, {
        where: {
          OR: [
            { name: { contains: 'Main', mode: 'insensitive' } },
            { code: { contains: 'Main', mode: 'insensitive' } },
            { city: { contains: 'Main', mode: 'insensitive' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: sinon.match.number,
        take: sinon.match.number,
      });
    });
  });

  describe('findById', () => {
    it('should return warehouse by ID', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);

      // Act
      const result = await service.findById('wh-1');

      // Assert
      expect(result).to.deep.equal(mockWarehouse);
      sinon.assert.calledWith(prismaService.warehouse.findUnique as any, {
        where: { id: 'wh-1' },
      });
    });

    it('should throw NotFoundException if warehouse not found', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.findById('invalid-id')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return warehouse by code', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);

      // Act
      const result = await service.findByCode('MAIN-001');

      // Assert
      expect(result).to.deep.equal(mockWarehouse);
      sinon.assert.calledWith(prismaService.warehouse.findUnique as any, {
        where: { code: 'MAIN-001' },
      });
    });

    it('should throw NotFoundException if warehouse not found by code', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.findByCode('INVALID-CODE')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update warehouse successfully', async () => {
      // Arrange
      const updatedWarehouse = { ...mockWarehouse, name: 'Updated Warehouse' };
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (prismaService.warehouse.update as any).resolves(updatedWarehouse);
      (securityService.sanitizeInput as any).returns(updateWarehouseDto);

      // Act
      const result = await service.update('wh-1', updateWarehouseDto, 'user-1');

      // Assert
      expect(result.name).to.equal('Updated Warehouse');
      sinon.assert.calledWith(prismaService.warehouse.update as any, {
        where: { id: 'wh-1' },
        data: sinon.match({
          name: 'Updated Warehouse',
          updatedBy: 'user-1',
        }),
      });
      sinon.assert.called(auditService.logEvent as any);
    });

    it('should throw NotFoundException if warehouse to update does not exist', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);
      (securityService.sanitizeInput as any).returns(updateWarehouseDto);

      // Act & Assert
      await expect(service.update('invalid-id', updateWarehouseDto, 'user-1')).to.be.rejectedWith(NotFoundException);
    });

    it('should validate maxCapacity is not less than current utilization', async () => {
      // Arrange
      const invalidUpdateDto = { ...updateWarehouseDto, maxCapacity: 1000 }; // Less than current 2500
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (securityService.sanitizeInput as any).returns(invalidUpdateDto);

      // Act & Assert
      await expect(service.update('wh-1', invalidUpdateDto, 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete warehouse successfully', async () => {
      // Arrange
      const deletedWarehouse = { ...mockWarehouse, isActive: false };
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (prismaService.warehouse.update as any).resolves(deletedWarehouse);

      // Act
      const result = await service.remove('wh-1', 'user-1');

      // Assert
      expect(result.isActive).to.be.false;
      sinon.assert.calledWith(prismaService.warehouse.update as any, {
        where: { id: 'wh-1' },
        data: {
          isActive: false,
          status: WarehouseStatus.INACTIVE,
          updatedBy: 'user-1',
        },
      });
      sinon.assert.called(auditService.logEvent as any);
    });

    it('should throw NotFoundException if warehouse to delete does not exist', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.remove('invalid-id', 'user-1')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('getWarehouseStock', () => {
    it('should return stock summary for warehouse', async () => {
      // Arrange
      const mockProducts = [
        { id: 'prod-1', name: 'Product 1', stockQuantity: 100 },
        { id: 'prod-2', name: 'Product 2', stockQuantity: 50 },
      ];
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (prismaService.product.findMany as any).resolves(mockProducts);

      // Act
      const result = await service.getWarehouseStock('wh-1');

      // Assert
      expect(result.warehouseId).to.equal('wh-1');
      expect(result.warehouseName).to.equal('Main Warehouse');
      expect(result.totalProducts).to.equal(2);
      expect(result.totalStock).to.equal(150);
      expect(result.products).to.have.length(2);
    });

    it('should throw NotFoundException if warehouse does not exist', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.getWarehouseStock('invalid-id')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('updateUtilization', () => {
    it('should update warehouse utilization successfully', async () => {
      // Arrange
      const updatedWarehouse = { ...mockWarehouse, currentUtilization: 3000 };
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);
      (prismaService.warehouse.update as any).resolves(updatedWarehouse);

      // Act
      const result = await service.updateUtilization('wh-1', 3000, 'user-1');

      // Assert
      expect(result.currentUtilization).to.equal(3000);
      sinon.assert.calledWith(prismaService.warehouse.update as any, {
        where: { id: 'wh-1' },
        data: {
          currentUtilization: 3000,
          updatedBy: 'user-1',
        },
      });
    });

    it('should throw BadRequestException if utilization exceeds max capacity', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);

      // Act & Assert
      await expect(service.updateUtilization('wh-1', 15000, 'user-1')).to.be.rejectedWith(BadRequestException);
    });

    it('should throw BadRequestException if utilization is negative', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);

      // Act & Assert
      await expect(service.updateUtilization('wh-1', -100, 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('getWarehouseCapacity', () => {
    it('should return capacity information', async () => {
      // Arrange
      (prismaService.warehouse.findUnique as any).resolves(mockWarehouse);

      // Act
      const result = await service.getWarehouseCapacity('wh-1');

      // Assert
      expect(result.warehouseId).to.equal('wh-1');
      expect(result.maxCapacity).to.equal(10000);
      expect(result.currentUtilization).to.equal(2500);
      expect(result.availableCapacity).to.equal(7500);
      expect(result.utilizationPercentage).to.equal(25);
    });

    it('should handle zero max capacity gracefully', async () => {
      // Arrange
      const zeroCapacityWarehouse = { ...mockWarehouse, maxCapacity: 0 };
      (prismaService.warehouse.findUnique as any).resolves(zeroCapacityWarehouse);

      // Act
      const result = await service.getWarehouseCapacity('wh-1');

      // Assert
      expect(result.utilizationPercentage).to.equal(0);
    });
  });

  describe('getWarehouseStatistics', () => {
    it('should return comprehensive warehouse statistics', async () => {
      // Arrange
      const mockWarehouses = [mockWarehouse];
      (prismaService.warehouse.findMany as any).resolves(mockWarehouses);
      (prismaService.product.findMany as any).resolves([
        { stockQuantity: 100 },
        { stockQuantity: 50 },
      ]);

      // Act
      const result = await service.getWarehouseStatistics();

      // Assert
      expect(result.totalWarehouses).to.equal(1);
      expect(result.activeWarehouses).to.equal(1);
      expect(result.totalCapacity).to.equal(10000);
      expect(result.totalUtilization).to.equal(2500);
      expect(result.averageUtilizationPercentage).to.equal(25);
    });
  });
});