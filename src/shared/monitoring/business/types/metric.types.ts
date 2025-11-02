/**
 * Business Metrics Types - Following SOLID Principles
 *
 * Single Responsibility: Only handles business metric type definitions
 * Open/Closed: Open for extension with new metric types
 * Interface Segregation: Focused interfaces for specific metric categories
 * Dependency Inversion: Depends on abstractions, not implementations
 * Liskov Substitution: Consistent metric interface implementations
 *
 * KISS Principle: Simple, clear metric type definitions
 * No unnecessary complexity, focused on business metric structure
 */

export enum MetricType {
  USER_ANALYTICS = 'USER_ANALYTICS',
  TRANSACTION_ANALYTICS = 'TRANSACTION_ANALYTICS',
  REVENUE = 'REVENUE',
  OPERATIONAL_EFFICIENCY = 'OPERATIONAL_EFFICIENCY',
  CUSTOMER_BEHAVIOR = 'CUSTOMER_BEHAVIOR',
  PRODUCT_PERFORMANCE = 'PRODUCT_PERFORMANCE',
  SALES_FUNNEL = 'SALES_FUNNEL',
  INVENTORY_TURNOVER = 'INVENTORY_TURNOVER',
  FINANCIAL_KPI = 'FINANCIAL_KPI',
}

export enum MetricUnit {
  COUNT = 'COUNT',
  PERCENTAGE = 'PERCENTAGE',
  CURRENCY = 'CURRENCY',
  TIME = 'TIME',
  RATIO = 'RATIO',
  RATE = 'RATE',
}

export interface MetricTimeRange {
  startDate: Date;
  endDate: Date;
}

export interface MetricValue {
  value: number;
  unit: MetricUnit;
  formatted: string;
}

export interface MetricTrend {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  previousValue: number;
}

export interface BusinessMetric {
  id: string;
  name: string;
  description: string;
  type: MetricType;
  value: MetricValue;
  trend?: MetricTrend;
  timeRange: MetricTimeRange;
  calculatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UserMetrics {
  activeUsers: BusinessMetric;
  newUsers: BusinessMetric;
  userEngagementRate: BusinessMetric;
  userRetentionRate: BusinessMetric;
  averageSessionDuration: BusinessMetric;
  userActivityTrends: BusinessMetric[];
}

export interface TransactionMetrics {
  totalTransactions: BusinessMetric;
  successfulTransactions: BusinessMetric;
  transactionSuccessRate: BusinessMetric;
  averageTransactionValue: BusinessMetric;
  averageProcessingTime: BusinessMetric;
  transactionVolumeTrends: BusinessMetric[];
}

export interface RevenueMetrics {
  totalRevenue: BusinessMetric;
  revenueGrowthRate: BusinessMetric;
  recurringRevenue: BusinessMetric;
  revenueByProductCategory: BusinessMetric[];
  revenueByRegion: BusinessMetric[];
  averageRevenuePerUser: BusinessMetric;
}

export interface OperationalEfficiencyMetrics {
  orderFulfillmentRate: BusinessMetric;
  averageOrderProcessingTime: BusinessMetric;
  inventoryTurnoverRatio: BusinessMetric;
  resourceUtilizationRate: BusinessMetric;
  processEfficiencyScore: BusinessMetric;
  operationalCosts: BusinessMetric;
}

export interface CustomerBehaviorMetrics {
  customerAcquisitionCost: BusinessMetric;
  customerLifetimeValue: BusinessMetric;
  customerChurnRate: BusinessMetric;
  customerSatisfactionScore: BusinessMetric;
  repeatPurchaseRate: BusinessMetric;
  customerSegmentationMetrics: BusinessMetric[];
}

export interface ProductPerformanceMetrics {
  productSalesVolume: BusinessMetric;
  productRevenue: BusinessMetric;
  productProfitMargin: BusinessMetric;
  productReturnRate: BusinessMetric;
  topPerformingProducts: BusinessMetric[];
  productPerformanceTrends: BusinessMetric[];
}

export interface SalesFunnelMetrics {
  leadConversionRate: BusinessMetric;
  opportunityToWinRate: BusinessMetric;
  averageSalesCycleLength: BusinessMetric;
  salesPipelineValue: BusinessMetric;
  funnelStageConversionRates: BusinessMetric[];
  salesEffectivenessScore: BusinessMetric;
}

export interface InventoryTurnoverMetrics {
  inventoryTurnoverRatio: BusinessMetric;
  daysInventoryOutstanding: BusinessMetric;
  stockoutRate: BusinessMetric;
  inventoryHoldingCosts: BusinessMetric;
  fillRate: BusinessMetric;
  inventoryAccuracy: BusinessMetric;
}

export interface FinancialKpiMetrics {
  grossProfitMargin: BusinessMetric;
  netProfitMargin: BusinessMetric;
  returnOnAssets: BusinessMetric;
  returnOnEquity: BusinessMetric;
  currentRatio: BusinessMetric;
  debtToEquityRatio: BusinessMetric;
  operatingCashFlow: BusinessMetric;
  earningsPerShare: BusinessMetric;
}

export interface BusinessMetricsSummary {
  userMetrics: UserMetrics;
  transactionMetrics: TransactionMetrics;
  revenueMetrics: RevenueMetrics;
  operationalEfficiencyMetrics: OperationalEfficiencyMetrics;
  customerBehaviorMetrics: CustomerBehaviorMetrics;
  productPerformanceMetrics: ProductPerformanceMetrics;
  salesFunnelMetrics: SalesFunnelMetrics;
  inventoryTurnoverMetrics: InventoryTurnoverMetrics;
  financialKpiMetrics: FinancialKpiMetrics;
  calculatedAt: Date;
  timeRange: MetricTimeRange;
}

export interface MetricCalculationRequest {
  metricType: MetricType;
  timeRange: MetricTimeRange;
  filters?: Record<string, unknown>;
  groupBy?: string[];
  includeTrends?: boolean;
}

export interface MetricCalculationResult {
  metric: BusinessMetric;
  calculationTime: number;
  dataSource: string;
  confidence: number;
}

export interface MetricAlert {
  id: string;
  metricId: string;
  threshold: number;
  condition: 'greater_than' | 'less_than' | 'equals';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
}