/**
 * Business Metric Services Interface - Following SOLID Principles
 *
 * Single Responsibility: Only handles business metric service interface definitions
 * Open/Closed: Open for implementation with different metric calculation strategies
 * Interface Segregation: Focused interfaces for specific metric categories
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Consistent interface for all metric services
 *
 * KISS Principle: Simple, focused interfaces for business metrics
 * No unnecessary complexity, focused on service contracts
 */

import {
  MetricTimeRange,
  UserMetrics,
  TransactionMetrics,
  RevenueMetrics,
  OperationalEfficiencyMetrics,
  CustomerBehaviorMetrics,
  ProductPerformanceMetrics,
  SalesFunnelMetrics,
  InventoryTurnoverMetrics,
  FinancialKpiMetrics,
  BusinessMetricsSummary
} from '../types/metric.types';

export interface IUserAnalyticsService {
  /**
   * Get active users metrics for the specified time range
   * Single Responsibility: Only handles active user calculations
   */
  getActiveUsers(timeRange: MetricTimeRange): Promise<UserMetrics>;

  /**
   * Calculate user engagement metrics
   * Single Responsibility: Only handles engagement calculations
   */
  getUserEngagementMetrics(timeRange: MetricTimeRange): Promise<UserMetrics>;

  /**
   * Calculate user retention metrics
   * Single Responsibility: Only handles retention calculations
   */
  getUserRetentionMetrics(timeRange: MetricTimeRange): Promise<UserMetrics>;

  /**
   * Calculate user activity trends
   * Single Responsibility: Only handles trend analysis
   */
  getUserActivityTrends(timeRange: MetricTimeRange): Promise<UserMetrics>;
}

export interface ITransactionAnalyticsService {
  /**
   * Calculate transaction volume metrics
   * Single Responsibility: Only handles volume calculations
   */
  getTransactionVolume(timeRange: MetricTimeRange): Promise<TransactionMetrics>;

  /**
   * Calculate transaction success rate
   * Single Responsibility: Only handles success rate calculations
   */
  getTransactionSuccessRate(timeRange: MetricTimeRange): Promise<TransactionMetrics>;

  /**
   * Calculate average transaction value
   * Single Responsibility: Only handles average value calculations
   */
  getAverageTransactionValue(timeRange: MetricTimeRange): Promise<TransactionMetrics>;

  /**
   * Calculate transaction processing time metrics
   * Single Responsibility: Only handles processing time calculations
   */
  getTransactionProcessingTime(timeRange: MetricTimeRange): Promise<TransactionMetrics>;
}

export interface IRevenueMonitoringService {
  /**
   * Calculate total revenue for the time range
   * Single Responsibility: Only handles total revenue calculations
   */
  getTotalRevenue(timeRange: MetricTimeRange): Promise<RevenueMetrics>;

  /**
   * Calculate revenue growth rate
   * Single Responsibility: Only handles growth rate calculations
   */
  getRevenueGrowthRate(timeRange: MetricTimeRange): Promise<RevenueMetrics>;

  /**
   * Calculate revenue by product category
   * Single Responsibility: Only handles category-based revenue calculations
   */
  getRevenueByProductCategory(timeRange: MetricTimeRange): Promise<RevenueMetrics>;

  /**
   * Calculate recurring revenue metrics
   * Single Responsibility: Only handles recurring revenue calculations
   */
  getRecurringRevenueMetrics(timeRange: MetricTimeRange): Promise<RevenueMetrics>;
}

export interface IOperationalEfficiencyService {
  /**
   * Calculate order fulfillment metrics
   * Single Responsibility: Only handles fulfillment calculations
   */
  getOrderFulfillmentMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics>;

