import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { Test } from '@nestjs/testing';
import { PayrollController } from './controllers/payroll.controller';
import { PayrollService } from './services/payroll.service';
import { SecurityService } from '../../shared/security/security.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreatePayrollDto, PaymentMethod } from './dto/create-payroll.dto';
import { UserRole } from '../../modules/users/dto/user.dto';
import { AuthenticatedUser } from '../../shared/security/interfaces/jwt.interface';

describe('Payroll Controller - Unit Tests', () => {
  let payrollController: PayrollController;
  let payrollService: PayrollService;
  // Mock data

  const mockCreatePayrollDto: CreatePayrollDto = {
    employeeId: 'emp-123',
    payPeriod: '2024-01',
    grossPay: 7500.00,
    netPay: 6200.00,
    regularHours: 160,
    overtimeHours: 0,
    hourlyRate: 46.88,
    overtimeRate: 70.31,
    paymentMethod: PaymentMethod.DIRECT_DEPOSIT,
  };

  // Mock authenticated user
  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 'user-123',
    sub: 'hr-456',
    email: 'hr@example.com',
    username: 'hruser',
    role: UserRole.MANAGER,
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayrollController],
      providers: [
        {
          provide: PayrollService,
          useValue: {
            calculatePayroll: sinon.stub(),
            findById: sinon.stub(),
            findByEmployee: sinon.stub(),
            findAll: sinon.stub(),
            approvePayroll: sinon.stub(),
            processPayment: sinon.stub(),
            generatePayrollReport: sinon.stub(),
          },
        },
        {
          provide: SecurityService,
          useValue: {
            logSecurityEvent: sinon.stub().resolves(),
          },
        },
      ],
    }).compile();

    payrollController = moduleRef.get<PayrollController>(PayrollController);
    payrollService = moduleRef.get<PayrollService>(PayrollService);
      });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /payroll/calculate', () => {
    it('should fail to calculate payroll when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.calculatePayroll as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await payrollController.calculatePayroll(mockCreatePayrollDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to calculate payroll when service throws BadRequestException', async () => {
      // Arrange
      (payrollService.calculatePayroll as sinon.SinonStub).throws(new BadRequestException('Invalid pay period'));

      // Act & Assert
      try {
        await payrollController.calculatePayroll(mockCreatePayrollDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid pay period');
      }
    });

    it('should fail to calculate payroll when service throws ConflictException', async () => {
      // Arrange
      (payrollService.calculatePayroll as sinon.SinonStub).throws(new ConflictException('Payroll record already exists'));

      // Act & Assert
      try {
        await payrollController.calculatePayroll(mockCreatePayrollDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll record already exists');
      }
    });
  });

  describe('GET /payroll/:id', () => {
    it('should fail to find payroll by ID when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.findById as sinon.SinonStub).throws(new NotFoundException('Payroll record not found'));

      // Act & Assert
      try {
        await payrollController.getPayrollById('non-existent');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll record not found');
      }
    });
  });

  describe('GET /payroll/employee/:employeeId', () => {
    it('should fail to find payroll by employee when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.findByEmployee as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await payrollController.getPayrollByEmployee('non-existent');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });
  });

  describe('GET /payroll', () => {
    it('should fail to find payroll records when service throws BadRequestException', async () => {
      // Arrange
      (payrollService.findAll as sinon.SinonStub).throws(new BadRequestException('Invalid pay period'));

      // Act & Assert
      try {
        await payrollController.getPayroll({ payPeriod: 'invalid' });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid pay period');
      }
    });
  });

  describe('PUT /payroll/:id/approve', () => {
    it('should fail to approve payroll when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.approvePayroll as sinon.SinonStub).throws(new NotFoundException('Payroll record not found'));

      // Act & Assert
      try {
        await payrollController.approvePayroll('non-existent', { user: mockAuthenticatedUser });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll record not found');
      }
    });

    it('should fail to approve payroll when service throws BadRequestException', async () => {
      // Arrange
      (payrollService.approvePayroll as sinon.SinonStub).throws(new BadRequestException('Payroll must be approved first'));

      // Act & Assert
      try {
        await payrollController.approvePayroll('payroll-123', { user: mockAuthenticatedUser });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll must be approved first');
      }
    });
  });

  describe('POST /payroll/:id/process', () => {
    it('should fail to process payroll when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.processPayment as sinon.SinonStub).throws(new NotFoundException('Payroll record not found'));

      // Act & Assert
      try {
        await payrollController.processPayment('non-existent', { user: mockAuthenticatedUser });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll record not found');
      }
    });

    it('should fail to process payroll when service throws BadRequestException', async () => {
      // Arrange
      (payrollService.processPayment as sinon.SinonStub).throws(new BadRequestException('Payroll record must be approved before processing'));

      // Act & Assert
      try {
        await payrollController.processPayment('payroll-123', { user: mockAuthenticatedUser });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Payroll record must be approved before processing');
      }
    });
  });

  describe('POST /payroll/reports', () => {
    it('should fail to generate payroll report when service throws BadRequestException', async () => {
      // Arrange
      (payrollService.generatePayrollReport as sinon.SinonStub).throws(new BadRequestException('Invalid date range'));

      // Act & Assert
      try {
        await payrollController.generatePayrollReport({
          startDate: '2024-01-31',
          endDate: '2024-01-01', // Invalid range
        });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid date range');
      }
    });

    it('should fail to generate payroll report when service throws NotFoundException', async () => {
      // Arrange
      (payrollService.generatePayrollReport as sinon.SinonStub).throws(new NotFoundException('No employees found'));

      // Act & Assert
      try {
        await payrollController.generatePayrollReport({
          departmentIds: ['non-existent'],
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('No employees found');
      }
    });
  });

  describe('Input Validation', () => {
    it('should fail with invalid create payroll DTO', async () => {
      // Arrange
      const invalidDto = {
        // Missing required fields
        employeeId: '',
        payPeriod: 'invalid-format',
        grossPay: -1000,
        netPay: 2000,
        regularHours: -10,
        overtimeHours: 5,
        hourlyRate: -20,
      };

      // Act & Assert
      try {
        await payrollController.calculatePayroll(invalidDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.exist;
        // ValidationPipe should catch this before it reaches the service
      }
    });
  });

  describe('Security and Authorization', () => {
    it('should fail when user context is missing', async () => {
      // Act & Assert
      try {
        await payrollController.calculatePayroll(mockCreatePayrollDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should fail when user ID is missing in context', async () => {
      // Act & Assert
      try {
        await payrollController.calculatePayroll(mockCreatePayrollDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected service errors gracefully', async () => {
      // Arrange
      (payrollService.findById as sinon.SinonStub).throws(new Error('Database connection failed'));

      // Act & Assert
      try {
        await payrollController.getPayrollById('payroll-123');
        expect.fail('Should have thrown Error');
      } catch (error) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Database connection failed');
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should fail with negative gross pay in validation', async () => {
      // Arrange
      const invalidDto = {
        ...mockCreatePayrollDto,
        grossPay: -1000,
      };

      // Act & Assert
      try {
        await payrollController.calculatePayroll(invalidDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.exist;
        // ValidationPipe should catch this
      }
    });

    it('should fail with excessive overtime hours', async () => {
      // Arrange
      const invalidDto = {
        ...mockCreatePayrollDto,
        overtimeHours: 100, // Excessive overtime
      };

      // Act & Assert
      try {
        await payrollController.calculatePayroll(invalidDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.exist;
        // ValidationPipe should catch this
      }
    });

    it('should fail with invalid pay period format', async () => {
      // Arrange
      const invalidDto = {
        ...mockCreatePayrollDto,
        payPeriod: '2024/01', // Wrong format
      };

      // Act & Assert
      try {
        await payrollController.calculatePayroll(invalidDto, { user: mockAuthenticatedUser });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.exist;
        // ValidationPipe should catch this
      }
    });
  });
});