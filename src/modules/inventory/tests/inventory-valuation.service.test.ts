import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from '../services/inventory-valuation.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import {
  InventoryValuationDto,
  InventoryValuationMethod,
} from '../dto/inventory.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Product, InventoryValuation, CostLayer, StockMovement } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as sinon from 'sinon';

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let prismaService: PrismaService;
  let securityService: SecurityService;

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

  const mockCostLayers: CostLayer[] = [
    {
      id: 'layer-1',
      productId: 'prod-1',
      batchNumber: 'BATCH-001',
      quantity: 50,
      unitCost: new Decimal('10.00'),
      totalCost: new Decimal('500.00'),
      remainingQuantity: 30,
      acquisitionDate: new Date('2024-01-01'),
      expiryDate: new Date('2024-12-31'),
      supplierId: 'supplier-1',
      purchaseOrderId: 'po-1',
      location: 'Warehouse A',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'layer-2',
      productId: 'prod-1',
      batchNumber: 'BATCH-002',
      quantity: 80,
      unitCost: new Decimal('12.00'),
      totalCost: new Decimal('960.00'),
      remainingQuantity: 70,
      acquisitionDate: new Date('2024-02-01'),
      expiryDate: new Date('2025-02-01'),
      supplierId: 'supplier-2',
      purchaseOrderId: 'po-2',
      location: 'Warehouse A',
      isActive: true,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
    },
  ];

  const mockInventoryValuation: InventoryValuation = {
    id: 'val-1',
    productId: 'prod-1',
    method: InventoryValuationMethod.FIFO,
    quantity: 100,
    unitCost: new Decimal('11.50'),
    totalValue: new Decimal('1150.00'),
    valuationDate: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
  };

  const valuationDto: InventoryValuationDto = {
    productId: 'prod-1',
    method: InventoryValuationMethod.FIFO,
    valuationDate: new Date(),
    includeInactive: false,
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findUnique: sinon.stub(),
        findMany: sinon.stub(),
      },
      inventoryValuation: {
        create: sinon.stub(),
        findMany: sinon.stub(),
        findFirst: sinon.stub(),
        deleteMany: sinon.stub(),
      },
      costLayer: {
        findMany: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
      },
      stockMovement: {
        findMany: sinon.stub(),
        create: sinon.stub(),
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
        InventoryValuationService,
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

    service = module.get<InventoryValuationService>(InventoryValuationService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('calculateInventoryValue', () => {
    it('should calculate FIFO valuation correctly', async () => {
      // Arrange
      const fifoValuation = { ...mockInventoryValuation, method: InventoryValuationMethod.FIFO };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (prismaService.inventoryValuation.create as sinon.SinonStub).resolves(fifoValuation);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(valuationDto);

      // Act
      const result = await service.calculateInventoryValue(valuationDto, 'user-1');

      // Assert
      expect(result.method).to.equal(InventoryValuationMethod.FIFO);
      expect(result.productValuations).to.have.length(1);

      const valuation = result.productValuations[0];
      expect(valuation.productId).to.equal('prod-1');
      expect(valuation.currentStock).to.equal(100);
      expect(valuation.unitCost).to.equal(11.40); // Weighted average: (30*10 + 70*12) / 100
      expect(valuation.totalValue).to.equal(1140.00);
      sinon.assert.calledWith(prismaService.inventoryValuation.create as any, {
        data: sinon.match({
          productId: 'prod-1',
          method: InventoryValuationMethod.FIFO,
          quantity: 100,
          unitCost: 11.40,
          totalValue: 1140.00,
        }),
      });
    });

    it('should calculate LIFO valuation correctly', async () => {
      // Arrange
      const lifoValuation = { ...mockInventoryValuation, method: InventoryValuationMethod.LIFO };
      const lifoDto = { ...valuationDto, method: InventoryValuationMethod.LIFO };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (prismaService.inventoryValuation.create as sinon.SinonStub).resolves(lifoValuation);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(lifoDto);

      // Act
      const result = await service.calculateInventoryValue(lifoDto, 'user-1');

      // Assert
      expect(result.method).to.equal(InventoryValuationMethod.LIFO);
      const valuation = result.productValuations[0];
      expect(valuation.unitCost).to.equal(11.40); // Same as FIFO in this case
    });

    it('should calculate Weighted Average valuation correctly', async () => {
      // Arrange
      const weightedAvgValuation = { ...mockInventoryValuation, method: InventoryValuationMethod.WEIGHTED_AVERAGE };
      const weightedAvgDto = { ...valuationDto, method: InventoryValuationMethod.WEIGHTED_AVERAGE };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (prismaService.inventoryValuation.create as sinon.SinonStub).resolves(weightedAvgValuation);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(weightedAvgDto);

      // Act
      const result = await service.calculateInventoryValue(weightedAvgDto, 'user-1');

      // Assert
      expect(result.method).to.equal(InventoryValuationMethod.WEIGHTED_AVERAGE);
      const valuation = result.productValuations[0];
      expect(valuation.unitCost).to.equal(11.40); // (30*10 + 70*12) / 100 = 11.40
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(valuationDto);

      // Act & Assert
      try {
        await service.calculateInventoryValue(valuationDto, 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });

    it('should handle products with no cost layers', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves([]);
      (prismaService.inventoryValuation.create as sinon.SinonStub).resolves(mockInventoryValuation);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(valuationDto);

      // Act
      const result = await service.calculateInventoryValue(valuationDto, 'user-1');

      // Assert
      const valuation = result.productValuations[0];
      expect(valuation.unitCost).to.equal(0);
      expect(valuation.totalValue).to.equal(0);
    });

    it('should handle products with zero stock', async () => {
      // Arrange
      const zeroStockProduct = { ...mockProduct, stockQuantity: 0 };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(zeroStockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (prismaService.inventoryValuation.create as sinon.SinonStub).resolves(mockInventoryValuation);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(valuationDto);

      // Act
      const result = await service.calculateInventoryValue(valuationDto, 'user-1');

      // Assert
      expect(result.totalValue).to.equal(0);
      expect(result.totalQuantity).to.equal(0);
    });
  });

  describe('getInventoryValuationHistory', () => {
    it('should return valuation history for a product', async () => {
      // Arrange
      const mockValuations = [mockInventoryValuation];
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.inventoryValuation.findMany as sinon.SinonStub).resolves(mockValuations);

      // Act
      const result = await service.getInventoryValuationHistory('prod-1');

      // Assert
      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal(mockInventoryValuation);
      expect((prismaService.inventoryValuation.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await service.getInventoryValuationHistory('invalid-id');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('addCostLayer', () => {
    it('should add cost layer successfully', async () => {
      // Arrange
      const costLayerDto = {
        productId: 'prod-1',
        batchNumber: 'BATCH-003',
        quantity: 100,
        unitCost: 15.00,
        acquisitionDate: new Date('2024-03-01'),
        supplierId: 'supplier-3',
        purchaseOrderId: 'po-3',
        location: 'Warehouse B',
      };

      const newCostLayer = {
        id: 'layer-3',
        ...costLayerDto,
        totalCost: 1500.00,
        remainingQuantity: 100,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.create as sinon.SinonStub).resolves(newCostLayer);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(costLayerDto);

      // Act
      const result = await service.addCostLayer(costLayerDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(newCostLayer);
      expect((prismaService.costLayer.create as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      const costLayerDto = { productId: 'invalid-id' } as any;
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(costLayerDto);

      // Act & Assert
      try {
        await service.addCostLayer(costLayerDto, 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('consumeCostLayer', () => {
    it('should consume from FIFO cost layers correctly', async () => {
      // Arrange
      const consumeDto = {
        productId: 'prod-1',
        quantity: 50,
        method: InventoryValuationMethod.FIFO,
      };

      const updatedLayers = [
        { ...mockCostLayers[0], remainingQuantity: 0 },
        { ...mockCostLayers[1], remainingQuantity: 50 },
      ];

      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (prismaService.costLayer.update as sinon.SinonStub).resolves(updatedLayers[0]);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(consumeDto);

      // Act
      const result = await service.consumeCostLayer(consumeDto, 'user-1');

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].remainingQuantity).to.equal(0);
      expect(result[1].remainingQuantity).to.equal(50);
      expect((prismaService.costLayer.update as sinon.SinonStub).callCount).to.equal(2);
    });

    it('should throw BadRequestException if insufficient stock in cost layers', async () => {
      // Arrange
      const consumeDto = {
        productId: 'prod-1',
        quantity: 200, // More than available (30 + 70 = 100)
        method: InventoryValuationMethod.FIFO,
      };

      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);
      (securityService.sanitizeInput as sinon.SinonStub).returns(consumeDto);

      // Act & Assert
      try {
        await service.consumeCostLayer(consumeDto, 'user-1');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });
  });

  describe('getCostOfGoodsSold', () => {
    it('should calculate COGS correctly', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const mockMovements: StockMovement[] = [
        {
          id: 'move-1',
          productId: 'prod-1',
          type: 'OUT',
          quantity: 20,
          reason: 'Sale',
          createdById: 'user-1',
          createdAt: new Date('2024-06-01'),
          reference: 'SO-001',
        },
      ];

      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.stockMovement.findMany as sinon.SinonStub).resolves(mockMovements);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);

      // Act
      const result = await service.getCostOfGoodsSold('prod-1', startDate, endDate);

      // Assert
      expect(result.quantity).to.equal(20);
      expect(result.cost).to.equal(200.00); // 20 * $10 (from oldest layer)
      expect(result.method).to.equal(InventoryValuationMethod.FIFO);
    });

    it('should handle products with no outbound movements', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.stockMovement.findMany as sinon.SinonStub).resolves([]);

      // Act
      const result = await service.getCostOfGoodsSold('prod-1', startDate, endDate);

      // Assert
      expect(result.quantity).to.equal(0);
      expect(result.cost).to.equal(0);
    });
  });

  describe('getInventoryValuationReport', () => {
    it('should generate comprehensive valuation report', async () => {
      // Arrange
      const mockProducts = [mockProduct];
      const mockValuations = [mockInventoryValuation];

      (prismaService.product.findMany as sinon.SinonStub).resolves(mockProducts);
      (prismaService.inventoryValuation.findMany as sinon.SinonStub).resolves(mockValuations);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves(mockCostLayers);

      // Act
      const result = await service.getInventoryValuationReport(InventoryValuationMethod.FIFO);

      // Assert
      expect(result.totalValue).to.equal(1150.00);
      expect(result.totalQuantity).to.equal(100);
      expect(result.productCount).to.equal(1);
      expect(result.method).to.equal(InventoryValuationMethod.FIFO);
      expect(result.productValuations).to.have.length(1);
    });

    it('should filter by category when provided', async () => {
      // Arrange
      const mockProducts = [mockProduct];
      (prismaService.product.findMany as sinon.SinonStub).resolves(mockProducts);
      (prismaService.inventoryValuation.findMany as sinon.SinonStub).resolves([mockInventoryValuation]);
      (prismaService.costLayer.findMany as sinon.SinonStub).resolves([]);

      // Act
      await service.getInventoryValuationReport(InventoryValuationMethod.FIFO, 'cat-1');

      // Assert
      expect((prismaService.product.findMany as sinon.SinonStub).called).to.be.true;
    });
  });
});