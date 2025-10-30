import { IsString, IsOptional, IsEnum, IsObject, IsDate, IsNumber, IsArray, IsBoolean, Min, Max, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum ReportType {
  FINANCIAL = 'FINANCIAL',
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  PURCHASING = 'PURCHASING',
  EXECUTIVE = 'EXECUTIVE',
}

export enum ReportCategory {
  SUMMARY = 'SUMMARY',
  DETAILED = 'DETAILED',
  ANALYTICS = 'ANALYTICS',
  KPI = 'KPI',
}

export enum ReportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
  PDF = 'PDF',
  EXCEL = 'EXCEL',
}

export enum ReportStatus {
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum KpiCategory {
  FINANCIAL = 'FINANCIAL',
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  PURCHASING = 'PURCHASING',
}

export class CreateReportDefinitionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  @IsString()
  query: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateReportDefinitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportCategory)
  category?: ReportCategory;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class GenerateReportDto {
  @IsString()
  reportDefinitionId: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, any>;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat = ReportFormat.JSON;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8760) // Max 1 year cache
  @Transform(({ value }) => parseInt(value))
  cacheHours?: number = 1;
}

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportCategory)
  category?: ReportCategory;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  skip?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  take?: number = 10;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  sortBy?: string = 'name';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  sortOrder?: 'asc' | 'desc' = 'asc';
}

export class FinancialReportParamsDto {
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
  @MaxLength(3)
  currency?: string = 'USD';

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeComparisons?: boolean = false;
}

export class SalesReportParamsDto {
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
  @MaxLength(50)
  customerGrouping?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  productGrouping?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  includeDetails?: boolean = false;
}

export class CreateDashboardDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  layout: Record<string, any>;

  @IsArray()
  widgets: Array<Record<string, any>>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;
}

export class CreateKpiDefinitionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(KpiCategory)
  category: KpiCategory;

  @IsString()
  formula: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  target?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

// Response Types
export interface ReportDefinitionResponse {
  id: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  query: string;
  parameters?: Record<string, any>;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReportResponse {
  id: string;
  reportDefinitionId: string;
  name: string;
  parameters?: Record<string, any>;
  data: Record<string, any>;
  format: string;
  status: string;
  generatedAt: Date;
  expiresAt?: Date;
  fileUrl?: string;
}

export interface ReportsQueryResponse {
  reports: ReportDefinitionResponse[];
  total: number;
  skip: number;
  take: number;
}

export interface DashboardResponse {
  id: string;
  name: string;
  description?: string;
  layout: Record<string, any>;
  widgets: Array<Record<string, any>>;
  isActive: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KpiDefinitionResponse {
  id: string;
  name: string;
  description?: string;
  category: string;
  formula: string;
  unit?: string;
  target?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialReportResponse {
  revenue: {
    total: number;
    byPeriod: Array<{ period: string; amount: number }>;
    byCategory: Array<{ category: string; amount: number }>;
  };
  expenses: {
    total: number;
    byPeriod: Array<{ period: string; amount: number }>;
    byCategory: Array<{ category: string; amount: number }>;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  period: string;
  currency: string;
}

export interface SalesAnalyticsResponse {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  topCustomers: Array<{ customerId: string; name: string; total: number }>;
  topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  salesByPeriod: Array<{ period: string; sales: number; orders: number }>;
  conversionRate: number;
}

export interface InventoryReportResponse {
  totalProducts: number;
  totalValue: number;
  lowStockItems: Array<{ productId: string; name: string; currentStock: number; threshold: number }>;
  stockMovements: Array<{ type: string; quantity: number; value: number; date: Date }>;
  topCategories: Array<{ categoryId: string; name: string; value: number }>;
  turnoverRate: number;
}

export interface PurchasingAnalyticsResponse {
  totalSpend: number;
  totalPurchaseOrders: number;
  averageOrderValue: number;
  topSuppliers: Array<{ supplierId: string; name: string; total: number }>;
  spendByCategory: Array<{ category: string; amount: number }>;
  ordersByStatus: Array<{ status: string; count: number; value: number }>;
  averageDeliveryTime: number;
}

export interface ExecutiveDashboardResponse {
  kpis: {
    revenue: { current: number; target: number; trend: number };
    profit: { current: number; target: number; trend: number };
    orders: { current: number; target: number; trend: number };
    customers: { current: number; target: number; trend: number };
  };
  charts: {
    revenueChart: Array<{ period: string; value: number }>;
    profitChart: Array<{ period: string; value: number }>;
    orderChart: Array<{ period: string; value: number }>;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: string;
    createdAt: Date;
  }>;
}