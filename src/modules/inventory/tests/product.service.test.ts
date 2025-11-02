import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from '../services/product.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import { CreateProductDto, UpdateProductDto, ProductQueryDto, ProductStatus } from '../dto/inventory.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Product, ProductCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as sinon from 'sinon';

describe('ProductService', () => {
  let service: ProductService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let auditService: AuditService;

  const mockProductCategory: ProductCategory = {
    id: 'cat-1',
    name: 'Electronics',
    description: 'Electronic devices',
    parentId: null,
    level: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct: Product = {
    id: 'prod-1',
    name: 'Laptop Computer',
    sku: 'LAPTOP-001',
    description: 'High-performance laptop',
    price: new Decimal('999.99'),
    categoryId: 'cat-1',
    status: ProductStatus.ACTIVE,
    stockQuantity: 100,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createProductDto: CreateProductDto = {
    name: 'Test Product',
    sku: 'TEST-001',
    description: 'Test product description',
    price: 99.99,
    costPrice: 75.00,
    categoryId: 'cat-1',
    initialStock: 50,
    lowStockThreshold: 5,
    status: ProductStatus.ACTIVE,
    attributes: { color: 'red', size: 'large' },
    specifications: { material: 'plastic' },
    tags: ['test', 'sample'],
    weight: 1.5,
    dimensions: '10x5x2',
  };

  const updateProductDto: UpdateProductDto = {
    name: 'Updated Product',
    description: 'Updated description',
    price: 149.99,
    status: ProductStatus.INACTIVE,
    lowStockThreshold: 8,
  };

  beforeEach(async () => {
    const prismaMock = {
      product: {
        findUnique: sinon.stub(),
        findMany: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        delete: sinon.stub(),
        count: sinon.stub(),
      },
      productCategory: {
        findUnique: sinon.stub(),
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
        ProductService,
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

    service = module.get<ProductService>(ProductService);
    prismaService = module.get<PrismaService>(PrismaService);
    securityService = module.get<SecurityService>(SecurityService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('create', () => {
    it('should create a new product successfully', async () => {
      // Arrange
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(mockProductCategory);
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (prismaService.product.create as sinon.SinonStub).resolves(mockProduct);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.create(createProductDto, 'user-1');

      // Assert
      expect(result).to.deep.equal(mockProduct);
      expect((securityService.sanitizeInput as sinon.SinonStub).called).to.be.true;
      expect((prismaService.productCategory.findUnique as sinon.SinonStub).called).to.be.true;
      expect((prismaService.product.findUnique as sinon.SinonStub).called).to.be.true;
      expect((prismaService.product.create as sinon.SinonStub).called).to.be.true;
      expect((auditService.logEvent as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if category does not exist', async () => {
      // Arrange
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(createProductDto);

      // Act & Assert
      try {
        await service.create(createProductDto, 'user-1');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });

    it('should throw ConflictException if SKU already exists', async () => {
      // Arrange
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(mockProductCategory);
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (securityService.sanitizeInput as sinon.SinonStub).returns(createProductDto);

      // Act & Assert
      try {
        await service.create(createProductDto, 'user-1');
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
      }
    });

    it('should handle initial stock creation', async () => {
      // Arrange
      const productWithStock = { ...mockProduct, stockQuantity: 50 };
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(mockProductCategory);
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (prismaService.product.create as sinon.SinonStub).resolves(productWithStock);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.create(createProductDto, 'user-1');

      // Assert
      expect(result.stockQuantity).to.equal(50);
      expect((prismaService.product.create as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      // Arrange
      const query: ProductQueryDto = {
        page: 1,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const mockProducts = [mockProduct];
      const mockTotal = 1;

      (prismaService.product.findMany as sinon.SinonStub).resolves(mockProducts);
      (prismaService.product.count as sinon.SinonStub).resolves(mockTotal);
      (securityService.sanitizeInput as sinon.SinonStub).returns(query);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.products).to.have.length(1);
      expect(result.total).to.equal(1);
      expect(result.page).to.equal(1);
      expect(result.limit).to.equal(10);
      expect(result.totalPages).to.equal(1);
      expect((prismaService.product.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should filter products by search term', async () => {
      // Arrange
      const query: ProductQueryDto = {
        search: 'laptop',
      };

      (prismaService.product.findMany as sinon.SinonStub).resolves([mockProduct]);
      (prismaService.product.count as sinon.SinonStub).resolves(1);
      (securityService.sanitizeInput as sinon.SinonStub).returns(query);

      // Act
      await service.findAll(query);

      // Assert
      expect((prismaService.product.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should filter low stock products', async () => {
      // Arrange
      const query: ProductQueryDto = {
        lowStock: true,
      };

      (prismaService.product.findMany as sinon.SinonStub).resolves([mockProduct]);
      (prismaService.product.count as sinon.SinonStub).resolves(1);
      (securityService.sanitizeInput as sinon.SinonStub).returns(query);

      // Act
      await service.findAll(query);

      // Assert
      expect((prismaService.product.findMany as sinon.SinonStub).called).to.be.true;
    });
  });

  describe('findById', () => {
    it('should return product by ID', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);

      // Act
      const result = await service.findById('prod-1');

      // Assert
      expect(result).to.deep.equal(mockProduct);
      expect((prismaService.product.findUnique as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product not found', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await service.findById('invalid-id');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
      }
    });
  });

  describe('findBySku', () => {
    it('should return product by SKU', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);

      // Act
      const result = await service.findBySku('LAPTOP-001');

      // Assert
      expect(result).to.deep.equal(mockProduct);
      expect((prismaService.product.findUnique as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product not found by SKU', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      await expect(service.findBySku('INVALID-SKU')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product successfully', async () => {
      // Arrange
      const updatedProduct = { ...mockProduct, name: 'Updated Product' };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(mockProductCategory);
      (prismaService.product.update as sinon.SinonStub).resolves(updatedProduct);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));
      (securityService.sanitizeInput as sinon.SinonStub).returns(updateProductDto);

      // Act
      const result = await service.update('prod-1', updateProductDto, 'user-1');

      // Assert
      expect(result.name).to.equal('Updated Product');
      expect((prismaService.product.update as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product to update does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(updateProductDto);

      // Act & Assert
      await expect(service.update('invalid-id', updateProductDto, 'user-1')).to.be.rejectedWith(NotFoundException);
    });

    it('should validate category exists when updating categoryId', async () => {
      // Arrange
      const updateWithCategory = { ...updateProductDto, categoryId: 'cat-2' };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.productCategory.findUnique as sinon.SinonStub).resolves(null);
      (securityService.sanitizeInput as sinon.SinonStub).returns(updateWithCategory);

      // Act & Assert
      await expect(service.update('prod-1', updateWithCategory, 'user-1')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete product successfully', async () => {
      // Arrange
      const deletedProduct = { ...mockProduct, isActive: false };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.product.update as sinon.SinonStub).resolves(deletedProduct);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.remove('prod-1', 'user-1');

      // Assert
      expect(result.isActive).to.be.false;
      expect((prismaService.product.update as sinon.SinonStub).called).to.be.true;
    });

    it('should throw NotFoundException if product to delete does not exist', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      await expect(service.remove('invalid-id', 'user-1')).to.be.rejectedWith(NotFoundException);
    });
  });

  describe('updateStock', () => {
    it('should update product stock quantity', async () => {
      // Arrange
      const updatedProduct = { ...mockProduct, stockQuantity: 150 };
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);
      (prismaService.product.update as sinon.SinonStub).resolves(updatedProduct);
      (prismaService.$transaction as sinon.SinonStub).callsFake((callback) => callback(prismaService));

      // Act
      const result = await service.updateStock('prod-1', 50, 'Stock increase', 'user-1');

      // Assert
      expect(result.stockQuantity).to.equal(150);
      expect((prismaService.product.update as sinon.SinonStub).called).to.be.true;
    });

    it('should throw BadRequestException if stock would become negative', async () => {
      // Arrange
      (prismaService.product.findUnique as sinon.SinonStub).resolves(mockProduct);

      // Act & Assert
      await expect(service.updateStock('prod-1', -150, 'Too much reduction', 'user-1')).to.be.rejectedWith(BadRequestException);
    });
  });

  describe('checkLowStock', () => {
    it('should return products with low stock', async () => {
      // Arrange
      const lowStockProduct = { ...mockProduct, stockQuantity: 5, lowStockThreshold: 10 };
      (prismaService.product.findMany as sinon.SinonStub).resolves([lowStockProduct]);

      // Act
      const result = await service.checkLowStock();

      // Assert
      expect(result).to.have.length(1);
      expect(result[0].isLowStock).to.be.true;
      expect((prismaService.product.findMany as sinon.SinonStub).called).to.be.true;
    });

    it('should return empty array when no products are low on stock', async () => {
      // Arrange
      (prismaService.product.findMany as sinon.SinonStub).resolves([]);

      // Act
      const result = await service.checkLowStock();

      // Assert
      expect(result).to.have.length(0);
    });
  });
});