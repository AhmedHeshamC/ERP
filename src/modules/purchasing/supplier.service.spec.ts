import { expect } from 'chai';
import * as sinon from 'sinon';
import { SupplierService } from './supplier.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierResponse,
  SupplierQueryDto,
  PaymentTerms
} from './dto/supplier.dto';

describe('SupplierService', () => {
  let supplierService: SupplierService;
  let prismaService: any;
  let securityService: any;

  beforeEach(() => {
    // Mock PrismaService
    prismaService = {
      supplier: {
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        create: sinon.stub(),
        update: sinon.stub(),
        count: sinon.stub(),
      },
    };

    // Mock SecurityService
    securityService = {
      validateInput: sinon.stub(),
      sanitizeInput: sinon.stub(),
      logSecurityEvent: sinon.stub(),
    };

    supplierService = new SupplierService(prismaService, securityService);
  });

  afterEach(() => {
    // Reset all stubs after each test
    sinon.restore();
  });

  describe('createSupplier', () => {
    const createSupplierDto: CreateSupplierDto = {
      code: 'SUP001',
      name: 'Test Supplier',
      email: 'supplier@test.com',
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      taxId: 'TAX123',
      isActive: true,
      creditLimit: 10000,
      paymentTerms: PaymentTerms.NET30,
    };

    it('should create a new supplier successfully', async () => {
      // Arrange
      const expectedSupplier: SupplierResponse = {
        id: 'supplier-123',
        ...createSupplierDto,
        creditLimit: 10000,
        paymentTerms: PaymentTerms.NET30,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(createSupplierDto);
      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.onFirstCall().resolves(null); // Code check
      prismaService.supplier.findUnique.onSecondCall().resolves(null); // Email check
      prismaService.supplier.create.resolves(expectedSupplier);

      // Act
      const result = await supplierService.createSupplier(createSupplierDto);

      // Assert
      expect(result).to.deep.equal(expectedSupplier);
      expect(securityService.validateInput.calledOnceWith(createSupplierDto)).to.be.true;
      expect(securityService.sanitizeInput.calledOnceWith(createSupplierDto)).to.be.true;
      expect(prismaService.supplier.create.calledOnce).to.be.true;
    });

    it('should throw error when input validation fails', async () => {
      // Arrange
      securityService.validateInput.returns(false);
      securityService.logSecurityEvent.resolves(undefined);

      // Act & Assert
      try {
        await supplierService.createSupplier(createSupplierDto);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.equal('Invalid supplier data');
      }

      expect(securityService.validateInput.calledOnceWith(createSupplierDto)).to.be.true;
      expect(prismaService.supplier.create.called).to.be.false;
    });

    it('should throw error when supplier code already exists', async () => {
      // Arrange
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(createSupplierDto);
      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.onFirstCall().resolves({ id: 'existing' }); // Code check

      // Act & Assert
      try {
        await supplierService.createSupplier(createSupplierDto);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('already exists');
      }
    });
  });

  describe('getSuppliers', () => {
    const queryDto: SupplierQueryDto = {
      search: 'test',
      skip: 0,
      take: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    };

    it('should return paginated suppliers', async () => {
      // Arrange
      const mockSuppliers: SupplierResponse[] = [
        {
          id: 'supplier-1',
          code: 'SUP001',
          name: 'Test Supplier 1',
          email: 'supplier1@test.com',
          isActive: true,
          creditLimit: 10000,
          paymentTerms: PaymentTerms.NET30,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'supplier-2',
          code: 'SUP002',
          name: 'Test Supplier 2',
          email: 'supplier2@test.com',
          isActive: true,
          creditLimit: 5000,
          paymentTerms: PaymentTerms.NET15,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaService.supplier.findMany.resolves(mockSuppliers);
      prismaService.supplier.count.resolves(2);

      // Act
      const result = await supplierService.getSuppliers(queryDto);

      // Assert
      expect(result.suppliers).to.have.length(2);
      expect(result.total).to.equal(2);
      expect(result.skip).to.equal(0);
      expect(result.take).to.equal(10);
      expect(prismaService.supplier.findMany.calledOnce).to.be.true;
      expect(prismaService.supplier.count.calledOnce).to.be.true;
    });

    it('should return empty result when no suppliers found', async () => {
      // Arrange
      prismaService.supplier.findMany.resolves([]);
      prismaService.supplier.count.resolves(0);

      // Act
      const result = await supplierService.getSuppliers(queryDto);

      // Assert
      expect(result.suppliers).to.be.empty;
      expect(result.total).to.equal(0);
    });
  });

  describe('getSupplierById', () => {
    it('should return supplier when found', async () => {
      // Arrange
      const supplierId = 'supplier-123';
      const expectedSupplier: SupplierResponse = {
        id: supplierId,
        code: 'SUP001',
        name: 'Test Supplier',
        email: 'supplier@test.com',
        isActive: true,
        creditLimit: 10000,
        paymentTerms: PaymentTerms.NET30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock supplier with Decimal-like creditLimit (as Prisma returns)
      const mockSupplierFromDb = {
        ...expectedSupplier,
        creditLimit: { toString: () => '10000.00' }, // Mock Decimal object
      };

      prismaService.supplier.findUnique.resolves(mockSupplierFromDb);

      // Act
      const result = await supplierService.getSupplierById(supplierId);

      // Assert
      expect(result).to.deep.equal(expectedSupplier);
    });

    it('should return null when supplier not found', async () => {
      // Arrange
      const supplierId = 'nonexistent-id';
      prismaService.supplier.findUnique.resolves(null);

      // Act
      const result = await supplierService.getSupplierById(supplierId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe('updateSupplier', () => {
    const supplierId = 'supplier-123';
    const updateSupplierDto: UpdateSupplierDto = {
      name: 'Updated Supplier Name',
      phone: '+0987654321',
    };

    it('should update supplier successfully', async () => {
      // Arrange
      const expectedSupplier: SupplierResponse = {
        id: supplierId,
        code: 'SUP001',
        name: 'Updated Supplier Name',
        email: 'supplier@test.com',
        phone: '+0987654321',
        isActive: true,
        creditLimit: 10000,
        paymentTerms: PaymentTerms.NET30,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(updateSupplierDto);
      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.onFirstCall().resolves({ id: supplierId }); // Existence check
      prismaService.supplier.findUnique.onSecondCall().resolves(null); // Code check (if code updated)
      prismaService.supplier.findUnique.onThirdCall().resolves(null); // Email check (if email updated)
      prismaService.supplier.update.resolves(expectedSupplier);

      // Act
      const result = await supplierService.updateSupplier(supplierId, updateSupplierDto);

      // Assert
      expect(result).to.deep.equal(expectedSupplier);
      expect(securityService.validateInput.calledOnceWith(updateSupplierDto)).to.be.true;
      expect(prismaService.supplier.update.calledOnce).to.be.true;
    });

    it('should throw error when supplier not found', async () => {
      // Arrange
      securityService.validateInput.returns(true);
      securityService.sanitizeInput.returns(updateSupplierDto);
      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.resolves(null);

      // Act & Assert
      try {
        await supplierService.updateSupplier(supplierId, updateSupplierDto);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }
    });
  });

  describe('deleteSupplier', () => {
    it('should soft delete supplier successfully', async () => {
      // Arrange
      const supplierId = 'supplier-123';
      const existingSupplier = {
        id: supplierId,
        code: 'SUP001',
        isActive: true,
      };

      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.resolves(existingSupplier);
      prismaService.supplier.update.resolves({ ...existingSupplier, isActive: false });

      // Act
      await supplierService.deleteSupplier(supplierId);

      // Assert
      expect(prismaService.supplier.update.calledOnceWith({
        where: { id: supplierId },
        data: { isActive: false },
      })).to.be.true;
    });

    it('should throw error when supplier not found', async () => {
      // Arrange
      const supplierId = 'nonexistent-id';
      securityService.logSecurityEvent.resolves(undefined);
      prismaService.supplier.findUnique.resolves(null);

      // Act & Assert
      try {
        await supplierService.deleteSupplier(supplierId);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }
    });
  });
});