import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException, Logger } from '@nestjs/common';
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
  LeaveAnalyticsQueryDto,
  LeaveRequestResponse,
  LeaveRequestQueryResponse,
  LeaveBalanceResponse,
  LeaveAnalyticsResponse,
} from '../dto/leave-request.dto';

/**
 * Leave balance configuration
 */
const LEAVE_BALANCE_LIMITS = {
  [LeaveType.ANNUAL]: { maxDays: 365, requiresApproval: true },
  [LeaveType.SICK]: { maxDays: 90, requiresApproval: false },
  [LeaveType.PERSONAL]: { maxDays: 30, requiresApproval: true },
  [LeaveType.MATERNITY]: { maxDays: 180, requiresApproval: true },
  [LeaveType.PATERNITY]: { maxDays: 30, requiresApproval: true },
  [LeaveType.UNPAID]: { maxDays: 365, requiresApproval: true },
};

/**
 * Enterprise Leave Request Service
 * Implements SOLID principles with single responsibility for leave request management
 * Follows KISS principle with clean, focused implementation
 * Comprehensive leave management system with balance validation and approval workflows
 * OWASP security compliance with input validation and audit trails
 */
@Injectable()
export class LeaveRequestService {
  private readonly logger = new Logger(LeaveRequestService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new leave request with comprehensive validation
   * Follows OWASP A01, A03, A07 security requirements
   */
  async createLeaveRequest(createLeaveRequestDto: CreateLeaveRequestDto): Promise<LeaveRequestResponse> {
    try {
      this.logger.log(`Creating leave request for employee: ${createLeaveRequestDto.employeeId}`);

      // Input validation and sanitization (OWASP A03)
      if (!this.securityService.validateInput(createLeaveRequestDto)) {
        this.logger.warn(`Invalid input data for leave request creation: ${createLeaveRequestDto.employeeId}`);
        throw new BadRequestException('Invalid leave request data');
      }

      const sanitizedData = this.securityService.sanitizeInput(createLeaveRequestDto) as CreateLeaveRequestDto;

      // Validate employee exists and is active
      const employee = await this.prismaService.employee.findUnique({
        where: { id: sanitizedData.employeeId },
        select: {
          id: true,
          isActive: true,
          annualLeaveBalance: true,
          sickLeaveBalance: true,
          personalLeaveBalance: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!employee) {
        this.logger.warn(`Employee not found for leave request creation: ${sanitizedData.employeeId}`);
        throw new NotFoundException(`Employee not found`);
      }

      if (!employee.isActive) {
        this.logger.warn(`Inactive employee attempted leave request creation: ${sanitizedData.employeeId}`);
        throw new BadRequestException(`Employee is inactive`);
      }

      // Validate date range
      if (sanitizedData.startDate >= sanitizedData.endDate) {
        this.logger.warn(`Invalid date range for leave request: ${sanitizedData.startDate} >= ${sanitizedData.endDate}`);
        throw new BadRequestException('Invalid date range: end date must be after start date');
      }

      // Calculate days requested
      const daysRequested = this.calculateDaysRequested(sanitizedData.startDate, sanitizedData.endDate);

      // Validate leave balance
      if (!this.validateLeaveBalance(employee, sanitizedData.leaveType, daysRequested)) {
        this.logger.warn(`Insufficient leave balance for employee: ${sanitizedData.employeeId}`);
        throw new BadRequestException('Insufficient leave balance');
      }

      // Create leave request
      const leaveRequest = await this.prismaService.leaveRequest.create({
        data: {
          ...sanitizedData,
          daysRequested,
          status: LeaveStatus.PENDING,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Convert response format
      const response: LeaveRequestResponse = {
        ...leaveRequest,
        leaveType: leaveRequest.leaveType as LeaveType,
        status: leaveRequest.status as LeaveStatus,
        daysRequested: Number(leaveRequest.daysRequested),
        payRate: leaveRequest.payRate ? Number(leaveRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully created leave request: ${leaveRequest.id} for employee: ${employee.user?.firstName} ${employee.user?.lastName}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create leave request: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create leave request');
    }
  }

  /**
   * Get leave requests with pagination, filtering, and sorting
   * Implements efficient querying with proper indexing
   */
  async getLeaveRequests(queryDto: LeaveRequestQueryDto): Promise<LeaveRequestQueryResponse> {
    try {
      this.logger.log(`Fetching leave requests with query: ${JSON.stringify(queryDto)}`);

      const {
        employeeId,
        leaveType,
        status,
        startDateFrom,
        startDateTo,
        createdFrom,
        createdTo,
        skip,
        take,
        sortBy,
        sortOrder,
        search,
      } = queryDto;

      // Build where clause for filtering
      const where: any = {};

      if (employeeId) {
        where.employeeId = employeeId;
      }

      if (leaveType) {
        where.leaveType = leaveType;
      }

      if (status) {
        where.status = status;
      }

      if (startDateFrom || startDateTo) {
        where.startDate = {};
        if (startDateFrom) {
          where.startDate.gte = new Date(startDateFrom);
        }
        if (startDateTo) {
          where.startDate.lte = new Date(startDateTo);
        }
      }

      if (createdFrom || createdTo) {
        where.createdAt = {};
        if (createdFrom) {
          where.createdAt.gte = new Date(createdFrom);
        }
        if (createdTo) {
          where.createdAt.lte = new Date(createdTo);
        }
      }

      if (search) {
        where.OR = [
          { reason: { contains: search, mode: 'insensitive' } },
          { employee: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
          { employee: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      // Execute queries in parallel for performance
      const [leaveRequests, total] = await Promise.all([
        this.prismaService.leaveRequest.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeId: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        this.prismaService.leaveRequest.count({ where }),
      ]);

      // Convert response format
      const requestsWithTypes = leaveRequests.map(request => ({
        ...request,
        leaveType: request.leaveType as LeaveType,
        status: request.status as LeaveStatus,
        daysRequested: Number(request.daysRequested),
        payRate: request.payRate ? Number(request.payRate) : undefined,
      }));

      this.logger.log(`Retrieved ${requestsWithTypes.length} leave requests out of ${total} total`);

      return {
        leaveRequests: requestsWithTypes,
        total,
        skip,
        take,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch leave requests: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch leave requests');
    }
  }

  /**
   * Get leave request by ID with proper error handling
   */
  async getLeaveRequestById(id: string): Promise<LeaveRequestResponse | null> {
    try {
      this.logger.log(`Fetching leave request by ID: ${id}`);

      const leaveRequest = await this.prismaService.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!leaveRequest) {
        this.logger.warn(`Leave request not found: ${id}`);
        return null;
      }

      // Convert response format
      const response: LeaveRequestResponse = {
        ...leaveRequest,
        leaveType: leaveRequest.leaveType as LeaveType,
        status: leaveRequest.status as LeaveStatus,
        daysRequested: Number(leaveRequest.daysRequested),
        payRate: leaveRequest.payRate ? Number(leaveRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully retrieved leave request: ${id}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to fetch leave request by ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch leave request');
    }
  }

  /**
   * Update leave request with comprehensive validation
   */
  async updateLeaveRequest(id: string, updateLeaveRequestDto: UpdateLeaveRequestDto): Promise<LeaveRequestResponse> {
    try {
      this.logger.log(`Updating leave request ${id} with data: ${JSON.stringify(updateLeaveRequestDto)}`);

      // Check if leave request exists
      const existingRequest = await this.prismaService.leaveRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        this.logger.warn(`Leave request update attempted for non-existent ID: ${id}`);
        throw new NotFoundException(`Leave request not found`);
      }

      // Input validation and sanitization
      if (!this.securityService.validateInput(updateLeaveRequestDto)) {
        this.logger.warn(`Invalid input data for leave request update: ${id}`);
        throw new BadRequestException('Invalid leave request data');
      }

      const sanitizedData = this.securityService.sanitizeInput(updateLeaveRequestDto) as UpdateLeaveRequestDto;

      // Only allow updates for PENDING requests
      if (existingRequest.status !== LeaveStatus.PENDING) {
        this.logger.warn(`Attempted to update non-pending leave request: ${id} with status: ${existingRequest.status}`);
        throw new BadRequestException('Only pending leave requests can be updated');
      }

      // Update leave request
      const updatedRequest = await this.prismaService.leaveRequest.update({
        where: { id },
        data: sanitizedData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Convert response format
      const response: LeaveRequestResponse = {
        ...updatedRequest,
        leaveType: updatedRequest.leaveType as LeaveType,
        status: updatedRequest.status as LeaveStatus,
        daysRequested: Number(updatedRequest.daysRequested),
        payRate: updatedRequest.payRate ? Number(updatedRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully updated leave request: ${updatedRequest.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update leave request ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update leave request');
    }
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(id: string, approvalDto: ApprovalLeaveRequestDto): Promise<LeaveRequestResponse> {
    try {
      this.logger.log(`Approving leave request: ${id}`);

      // Input validation
      if (!this.securityService.validateInput(approvalDto)) {
        throw new BadRequestException('Invalid approval data');
      }

      const sanitizedData = this.securityService.sanitizeInput(approvalDto) as ApprovalLeaveRequestDto;

      // Check if leave request exists and is in PENDING status
      const existingRequest = await this.prismaService.leaveRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        throw new NotFoundException('Leave request not found');
      }

      if (existingRequest.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Leave request is not in PENDING status');
      }

      // Approve leave request
      const approvedRequest = await this.prismaService.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          approvedBy: sanitizedData.approverId,
          approvedAt: new Date(),
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Convert response format
      const response: LeaveRequestResponse = {
        ...approvedRequest,
        leaveType: approvedRequest.leaveType as LeaveType,
        status: approvedRequest.status as LeaveStatus,
        daysRequested: Number(approvedRequest.daysRequested),
        payRate: approvedRequest.payRate ? Number(approvedRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully approved leave request: ${approvedRequest.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to approve leave request ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to approve leave request');
    }
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(id: string, rejectionDto: RejectLeaveRequestDto): Promise<LeaveRequestResponse> {
    try {
      this.logger.log(`Rejecting leave request: ${id}`);

      // Input validation
      if (!this.securityService.validateInput(rejectionDto)) {
        throw new BadRequestException('Invalid rejection data');
      }

      const sanitizedData = this.securityService.sanitizeInput(rejectionDto) as RejectLeaveRequestDto;

      // Check if leave request exists and is in PENDING status
      const existingRequest = await this.prismaService.leaveRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        throw new NotFoundException('Leave request not found');
      }

      if (existingRequest.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Leave request is not in PENDING status');
      }

      // Reject leave request
      const rejectedRequest = await this.prismaService.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.REJECTED,
          rejectedBy: sanitizedData.rejectedBy,
          rejectedAt: new Date(),
          rejectionReason: sanitizedData.rejectionReason,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Convert response format
      const response: LeaveRequestResponse = {
        ...rejectedRequest,
        leaveType: rejectedRequest.leaveType as LeaveType,
        status: rejectedRequest.status as LeaveStatus,
        daysRequested: Number(rejectedRequest.daysRequested),
        payRate: rejectedRequest.payRate ? Number(rejectedRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully rejected leave request: ${rejectedRequest.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to reject leave request ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to reject leave request');
    }
  }

  /**
   * Cancel leave request
   */
  async cancelLeaveRequest(id: string, cancelDto: CancelLeaveRequestDto): Promise<LeaveRequestResponse> {
    try {
      this.logger.log(`Cancelling leave request: ${id}`);

      // Input validation
      if (!this.securityService.validateInput(cancelDto)) {
        throw new BadRequestException('Invalid cancellation data');
      }

      const sanitizedData = this.securityService.sanitizeInput(cancelDto) as CancelLeaveRequestDto;

      // Check if leave request exists
      const existingRequest = await this.prismaService.leaveRequest.findUnique({
        where: { id },
      });

      if (!existingRequest) {
        throw new NotFoundException('Leave request not found');
      }

      // Only allow cancellation for PENDING requests
      if (existingRequest.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Cannot cancel approved or completed leave request');
      }

      // Cancel leave request
      const cancelledRequest = await this.prismaService.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCELLED,
          reason: sanitizedData.reason,
          updatedBy: sanitizedData.cancelledBy,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Convert response format
      const response: LeaveRequestResponse = {
        ...cancelledRequest,
        leaveType: cancelledRequest.leaveType as LeaveType,
        status: cancelledRequest.status as LeaveStatus,
        daysRequested: Number(cancelledRequest.daysRequested),
        payRate: cancelledRequest.payRate ? Number(cancelledRequest.payRate) : undefined,
      };

      this.logger.log(`Successfully cancelled leave request: ${cancelledRequest.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to cancel leave request ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to cancel leave request');
    }
  }

  /**
   * Get leave balance for employee
   */
  async getLeaveBalance(employeeId: string): Promise<LeaveBalanceResponse> {
    try {
      this.logger.log(`Fetching leave balance for employee: ${employeeId}`);

      const employee = await this.prismaService.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          annualLeaveBalance: true,
          sickLeaveBalance: true,
          personalLeaveBalance: true,
          updatedAt: true,
        },
      });

      if (!employee) {
        this.logger.warn(`Employee not found for leave balance: ${employeeId}`);
        throw new NotFoundException(`Employee not found`);
      }

      const response: LeaveBalanceResponse = {
        employeeId: employee.id,
        annualLeaveBalance: Number(employee.annualLeaveBalance),
        sickLeaveBalance: Number(employee.sickLeaveBalance),
        personalLeaveBalance: Number(employee.personalLeaveBalance),
        lastUpdated: employee.updatedAt,
      };

      this.logger.log(`Successfully retrieved leave balance for employee: ${employeeId}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch leave balance for employee ${employeeId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch leave balance');
    }
  }

  /**
   * Get comprehensive leave analytics
   */
  async getLeaveAnalytics(queryDto: LeaveAnalyticsQueryDto): Promise<LeaveAnalyticsResponse> {
    try {
      this.logger.log(`Fetching leave analytics with query: ${JSON.stringify(queryDto)}`);

      const { employeeId, departmentId, startDateFrom, startDateTo } = queryDto;

      // Build where clause
      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (startDateFrom || startDateTo) {
        where.startDate = {};
        if (startDateFrom) where.startDate.gte = new Date(startDateFrom);
        if (startDateTo) where.startDate.lte = new Date(startDateTo);
      }

      // Fetch leave requests with employee and department info
      const leaveRequests = await this.prismaService.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Filter by department if specified
      const filteredRequests = departmentId
        ? leaveRequests.filter(lr => lr.employee.department?.id === departmentId)
        : leaveRequests;

      // Calculate analytics
      const totalRequests = filteredRequests.length;
      const approvedRequests = filteredRequests.filter(lr => lr.status === LeaveStatus.APPROVED).length;
      const pendingRequests = filteredRequests.filter(lr => lr.status === LeaveStatus.PENDING).length;
      const rejectedRequests = filteredRequests.filter(lr => lr.status === LeaveStatus.REJECTED).length;
      const cancelledRequests = filteredRequests.filter(lr => lr.status === LeaveStatus.CANCELLED).length;

      const totalDays = filteredRequests.reduce((sum, lr) => sum + Number(lr.daysRequested), 0);
      const averageDuration = totalRequests > 0 ? totalDays / totalRequests : 0;

      // Group by leave type
      const byLeaveType: Record<LeaveType, { count: number; days: number; percentage: number }> = {} as any;
      Object.values(LeaveType).forEach(type => {
        const typeRequests = filteredRequests.filter(lr => lr.leaveType === type);
        const typeDays = typeRequests.reduce((sum, lr) => sum + Number(lr.daysRequested), 0);
        byLeaveType[type] = {
          count: typeRequests.length,
          days: typeDays,
          percentage: totalRequests > 0 ? (typeRequests.length / totalRequests) * 100 : 0,
        };
      });

      // Group by department
      const byDepartment: Record<string, { count: number; days: number; percentage: number }> = {};
      filteredRequests.forEach(lr => {
        const deptName = lr.employee.department?.name || 'Unknown';
        if (!byDepartment[deptName]) {
          byDepartment[deptName] = { count: 0, days: 0, percentage: 0 };
        }
        byDepartment[deptName].count++;
        byDepartment[deptName].days += Number(lr.daysRequested);
      });

      // Calculate department percentages
      Object.keys(byDepartment).forEach(dept => {
        byDepartment[dept].percentage = totalRequests > 0 ? (byDepartment[dept].count / totalRequests) * 100 : 0;
      });

      // Group by status
      const byStatus: Record<LeaveStatus, number> = {
        [LeaveStatus.PENDING]: pendingRequests,
        [LeaveStatus.APPROVED]: approvedRequests,
        [LeaveStatus.REJECTED]: rejectedRequests,
        [LeaveStatus.CANCELLED]: cancelledRequests,
        [LeaveStatus.COMPLETED]: 0, // We'll add this if needed in the future
      };

      const response: LeaveAnalyticsResponse = {
        totalLeaveRequests: totalRequests,
        approvedLeaveRequests: approvedRequests,
        pendingLeaveRequests: pendingRequests,
        rejectedLeaveRequests: rejectedRequests,
        cancelledLeaveRequests: cancelledRequests,
        totalLeaveDays: totalDays,
        averageLeaveDuration: Math.round(averageDuration * 100) / 100,
        byLeaveType,
        byDepartment,
        byStatus,
        monthlyTrends: [], // TODO: Implement monthly trends if needed
      };

      this.logger.log(`Successfully generated leave analytics: ${totalRequests} total requests`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to generate leave analytics: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate leave analytics');
    }
  }

  /**
   * Validate leave balance against requested days
   */
  private validateLeaveBalance(employee: any, leaveType: LeaveType, daysRequested: number): boolean {
    switch (leaveType) {
      case LeaveType.ANNUAL:
        return Number(employee.annualLeaveBalance) >= daysRequested;
      case LeaveType.SICK:
        return Number(employee.sickLeaveBalance) >= daysRequested;
      case LeaveType.PERSONAL:
        return Number(employee.personalLeaveBalance) >= daysRequested;
      case LeaveType.MATERNITY:
      case LeaveType.PATERNITY:
      case LeaveType.UNPAID:
        // These types may have different validation rules
        return true; // For now, allow all requests
      default:
        return false;
    }
  }

  /**
   * Calculate days requested including weekends
   */
  private calculateDaysRequested(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Reset time to midnight for accurate day calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates

    return diffDays;
  }
}