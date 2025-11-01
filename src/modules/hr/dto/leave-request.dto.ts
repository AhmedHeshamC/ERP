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
  employeeId!: string;

  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType!: LeaveType;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate!: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate!: Date;

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
  approverId!: string;

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
  rejectedBy!: string;

  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;

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
  cancelledBy!: string;

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
 * Employee DTO for Leave Request Response
 */
export interface LeaveRequestEmployee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  department?: {
    id: string;
    name: string;
  };
}

/**
 * Leave Request Response DTO
 */
export class LeaveRequestResponse {
  id!: string;
  employeeId!: string;
  leaveType!: LeaveType;
  startDate!: Date;
  endDate!: Date;
  daysRequested!: number;
  reason?: string;
  status!: LeaveStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  paidLeave!: boolean;
  payRate?: number;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy?: string;
  updatedBy?: string;

  // Include employee details for response
  employee?: LeaveRequestEmployee;
}

/**
 * Leave Request Query Response DTO
 */
export class LeaveRequestQueryResponse {
  leaveRequests!: LeaveRequestResponse[];
  total!: number;
  skip!: number;
  take!: number;
}

/**
 * Leave Balance Response DTO
 */
export class LeaveBalanceResponse {
  employeeId!: string;
  annualLeaveBalance!: number;
  sickLeaveBalance!: number;
  personalLeaveBalance!: number;
  lastUpdated!: Date;
}

/**
 * Leave Type Statistics DTO
 */
export interface LeaveTypeStats {
  count: number;
  days: number;
  percentage: number;
}

/**
 * Department Statistics DTO
 */
export interface DepartmentStats {
  count: number;
  days: number;
  percentage: number;
}

/**
 * Monthly Trend DTO
 */
export interface MonthlyTrend {
  month: string;
  count: number;
  days: number;
}

/**
 * Leave Analytics Response DTO
 */
export class LeaveAnalyticsResponse {
  totalLeaveRequests!: number;
  approvedLeaveRequests!: number;
  pendingLeaveRequests!: number;
  rejectedLeaveRequests!: number;
  cancelledLeaveRequests!: number;
  totalLeaveDays!: number;
  averageLeaveDuration!: number;
  byLeaveType!: Record<LeaveType, LeaveTypeStats>;
  byDepartment!: Record<string, DepartmentStats>;
  byStatus!: Record<LeaveStatus, number>;
  monthlyTrends!: Array<MonthlyTrend>;
}

/**
 * Bulk Leave Request DTO
 */
export class BulkLeaveRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLeaveRequestDto)
  leaveRequests!: CreateLeaveRequestDto[];
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
  employeeId!: string;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate!: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate!: Date;

  @IsOptional()
  @IsString()
  excludeRequestId?: string;
}

/**
 * Leave Conflict Response DTO
 */
/**
 * Leave Conflict DTO
 */
export interface LeaveConflict {
  requestId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  status: LeaveStatus;
}

export class LeaveConflictResponse {
  hasConflicts!: boolean;
  conflicts!: Array<LeaveConflict>;
  overlappingDays!: number;
}