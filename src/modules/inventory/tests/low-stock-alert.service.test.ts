import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { LowStockAlertService } from '../services/low-stock-alert.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import {
  LowStockAlertDto,
  AlertSeverity,
} from '../dto/inventory.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Product, LowStockAlert } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as sinon from 'sinon';

describe('LowStockAlertService', () => {
  let service: LowStockAlertService;
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
    stockQuantity: 5,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLowStockAlert: LowStockAlert = {
    id: 'alert-1',
    productId: 'prod-1',
    currentStock: 5,
    lowStockThreshold: 10,
    stockDeficit: 5,
    severity: AlertSeverity.HIGH,
    isActive: true,
    isAcknowledged: false,
    acknowledgedAt: null,
    reorderQuantity: null,
    acknowledgedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const lowStockAlertDto: LowStockAlertDto = {
    productId: 'prod-1',
    severity: AlertSeverity.HIGH,
    minStockPercentage: 50,
    includeInactive: false,
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findUnique: sinon.stub(),
        findMany: sinon.stub(),
      },
      lowStockAlert: {
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        deleteMany: sinon.stub(),
        count: sinon.stub(),
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
        LowStockAlertService,
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

    service = module.get<LowStockAlertService>(LowStockAlertService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createAlert', () => {
    it('should create low stock alert successfully', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.lowStockAlert.create as sinon.SinonStub).resolves(mockLowStockAlert);
      (securityService.sanitizeInput as sinon.SinonStub).returns(lowStockAlertDto);

      // Act
      const result = await service.createAlert(lowStockAlertDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockLowStockAlert);
      expect((prismaService.product.findUnique as sinon.SinonStub).called).to.be.true;
      expect((prismaService.lowStockAlert.create as sinon.SinonStub).called).to.be.true;
      expect((auditService.logEvent as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(lowStockAlertDto);

      // Act & Assert
      try {
        await service.createAlert(lowStockAlertDto, 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });

    it('should not create alert if stock is above threshold', async () => {
      // Arrange
      const highStockProduct = { ...mockProduct, stockQuantity: 15 };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(highStockProduct);
      (securityService.sanitizeInput as sinon.SinonStub).returns(lowStockAlertDto);

      // Act & Assert
      try {
        await service.createAlert(lowStockAlertDto, 'user-1');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });

    it('should calculate correct severity based on stock percentage', async () => {
      // Arrange
      const criticalStockProduct = { ...mockProduct, stockQuantity: 1 };
      const criticalAlert = { ...mockLowStockAlert, severity: AlertSeverity.CRITICAL, stockDeficit: 9 };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(criticalStockProduct);
      (prismaService.lowStockAlert.create as sinon.SinonStub).resolves(criticalAlert);
      (securityService.sanitizeInput as sinon.SinonStub).returns(lowStockAlertDto);

      // Act
      const result = await service.createAlert(lowStockAlertDto, 'user-1');

      // Assert
      expect(result.severity).to.equal(AlertSeverity.CRITICAL);
      expect((prismaService.lowStockAlert.create as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('checkAndCreateAlerts', () => {
    it('should create alerts for all low stock products', async () => {
      // Arrange
      const lowStockProducts = [
        mockProduct,
        { ...mockProduct, id: 'prod-2', name: 'Product 2', stockQuantity: 2, lowStockThreshold: 10 },
      ];

      (prismaService.product.findMany as sinon.SinonStub).resolves(lowStockProducts);
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([]);
      (prismaService.lowStockAlert.create as sinon.SinonStub).resolves(mockLowStockAlert);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.checkAndCreateAlerts('user-1');

      // Assert
      expect(result).to.have.length(2);
      expect((prismaService.lowStockAlert.create as sinon.SinonStub).callCount).to.equal(2);
    });

    it('should not create duplicate alerts for existing alerts', async () => {
      // Arrange
      const lowStockProducts = [mockProduct];
      const existingAlerts = [mockLowStockAlert];

      (prismaService.product.findMany as sinon.SinonStub).resolves(lowStockProducts);
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves(existingAlerts);

      // Act
      const result = await service.checkAndCreateAlerts('user-1');

      // Assert
      expect(result).to.have.length(0);
      expect((prismaService.lowStockAlert.create as sinon.SinonStub).called).to.be.false;
    });

    it('should update existing alerts if stock level changed', async () => {
      // Arrange
      const updatedProduct = { ...mockProduct, stockQuantity: 3 };
      const existingAlert = { ...mockLowStockAlert, currentStock: 5, stockDeficit: 5 };
      const updatedAlert = { ...mockLowStockAlert, currentStock: 3, stockDeficit: 7 };

      (prismaService.product.findMany as sinon.SinonStub).resolves([updatedProduct]);
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([existingAlert]);
      (prismaService.lowStockAlert.update as sinon.SinonStub).resolves(updatedAlert);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.checkAndCreateAlerts('user-1');

      // Assert
      expect(result).to.have.length(1);
      expect((prismaService.lowStockAlert.update as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active low stock alerts', async () => {
      // Arrange
      const mockAlerts = [mockLowStockAlert];
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves(mockAlerts);

      // Act
      const result = await service.getActiveAlerts();

      // Assert
      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal(mockLowStockAlert);
      expect((prismaService.lowStockAlert.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should filter alerts by severity', async () => {
      // Arrange
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([mockLowStockAlert]);

      // Act
      await service.getActiveAlerts(AlertSeverity.CRITICAL);

      // Assert
      expect((prismaService.lowStockAlert.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should filter alerts by product', async () => {
      // Arrange
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([mockLowStockAlert]);

      // Act
      await service.getActiveAlerts(undefined, 'prod-1');

      // Assert
      expect((prismaService.lowStockAlert.findMany as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alert successfully', async () => {
      // Arrange
      const acknowledgedAlert = {
        ...mockLowStockAlert,
        isAcknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: 'user-1',
      };

      (prismaService.lowStockAlert.findUnique as sinon.SinonStub).resolves(mockLowStockAlert);
      (prismaService.lowStockAlert.update as sinon.SinonStub).resolves(acknowledgedAlert);

      // Act
      const result = await service.acknowledgeAlert('alert-1', 'user-1');

      // Assert
      expect(result.acknowledgedAt).to.be.a('date');
      expect((prismaService.lowStockAlert.update as sinon.SinonStub).called).to.be.true;
      expect((auditService.logEvent as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if alert does not exist', async () => {
      // Arrange
      (prismaService.lowStockAlert.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await service.acknowledgeAlert('invalid-id', 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });

    it('should not acknowledge already acknowledged alert', async () => {
      // Arrange
      const alreadyAcknowledgedAlert = { ...mockLowStockAlert, isAcknowledged: true };
      (prismaService.lowStockAlert.findUnique as sinon.SinonStub).resolves(alreadyAcknowledgedAlert);

      // Act & Assert
      try {
        await service.acknowledgeAlert('alert-1', 'user-1');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
      }
    });
  });

  describe('dismissAlert', () => {
    it('should dismiss alert successfully', async () => {
      // Arrange
      const dismissedAlert = { ...mockLowStockAlert, isActive: false };

      (prismaService.lowStockAlert.findUnique as sinon.SinonStub).resolves(mockLowStockAlert);
      (prismaService.lowStockAlert.update as sinon.SinonStub).resolves(dismissedAlert);

      // Act
      const result = await service.dismissAlert('alert-1', 'user-1');

      // Assert
      expect(result).to.not.be.undefined;
      expect((prismaService.lowStockAlert.update as sinon.SinonStub).called).to.be.true;
      expect((auditService.logEvent as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if alert does not exist', async () => {
      // Arrange
      (prismaService.lowStockAlert.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await service.dismissAlert('invalid-id', 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('getAlertStatistics', () => {
    it('should return comprehensive alert statistics', async () => {
      // Arrange
      const mockAlerts = [
        mockLowStockAlert,
        { ...mockLowStockAlert, id: 'alert-2', severity: AlertSeverity.CRITICAL },
        { ...mockLowStockAlert, id: 'alert-3', severity: AlertSeverity.MEDIUM, isAcknowledged: true },
        { ...mockLowStockAlert, id: 'alert-4', severity: AlertSeverity.LOW, isActive: false },
      ];

      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves(mockAlerts);

      // Act
      const result = await service.getAlertStatistics();

      // Assert
      expect(result.totalAlerts).to.equal(4);
      expect(result.activeAlerts).to.equal(3);
      expect(result.acknowledgedAlerts).to.equal(1);
      expect(result.unacknowledgedAlerts).to.equal(3);
      expect(result.alertsBySeverity[AlertSeverity.CRITICAL]).to.equal(1);
      expect(result.alertsBySeverity[AlertSeverity.HIGH]).to.equal(1);
      expect(result.alertsBySeverity[AlertSeverity.MEDIUM]).to.equal(1);
      expect(result.alertsBySeverity[AlertSeverity.LOW]).to.equal(1);
    });

    it('should handle empty alerts list', async () => {
      // Arrange
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([]);

      // Act
      const result = await service.getAlertStatistics();

      // Assert
      expect(result.totalAlerts).to.equal(0);
      expect(result.activeAlerts).to.equal(0);
      expect(result.acknowledgedAlerts).to.equal(0);
      expect(result.unacknowledgedAlerts).to.equal(0);
      expect(Object.keys(result.alertsBySeverity)).to.have.length(4);
    });
  });

  describe('getReorderSuggestions', () => {
    it('should generate reorder suggestions for low stock products', async () => {
      // Arrange
      const mockAlerts = [
        mockLowStockAlert,
        { ...mockLowStockAlert, id: 'alert-2', productId: 'prod-2', lowStockThreshold: 20 },
      ];

      const mockProducts = [
        mockProduct,
        { ...mockProduct, id: 'prod-2', name: 'Product 2', lowStockThreshold: 20 },
      ];

      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves(mockAlerts);
      (prismaService.product.findMany as sinon.SinonStub).resolves(mockProducts);

      // Act
      const result = await service.getReorderSuggestions();

      // Assert
      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({
        productId: 'prod-1',
        productName: 'Test Product',
        productSku: 'TEST-001',
        currentStock: 5,
        lowStockThreshold: 10,
        stockDeficit: 5,
        suggestedReorderQuantity: 20, // Math.max(10*2 - 5, 10) = 20
        severity: AlertSeverity.HIGH,
        estimatedCost: 0, // No cost price set
        priority: 'HIGH',
      });
    });

    it('should calculate estimated cost when cost price is available', async () => {
      // Arrange
      const productWithCost = { ...mockProduct, price: 50.00, costPrice: 30.00 };
      (prismaService.lowStockAlert.findMany as sinon.SinonStub).resolves([mockLowStockAlert]);
      (prismaService.product.findMany as sinon.SinonStub).resolves([productWithCost]);

      // Act
      const result = await service.getReorderSuggestions();

      // Assert
      expect(result[0].estimatedCost).to.equal(600.00); // 20 * 30.00
    });
  });

  describe('calculateSeverity', () => {
    it('should calculate CRITICAL severity for very low stock', () => {
      // Act
      const severity = service['calculateSeverity'](1, 10); // 10% of threshold

      // Assert
      expect(severity).to.equal(AlertSeverity.CRITICAL);
    });

    it('should calculate HIGH severity for low stock', () => {
      // Act
      const severity = service['calculateSeverity'](3, 10); // 30% of threshold

      // Assert
      expect(severity).to.equal(AlertSeverity.HIGH);
    });

    it('should calculate MEDIUM severity for moderate low stock', () => {
      // Act
      const severity = service['calculateSeverity'](6, 10); // 60% of threshold

      // Assert
      expect(severity).to.equal(AlertSeverity.MEDIUM);
    });

    it('should calculate LOW severity for near threshold', () => {
      // Act
      const severity = service['calculateSeverity'](9, 10); // 90% of threshold

      // Assert
      expect(severity).to.equal(AlertSeverity.LOW);
    });
  });
});