  /**
   * Calculate inventory turnover ratio
   * Single Responsibility: Only handles inventory turnover calculations
   */
  getInventoryTurnoverRatio(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics>;

  /**
   * Calculate resource utilization metrics
   * Single Responsibility: Only handles utilization calculations
   */
  getResourceUtilizationMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics>;

  /**
   * Calculate process efficiency metrics
   * Single Responsibility: Only handles efficiency calculations
   */
  getProcessEfficiencyMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics>;
}

export interface ICustomerBehaviorService {
  /**
   * Calculate customer acquisition metrics
   * Single Responsibility: Only handles acquisition calculations
   */
  getCustomerAcquisitionMetrics(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics>;

  /**
   * Calculate customer lifetime value
   * Single Responsibility: Only handles CLV calculations
   */
  getCustomerLifetimeValue(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics>;

  /**
   * Calculate customer churn rate
   * Single Responsibility: Only handles churn calculations
   */
  getCustomerChurnRate(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics>;

  /**
   * Calculate customer segmentation metrics
   * Single Responsibility: Only handles segmentation calculations
   */
  getCustomerSegmentationMetrics(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics>;
}

export interface IProductPerformanceService {
  /**
   * Calculate product sales metrics
   * Single Responsibility: Only handles sales calculations
   */
  getProductSalesMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics>;

  /**
   * Calculate product profitability metrics
   * Single Responsibility: Only handles profitability calculations
   */
  getProductProfitabilityMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics>;

  /**
   * Calculate product performance trends
   * Single Responsibility: Only handles trend calculations
   */
  getProductPerformanceTrends(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics>;

  /**
   * Calculate product inventory metrics
   * Single Responsibility: Only handles inventory calculations
   */
  getProductInventoryMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics>;
}

export interface ISalesFunnelService {
  /**
   * Calculate lead conversion metrics
   * Single Responsibility: Only handles conversion calculations
   */
  getLeadConversionMetrics(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics>;

  /**
   * Calculate sales cycle metrics
   * Single Responsibility: Only handles cycle calculations
   */
  getSalesCycleMetrics(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics>;

  /**
   * Calculate funnel stage conversion rates
   * Single Responsibility: Only handles stage conversion calculations
   */
  getFunnelStageConversionRates(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics>;

  /**
   * Calculate sales pipeline value
   * Single Responsibility: Only handles pipeline value calculations
   */
  getSalesPipelineValue(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics>;
}

export interface IInventoryTurnoverService {
  /**
   * Calculate inventory turnover ratio
   * Single Responsibility: Only handles turnover calculations
   */
  getInventoryTurnoverRatio(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics>;

  /**
   * Calculate days inventory outstanding
   * Single Responsibility: Only handles DIO calculations
   */
  getDaysInventoryOutstanding(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics>;

  /**
   * Calculate stockout metrics
   * Single Responsibility: Only handles stockout calculations
   */
  getStockoutMetrics(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics>;

  /**
   * Calculate inventory holding costs
   * Single Responsibility: Only handles holding cost calculations
   */
  getInventoryHoldingCosts(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics>;
}

export interface IFinancialKpiService {
  /**
   * Calculate gross profit margin
   * Single Responsibility: Only handles gross margin calculations
   */
  getGrossProfitMargin(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics>;

  /**
   * Calculate net profit margin
   * Single Responsibility: Only handles net margin calculations
   */
  getNetProfitMargin(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics>;

  /**
   * Calculate return on assets
   * Single Responsibility: Only handles ROA calculations
   */
  getReturnOnAssets(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics>;

  /**
   * Calculate current ratio
   * Single Responsibility: Only handles current ratio calculations
   */
  getCurrentRatio(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics>;

  /**
   * Calculate debt to equity ratio
   * Single Responsibility: Only handles debt-to-equity calculations
   */
  getDebtToEquityRatio(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics>;
}

export interface IBusinessMetricsService {
  /**
   * Calculate comprehensive business metrics summary
   * Single Responsibility: Only handles summary calculations
   */
  getBusinessMetricsSummary(timeRange: MetricTimeRange): Promise<BusinessMetricsSummary>;

  /**
   * Calculate user analytics metrics
   * Single Responsibility: Only handles user analytics coordination
   */
  calculateUserAnalytics(timeRange: MetricTimeRange): Promise<UserMetrics>;

  /**
   * Calculate transaction analytics metrics
   * Single Responsibility: Only handles transaction analytics coordination
   */
  calculateTransactionAnalytics(timeRange: MetricTimeRange): Promise<TransactionMetrics>;

  /**
   * Calculate revenue metrics
   * Single Responsibility: Only handles revenue calculations coordination
   */
  calculateRevenueMetrics(timeRange: MetricTimeRange): Promise<RevenueMetrics>;
}