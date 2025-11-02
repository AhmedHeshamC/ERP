import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// Enums
export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AlertCategory {
  SYSTEM = 'SYSTEM',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  BUSINESS = 'BUSINESS',
  AVAILABILITY = 'AVAILABILITY'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  SUPPRESSED = 'SUPPRESSED'
}

// Base DTOs
export class CreateAlertDto {
  @ApiProperty({ description: 'Alert name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Alert description' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: AlertSeverity, description: 'Alert severity' })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity = AlertSeverity.MEDIUM;

  @ApiPropertyOptional({ enum: AlertCategory, description: 'Alert category' })
  @IsOptional()
  @IsEnum(AlertCategory)
  category?: AlertCategory = AlertCategory.SYSTEM;

  @ApiPropertyOptional({ description: 'Alert source' })
  @IsOptional()
  @IsString()
  source?: string = 'system';

  @ApiPropertyOptional({ description: 'Current value' })
  @IsOptional()
  @IsNumber()
  currentValue?: number;

  @ApiPropertyOptional({ description: 'Alert threshold' })
  @IsOptional()
  @IsObject()
  threshold?: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    value: number;
    severity: AlertSeverity;
  };

  @ApiPropertyOptional({ description: 'Alert tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] = [];

  @ApiPropertyOptional({ description: 'Alert metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any> = {};

  @ApiPropertyOptional({ description: 'Correlation ID for tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class UpdateAlertDto {
  @ApiPropertyOptional({ description: 'Alert name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Alert description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: AlertSeverity, description: 'Alert severity' })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ description: 'Alert tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Alert metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class AlertQueryDto {
  @ApiPropertyOptional({ enum: AlertSeverity, description: 'Filter by severity' })
  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @ApiPropertyOptional({ enum: AlertCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(AlertCategory)
  category?: AlertCategory;

  @ApiPropertyOptional({ enum: AlertStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({ description: 'Filter by source' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'Limit number of results', minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({ description: 'Offset for pagination', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class AcknowledgeAlertDto {
  @ApiProperty({ description: 'User acknowledging the alert' })
  @IsString()
  acknowledgedBy: string;

  @ApiPropertyOptional({ description: 'Acknowledgment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SuppressAlertDto {
  @ApiProperty({ description: 'Suppression duration in minutes', minimum: 1, maximum: 10080 })
  @IsNumber()
  @Min(1)
  @Max(10080) // Max 7 days
  duration: number;

  @ApiPropertyOptional({ description: 'Reason for suppression' })
  @IsOptional()
  @IsString()
  reason?: string;
}

// Response DTOs
export class AlertResponseDto {
  @ApiProperty({ description: 'Alert ID' })
  id: string;

  @ApiProperty({ description: 'Alert name' })
  name: string;

  @ApiProperty({ description: 'Alert description' })
  description: string;

  @ApiProperty({ enum: AlertSeverity, description: 'Alert severity' })
  severity: AlertSeverity;

  @ApiProperty({ enum: AlertStatus, description: 'Alert status' })
  status: AlertStatus;

  @ApiProperty({ enum: AlertCategory, description: 'Alert category' })
  category: AlertCategory;

  @ApiProperty({ description: 'Alert source' })
  source: string;

  @ApiProperty({ description: 'Alert timestamp' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Alert resolution timestamp' })
  resolvedAt?: Date;

  @ApiPropertyOptional({ description: 'Current value' })
  currentValue?: number;

  @ApiPropertyOptional({ description: 'Alert threshold' })
  threshold?: {
    metric: string;
    operator: string;
    value: number;
    severity: AlertSeverity;
  };

  @ApiProperty({ description: 'Alert tags', type: [String] })
  tags: string[];

  @ApiPropertyOptional({ description: 'Alert metadata' })
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Correlation ID' })
  correlationId?: string;

  @ApiPropertyOptional({ description: 'User who acknowledged the alert' })
  acknowledgedBy?: string;

  @ApiPropertyOptional({ description: 'Acknowledgment timestamp' })
  acknowledgedAt?: Date;

  @ApiPropertyOptional({ description: 'Alert notes' })
  notes?: string;
}

export class AlertListResponseDto {
  @ApiProperty({ description: 'Array of alerts', type: [AlertResponseDto] })
  alerts: AlertResponseDto[];

  @ApiProperty({ description: 'Total number of alerts matching the filter' })
  total: number;

  @ApiProperty({ description: 'Whether there are more alerts available' })
  hasMore: boolean;
}

export class AlertStatisticsDto {
  @ApiProperty({ description: 'Total number of alerts' })
  total: number;

  @ApiProperty({ description: 'Number of active alerts' })
  active: number;

  @ApiProperty({ description: 'Number of resolved alerts' })
  resolved: number;

  @ApiProperty({ description: 'Number of suppressed alerts' })
  suppressed: number;

  @ApiProperty({ description: 'Alerts grouped by severity' })
  bySeverity: Record<string, number>;

  @ApiProperty({ description: 'Alerts grouped by category' })
  byCategory: Record<string, number>;

  @ApiProperty({ description: 'Alerts grouped by source' })
  bySource: Record<string, number>;

  @ApiProperty({ description: 'Recent alerts', type: [AlertResponseDto] })
  recentAlerts: AlertResponseDto[];

  @ApiProperty({ description: 'Top occurring alerts' })
  topAlerts: Array<{
    name: string;
    count: number;
    lastOccurred: Date;
  }>;

  @ApiProperty({ description: 'Average resolution times by category' })
  resolutionTimes: Array<{
    category: string;
    avgTime: number;
    count: number;
  }>;
}

export class NotificationChannelDto {
  @ApiProperty({ description: 'Channel ID' })
  id: string;

  @ApiProperty({ description: 'Channel name' })
  name: string;

  @ApiProperty({ description: 'Channel type' })
  type: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'SLACK' | 'TEAMS' | 'PAGERDUTY';

  @ApiProperty({ description: 'Channel configuration' })
  config: Record<string, any>;

  @ApiProperty({ description: 'Whether the channel is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Channel filters' })
  filters: {
    severities: string[];
    categories: string[];
    sources: string[];
  };
}

export class AlertRuleDto {
  @ApiProperty({ description: 'Rule ID' })
  id: string;

  @ApiProperty({ description: 'Rule name' })
  name: string;

  @ApiProperty({ description: 'Rule description' })
  description: string;

  @ApiProperty({ description: 'Whether the rule is enabled' })
  enabled: boolean;

  @ApiProperty({ description: 'Rule thresholds' })
  thresholds: Array<{
    metric: string;
    operator: string;
    value: number;
    severity: AlertSeverity;
  }>;

  @ApiProperty({ description: 'Rule conditions' })
  conditions: Array<{
    metric: string;
    operator: string;
    value: any;
    aggregate?: string;
    timeWindow?: number;
  }>;

  @ApiProperty({ description: 'Notification channels' })
  notifications: NotificationChannelDto[];

  @ApiProperty({ description: 'Cooldown period in minutes' })
  cooldown: number;

  @ApiProperty({ description: 'Suppression duration in minutes' })
  suppressDuration: number;

  @ApiProperty({ description: 'Rule tags', type: [String] })
  tags: string[];
}