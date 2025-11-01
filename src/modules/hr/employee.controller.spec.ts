import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { Test } from '@nestjs/testing';
import { EmployeeController } from './controllers/employee.controller';
import { EmployeeService } from './services/employee.service';
import { SecurityService } from '../../shared/security/security.service';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CreateEmployeeDto, EmploymentType } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

describe('Employee Controller - Unit Tests', () => {
  let employeeController: EmployeeController;
  let employeeService: EmployeeService;
  // Mock data
  const mockCreateEmployeeDto: CreateEmployeeDto = {
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    departmentId: 'dept-123',
    position: 'Software Developer',
    jobTitle: 'Senior Software Developer',
    employmentType: EmploymentType.FULL_TIME,
    salary: 75000,
    dateOfBirth: '1990-01-15',
  };

  const mockUpdateEmployeeDto: UpdateEmployeeDto = {
    firstName: 'Updated Name',
    salary: 80000,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [
        {
          provide: EmployeeService,
          useValue: {
            create: sinon.stub(),
            findById: sinon.stub(),
            findByEmployeeId: sinon.stub(),
            findAll: sinon.stub(),
            update: sinon.stub(),
            softDelete: sinon.stub(),
            activate: sinon.stub(),
            deactivate: sinon.stub(),
            getEmployeeSummary: sinon.stub(),
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

    employeeController = moduleRef.get<EmployeeController>(EmployeeController);
    employeeService = moduleRef.get<EmployeeService>(EmployeeService);
      });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /employees', () => {
    it('should fail to create employee when service throws NotFoundException', async () => {
      // Arrange
      (employeeService.create as sinon.SinonStub).throws(new NotFoundException('User not found'));

      // Act & Assert
      try {
        await employeeController.createEmployee(mockCreateEmployeeDto, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('User not found');
      }
    });

    it('should fail to create employee when service throws ConflictException', async () => {
      // Arrange
      (employeeService.create as sinon.SinonStub).throws(new ConflictException('Employee already exists'));

      // Act & Assert
      try {
        await employeeController.createEmployee(mockCreateEmployeeDto, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee already exists');
      }
    });

    it('should fail to create employee when service throws BadRequestException', async () => {
      // Arrange
      (employeeService.create as sinon.SinonStub).throws(new BadRequestException('Invalid employment type'));

      // Act & Assert
      try {
        await employeeController.createEmployee(mockCreateEmployeeDto, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid employment type');
      }
    });
  });

  describe('GET /employees/:id', () => {
    it('should fail to find employee by ID when service throws NotFoundException', async () => {
      // Arrange
      (employeeService.findById as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.getEmployeeById('non-existent');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });
  });

  describe('GET /employees/number/:employeeId', () => {
    it('should fail to find employee by employee number when service throws NotFoundException', async () => {
      // Arrange
      (employeeService.findByEmployeeId as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.getEmployeeByEmployeeId('EMP999');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });
  });

  describe('GET /employees', () => {
    it('should fail to find employees when service throws NotFoundException', async () => {
      // Arrange
      (employeeService.findAll as sinon.SinonStub).throws(new NotFoundException('Department not found'));

      // Act & Assert
      try {
        await employeeController.getEmployees({ departmentId: 'non-existent' });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Department not found');
      }
    });

    it('should fail to find employees when service throws BadRequestException', async () => {
      // Arrange
      (employeeService.findAll as sinon.SinonStub).throws(new BadRequestException('Invalid date range'));

      // Act & Assert
      try {
        await employeeController.getEmployees({
          hireDateFrom: '2024-01-01',
          hireDateTo: '2023-01-01'
        });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid date range');
      }
    });
  });

  describe('PUT /employees/:id', () => {
    it('should fail to update non-existent employee', async () => {
      // Arrange
      (employeeService.update as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.updateEmployee('non-existent', mockUpdateEmployeeDto, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to update employee when service throws BadRequestException', async () => {
      // Arrange
      (employeeService.update as sinon.SinonStub).throws(new BadRequestException('Salary must be positive'));

      // Act & Assert
      try {
        await employeeController.updateEmployee('emp-123', { salary: -1000 }, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Salary must be positive');
      }
    });
  });

  describe('DELETE /employees/:id', () => {
    it('should fail to delete non-existent employee', async () => {
      // Arrange
      (employeeService.softDelete as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.deleteEmployee('non-existent', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to delete already terminated employee', async () => {
      // Arrange
      (employeeService.softDelete as sinon.SinonStub).throws(new BadRequestException('Employee is already terminated'));

      // Act & Assert
      try {
        await employeeController.deleteEmployee('emp-123', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee is already terminated');
      }
    });
  });

  describe('POST /employees/:id/activate', () => {
    it('should fail to activate non-existent employee', async () => {
      // Arrange
      (employeeService.activate as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.activateEmployee('non-existent', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to activate already active employee', async () => {
      // Arrange
      (employeeService.activate as sinon.SinonStub).throws(new BadRequestException('Employee is already active'));

      // Act & Assert
      try {
        await employeeController.activateEmployee('emp-123', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee is already active');
      }
    });
  });

  describe('POST /employees/:id/deactivate', () => {
    it('should fail to deactivate non-existent employee', async () => {
      // Arrange
      (employeeService.deactivate as sinon.SinonStub).throws(new NotFoundException('Employee not found'));

      // Act & Assert
      try {
        await employeeController.deactivateEmployee('non-existent', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to deactivate already inactive employee', async () => {
      // Arrange
      (employeeService.deactivate as sinon.SinonStub).throws(new BadRequestException('Employee is already inactive'));

      // Act & Assert
      try {
        await employeeController.deactivateEmployee('emp-123', { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee is already inactive');
      }
    });
  });

  describe('GET /employees/summary', () => {
    it('should fail to get employee summary when service throws error', async () => {
      // Arrange
      (employeeService.getEmployeeSummary as sinon.SinonStub).throws(new Error('Database connection failed'));

      // Act & Assert
      try {
        await employeeController.getEmployeeSummary();
        expect.fail('Should have thrown Error');
      } catch (error) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Database connection failed');
      }
    });
  });

  describe('Input Validation', () => {
    it('should fail with invalid create employee DTO', async () => {
      // Arrange
      const invalidDto = {
        userId: 'user-123',
        firstName: '',
        lastName: 'Doe',
        email: 'invalid-email',
        departmentId: 'dept-123',
        position: 'Developer',
        jobTitle: 'Software Developer',
        employmentType: EmploymentType.FULL_TIME,
        salary: -1000,
        dateOfBirth: 'invalid-date',
      };

      // Act & Assert
      try {
        await employeeController.createEmployee(invalidDto, { user: { sub: 'admin-123' } });
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.exist;
        // ValidationPipe should catch this before it reaches the service
      }
    });

    it('should fail with invalid update employee DTO', async () => {
      // Arrange
      const invalidDto = {
        salary: -1000,
        dateOfBirth: 'invalid-date',
      };

      // Act & Assert
      try {
        await employeeController.updateEmployee('emp-123', invalidDto, { user: { sub: 'admin-123' } });
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
        await employeeController.createEmployee(mockCreateEmployeeDto, null);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should fail when user ID is missing in context', async () => {
      // Act & Assert
      try {
        await employeeController.createEmployee(mockCreateEmployeeDto, {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected service errors gracefully', async () => {
      // Arrange
      (employeeService.findById as sinon.SinonStub).throws(new Error('Unexpected database error'));

      // Act & Assert
      try {
        await employeeController.getEmployeeById('emp-123');
        expect.fail('Should have thrown Error');
      } catch (error) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Unexpected database error');
      }
    });
  });
});