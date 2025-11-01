import { IsString, IsNumber, IsOptional, IsEnum, IsInt, IsDate, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Supplier Performance Tiers Enum
 */
export enum SupplierTier {
  PREFERRED = 'PREFERRED',
  APPROVED = 'APPROVED',
  STANDARD = 'STANDARD',
  CONDITIONAL = 'CONDITIONAL',
  UNDER_REVIEW = 'UNDER_REVIEW',
}

/**
 * Performance Metric Types Enum
 */
export enum PerformanceMetricType {
  QUALITY = 'QUALITY',
  DELIVERY = 'DELIVERY',
  COST = 'COST',
  SERVICE = 'SERVICE',
  RESPONSIVENESS = 'RESPONSIVENESS',
}

/**
 * Performance Levels Enum
 */
export enum PerformanceLevel {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  AVERAGE = 'AVERAGE',
  POOR = 'POOR',
  CRITICAL = 'CRITICAL',
}

/**
 * Event Types Enum
 */
export enum PerformanceEventType {
  LATE_DELIVERY = 'LATE_DELIVERY',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  PRICE_INCREASE = 'PRICE_INCREASE',
  SERVICE_COMPLAINT = 'SERVICE_COMPLAINT',
  EXCELLENT_SERVICE = 'EXCELLENT_SERVICE',
}

/**
 * Event Severity Enum
 */
export enum EventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Review Types Enum
 */
export enum ReviewType {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  ADHOC = 'ADHOC',
}

/**
 * Review Status Enum
 */
export enum ReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * Create Supplier Performance DTO
 */
export class CreateSupplierPerformanceDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  supplierId!: string;

  @ApiProperty({ description: 'Period in YYYY-MM format' })
  @IsString()
  period!: string;

  @ApiPropertyOptional({ description: 'Quality score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'Delivery score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryScore?: number;

  @ApiPropertyOptional({ description: 'Cost score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  costScore?: number;

  @ApiPropertyOptional({ description: 'Service score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceScore?: number;

  @ApiPropertyOptional({ description: 'On-time delivery rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  onTimeDeliveryRate?: number;

  @ApiPropertyOptional({ description: 'Quality defect rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityDefectRate?: number;

  @ApiPropertyOptional({ description: 'Order accuracy rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  orderAccuracyRate?: number;

  @ApiPropertyOptional({ description: 'Price variance rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceVarianceRate?: number;

  @ApiPropertyOptional({ description: 'Response time in hours', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTimeHours?: number;

  @ApiPropertyOptional({ description: 'Total orders' })
  @IsOptional()
  @IsInt()
  totalOrders?: number;

  @ApiPropertyOptional({ description: 'Total value', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Late deliveries count' })
  @IsOptional()
  @IsInt()
  lateDeliveries?: number;

  @ApiPropertyOptional({ description: 'Quality issues count' })
  @IsOptional()
  @IsInt()
  qualityIssues?: number;

  @ApiPropertyOptional({ description: 'Returns count' })
  @IsOptional()
  @IsInt()
  returnsCount?: number;

  @ApiPropertyOptional({ description: 'Performance notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'User who calculated the metrics' })
  @IsOptional()
  @IsString()
  calculatedBy?: string;
}

/**
 * Update Supplier Performance DTO
 */
export class UpdateSupplierPerformanceDto {
  @ApiPropertyOptional({ description: 'Quality score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'Delivery score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryScore?: number;

  @ApiPropertyOptional({ description: 'Cost score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  costScore?: number;

  @ApiPropertyOptional({ description: 'Service score (0-100)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceScore?: number;

  @ApiPropertyOptional({ description: 'On-time delivery rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  onTimeDeliveryRate?: number;

  @ApiPropertyOptional({ description: 'Quality defect rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  qualityDefectRate?: number;

  @ApiPropertyOptional({ description: 'Order accuracy rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  orderAccuracyRate?: number;

  @ApiPropertyOptional({ description: 'Price variance rate (%)', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  priceVarianceRate?: number;

  @ApiPropertyOptional({ description: 'Response time in hours', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTimeHours?: number;

  @ApiPropertyOptional({ description: 'Total orders' })
  @IsOptional()
  @IsInt()
  totalOrders?: number;

  @ApiPropertyOptional({ description: 'Total value', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  totalValue?: number;

  @ApiPropertyOptional({ description: 'Late deliveries count' })
  @IsOptional()
  @IsInt()
  lateDeliveries?: number;

  @ApiPropertyOptional({ description: 'Quality issues count' })
  @IsOptional()
  @IsInt()
  qualityIssues?: number;

  @ApiPropertyOptional({ description: 'Returns count' })
  @IsOptional()
  @IsInt()
  returnsCount?: number;

  @ApiPropertyOptional({ description: 'Performance notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Manager who reviewed the metrics' })
  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

/**
 * Supplier Performance Query DTO
 */
export class SupplierPerformanceQueryDto {
  @ApiPropertyOptional({ description: 'Supplier ID filter' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Period filter (YYYY-MM)' })
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional({ description: 'Tier filter', enum: SupplierTier })
  @IsOptional()
  @IsEnum(SupplierTier)
  tier?: SupplierTier;

  @ApiPropertyOptional({ description: 'Minimum overall score' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minOverallScore?: number;

  @ApiPropertyOptional({ description: 'Maximum overall score' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxOverallScore?: number;

  @ApiPropertyOptional({ description: 'Period start filter' })
  @IsOptional()
  @IsString()
  periodFrom?: string;

  @ApiPropertyOptional({ description: 'Period end filter' })
  @IsOptional()
  @IsString()
  periodTo?: string;

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
 * Supplier Performance Response DTO
 */
export class SupplierPerformanceResponse {
  @ApiProperty({ description: 'Performance record ID' })
  id!: string;

  @ApiProperty({ description: 'Supplier ID' })
  supplierId!: string;

  @ApiPropertyOptional({ description: 'Supplier information' })
  supplier?: {
    id: string;
    name: string;
    code: string;
    email: string;
  };

  @ApiProperty({ description: 'Period in YYYY-MM format' })
  period!: string;

  @ApiProperty({ description: 'Quality score (0-100)', type: 'number', format: 'decimal' })
  qualityScore!: number;

  @ApiProperty({ description: 'Delivery score (0-100)', type: 'number', format: 'decimal' })
  deliveryScore!: number;

  @ApiProperty({ description: 'Cost score (0-100)', type: 'number', format: 'decimal' })
  costScore!: number;

  @ApiProperty({ description: 'Service score (0-100)', type: 'number', format: 'decimal' })
  serviceScore!: number;

  @ApiProperty({ description: 'Overall score (0-100)', type: 'number', format: 'decimal' })
  overallScore!: number;

  @ApiProperty({ description: 'Supplier tier', enum: SupplierTier })
  tier!: SupplierTier;

  @ApiProperty({ description: 'On-time delivery rate (%)', type: 'number', format: 'decimal' })
  onTimeDeliveryRate!: number;

  @ApiProperty({ description: 'Quality defect rate (%)', type: 'number', format: 'decimal' })
  qualityDefectRate!: number;

  @ApiProperty({ description: 'Order accuracy rate (%)', type: 'number', format: 'decimal' })
  orderAccuracyRate!: number;

  @ApiProperty({ description: 'Price variance rate (%)', type: 'number', format: 'decimal' })
  priceVarianceRate!: number;

  @ApiProperty({ description: 'Response time in hours', type: 'number', format: 'decimal' })
  responseTimeHours!: number;

  @ApiProperty({ description: 'Total orders' })
  totalOrders!: number;

  @ApiProperty({ description: 'Total value', type: 'number', format: 'decimal' })
  totalValue!: number;

  @ApiProperty({ description: 'Late deliveries count' })
  lateDeliveries!: number;

  @ApiProperty({ description: 'Quality issues count' })
  qualityIssues!: number;

  @ApiProperty({ description: 'Returns count' })
  returnsCount!: number;

  @ApiPropertyOptional({ description: 'Performance notes' })
  notes?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Calculator user ID' })
  calculatedBy?: string;

  @ApiPropertyOptional({ description: 'Calculator user information' })
  calculator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiPropertyOptional({ description: 'Reviewer user ID' })
  reviewedBy?: string;

  @ApiPropertyOptional({ description: 'Reviewer user information' })
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiPropertyOptional({ description: 'Review timestamp' })
  reviewedAt?: Date;
}

/**
 * Supplier Performance Query Response DTO
 */
export class SupplierPerformanceQueryResponse {
  @ApiProperty({ description: 'Array of supplier performance records', type: [SupplierPerformanceResponse] })
  performances!: SupplierPerformanceResponse[];

  @ApiProperty({ description: 'Total number of records' })
  total!: number;

  @ApiProperty({ description: 'Number of records skipped' })
  skip!: number;

  @ApiProperty({ description: 'Number of records taken' })
  take!: number;
}

/**
 * Performance Analytics Response DTO
 */
export class PerformanceAnalyticsResponse {
  @ApiProperty({ description: 'Total number of suppliers' })
  totalSuppliers!: number;

  @ApiProperty({ description: 'Average overall score across all suppliers', type: 'number', format: 'decimal' })
  averageOverallScore!: number;

  @ApiProperty({ description: 'Distribution of suppliers by tier' })
  tierDistribution!: Record<SupplierTier, number>;

  @ApiProperty({ description: 'Performance trends over time', type: Array })
  performanceTrends!: {
    period: string;
    averageScore: number;
    totalOrders: number;
    totalValue: number;
  }[];

  @ApiProperty({ description: 'Top performing suppliers', type: Array })
  topPerformers!: {
    supplierId: string;
    supplierName: string;
    overallScore: number;
    tier: SupplierTier;
  }[];

  @ApiProperty({ description: 'Low performing suppliers', type: Array })
  lowPerformers!: {
    supplierId: string;
    supplierName: string;
    overallScore: number;
    tier: SupplierTier;
  }[];

  @ApiProperty({ description: 'Key performance metrics' })
  keyMetrics!: {
    averageOnTimeDelivery: number;
    averageQualityScore: number;
    averageDeliveryScore: number;
    averageCostScore: number;
    averageServiceScore: number;
    totalQualityIssues: number;
    totalLateDeliveries: number;
  };
}

/**
 * Scorecard Detail DTO
 */
export class CreateScorecardDetailDto {
  @ApiProperty({ description: 'Performance ID' })
  @IsString()
  performanceId!: string;

  @ApiProperty({ description: 'Metric type', enum: PerformanceMetricType })
  @IsEnum(PerformanceMetricType)
  metricType!: PerformanceMetricType;

  @ApiProperty({ description: 'Metric name' })
  @IsString()
  metricName!: string;

  @ApiProperty({ description: 'Metric value', type: 'number', format: 'decimal' })
  @IsNumber()
  metricValue!: number;

  @ApiProperty({ description: 'Target value', type: 'number', format: 'decimal' })
  @IsNumber()
  targetValue!: number;

  @ApiProperty({ description: 'Performance level', enum: PerformanceLevel })
  @IsEnum(PerformanceLevel)
  performanceLevel!: PerformanceLevel;

  @ApiPropertyOptional({ description: 'Weight in calculation', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ description: 'Calculated score', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @ApiPropertyOptional({ description: 'Trend direction' })
  @IsOptional()
  @IsString()
  trend?: 'IMPROVING' | 'STABLE' | 'DECLINING';

  @ApiPropertyOptional({ description: 'Comments' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ description: 'Supporting data' })
  @IsOptional()
  supportingData?: Record<string, unknown>;
}

/**
 * Performance Event DTO
 */
export class CreatePerformanceEventDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  supplierId!: string;

  @ApiProperty({ description: 'Event type', enum: PerformanceEventType })
  @IsEnum(PerformanceEventType)
  eventType!: PerformanceEventType;

  @ApiProperty({ description: 'Event date' })
  @IsDate()
  @Type(() => Date)
  eventDate!: Date;

  @ApiProperty({ description: 'Event severity', enum: EventSeverity })
  @IsEnum(EventSeverity)
  severity!: EventSeverity;

  @ApiProperty({ description: 'Event description' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Business impact description' })
  @IsOptional()
  @IsString()
  impact?: string;

  @ApiPropertyOptional({ description: 'Related order ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Related order item ID' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Cost impact', type: 'number', format: 'decimal' })
  @IsOptional()
  @IsNumber()
  costImpact?: number;

  @ApiPropertyOptional({ description: 'Preventive actions' })
  @IsOptional()
  @IsString()
  preventiveAction?: string;

  @ApiPropertyOptional({ description: 'User who created the event' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}