import { IsString, IsBoolean, IsOptional, IsEnum, IsArray, IsInt, IsEmail, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Schedule Types Enum
 */
export enum ScheduleType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

/**
 * Execution Status Enum
 */
export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Delivery Status Enum
 */
export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENDING = 'SENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

/**
 * Report Format Enum
 */
export enum ReportFormat {
  JSON = 'JSON',
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
}

/**
 * Delivery Method Enum
 */
export enum DeliveryMethod {
  EMAIL = 'EMAIL',
  DOWNLOAD = 'DOWNLOAD',
  BOTH = 'BOTH',
}

/**
 * Subscription Type Enum
 */
export enum SubscriptionType {
  IMMEDIATE = 'IMMEDIATE',
  DAILY_DIGEST = 'DAILY_DIGEST',
  WEEKLY_DIGEST = 'WEEKLY_DIGEST',
  CUSTOM = 'CUSTOM',
}

/**
 * Create Scheduled Report DTO
 */
export class CreateScheduledReportDto {
  @ApiProperty({ description: 'Report definition ID' })
  @IsString()
  reportDefinitionId: string;

  @ApiProperty({ description: 'Scheduled report name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Scheduled report description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cron expression for scheduling' })
  @IsString()
  schedule: string;

  @ApiProperty({ description: 'Schedule type', enum: ScheduleType })
  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @ApiPropertyOptional({ description: 'Is scheduled report active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Next run time' })
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @ApiPropertyOptional({ description: 'Default parameters for the report' })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report format', enum: ReportFormat, default: ReportFormat.PDF })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiPropertyOptional({ description: 'Timezone', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Send email notification', default: true })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Email recipients' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @ApiPropertyOptional({ description: 'Custom email subject' })
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiPropertyOptional({ description: 'Maximum retry attempts', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Retry interval in seconds', default: 300 })
  @IsOptional()
  @IsInt()
  @Min(60)
  retryInterval?: number;

  @ApiPropertyOptional({ description: 'Archive after N days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  archiveAfter?: number;

  @ApiPropertyOptional({ description: 'Delete after N days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deleteAfter?: number;
}

/**
 * Update Scheduled Report DTO
 */
export class UpdateScheduledReportDto {
  @ApiPropertyOptional({ description: 'Scheduled report name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Scheduled report description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Cron expression for scheduling' })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({ description: 'Schedule type', enum: ScheduleType })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({ description: 'Is scheduled report active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Next run time' })
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @ApiPropertyOptional({ description: 'Default parameters for the report' })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Report format', enum: ReportFormat })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Send email notification' })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Email recipients' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @ApiPropertyOptional({ description: 'Custom email subject' })
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  @IsOptional()
  @IsString()
  emailBody?: string;

  @ApiPropertyOptional({ description: 'Maximum retry attempts' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Retry interval in seconds' })
  @IsOptional()
  @IsInt()
  @Min(60)
  retryInterval?: number;

  @ApiPropertyOptional({ description: 'Archive after N days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  archiveAfter?: number;

  @ApiPropertyOptional({ description: 'Delete after N days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deleteAfter?: number;
}

/**
 * Scheduled Report Query DTO
 */
export class ScheduledReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by report definition ID' })
  @IsOptional()
  @IsString()
  reportDefinitionId?: string;

  @ApiPropertyOptional({ description: 'Filter by schedule type', enum: ScheduleType })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by next run time from' })
  @IsOptional()
  @IsDateString()
  nextRunFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by next run time to' })
  @IsOptional()
  @IsDateString()
  nextRunTo?: string;

  @ApiPropertyOptional({ description: 'Skip records for pagination', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Take records for pagination', default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 10;

  @ApiPropertyOptional({ description: 'Sort field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Create Distribution List DTO
 */
export class CreateDistributionListDto {
  @ApiProperty({ description: 'Scheduled report ID' })
  @IsString()
  scheduledReportId: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Is distribution active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Custom email subject' })
  @IsOptional()
  @IsString()
  customSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  @IsOptional()
  @IsString()
  customBody?: string;

  @ApiPropertyOptional({ description: 'Delivery method', enum: DeliveryMethod, default: DeliveryMethod.EMAIL })
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @ApiPropertyOptional({ description: 'Preferred format', enum: ReportFormat })
  @IsOptional()
  @IsEnum(ReportFormat)
  preferredFormat?: ReportFormat;
}

/**
 * Create Report Subscription DTO
 */
export class CreateReportSubscriptionDto {
  @ApiProperty({ description: 'Report definition ID' })
  @IsString()
  reportDefinitionId: string;

  @ApiProperty({ description: 'Subscription type', enum: SubscriptionType })
  @IsEnum(SubscriptionType)
  subscriptionType: SubscriptionType;

  @ApiPropertyOptional({ description: 'Subscription preferences' })
  @IsOptional()
  preferences?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Subscription criteria' })
  @IsOptional()
  criteria?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Send email notification', default: true })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Send in-app notification', default: true })
  @IsOptional()
  @IsBoolean()
  sendInApp?: boolean;

  @ApiPropertyOptional({ description: 'Quiet hours configuration' })
  @IsOptional()
  quietHours?: Record<string, any>;
}

/**
 * Manual Report Trigger DTO
 */
export class ManualReportTriggerDto {
  @ApiPropertyOptional({ description: 'Override parameters' })
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Override format', enum: ReportFormat })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @ApiPropertyOptional({ description: 'Override email recipients' })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @ApiPropertyOptional({ description: 'Send email notification' })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({ description: 'Custom email subject' })
  @IsOptional()
  @IsString()
  emailSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  @IsOptional()
  @IsString()
  emailBody?: string;
}

/**
 * Response DTOs
 */

export interface ScheduledReportResponse {
  id: string;
  reportDefinitionId: string;
  reportDefinition?: {
    id: string;
    name: string;
    type: string;
    category: string;
  };
  name: string;
  description?: string;
  schedule: string;
  scheduleType: ScheduleType;
  isActive: boolean;
  nextRunAt: Date;
  lastRunAt?: Date;
  parameters?: Record<string, any>;
  format: ReportFormat;
  timezone: string;
  sendEmail: boolean;
  emailRecipients: string[];
  emailSubject?: string;
  emailBody?: string;
  maxRetries: number;
  archiveAfter?: number;
  deleteAfter?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updater?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ScheduledReportExecutionResponse {
  id: string;
  scheduledReportId: string;
  scheduledReport?: {
    id: string;
    name: string;
  };
  scheduledAt: Date;
  startedAt: Date;
  completedAt?: Date;
  status: ExecutionStatus;
  generatedReportId?: string;
  generatedReport?: {
    id: string;
    name: string;
    status: string;
    fileUrl?: string;
  };
  errorMessage?: string;
  retryCount: number;
  deliveryStatus: DeliveryStatus;
  deliveryAttempts: number;
  executionTimeMs: number;
  createdAt: Date;
  createdBy?: string;
}

export interface ScheduledReportQueryResponse {
  scheduledReports: ScheduledReportResponse[];
  total: number;
  skip: number;
  take: number;
}

export interface ReportSubscriptionResponse {
  id: string;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reportDefinitionId: string;
  reportDefinition?: {
    id: string;
    name: string;
    type: string;
    category: string;
  };
  subscriptionType: SubscriptionType;
  isActive: boolean;
  preferences?: Record<string, any>;
  criteria?: Record<string, any>;
  sendEmail: boolean;
  sendInApp: boolean;
  quietHours?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface DistributionListResponse {
  id: string;
  scheduledReportId: string;
  scheduledReport?: {
    id: string;
    name: string;
  };
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  email: string;
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  customSubject?: string;
  customBody?: string;
  deliveryMethod: DeliveryMethod;
  preferredFormat?: ReportFormat;
  createdAt: Date;
  createdBy?: string;
}

export interface ScheduledReportStatsResponse {
  totalScheduledReports: number;
  activeScheduledReports: number;
  inactiveScheduledReports: number;
  executionsToday: number;
  executionsThisWeek: number;
  executionsThisMonth: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  scheduleTypeDistribution: Record<ScheduleType, number>;
  topPerformingReports: Array<{
    reportName: string;
    executionCount: number;
    successRate: number;
    averageExecutionTime: number;
  }>;
  recentExecutions: ScheduledReportExecutionResponse[];
}