import { expect } from 'chai';
import { stub } from 'sinon';
import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequestService } from '../services/leave-request.service';
import {
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  LeaveRequestQueryDto,
  ApprovalLeaveRequestDto,
  RejectLeaveRequestDto,
  CancelLeaveRequestDto,
  LeaveAnalyticsQueryDto,
  LeaveType,
  LeaveStatus,
} from '../dto/leave-request.dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('LeaveRequestController', () => {
  let controller: LeaveRequestController;
  let leaveRequestService: LeaveRequestService;
  let leaveRequestServiceStub: any;
  
  beforeEach(() => {
    leaveRequestService = {
      createLeaveRequest: stub(),
      getLeaveRequests: stub(),
      getLeaveRequestById: stub(),
      updateLeaveRequest: stub(),
      approveLeaveRequest: stub(),
      rejectLeaveRequest: stub(),
      cancelLeaveRequest: stub(),
      getLeaveBalance: stub(),
      getLeaveAnalytics: stub(),
    } as any;

    controller = new LeaveRequestController(leaveRequestService);

    
    // Create references for easier access to stubs
    leaveRequestServiceStub = leaveRequestService;
  });

  afterEach(() => {
    // Restore stubs
    (leaveRequestService.createLeaveRequest as any).restore?.();
    (leaveRequestService.getLeaveRequests as any).restore?.();
    (leaveRequestService.getLeaveRequestById as any).restore?.();
    (leaveRequestService.updateLeaveRequest as any).restore?.();
    (leaveRequestService.approveLeaveRequest as any).restore?.();
    (leaveRequestService.rejectLeaveRequest as any).restore?.();
    (leaveRequestService.cancelLeaveRequest as any).restore?.();
    (leaveRequestService.getLeaveBalance as any).restore?.();
    (leaveRequestService.getLeaveAnalytics as any).restore?.();
  });

  describe('POST /leave-requests', () => {
    it('should create leave request successfully', async () => {
      // Arrange
      const createDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        reason: 'Family vacation',
        paidLeave: true,
      };

      const currentUser = {
        id: 'user-123',
        sub: 'user-123',
        email: 'user@example.com',
      };

      const createdLeaveRequest = {
        id: 'leave-123',
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        daysRequested: 5,
        reason: 'Family vacation',
        status: LeaveStatus.PENDING,
        paidLeave: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      leaveRequestServiceStub.createLeaveRequest.resolves(createdLeaveRequest);

      // Act
      const result = await controller.createLeaveRequest(createDto, { user: currentUser });

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal('leave-123');
      expect(result.employeeId).to.equal('employee-123');
      expect(result.leaveType).to.equal(LeaveType.ANNUAL);
      expect(result.status).to.equal(LeaveStatus.PENDING);
      expect(result.daysRequested).to.equal(5);
      expect(result.paidLeave).to.be.true;

      // Verify service was called correctly
      expect(leaveRequestServiceStub.createLeaveRequest.calledOnceWith(createDto)).to.be.true;
    });

    it('should handle NotFoundException from service', async () => {
      // Arrange
      const createDto: CreateLeaveRequestDto = {
        employeeId: 'non-existent-employee',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
      };

      const currentUser = {
        id: 'user-123',
        sub: 'user-123',
        email: 'user@example.com',
      };

      const error = new NotFoundException('Employee not found');
      leaveRequestServiceStub.createLeaveRequest.rejects(error);

      // Act & Assert
      try {
        await controller.createLeaveRequest(createDto, { user: currentUser });
        expect.fail('Should have thrown NotFoundException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(NotFoundException);
        expect((err as NotFoundException).message).to.include('Employee not found');
      }
    });

    it('should handle BadRequestException from service', async () => {
      // Arrange
      const createDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date('2024-01-20'),
        endDate: new Date('2024-01-15'), // Invalid date range
      };

      const currentUser = {
        id: 'user-123',
        sub: 'user-123',
        email: 'user@example.com',
      };

      const error = new BadRequestException('Invalid date range');
      leaveRequestServiceStub.createLeaveRequest.rejects(error);

      // Act & Assert
      try {
        await controller.createLeaveRequest(createDto, { user: currentUser });
        expect.fail('Should have thrown BadRequestException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect((err as Error).message).to.include('End date must be after start date');
      }
    });
  });

  describe('GET /leave-requests', () => {
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
          leaveType: LeaveType.ANNUAL,
          startDate: new Date(),
          endDate: new Date(),
          daysRequested: 5,
          status: LeaveStatus.PENDING,
        },
        {
          id: 'leave-2',
          employeeId: 'employee-123',
          leaveType: LeaveType.SICK,
          startDate: new Date(),
          endDate: new Date(),
          daysRequested: 2,
          status: LeaveStatus.PENDING,
        },
      ];

      const serviceResponse = {
        leaveRequests: mockLeaveRequests,
        total: 2,
        skip: 0,
        take: 10,
      };

      leaveRequestServiceStub.getLeaveRequests.resolves(serviceResponse);

      // Act
      const result = await controller.getLeaveRequests(queryDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.leaveRequests).to.have.length(2);
      expect(result.total).to.equal(2);
      expect(result.skip).to.equal(0);
      expect(result.take).to.equal(10);
      expect(result.leaveRequests[0].status).to.equal(LeaveStatus.PENDING);

      // Verify service was called correctly
      expect(leaveRequestServiceStub.getLeaveRequests.calledOnceWith(queryDto)).to.be.true;
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const queryDto: LeaveRequestQueryDto = {
        skip: 0,
        take: 10,
      };

      const error = new Error('Database connection failed');
      leaveRequestServiceStub.getLeaveRequests.rejects(error);

      // Act & Assert
      try {
        await controller.getLeaveRequests(queryDto);
        expect.fail('Should have thrown error');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('Database connection failed');
      }
    });
  });

  describe('GET /leave-requests/:id', () => {
    it('should return leave request by ID', async () => {
      // Arrange
      const leaveRequestId = 'leave-123';
      const mockLeaveRequest = {
        id: leaveRequestId,
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date(),
        endDate: new Date(),
        daysRequested: 5,
        status: LeaveStatus.PENDING,
        employee: {
          id: 'employee-123',
          firstName: 'John',
          lastName: 'Doe',
          employeeId: 'EMP001',
        },
      };

      leaveRequestServiceStub.getLeaveRequestById.resolves(mockLeaveRequest);

      // Act
      const result = await controller.getLeaveRequestById(leaveRequestId);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(leaveRequestId);
      expect(result.employeeId).to.equal('employee-123');
      expect(result.leaveType).to.equal(LeaveType.ANNUAL);
      expect(result.employee?.firstName).to.equal('John');

      // Verify service was called correctly
      expect(leaveRequestServiceStub.getLeaveRequestById.calledOnceWith(leaveRequestId)).to.be.true;
    });

    it('should return 404 when leave request not found', async () => {
      // Arrange
      const nonExistentId = 'leave-non-existent';
      leaveRequestServiceStub.getLeaveRequestById.resolves(null);

      // Act & Assert
      try {
        await controller.getLeaveRequestById(nonExistentId);
        expect.fail('Should have thrown NotFoundException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(NotFoundException);
        expect((err as Error).message).to.include('Leave request not found');
      }
    });
  });

  describe('PUT /leave-requests/:id', () => {
    it('should update leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const updateDto: UpdateLeaveRequestDto = {
        reason: 'Updated vacation reason',
        paidLeave: false,
      };

      const updatedLeaveRequest = {
        id: requestId,
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        reason: 'Updated vacation reason',
        paidLeave: false,
        daysRequested: 5,
        status: LeaveStatus.PENDING,
        updatedAt: new Date(),
      };

      leaveRequestServiceStub.updateLeaveRequest.resolves(updatedLeaveRequest);

      // Act
      const result = await controller.updateLeaveRequest(requestId, updateDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(requestId);
      expect(result.reason).to.equal('Updated vacation reason');
      expect(result.paidLeave).to.be.false;

      // Verify service was called correctly
      expect(leaveRequestServiceStub.updateLeaveRequest.calledOnceWith(requestId, updateDto)).to.be.true;
    });

    it('should handle NotFoundException when updating non-existent request', async () => {
      // Arrange
      const requestId = 'leave-non-existent';
      const updateDto: UpdateLeaveRequestDto = {
        reason: 'Updated reason',
      };

      const error = new NotFoundException('Leave request not found');
      leaveRequestServiceStub.updateLeaveRequest.rejects(error);

      // Act & Assert
      try {
        await controller.updateLeaveRequest(requestId, updateDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(NotFoundException);
        expect((err as Error).message).to.include('Leave request not found');
      }
    });
  });

  describe('POST /leave-requests/:id/approve', () => {
    it('should approve leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const approvalDto: ApprovalLeaveRequestDto = {
        approverId: 'manager-123',
        comments: 'Approved for vacation',
      };

      const approvedLeaveRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: LeaveStatus.APPROVED,
        approvedBy: 'manager-123',
        approvedAt: new Date(),
        daysRequested: 5,
      };

      leaveRequestServiceStub.approveLeaveRequest.resolves(approvedLeaveRequest);

      // Act
      const result = await controller.approveLeaveRequest(requestId, approvalDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(requestId);
      expect(result.status).to.equal(LeaveStatus.APPROVED);
      expect(result.approvedBy).to.equal('manager-123');
      expect(result.approvedAt).to.not.be.null;

      // Verify service was called correctly
      expect(leaveRequestServiceStub.approveLeaveRequest.calledOnceWith(requestId, approvalDto)).to.be.true;
    });

    it('should handle BadRequestException when approving non-pending request', async () => {
      // Arrange
      const requestId = 'leave-123';
      const approvalDto: ApprovalLeaveRequestDto = {
        approverId: 'manager-123',
      };

      const error = new BadRequestException('Leave request is not in PENDING status');
      leaveRequestServiceStub.approveLeaveRequest.rejects(error);

      // Act & Assert
      try {
        await controller.approveLeaveRequest(requestId, approvalDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect((err as Error).message).to.include('Leave request is not in PENDING status');
      }
    });
  });

  describe('POST /leave-requests/:id/reject', () => {
    it('should reject leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const rejectionDto: RejectLeaveRequestDto = {
        rejectedBy: 'manager-123',
        rejectionReason: 'Insufficient notice',
        comments: 'Rejected due to short notice period',
      };

      const rejectedLeaveRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: LeaveStatus.REJECTED,
        rejectedBy: 'manager-123',
        rejectedAt: new Date(),
        rejectionReason: 'Insufficient notice',
        daysRequested: 5,
      };

      leaveRequestServiceStub.rejectLeaveRequest.resolves(rejectedLeaveRequest);

      // Act
      const result = await controller.rejectLeaveRequest(requestId, rejectionDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(requestId);
      expect(result.status).to.equal(LeaveStatus.REJECTED);
      expect(result.rejectedBy).to.equal('manager-123');
      expect(result.rejectionReason).to.equal('Insufficient notice');

      // Verify service was called correctly
      expect(leaveRequestServiceStub.rejectLeaveRequest.calledOnceWith(requestId, rejectionDto)).to.be.true;
    });
  });

  describe('POST /leave-requests/:id/cancel', () => {
    it('should cancel leave request successfully', async () => {
      // Arrange
      const requestId = 'leave-123';
      const cancelDto: CancelLeaveRequestDto = {
        cancelledBy: 'employee-123',
        reason: 'Changed plans',
      };

      const cancelledLeaveRequest = {
        id: requestId,
        employeeId: 'employee-123',
        status: LeaveStatus.CANCELLED,
        reason: 'Changed plans',
        daysRequested: 5,
        updatedAt: new Date(),
      };

      leaveRequestServiceStub.cancelLeaveRequest.resolves(cancelledLeaveRequest);

      // Act
      const result = await controller.cancelLeaveRequest(requestId, cancelDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(requestId);
      expect(result.status).to.equal(LeaveStatus.CANCELLED);
      expect(result.reason).to.equal('Changed plans');

      // Verify service was called correctly
      expect(leaveRequestServiceStub.cancelLeaveRequest.calledOnceWith(requestId, cancelDto)).to.be.true;
    });

    it('should handle BadRequestException when cancelling approved request', async () => {
      // Arrange
      const requestId = 'leave-123';
      const cancelDto: CancelLeaveRequestDto = {
        cancelledBy: 'employee-123',
      };

      const error = new BadRequestException('Cannot cancel approved leave request');
      leaveRequestServiceStub.cancelLeaveRequest.rejects(error);

      // Act & Assert
      try {
        await controller.cancelLeaveRequest(requestId, cancelDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(BadRequestException);
        expect((err as Error).message).to.include('Cannot cancel approved leave request');
      }
    });
  });

  describe('GET /leave-requests/:id/balance', () => {
    it('should return leave balance for employee', async () => {
      // Arrange
      const employeeId = 'employee-123';
      const mockBalance = {
        employeeId: employeeId,
        annualLeaveBalance: 15.5,
        sickLeaveBalance: 10.0,
        personalLeaveBalance: 3.0,
        lastUpdated: new Date(),
      };

      leaveRequestServiceStub.getLeaveBalance.resolves(mockBalance);

      // Act
      const result = await controller.getLeaveBalance(employeeId);

      // Assert
      expect(result).to.not.be.null;
      expect(result.employeeId).to.equal(employeeId);
      expect(result.annualLeaveBalance).to.equal(15.5);
      expect(result.sickLeaveBalance).to.equal(10.0);
      expect(result.personalLeaveBalance).to.equal(3.0);

      // Verify service was called correctly
      expect(leaveRequestServiceStub.getLeaveBalance.calledOnceWith(employeeId)).to.be.true;
    });

    it('should handle NotFoundException when employee not found', async () => {
      // Arrange
      const employeeId = 'non-existent-employee';
      const error = new NotFoundException('Employee not found');
      leaveRequestServiceStub.getLeaveBalance.rejects(error);

      // Act & Assert
      try {
        await controller.getLeaveBalance(employeeId);
        expect.fail('Should have thrown NotFoundException');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(NotFoundException);
        expect((err as Error).message).to.include('Employee not found');
      }
    });
  });

  describe('GET /leave-requests/analytics', () => {
    it('should return leave analytics', async () => {
      // Arrange
      const queryDto: LeaveAnalyticsQueryDto = {
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-01-31'),
        departmentId: 'dept-123',
      };

      const mockAnalytics = {
        totalLeaveRequests: 25,
        approvedLeaveRequests: 20,
        pendingLeaveRequests: 3,
        rejectedLeaveRequests: 2,
        cancelledLeaveRequests: 0,
        totalLeaveDays: 120,
        averageLeaveDuration: 4.8,
        byLeaveType: {
          [LeaveType.ANNUAL]: { count: 15, days: 80, percentage: 60 },
          [LeaveType.SICK]: { count: 10, days: 40, percentage: 40 },
        },
        byDepartment: {
          'Engineering': { count: 15, days: 70, percentage: 60 },
          'Sales': { count: 10, days: 50, percentage: 40 },
        },
        byStatus: {
          [LeaveStatus.APPROVED]: 20,
          [LeaveStatus.PENDING]: 3,
          [LeaveStatus.REJECTED]: 2,
          [LeaveStatus.CANCELLED]: 0,
        },
        monthlyTrends: [],
      };

      leaveRequestServiceStub.getLeaveAnalytics.resolves(mockAnalytics);

      // Act
      const result = await controller.getLeaveAnalytics(queryDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.totalLeaveRequests).to.equal(25);
      expect(result.approvedLeaveRequests).to.equal(20);
      expect(result.totalLeaveDays).to.equal(120);
      expect(result.averageLeaveDuration).to.equal(4.8);
      expect(result.byLeaveType[LeaveType.ANNUAL].count).to.equal(15);

      // Verify service was called correctly
      expect(leaveRequestServiceStub.getLeaveAnalytics.calledOnceWith(queryDto)).to.be.true;
    });

    it('should handle analytics service errors gracefully', async () => {
      // Arrange
      const queryDto: LeaveAnalyticsQueryDto = {
        startDateFrom: new Date('2024-01-01'),
        startDateTo: new Date('2024-01-31'),
      };

      const error = new Error('Analytics generation failed');
      leaveRequestServiceStub.getLeaveAnalytics.rejects(error);

      // Act & Assert
      try {
        await controller.getLeaveAnalytics(queryDto);
        expect.fail('Should have thrown error');
      } catch (err: unknown) {
        expect((err as Error).message).to.include('Analytics generation failed');
      }
    });
  });

  describe('Input Validation', () => {
    it('should handle validation errors from DTO', async () => {
      // Arrange
      const invalidDto = {
        employeeId: 'employee-123', // Valid
        leaveType: 'INVALID_TYPE', // Invalid enum value
        startDate: new Date('2024-01-15'), // Valid date
        endDate: new Date('2024-01-19'), // Valid date
      } as any;

      const currentUser = {
        id: 'user-123',
        sub: 'user-123',
      };

      // Act & Assert
      try {
        await controller.createLeaveRequest(invalidDto, { user: currentUser });
        expect.fail('Should have thrown validation error');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });

    it('should handle invalid query parameters', async () => {
      // Arrange
      const invalidQuery = {
        skip: -1, // Invalid negative value
        take: 1000, // Invalid too large value
        sortBy: 'invalid-field',
        sortOrder: 'invalid-order',
      } as any;

      // Act & Assert
      try {
        await controller.getLeaveRequests(invalidQuery);
        expect.fail('Should have thrown validation error');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(BadRequestException);
      }
    });
  });

  describe('Security and Authorization', () => {
    it('should handle missing user context', async () => {
      // Arrange
      const createDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date(),
        endDate: new Date(),
      };

      const invalidUser = null as any;

      // Act & Assert
      try {
        await controller.createLeaveRequest(createDto, invalidUser);
        expect.fail('Should have thrown error for missing user context');
      } catch (err: unknown) {
        // This should be a TypeError because invalidUser is null and we try to access req.user
        expect((err as Error).message).to.include('Cannot read properties of null');
      }
    });

    it('should handle invalid user ID format', async () => {
      // Arrange
      const createDto: CreateLeaveRequestDto = {
        employeeId: 'employee-123',
        leaveType: LeaveType.ANNUAL,
        startDate: new Date(),
        endDate: new Date(),
      };

      const invalidUser = {
        id: '',
        sub: undefined,
        email: 'user@example.com',
      } as any;

      // Act & Assert
      try {
        await controller.createLeaveRequest(createDto, { user: invalidUser });
        expect.fail('Should have thrown error for invalid user ID');
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(ForbiddenException);
        expect((err as Error).message).to.include('User sub claim is required');
      }
    });
  });
});