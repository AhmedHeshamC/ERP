import { IsString, IsBoolean, IsOptional, IsEnum, IsArray, IsInt, IsEmail, IsDateString, Min, Max } from 'class-validator';
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
  reportDefinitionId!: string;

  @ApiProperty({ description: 'Scheduled report name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Scheduled report description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Cron expression for scheduling' })
  @IsString()
  schedule!: string;

  @ApiProperty({ description: 'Schedule type', enum: ScheduleType })
  @IsEnum(ScheduleType)
  scheduleType!: ScheduleType;

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
  parameters?: Record<string, unknown>;

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
  parameters?: Record<string, unknown>;

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
  scheduledReportId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

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
  reportDefinitionId!: string;

  @ApiProperty({ description: 'Subscription type', enum: SubscriptionType })
  @IsEnum(SubscriptionType)
  subscriptionType!: SubscriptionType;

  @ApiPropertyOptional({ description: 'Subscription preferences' })
  @IsOptional()
  preferences?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Subscription criteria' })
  @IsOptional()
  criteria?: Record<string, unknown>;

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
  quietHours?: Record<string, unknown>;
}

/**
 * Manual Report Trigger DTO
 */
export class ManualReportTriggerDto {
  @ApiPropertyOptional({ description: 'Override parameters' })
  @IsOptional()
  parameters?: Record<string, unknown>;

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

export class ScheduledReportResponse {
  @ApiProperty({ description: 'Scheduled report ID' })
  id!: string;

  @ApiProperty({ description: 'Report definition ID' })
  reportDefinitionId!: string;

  @ApiPropertyOptional({ description: 'Report definition information' })
  reportDefinition?: {
    id: string;
    name: string;
    type: string;
    category: string;
  };

  @ApiProperty({ description: 'Scheduled report name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Scheduled report description' })
  description?: string;

  @ApiProperty({ description: 'Cron expression for scheduling' })
  schedule!: string;

  @ApiProperty({ description: 'Schedule type', enum: ScheduleType })
  scheduleType!: ScheduleType;

  @ApiProperty({ description: 'Is scheduled report active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Next run time' })
  nextRunAt!: Date;

  @ApiPropertyOptional({ description: 'Last run time' })
  lastRunAt?: Date;

  @ApiPropertyOptional({ description: 'Default parameters for the report' })
  parameters?: Record<string, unknown>;

  @ApiProperty({ description: 'Report format', enum: ReportFormat })
  format!: ReportFormat;

  @ApiProperty({ description: 'Timezone' })
  timezone!: string;

  @ApiProperty({ description: 'Send email notification' })
  sendEmail!: boolean;

  @ApiProperty({ description: 'Email recipients', type: [String] })
  emailRecipients!: string[];

  @ApiPropertyOptional({ description: 'Custom email subject' })
  emailSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  emailBody?: string;

  @ApiProperty({ description: 'Maximum retry attempts' })
  maxRetries!: number;

  @ApiPropertyOptional({ description: 'Archive after N days' })
  archiveAfter?: number;

  @ApiPropertyOptional({ description: 'Delete after N days' })
  deleteAfter?: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Creator user ID' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updater user ID' })
  updatedBy?: string;

  @ApiPropertyOptional({ description: 'Creator user information' })
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiPropertyOptional({ description: 'Updater user information' })
  updater?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class ScheduledReportExecutionResponse {
  @ApiProperty({ description: 'Execution record ID' })
  id!: string;

  @ApiProperty({ description: 'Scheduled report ID' })
  scheduledReportId!: string;

  @ApiPropertyOptional({ description: 'Scheduled report information' })
  scheduledReport?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'Scheduled execution time' })
  scheduledAt!: Date;

  @ApiProperty({ description: 'Actual start time' })
  startedAt!: Date;

  @ApiPropertyOptional({ description: 'Completion time' })
  completedAt?: Date;

  @ApiProperty({ description: 'Execution status', enum: ExecutionStatus })
  status!: ExecutionStatus;

  @ApiPropertyOptional({ description: 'Generated report ID' })
  generatedReportId?: string;

  @ApiPropertyOptional({ description: 'Generated report information' })
  generatedReport?: {
    id: string;
    name: string;
    status: string;
    fileUrl?: string;
  };

  @ApiPropertyOptional({ description: 'Error message if execution failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'Number of retry attempts' })
  retryCount!: number;

  @ApiProperty({ description: 'Delivery status', enum: DeliveryStatus })
  deliveryStatus!: DeliveryStatus;

  @ApiProperty({ description: 'Number of delivery attempts' })
  deliveryAttempts!: number;

  @ApiProperty({ description: 'Execution time in milliseconds' })
  executionTimeMs!: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Creator user ID' })
  createdBy?: string;
}

export class ScheduledReportQueryResponse {
  @ApiProperty({ description: 'Array of scheduled reports', type: [ScheduledReportResponse] })
  scheduledReports!: ScheduledReportResponse[];

  @ApiProperty({ description: 'Total number of records' })
  total!: number;

  @ApiProperty({ description: 'Number of records skipped' })
  skip!: number;

  @ApiProperty({ description: 'Number of records taken' })
  take!: number;
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
  preferences?: Record<string, unknown>;
  criteria?: Record<string, unknown>;
  sendEmail: boolean;
  sendInApp: boolean;
  quietHours?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export class DistributionListResponse {
  @ApiProperty({ description: 'Distribution list record ID' })
  id!: string;

  @ApiProperty({ description: 'Scheduled report ID' })
  scheduledReportId!: string;

  @ApiPropertyOptional({ description: 'Scheduled report information' })
  scheduledReport?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiPropertyOptional({ description: 'User information' })
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'Is distribution active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Subscription timestamp' })
  subscribedAt!: Date;

  @ApiPropertyOptional({ description: 'Unsubscription timestamp' })
  unsubscribedAt?: Date;

  @ApiPropertyOptional({ description: 'Custom email subject' })
  customSubject?: string;

  @ApiPropertyOptional({ description: 'Custom email body' })
  customBody?: string;

  @ApiProperty({ description: 'Delivery method', enum: DeliveryMethod })
  deliveryMethod!: DeliveryMethod;

  @ApiPropertyOptional({ description: 'Preferred format', enum: ReportFormat })
  preferredFormat?: ReportFormat;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Creator user ID' })
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