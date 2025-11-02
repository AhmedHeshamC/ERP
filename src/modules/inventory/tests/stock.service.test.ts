import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from '../services/stock.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import {
  StockMovementDto,
  StockAdjustmentDto,
  WarehouseTransferDto,
  StockMovementType,
} from '../dto/inventory.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Product, StockMovement } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as sinon from 'sinon';

describe('StockService', () => {
  let service: StockService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let auditService: AuditService;

  const mockProduct: Product = {
    id: 'prod-1',
    name: 'Test Product',
    sku: 'TEST-001',
    description: 'Test description',
    price: new Decimal('99.99'),
    categoryId: 'cat-1',
    status: 'ACTIVE',
    stockQuantity: 100,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStockMovement: StockMovement = {
    id: 'move-1',
    productId: 'prod-1',
    type: StockMovementType.IN,
    quantity: 10,
    reason: 'Purchase order receipt',
    reference: 'PO-001',
    createdById: 'user-1',
    createdAt: new Date(),
  };

  const stockMovementDto: StockMovementDto = {
    productId: 'prod-1',
    type: StockMovementType.IN,
    quantity: 10,
    reason: 'Purchase order receipt',
    reference: 'PO-001',
    sourceLocation: 'Warehouse A',
    destinationLocation: 'Main Store',
    unitCost: 75.00,
    metadata: { supplier: 'Supplier Inc' },
  };

  const stockAdjustmentDto: StockAdjustmentDto = {
    productId: 'prod-1',
    quantity: -5,
    reason: 'Damaged items found',
    reference: 'ADJ-001',
    adjustmentCost: 50.00,
    notes: 'Items damaged during handling',
  };

  const warehouseTransferDto: WarehouseTransferDto = {
    productId: 'prod-1',
    sourceLocation: 'Warehouse A',
    destinationLocation: 'Warehouse B',
    quantity: 25,
    reason: 'Stock redistribution',
    reference: 'TRANSFER-001',
    deliveryDate: new Date('2024-01-15'),
    notes: 'Transfer for better distribution',
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findUnique: sinon.stub(),
        update: sinon.stub(),
      },
      stockMovement: {
        create: sinon.stub(),
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        count: sinon.stub(),
      },
      $transaction: sinon.stub(),
    };

    const securityServiceMock = {
      sanitizeInput: sinon.stub((data: any) => data),
    };

    const auditServiceMock = {
      logEvent: sinon.stub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
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

    service = module.get<StockService>(StockService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createMovement', () => {
    it('should create stock movement successfully', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (prismaService.stockMovement.create as any).resolves(mockStockMovement);
      (prismaService.product.update as any).resolves({ ...mockProduct, stockQuantity: 110 });
      (prismaService.$transaction as any).callsFake((callback: any) => callback(prismaService));
      (securityService.sanitizeInput as any).returns(stockMovementDto);

      // Act
      const result = await service.createMovement(stockMovementDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockStockMovement);
      sinon.assert.calledWith(prismaService.product.findUnique as any, {
        where: { id: 'prod-1', isActive: true },
      });
      sinon.assert.calledWith(prismaService.product.update as any, {
        where: { id: 'prod-1' },
        data: { stockQuantity: 110, updatedBy: 'user-1' },
      });
      sinon.assert.calledWith(prismaService.stockMovement.create as any, {
        data: sinon.match({
          productId: 'prod-1',
          type: StockMovementType.IN,
          quantity: 10,
          reason: 'Purchase order receipt',
          reference: 'PO-001',
          createdById: 'user-1',
        }),
      });
      sinon.assert.called(auditService.logEvent as any);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(null);
      (securityService.sanitizeInput as any).returns(stockMovementDto);

      // Act & Assert
      await expect(service.createMovement(stockMovementDto, 'user-1')).to.be.rejectedWith(NotFoundException);
    });

    it('should throw BadRequestException if OUT movement exceeds available stock', async () => {
      // Arrange
      const outMovementDto = { ...stockMovementDto, type: StockMovementType.OUT, quantity: 150 };
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (securityService.sanitizeInput as any).returns(outMovementDto);

      // Act & Assert
      await expect(service.createMovement(outMovementDto, 'user-1')).to.be.rejectedWith(BadRequestException);
    });

    it('should handle ADJUSTMENT movement type', async () => {
      // Arrange
      const adjustmentMovementDto = { ...stockMovementDto, type: StockMovementType.ADJUSTMENT, quantity: -10 };
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (prismaService.stockMovement.create as any).resolves(mockStockMovement);
      (prismaService.product.update as any).resolves({ ...mockProduct, stockQuantity: 90 });
      (prismaService.$transaction as any).callsFake((callback: any) => callback(prismaService));
      (securityService.sanitizeInput as any).returns(adjustmentMovementDto);

      // Act
      const result = await service.createMovement(adjustmentMovementDto, 'user-1');

      // Assert
      expect(result.type).to.equal(StockMovementType.ADJUSTMENT);
      sinon.assert.calledWith(prismaService.product.update as any, {
        where: { id: 'prod-1' },
        data: { stockQuantity: 90, updatedBy: 'user-1' },
      });
    });
  });

  describe('createAdjustment', () => {
    it('should create stock adjustment successfully', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (prismaService.stockMovement.create as any).resolves(mockStockMovement);
      (prismaService.product.update as any).resolves({ ...mockProduct, stockQuantity: 95 });
      (prismaService.$transaction as any).callsFake((callback: any) => callback(prismaService));
      (securityService.sanitizeInput as any).returns(stockAdjustmentDto);

      // Act
      const result = await service.createAdjustment(stockAdjustmentDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockStockMovement);
      sinon.assert.calledWith(prismaService.product.update as any, {
        where: { id: 'prod-1' },
        data: { stockQuantity: 95, updatedBy: 'user-1' },
      });
      sinon.assert.calledWith(prismaService.stockMovement.create as any, {
        data: sinon.match({
          productId: 'prod-1',
          type: StockMovementType.ADJUSTMENT,
          quantity: 5,
          reason: 'Damaged items found',
          reference: 'ADJ-001',
          createdById: 'user-1',
        }),
      });
    });

    it('should throw BadRequestException if adjustment would result in negative stock', async () => {
      // Arrange
      const largeAdjustmentDto = { ...stockAdjustmentDto, quantity: -150 };
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (securityService.sanitizeInput as any).returns(largeAdjustmentDto);

      // Act & Assert
      await expect(service.createAdjustment(largeAdjustmentDto, 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('createTransfer', () => {
    it('should create warehouse transfer successfully', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (prismaService.stockMovement.create as any).resolves(mockStockMovement);
      (prismaService.$transaction as any).callsFake((callback: any) => callback(prismaService));
      (securityService.sanitizeInput as any).returns(warehouseTransferDto);

      // Act
      const result = await service.createTransfer(warehouseTransferDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockStockMovement);
      sinon.assert.calledWith(prismaService.stockMovement.create as any, {
        data: sinon.match({
          productId: 'prod-1',
          type: StockMovementType.TRANSFER,
          quantity: 25,
          reason: 'Stock redistribution',
          reference: 'TRANSFER-001',
          sourceLocation: 'Warehouse A',
          destinationLocation: 'Warehouse B',
          createdById: 'user-1',
        }),
      });
    });

    it('should throw BadRequestException if transfer quantity exceeds available stock', async () => {
      // Arrange
      const largeTransferDto = { ...warehouseTransferDto, quantity: 150 };
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (securityService.sanitizeInput as any).returns(largeTransferDto);

      // Act & Assert
      await expect(service.createTransfer(largeTransferDto, 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('getMovements', () => {
    it('should return paginated stock movements', async () => {
      // Arrange
      const mockMovements = [mockStockMovement];
      const mockTotal = 1;

      (prismaService.stockMovement.findMany as any).resolves(mockMovements);
      (prismaService.stockMovement.count as any).resolves(mockTotal);

      // Act
      const result = await service.getMovements({
        page: 1,
        limit: 10,
        productId: 'prod-1',
      });

      // Assert
      expect(result.movements).to.have.length(1);
      expect(result.total).to.equal(1);
      expect(result.page).to.equal(1);
      expect(result.limit).to.equal(10);
      expect(result.totalPages).to.equal(1);
      sinon.assert.calledWith(prismaService.stockMovement.findMany as any, {
        where: sinon.match({ productId: 'prod-1' }),
        include: sinon.match.object,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should filter movements by type', async () => {
      // Arrange
      (prismaService.stockMovement.findMany as any).resolves([mockStockMovement]);
      (prismaService.stockMovement.count as any).resolves(1);

      // Act
      await service.getMovements({
        type: StockMovementType.IN,
      });

      // Assert
      sinon.assert.calledWith(prismaService.stockMovement.findMany as any, {
        where: sinon.match({ type: StockMovementType.IN }),
        include: sinon.match.object,
        orderBy: { createdAt: 'desc' },
        skip: sinon.match.number,
        take: sinon.match.number,
      });
    });

    it('should filter movements by date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      (prismaService.stockMovement.findMany as any).resolves([mockStockMovement]);
      (prismaService.stockMovement.count as any).resolves(1);

      // Act
      await service.getMovements({
        startDate,
        endDate,
      });

      // Assert
      sinon.assert.calledWith(prismaService.stockMovement.findMany as any, {
        where: sinon.match({
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
        include: sinon.match.object,
        orderBy: { createdAt: 'desc' },
        skip: sinon.match.number,
        take: sinon.match.number,
      });
    });
  });

  describe('getMovementById', () => {
    it('should return movement by ID', async () => {
      // Arrange
      (prismaService.stockMovement.findUnique as any).resolves(mockStockMovement);

      // Act
      const result = await service.getMovementById('move-1');

      // Assert
      expect(result).to.deep.equal(mockStockMovement);
      sinon.assert.calledWith(prismaService.stockMovement.findUnique as any, {
        where: { id: 'move-1' },
        include: sinon.match.object,
      });
    });

    it('should throw NotFoundException if movement not found', async () => {
      // Arrange
      (prismaService.stockMovement.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.getMovementById('invalid-id')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('getProductStockHistory', () => {
    it('should return stock history for product', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(mockProduct);
      (prismaService.stockMovement.findMany as any).resolves([mockStockMovement]);

      // Act
      const result = await service.getProductStockHistory('prod-1');

      // Assert
      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal(mockStockMovement);
      sinon.assert.calledWith(prismaService.product.findUnique as any, {
        where: { id: 'prod-1', isActive: true },
      });
      sinon.assert.calledWith(prismaService.stockMovement.findMany as any, {
        where: { productId: 'prod-1' },
        include: sinon.match.object,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as any).resolves(null);

      // Act & Assert
      await expect(service.getProductStockHistory('invalid-id')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('getStockSummary', () => {
    it('should return stock summary for all products', async () => {
      // Arrange
      const mockProducts = [mockProduct];

      (prismaService.product.findMany as any).resolves(mockProducts);
      (prismaService.stockMovement.groupBy as any).resolves([
        { productId: 'prod-1', _sum: { quantity: 10 }, _count: { id: 1 } },
      ]);

      // Act
      const result = await service.getStockSummary();

      // Assert
      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({
        productId: 'prod-1',
        productName: 'Test Product',
        productSku: 'TEST-001',
        currentStock: 100,
        totalMovementsIn: 10,
        totalMovementsOut: 0,
        lastMovementDate: mockStockMovement.createdAt,
      });
    });

    it('should handle products with no movements', async () => {
      // Arrange
      const mockProducts = [mockProduct];
      (prismaService.product.findMany as any).resolves(mockProducts);
      (prismaService.stockMovement.groupBy as any).resolves([]);

      // Act
      const result = await service.getStockSummary();

      // Assert
      expect(result[0].totalMovementsIn).to.equal(0);
      expect(result[0].totalMovementsOut).to.equal(0);
      expect(result[0].lastMovementDate).to.be.null;
    });
  });
});