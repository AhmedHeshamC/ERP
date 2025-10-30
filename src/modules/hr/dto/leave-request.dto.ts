import { IsString, IsOptional, IsDate, IsNumber, IsBoolean, IsEnum, IsArray, Min, Max, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Leave Types Enumeration
 */
export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  UNPAID = 'UNPAID',
}

/**
 * Leave Status Enumeration
 */
export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/**
 * Create Leave Request DTO
 * OWASP A03: Input validation for leave request creation
 */
export class CreateLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  paidLeave?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  payRate?: number;
}

/**
 * Update Leave Request DTO
 * OWASP A03: Input validation for leave request updates
 */
export class UpdateLeaveRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  paidLeave?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999.99)
  payRate?: number;
}

/**
 * Approval Leave Request DTO
 * OWASP A03: Input validation for leave approval
 */
export class ApprovalLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  approverId: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/**
 * Reject Leave Request DTO
 * OWASP A03: Input validation for leave rejection
 */
export class RejectLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  rejectedBy: string;

  @IsString()
  @IsNotEmpty()
  rejectionReason: string;

  @IsOptional()
  @IsString()
  comments?: string;
}

/**
 * Cancel Leave Request DTO
 * OWASP A03: Input validation for leave cancellation
 */
export class CancelLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  cancelledBy: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Leave Request Query DTO
 * OWASP A03: Input validation for leave request queries
 */
export class LeaveRequestQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(LeaveType)
  leaveType?: LeaveType;

  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateTo?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdTo?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * Leave Analytics Query DTO
 */
export class LeaveAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateFrom?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDateTo?: Date;
}

/**
 * Leave Request Response DTO
 */
export class LeaveRequestResponse {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  paidLeave: boolean;
  payRate?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;

  // Include employee details for response
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: {
      id: string;
      name: string;
    };
  };
}

/**
 * Leave Request Query Response DTO
 */
export class LeaveRequestQueryResponse {
  leaveRequests: LeaveRequestResponse[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Leave Balance Response DTO
 */
export class LeaveBalanceResponse {
  employeeId: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  personalLeaveBalance: number;
  lastUpdated: Date;
}

/**
 * Leave Analytics Response DTO
 */
export class LeaveAnalyticsResponse {
  totalLeaveRequests: number;
  approvedLeaveRequests: number;
  pendingLeaveRequests: number;
  rejectedLeaveRequests: number;
  cancelledLeaveRequests: number;
  totalLeaveDays: number;
  averageLeaveDuration: number;
  byLeaveType: Record<LeaveType, {
    count: number;
    days: number;
    percentage: number;
  }>;
  byDepartment: Record<string, {
    count: number;
    days: number;
    percentage: number;
  }>;
  byStatus: Record<LeaveStatus, number>;
  monthlyTrends: Array<{
    month: string;
    count: number;
    days: number;
  }>;
}

/**
 * Bulk Leave Request DTO
 */
export class BulkLeaveRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLeaveRequestDto)
  leaveRequests: CreateLeaveRequestDto[];
}

/**
 * Leave Calendar DTO
 */
export class LeaveCalendarDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsBoolean()
  includeWeekends?: boolean = true;
}

/**
 * Leave Conflict Check DTO
 */
export class LeaveConflictCheckDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @IsOptional()
  @IsString()
  excludeRequestId?: string;
}

/**
 * Leave Conflict Response DTO
 */
export class LeaveConflictResponse {
  hasConflicts: boolean;
  conflicts: Array<{
    requestId: string;
    employeeName: string;
    leaveType: LeaveType;
    startDate: Date;
    endDate: Date;
    status: LeaveStatus;
  }>;
  overlappingDays: number;
}