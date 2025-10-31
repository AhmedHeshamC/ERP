import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { LeaveRequest, Employee } from '@prisma/client';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async create(createLeaveData: any, createdBy: string): Promise<LeaveRequest> {
    // Input validation and security
    const sanitizedData = this.securityService.sanitizeInput(createLeaveData);

    // Validate employee exists and is active
    const employee = await this.prismaService.employee.findUnique({
      where: { id: sanitizedData.employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive || employee.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create leave request for inactive employee');
    }

    // Validate leave type
    const validLeaveTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
    if (!validLeaveTypes.includes(sanitizedData.leaveType)) {
      throw new BadRequestException('Invalid leave type');
    }

    // Validate dates
    const startDate = new Date(sanitizedData.startDate);
    const endDate = new Date(sanitizedData.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (startDate < today) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Calculate days requested
    const daysRequested = sanitizedData.daysRequested ||
                         this.securityService.calculateLeaveDays(startDate, endDate);

    // Validate leave balance
    if (!this.securityService.validateLeaveBalance(employee, sanitizedData.leaveType, daysRequested)) {
      throw new BadRequestException('Insufficient leave balance');
    }

    // Check for conflicts with existing leave
    const conflicts = await this.securityService.checkLeaveConflicts(
      employee.id,
      startDate,
      endDate
    );
    if (conflicts.length > 0) {
      throw new ConflictException('Leave dates conflict with existing leave request');
    }

    // Validate leave request
    if (!this.securityService.validateLeaveRequest(sanitizedData)) {
      throw new BadRequestException('Invalid leave request');
    }

    // Create leave request
    const leaveRequest = await this.prismaService.leaveRequest.create({
      data: {
        ...sanitizedData,
        startDate,
        endDate,
        daysRequested,
        status: 'PENDING',
        paidLeave: sanitizedData.paidLeave !== false, // Default to true
        createdBy,
      },
    });

    return leaveRequest;
  }

  async approve(leaveRequestId: string, approvedBy: string, comments?: string): Promise<LeaveRequest> {
    const leaveRequest = await this.prismaService.leaveRequest.findUnique({
      where: { id: leaveRequestId },
      include: { employee: true },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status === 'APPROVED') {
      throw new BadRequestException('Leave request is already approved');
    }

    if (leaveRequest.status === 'REJECTED') {
      throw new BadRequestException('Cannot approve rejected leave request');
    }

    // Validate authorization (simplified - in real app, check user roles)
    if (approvedBy === leaveRequest.employeeId) {
      throw new BadRequestException('Cannot approve own leave request');
    }

    // Validate leave balance again (in case it changed since request)
    const employee = leaveRequest.employee;
    if (!this.securityService.validateLeaveBalance(employee, leaveRequest.leaveType, Number(leaveRequest.daysRequested))) {
      throw new BadRequestException('Insufficient leave balance');
    }

    // Update leave request status
    const approvedLeave = await this.prismaService.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    // Update employee leave balance (this would typically be done after leave is completed)
    // For now, we'll update it immediately upon approval
    await this.updateEmployeeLeaveBalance(employee, leaveRequest);

    return approvedLeave;
  }

  async reject(leaveRequestId: string, rejectedBy: string, rejectionReason: string): Promise<LeaveRequest> {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    const leaveRequest = await this.prismaService.leaveRequest.findUnique({
      where: { id: leaveRequestId },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status === 'REJECTED') {
      throw new BadRequestException('Leave request is already rejected');
    }

    if (leaveRequest.status === 'APPROVED') {
      throw new BadRequestException('Cannot reject approved leave request');
    }

    // Validate authorization
    if (rejectedBy === leaveRequest.employeeId) {
      throw new BadRequestException('Cannot reject own leave request');
    }

    const rejectedLeave = await this.prismaService.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason,
      },
    });

    return rejectedLeave;
  }

  async cancel(leaveRequestId: string, cancelledBy: string): Promise<LeaveRequest> {
    const leaveRequest = await this.prismaService.leaveRequest.findUnique({
      where: { id: leaveRequestId },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status === 'APPROVED') {
      throw new BadRequestException('Cannot cancel approved leave request');
    }

    // Only the employee who created the request can cancel it
    if (leaveRequest.employeeId !== cancelledBy) {
      throw new BadRequestException('Cannot cancel leave request owned by another employee');
    }

    const cancelledLeave = await this.prismaService.leaveRequest.update({
      where: { id: leaveRequestId },
      data: {
        status: 'CANCELLED',
        updatedBy: cancelledBy,
        updatedAt: new Date(),
      },
    });

    return cancelledLeave;
  }

  async findById(id: string): Promise<LeaveRequest> {
    const leaveRequest = await this.prismaService.leaveRequest.findUnique({
      where: { id },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    return leaveRequest;
  }

  async findByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prismaService.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(filters: any = {}): Promise<{ leaveRequests: LeaveRequest[]; total: number }> {
    // Validate leave type if provided
    if (filters.leaveType) {
      const validTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
      if (!validTypes.includes(filters.leaveType)) {
        throw new BadRequestException('Invalid leave type');
      }
    }

    // Validate date range if provided
    if (filters.startDate && filters.endDate) {
      const fromDate = new Date(filters.startDate);
      const toDate = new Date(filters.endDate);
      if (fromDate > toDate) {
        throw new BadRequestException('Invalid date range: Start date must be before end date');
      }
    }

    const skip = filters.skip || 0;
    const take = Math.min(filters.take || 10, 100);
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    // Build where clause
    const where: any = {};

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.leaveType) {
      where.leaveType = filters.leaveType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.startDate = {};
      if (filters.startDate) {
        where.startDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.startDate.lte = new Date(filters.endDate);
      }
    }

    const [leaveRequests, total] = await Promise.all([
      this.prismaService.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prismaService.leaveRequest.count({ where }),
    ]);

    return {
      leaveRequests,
      total,
    };
  }

  async updateLeaveBalance(employeeId: string, updateData: any, updatedBy: string): Promise<Employee> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Validate balances are not negative
    if (updateData.annualLeaveBalance !== undefined && updateData.annualLeaveBalance < 0) {
      throw new BadRequestException('Leave balance cannot be negative');
    }
    if (updateData.sickLeaveBalance !== undefined && updateData.sickLeaveBalance < 0) {
      throw new BadRequestException('Leave balance cannot be negative');
    }
    if (updateData.personalLeaveBalance !== undefined && updateData.personalLeaveBalance < 0) {
      throw new BadRequestException('Leave balance cannot be negative');
    }

    // Validate maximum reasonable limits
    const maxDays = 365;
    if (updateData.annualLeaveBalance > maxDays) {
      throw new BadRequestException('Leave balance exceeds maximum allowed');
    }

    const updatedEmployee = await this.prismaService.employee.update({
      where: { id: employeeId },
      data: {
        ...updateData,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    return updatedEmployee;
  }

  async getLeaveSummary(employeeId?: string): Promise<any> {
    const where = employeeId ? { employeeId } : {};

    const [total, byStatus, byType, pendingCount] = await Promise.all([
      this.prismaService.leaveRequest.count({ where }),
      this.prismaService.leaveRequest.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prismaService.leaveRequest.groupBy({
        by: ['leaveType'],
        where,
        _count: true,
      }),
      this.prismaService.leaveRequest.count({
        where: { ...where, status: 'PENDING' },
      }),
    ]);

    return {
      total,
      pendingApproval: pendingCount,
      statusBreakdown: byStatus,
      typeBreakdown: byType,
    };
  }

  private async updateEmployeeLeaveBalance(employee: Employee, leaveRequest: LeaveRequest): Promise<void> {
    // Only update balance for paid leave
    if (!leaveRequest.paidLeave) return;

    const updateData: any = {};

    switch (leaveRequest.leaveType) {
      case 'ANNUAL':
        updateData.annualLeaveBalance = {
          decrement: leaveRequest.daysRequested,
        };
        break;
      case 'SICK':
        updateData.sickLeaveBalance = {
          decrement: leaveRequest.daysRequested,
        };
        break;
      case 'PERSONAL':
        updateData.personalLeaveBalance = {
          decrement: leaveRequest.daysRequested,
        };
        break;
      // Maternity, Paternity, and Unpaid don't affect balance
    }

    if (Object.keys(updateData).length > 0) {
      await this.prismaService.employee.update({
        where: { id: employee.id },
        data: updateData,
      });
    }
  }
}