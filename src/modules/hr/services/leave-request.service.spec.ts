import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { LeaveRequestService } from '../services/leave-request.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import {
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  LeaveRequestQueryDto,
  LeaveType,
  LeaveStatus,
  ApprovalLeaveRequestDto,
  RejectLeaveRequestDto,
  CancelLeaveRequestDto,
  LeaveRequestResponse,
  LeaveRequestQueryResponse,
  LeaveBalanceResponse,
  LeaveAnalyticsResponse,
} from '../dto/leave-request.dto';
import { NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let prismaStub: any;
  let securityStub: any;

  beforeEach(() => {
    prismaService = {
      leaveRequest: {
        create: stub(),
        findUnique: stub(),
        findMany: stub(),
        update: stub(),
        count: stub(),
        delete: stub(),
      },
      employee: {
        findUnique: stub(),
        findMany: stub(),
        update: stub(),
      },
      user: {
        findUnique: stub(),
        findMany: stub(),
      },
      $transaction: stub(),
    } as any;

    securityService = {
      validateInput: stub(),
      sanitizeInput: stub(),
    } as any;

    service = new LeaveRequestService(prismaService, securityService);

    // Create references for easier access to stubs
    prismaStub = prismaService;
    securityStub = securityService;
  });

  afterEach(() => {
    // Restore stubs - Sinon stubs have restore method
    (prismaService.leaveRequest.create as any).restore?.();
    (prismaService.leaveRequest.findUnique as any).restore?.();
    (prismaService.leaveRequest.findMany as any).restore?.();
    (prismaService.leaveRequest.update as any).restore?.();
    (prismaService.leaveRequest.count as any).restore?.();
    (prismaService.employee.findUnique as any).restore?.();
    (prismaService.user.findUnique as any).restore?.();
    (securityService.validateInput as any).restore?.();
    (securityService.sanitizeInput as any).restore?.();
  });

  describe('createLeaveRequest', () => {
    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidDto = { employeeId: '', leaveType: LeaveType.ANNUAL, startDate: new Date(), endDate: new Date() } as CreateLeaveRequestDto;
      securityStub.validateInput.returns(false);

      // Act & Assert
      try {
        await service.createLeaveRequest(invalidDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.equal('Invalid leave request data');
      }
    });

    it('should throw error if employee does not exist', async () => {
      // Arrange
      const validDto: CreateLeaveRequestDto = {
        employeeId: 'non-existent-employee',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        reason: 'Family vacation',
      };
      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.employee.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.createLeaveRequest(validDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Employee not found');
      }
    });

    it('should throw error if employee is inactive', async () => {
      // Arrange
      const validDto: CreateLeaveRequestDto = {
        employeeId: 'inactive-employee',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
      };

      const inactiveEmployee = {
        id: 'inactive-employee',
        isActive: false,
        annualLeaveBalance: 10,
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.employee.findUnique.resolves(inactiveEmployee);

      // Act & Assert
      try {
        await service.createLeaveRequest(validDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Employee is inactive');
      }
    });

    it('should throw error for invalid date range', async () => {
      // Arrange
      const invalidDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-15'), // End date before start date
      };

      const activeEmployee = {
        id: 'employee-123',
        isActive: true,
        annualLeaveBalance: 10,
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(invalidDto);
      prismaStub.employee.findUnique.resolves(activeEmployee);

      // Act & Assert
      try {
        await service.createLeaveRequest(invalidDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Invalid date range');
      }
    });

    it('should throw error for insufficient leave balance', async () => {
      // Arrange
      const validDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-25'), // 10 working days
      };

      const employeeWithLowBalance = {
        id: 'employee-123',
        isActive: true,
        annualLeaveBalance: 5, // Only 5 days available
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.employee.findUnique.resolves(employeeWithLowBalance);

      // Act & Assert
      try {
        await service.createLeaveRequest(validDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Insufficient leave balance');
      }
    });

    it('should create leave request successfully', async () => {
      // Arrange
      const validDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        reason: 'Family vacation',
        paidLeave: true,
      };

      const activeEmployee = {
        id: 'employee-123',
        isActive: true,
        annualLeaveBalance: 15,
        sickLeaveBalance: 10,
        personalLeaveBalance: 5,
      };

      const createdLeaveRequest = {
        id: 'leave-123',
        employeeId: 'employee-123',
        leaveType: 'ANNUAL',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        daysRequested: 5,
        reason: 'Family vacation',
        status: 'PENDING',
        paidLeave: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.employee.findUnique.resolves(activeEmployee);
      prismaStub.leaveRequest.create.resolves(createdLeaveRequest);

      // Act
      const result = await service.createLeaveRequest(validDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal('leave-123');
      expect(result.employeeId).to.equal('employee-123');
      expect(result.leaveType).to.equal(LeaveType.ANNUAL);
      expect(result.status).to.equal(LeaveStatus.PENDING);
      expect(result.daysRequested).to.equal(5);
      expect(result.paidLeave).to.be.true;

      // Verify method calls
      expect(securityStub.validateInput.calledOnce).to.be.true;
      expect(prismaStub.employee.findUnique.calledOnce).to.be.true;
      expect(prismaStub.leaveRequest.create.calledOnce).to.be.true;
    });

    it('should calculate days requested correctly including weekends', async () => {
      // Arrange
      const validDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'), // Monday
        endDate: new Date('2024-01-21'),   // Sunday (7 days)
        reason: 'Week vacation',
      };

      const activeEmployee = {
        id: 'employee-123',
        isActive: true,
        annualLeaveBalance: 10,
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      const createdLeaveRequest = {
        id: 'leave-123',
        employeeId: 'employee-123',
        leaveType: 'ANNUAL',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-21'),
        daysRequested: 7, // Should include weekends
        reason: 'Week vacation',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.employee.findUnique.resolves(activeEmployee);
      prismaStub.leaveRequest.create.resolves(createdLeaveRequest);

      // Act
      const result = await service.createLeaveRequest(validDto);

      // Assert
      expect(result.daysRequested).to.equal(7);
    });
  });

  describe('getLeaveRequests', () => {
    it('should return paginated leave requests', async () => {
      // Arrange
      const queryDto: LeaveRequestQueryDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        status: LeaveStatus.PENDING,
        skip: 0,
        take: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const mockLeaveRequests = [
        {
          id: 'leave-1',
          employeeId: 'employee-123',
          leaveType: 'ANNUAL',
          startDate: new Date(),
          endDate: new Date(),
          daysRequested: 5,
          reason: 'Vacation',
          status: 'PENDING',
          createdAt: new Date(),
          employee: {
            id: 'employee-123',
            firstName: 'John',
            lastName: 'Doe',
            employeeId: 'EMP001',
          },
        },
        {
          id: 'leave-2',
          employeeId: 'employee-123',
          leaveType: 'SICK',
          startDate: new Date(),
          endDate: new Date(),
          daysRequested: 2,
          reason: 'Flu',
          status: 'PENDING',
          createdAt: new Date(),
          employee: {
            id: 'employee-123',
            firstName: 'John',
            lastName: 'Doe',
            employeeId: 'EMP001',
          },
        },
      ];

      prismaStub.leaveRequest.findMany.resolves(mockLeaveRequests);
      prismaStub.leaveRequest.count.resolves(2);

      // Act
      const result = await service.getLeaveRequests(queryDto);

      // Assert
      expect(result.leaveRequests).to.have.length(2);
      expect(result.total).to.equal(2);
      expect(result.skip).to.equal(0);
      expect(result.take).to.equal(10);
      expect(result.leaveRequests[0].leaveType).to.equal(LeaveType.ANNUAL);
      expect(result.leaveRequests[0].status).to.equal(LeaveStatus.PENDING);
    });

    it('should filter by date range correctly', async () => {
      // Arrange
      const queryDto: LeaveRequestQueryDto = {
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-01-31'),
        skip: 0,
        take: 10,
      };

      const mockLeaveRequest = {
        id: 'leave-1',
        employeeId: 'employee-123',
        leaveType: 'ANNUAL',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        daysRequested: 5,
        status: 'PENDING',
        createdAt: new Date(),
      };

      prismaStub.leaveRequest.findMany.resolves([mockLeaveRequest]);
      prismaStub.leaveRequest.count.resolves(1);

      // Act
      const result = await service.getLeaveRequests(queryDto);

      // Assert
      expect(result.leaveRequests).to.have.length(1);
      expect(result.total).to.equal(1);
    });
  });

  describe('getLeaveRequestById', () => {
    it('should return leave request by ID', async () => {
      // Arrange
      const leaveRequestId = 'leave-123';
      const mockLeaveRequest = {
        id: leaveRequestId,
        employeeId: 'employee-123',
        leaveType: 'ANNUAL',
        startDate: new Date(),
        endDate: new Date(),
        daysRequested: 5,
        reason: 'Vacation',
        status: 'PENDING',
        createdAt: new Date(),
        employee: {
          id: 'employee-123',
          firstName: 'John',
          lastName: 'Doe',
          employeeId: 'EMP001',
        },
      };

      prismaStub.leaveRequest.findUnique.resolves(mockLeaveRequest);

      // Act
      const result = await service.getLeaveRequestById(leaveRequestId);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(leaveRequestId);
      expect(result.leaveType).to.equal(LeaveType.ANNUAL);
      expect(result.employee.firstName).to.equal('John');
    });

    it('should return null for non-existent leave request ID', async () => {
      // Arrange
      const nonExistentId = 'leave-non-existent';
      prismaStub.leaveRequest.findUnique.resolves(null);

      // Act
      const result = await service.getLeaveRequestById(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe('updateLeaveRequest', () => {
    it('should throw error if leave request does not exist', async () => {
      // Arrange
      const requestId = 'leave-non-existent';
      const updateDto: UpdateLeaveRequestDto = {
        reason: 'Updated reason',
      };

      prismaStub.leaveRequest.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.updateLeaveRequest(requestId, updateDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Leave request not found');
      }
    });

    it('should update leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const updateDto: UpdateLeaveRequestDto = {
        reason: 'Updated vacation reason',
        paidLeave: false,
      };

      const existingRequest = {
        id: requestId,
        employeeId: 'employee-123',
        leaveType: 'ANNUAL',
        status: 'PENDING',
        startDate: new Date(),
        endDate: new Date(),
      };

      const updatedRequest = {
        ...existingRequest,
        reason: 'Updated vacation reason',
        paidLeave: false,
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(updateDto);
      prismaStub.leaveRequest.findUnique.resolves(existingRequest);
      prismaStub.leaveRequest.update.resolves(updatedRequest);

      // Act
      const result = await service.updateLeaveRequest(requestId, updateDto);

      // Assert
      expect(result.reason).to.equal('Updated vacation reason');
      expect(result.paidLeave).to.be.false;
    });
  });

  describe('approveLeaveRequest', () => {
    it('should throw error if leave request does not exist', async () => {
      // Arrange
      const requestId = 'leave-non-existent';
      const approvalDto: ApprovalLeaveRequestDto = {
        approverId: 'manager-123',
        comments: 'Approved for vacation',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(approvalDto);
      prismaStub.leaveRequest.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.approveLeaveRequest(requestId, approvalDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Leave request not found');
      }
    });

    it('should throw error if leave request is not in PENDING status', async () => {
      // Arrange
      const requestId = 'leave-123';
      const approvalDto: ApprovalLeaveRequestDto = {
        approverId: 'manager-123',
        comments: 'Approved for vacation',
      };

      const approvedRequest = {
        id: requestId,
        status: 'APPROVED', // Already approved
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(approvalDto);
      prismaStub.leaveRequest.findUnique.resolves(approvedRequest);

      // Act & Assert
      try {
        await service.approveLeaveRequest(requestId, approvalDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Leave request is not in PENDING status');
      }
    });

    it('should approve leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const approvalDto: ApprovalLeaveRequestDto = {
        approverId: 'manager-123',
        comments: 'Approved for vacation',
      };

      const pendingRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: 'PENDING',
        startDate: new Date(),
        endDate: new Date(),
      };

      const approvedRequest = {
        ...pendingRequest,
        status: 'APPROVED',
        approvedBy: 'manager-123',
        approvedAt: new Date(),
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(approvalDto);
      prismaStub.leaveRequest.findUnique.resolves(pendingRequest);
      prismaStub.leaveRequest.update.resolves(approvedRequest);

      // Act
      const result = await service.approveLeaveRequest(requestId, approvalDto);

      // Assert
      expect(result.status).to.equal(LeaveStatus.APPROVED);
      expect(result.approvedBy).to.equal('manager-123');
      expect(result.approvedAt).to.not.be.null;
    });
  });

  describe('rejectLeaveRequest', () => {
    it('should throw error if leave request does not exist', async () => {
      // Arrange
      const requestId = 'leave-non-existent';
      const rejectionDto: RejectLeaveRequestDto = {
        rejectedBy: 'manager-123',
        rejectionReason: 'Insufficient notice',
        comments: 'Rejected due to short notice period',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(rejectionDto);
      prismaStub.leaveRequest.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.rejectLeaveRequest(requestId, rejectionDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Leave request not found');
      }
    });

    it('should reject leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const rejectionDto: RejectLeaveRequestDto = {
        rejectedBy: 'manager-123',
        rejectionReason: 'Insufficient notice',
        comments: 'Rejected due to short notice period',
      };

      const pendingRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: 'PENDING',
        startDate: new Date(),
        endDate: new Date(),
      };

      const rejectedRequest = {
        ...pendingRequest,
        status: 'REJECTED',
        rejectedBy: 'manager-123',
        rejectedAt: new Date(),
        rejectionReason: 'Insufficient notice',
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(rejectionDto);
      prismaStub.leaveRequest.findUnique.resolves(pendingRequest);
      prismaStub.leaveRequest.update.resolves(rejectedRequest);

      // Act
      const result = await service.rejectLeaveRequest(requestId, rejectionDto);

      // Assert
      expect(result.status).to.equal(LeaveStatus.REJECTED);
      expect(result.rejectedBy).to.equal('manager-123');
      expect(result.rejectionReason).to.equal('Insufficient notice');
      expect(result.rejectedAt).to.not.be.null;
    });
  });

  describe('cancelLeaveRequest', () => {
    it('should throw error if leave request does not exist', async () => {
      // Arrange
      const requestId = 'leave-non-existent';
      const cancelDto: CancelLeaveRequestDto = {
        cancelledBy: 'employee-123',
        reason: 'Changed plans',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(cancelDto);
      prismaStub.leaveRequest.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.cancelLeaveRequest(requestId, cancelDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Leave request not found');
      }
    });

    it('should throw error if leave request is already approved', async () => {
      // Arrange
      const requestId = 'leave-123';
      const cancelDto: CancelLeaveRequestDto = {
        cancelledBy: 'employee-123',
        reason: 'Changed plans',
      };

      const approvedRequest = {
        id: requestId,
        status: 'APPROVED',
        startDate: new Date(),
        endDate: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(cancelDto);
      prismaStub.leaveRequest.findUnique.resolves(approvedRequest);

      // Act & Assert
      try {
        await service.cancelLeaveRequest(requestId, cancelDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Cannot cancel approved or completed leave request');
      }
    });

    it('should cancel leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const cancelDto: CancelLeaveRequestDto = {
        cancelledBy: 'employee-123',
        reason: 'Changed plans',
      };

      const pendingRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: 'PENDING',
        startDate: new Date(),
        endDate: new Date(),
      };

      const cancelledRequest = {
        ...pendingRequest,
        status: 'CANCELLED',
        reason: 'Changed plans',
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(cancelDto);
      prismaStub.leaveRequest.findUnique.resolves(pendingRequest);
      prismaStub.leaveRequest.update.resolves(cancelledRequest);

      // Act
      const result = await service.cancelLeaveRequest(requestId, cancelDto);

      // Assert
      expect(result.status).to.equal(LeaveStatus.CANCELLED);
      expect(result.reason).to.equal('Changed plans');
    });
  });

  describe('getLeaveBalance', () => {
    it('should return leave balance for employee', async () => {
      // Arrange
      const employeeId = 'employee-123';

      const employee = {
        id: employeeId,
        isActive: true,
        annualLeaveBalance: 15.5,
        sickLeaveBalance: 10.0,
        personalLeaveBalance: 3.0,
      };

      prismaStub.employee.findUnique.resolves(employee);

      // Act
      const result = await service.getLeaveBalance(employeeId);

      // Assert
      expect(result).to.not.be.null;
      expect(result.employeeId).to.equal(employeeId);
      expect(result.annualLeaveBalance).to.equal(15.5);
      expect(result.sickLeaveBalance).to.equal(10.0);
      expect(result.personalLeaveBalance).to.equal(3.0);
    });

    it('should throw error if employee does not exist', async () => {
      // Arrange
      const employeeId = 'non-existent-employee';
      prismaStub.employee.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.getLeaveBalance(employeeId);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Employee not found');
      }
    });
  });

  describe('getLeaveAnalytics', () => {
    it('should return comprehensive leave analytics', async () => {
      // Arrange
      const mockLeaveRequests = [
        {
          id: 'leave-1',
          leaveType: 'ANNUAL',
          status: 'APPROVED',
          daysRequested: 5,
          startDate: new Date('2024-01-15'),
          employee: {
            department: {
              name: 'Engineering',
            },
          },
        },
        {
          id: 'leave-2',
          leaveType: 'SICK',
          status: 'APPROVED',
          daysRequested: 2,
          startDate: new Date('2024-01-10'),
          employee: {
            department: {
              name: 'Engineering',
            },
          },
        },
        {
          id: 'leave-3',
          leaveType: 'ANNUAL',
          status: 'PENDING',
          daysRequested: 3,
          startDate: new Date('2024-01-20'),
          employee: {
            department: {
              name: 'Sales',
            },
          },
        },
      ];

      prismaStub.leaveRequest.findMany.resolves(mockLeaveRequests);

      // Act
      const result = await service.getLeaveAnalytics({
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-01-31'),
      });

      // Assert
      expect(result).to.not.be.null;
      expect(result.totalLeaveRequests).to.equal(3);
      expect(result.approvedLeaveRequests).to.equal(2);
      expect(result.pendingLeaveRequests).to.equal(1);
      expect(result.totalLeaveDays).to.equal(10);
      expect(result.byLeaveType).to.have.property('ANNUAL');
      expect(result.byLeaveType).to.have.property('SICK');
      expect(result.byDepartment).to.have.property('Engineering');
      expect(result.byDepartment).to.have.property('Sales');
    });

    it('should handle empty analytics data gracefully', async () => {
      // Arrange
      prismaStub.leaveRequest.findMany.resolves([]);

      // Act
      const result = await service.getLeaveAnalytics({
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-01-31'),
      });

      // Assert
      expect(result).to.not.be.null;
      expect(result.totalLeaveRequests).to.equal(0);
      expect(result.approvedLeaveRequests).to.equal(0);
      expect(result.totalLeaveDays).to.equal(0);
      expect(Object.keys(result.byLeaveType).filter(key => (result.byLeaveType as any)[key].count > 0)).to.be.empty;
      expect(Object.keys(result.byDepartment).filter(key => (result.byDepartment as any)[key].count > 0)).to.be.empty;
    });
  });

  describe('validateLeaveBalance', () => {
    it('should return true for sufficient balance', () => {
      // Arrange
      const employee = {
        annualLeaveBalance: 10,
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      // Act
      const result = service['validateLeaveBalance'](employee, LeaveType.ANNUAL, 5);

      // Assert
      expect(result).to.be.true;
    });

    it('should return false for insufficient balance', () => {
      // Arrange
      const employee = {
        annualLeaveBalance: 3,
        sickLeaveBalance: 5,
        personalLeaveBalance: 2,
      };

      // Act
      const result = service['validateLeaveBalance'](employee, LeaveType.ANNUAL, 5);

      // Assert
      expect(result).to.be.false;
    });

    it('should return true for sick leave when using sick balance', () => {
      // Arrange
      const employee = {
        annualLeaveBalance: 1,
        sickLeaveBalance: 10,
        personalLeaveBalance: 2,
      };

      // Act
      const result = service['validateLeaveBalance'](employee, LeaveType.SICK, 5);

      // Assert
      expect(result).to.be.true;
    });
  });

  describe('calculateDaysRequested', () => {
    it('should calculate days correctly for same date', () => {
      // Arrange
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      // Act
      const days = service['calculateDaysRequested'](startDate, endDate);

      // Assert
      expect(days).to.equal(1);
    });

    it('should calculate days correctly for one week', () => {
      // Arrange
      const startDate = new Date('2024-01-15'); // Monday
      const endDate = new Date('2024-01-21');   // Sunday

      // Act
      const days = service['calculateDaysRequested'](startDate, endDate);

      // Assert
      expect(days).to.equal(7); // Includes weekend
    });

    it('should calculate days correctly for date range spanning multiple weeks', () => {
      // Arrange
      const startDate = new Date('2024-01-15'); // Monday
      const endDate = new Date('2024-01-28');   // Sunday (2 weeks)

      // Act
      const days = service['calculateDaysRequested'](startDate, endDate);

      // Assert
      expect(days).to.equal(14); // Includes all weekends
    });
  });
});