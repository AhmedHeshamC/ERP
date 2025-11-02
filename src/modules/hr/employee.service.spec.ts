import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import * as sinon from 'sinon';
import { EmployeeService } from './services/employee.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('Employee Service - Unit Tests', () => {
  let employeeService: EmployeeService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let cacheService: any;

  // Mock data
  const mockEmployee = {
    id: 'emp-123',
    employeeId: 'EMP001',
    userId: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1-555-0123',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'USA',
    dateOfBirth: new Date('1990-01-15'),
    hireDate: new Date('2023-01-01'),
    departmentId: 'dept-123',
    position: 'Software Developer',
    jobTitle: 'Senior Software Developer',
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
    salary: 75000,
    currency: 'USD',
    isActive: true,
    performanceRating: null,
    lastReviewDate: null,
    nextReviewDate: null,
    annualLeaveBalance: 20,
    sickLeaveBalance: 10,
    personalLeaveBalance: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-123',
    updatedBy: null,
    terminatedAt: null,
    terminationReason: null,
    workSchedule: null,
    emergencyContact: null,
    socialSecurity: null,
    taxId: null,
    bankAccount: null,
  };

  const mockDepartment = {
    id: 'dept-123',
    code: 'TECH',
    name: 'Technology',
    description: 'Technology Department',
    parentId: null,
    managerId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin-123',
    updatedBy: null,
  };

  const mockUser = {
    id: 'user-123',
    email: 'john.doe@company.com',
    username: 'johndoe',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1-555-0123',
    avatar: null,
    role: 'USER',
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  beforeEach(() => {
    prismaService = {
      employee: {
        create: sinon.stub(),
        findMany: sinon.stub(),
        findUnique: sinon.stub(),
        update: sinon.stub(),
        findFirst: sinon.stub(),
        count: sinon.stub(),
        groupBy: sinon.stub(),
      },
      department: {
        findUnique: sinon.stub(),
      },
      user: {
        findUnique: sinon.stub(),
        create: sinon.stub(),
      },
      $transaction: sinon.stub(),
    } as any;

    securityService = {
      sanitizeInput: sinon.stub().callsFake((input) => input),
      generateEmployeeId: sinon.stub().returns('EMP001'),
      validatePersonalInfo: sinon.stub().returns(true),
    } as any;

    cacheService = {
      get: sinon.stub(),
      set: sinon.stub(),
      del: sinon.stub(),
      getStats: sinon.stub().returns({ hitRate: 85, totalRequests: 1000 }),
    } as any;

    employeeService = new EmployeeService(prismaService, securityService, cacheService);
  });

  describe('Employee Creation', () => {
    it('should fail to create employee when service does not exist', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'FULL_TIME' as const,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('User not found');
      }
    });

    it('should fail to create employee when department does not exist', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'FULL_TIME' as const,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(mockUser);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Department not found');
      }
    });

    it('should fail to create employee when employee already exists for user', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'FULL_TIME' as const,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(mockUser);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(mockDepartment);
      (prismaService.employee.findFirst as sinon.SinonStub).resolves(mockEmployee);

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown ConflictException');
      } catch (error) {
        expect(error).to.be.instanceOf(ConflictException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee already exists');
      }
    });

    it('should fail to create employee with invalid employment type', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'INVALID_TYPE' as any,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(mockUser);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(mockDepartment);

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid employment type');
      }
    });
  });

  describe('Employee Retrieval', () => {
    it('should fail to find non-existent employee by ID', async () => {
      // Arrange
      const employeeId = 'non-existent';
      (prismaService.employee.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.findById(employeeId);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to find non-existent employee by employee number', async () => {
      // Arrange
      const employeeNumber = 'EMP999';
      (prismaService.employee.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.findByEmployeeId(employeeNumber);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to find employees in non-existent department', async () => {
      // Arrange
      const departmentId = 'non-existent-dept';
      const filters = { departmentId };

      (prismaService.department.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.findAll(filters);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Department not found');
      }
    });
  });

  describe('Employee Update', () => {
    it('should fail to update non-existent employee', async () => {
      // Arrange
      const employeeId = 'non-existent';
      const updateEmployeeDto = {
        firstName: 'Updated Name',
        salary: 80000,
      };

      (prismaService.employee.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.update(employeeId, updateEmployeeDto, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to transfer employee to non-existent department', async () => {
      // Arrange
      const employeeId = 'emp-123';
      const updateEmployeeDto = {
        departmentId: 'non-existent-dept',
      };

      (prismaService.employee.findUnique as sinon.SinonStub).resolves(mockEmployee);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.update(employeeId, updateEmployeeDto, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Department not found');
      }
    });

    it('should fail to update with invalid salary', async () => {
      // Arrange
      const employeeId = 'emp-123';
      const updateEmployeeDto = {
        salary: -1000,
      };

      (prismaService.employee.findUnique as sinon.SinonStub).resolves(mockEmployee);

      // Act & Assert
      try {
        await employeeService.update(employeeId, updateEmployeeDto, 'admin-123');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Salary must be positive');
      }
    });
  });

  describe('Employee Deletion', () => {
    it('should fail to delete non-existent employee', async () => {
      // Arrange
      const employeeId = 'non-existent';
      (prismaService.employee.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.softDelete(employeeId, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to terminate already terminated employee', async () => {
      // Arrange
      const terminatedEmployee = {
        ...mockEmployee,
        status: 'TERMINATED',
        terminatedAt: new Date(),
        terminationReason: 'Resigned',
      };

      (prismaService.employee.findUnique as sinon.SinonStub).resolves(terminatedEmployee);

      // Act & Assert
      try {
        await employeeService.softDelete('emp-123', 'admin-123');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee is already terminated');
      }
    });
  });

  describe('Employee Status Management', () => {
    it('should fail to activate non-existent employee', async () => {
      // Arrange
      const employeeId = 'non-existent';
      (prismaService.employee.findUnique as sinon.SinonStub).resolves(null);

      // Act & Assert
      try {
        await employeeService.activate(employeeId, 'admin-123');
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee not found');
      }
    });

    it('should fail to deactivate already inactive employee', async () => {
      // Arrange
      const inactiveEmployee = {
        ...mockEmployee,
        isActive: false,
      };

      (prismaService.employee.findUnique as sinon.SinonStub).resolves(inactiveEmployee);

      // Act & Assert
      try {
        await employeeService.deactivate('emp-123', 'admin-123');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Employee is already inactive');
      }
    });
  });

  describe('Employee Search and Filtering', () => {
    it('should fail search with invalid date range', async () => {
      // Arrange
      const filters = {
        hireDateFrom: '2024-01-01',
        hireDateTo: '2023-01-01', // Before from date
      };

      // Act & Assert
      try {
        await employeeService.findAll(filters);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid date range');
      }
    });

    it('should fail with invalid employment type filter', async () => {
      // Arrange
      const filters = {
        employmentType: 'INVALID_TYPE' as any,
      };

      // Act & Assert
      try {
        await employeeService.findAll(filters);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid employment type');
      }
    });
  });

  describe('Security and Validation', () => {
    it('should fail when personal info validation fails', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'FULL_TIME' as const,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(mockUser);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(mockDepartment);
      (securityService.validatePersonalInfo as sinon.SinonStub).returns(false);

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error instanceof Error ? error.message : "Unknown error").to.include('Invalid personal information');
      }
    });

    it('should fail with XSS attempt in employee data', async () => {
      // Arrange
      const createEmployeeDto = {
        userId: 'user-123',
        firstName: '<script>alert("xss")</script>',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        departmentId: 'dept-123',
        position: 'Software Developer',
        jobTitle: 'Senior Software Developer',
        employmentType: 'FULL_TIME' as const,
        salary: 75000,
        dateOfBirth: '1990-01-15',
      };

      (prismaService.user.findUnique as sinon.SinonStub).resolves(mockUser);
      (prismaService.department.findUnique as sinon.SinonStub).resolves(mockDepartment);
      (securityService.sanitizeInput as sinon.SinonStub).throws(new Error('XSS detected'));

      // Act & Assert
      try {
        await employeeService.create(createEmployeeDto, 'admin-123');
        expect.fail('Should have thrown Error');
      } catch (error) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('XSS detected');
      }
    });
  });
});