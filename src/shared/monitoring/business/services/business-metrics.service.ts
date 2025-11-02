/**
 * Business Metrics Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles business metrics coordination and calculation
 * Open/Closed: Open for extension with new metric types and calculations
 * Interface Segregation: Implements focused business metrics interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear metric calculation logic
 * No unnecessary complexity, focused on business metrics coordination
 */

import { Injectable } from '@nestjs/common';
import {
  IBusinessMetricsService,
  IUserAnalyticsService,
  ITransactionAnalyticsService,
  IRevenueMonitoringService,
  IOperationalEfficiencyService,
  ICustomerBehaviorService,
  IProductPerformanceService,
  ISalesFunnelService,
  IInventoryTurnoverService,
  IFinancialKpiService
} from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  UserMetrics,
  TransactionMetrics,
  RevenueMetrics,
  // OperationalEfficiencyMetrics,
  // CustomerBehaviorMetrics,
  // ProductPerformanceMetrics,
  // SalesFunnelMetrics,
  // InventoryTurnoverMetrics,
  // FinancialKpiMetrics,
  BusinessMetricsSummary
} from '../types/metric.types';

@Injectable()
export class BusinessMetricsService implements IBusinessMetricsService {
  constructor(
    private readonly userAnalyticsService?: IUserAnalyticsService,
    private readonly transactionAnalyticsService?: ITransactionAnalyticsService,
    private readonly revenueMonitoringService?: IRevenueMonitoringService,
    private readonly operationalEfficiencyService?: IOperationalEfficiencyService,
    private readonly customerBehaviorService?: ICustomerBehaviorService,
    private readonly productPerformanceService?: IProductPerformanceService,
    private readonly salesFunnelService?: ISalesFunnelService,
    private readonly inventoryTurnoverService?: IInventoryTurnoverService,
    private readonly financialKpiService?: IFinancialKpiService,
  ) {}

  /**
   * Calculate comprehensive business metrics summary
   * Single Responsibility: Only handles summary coordination
   * KISS: Simple parallel calculation with aggregation
   */
  async getBusinessMetricsSummary(timeRange: MetricTimeRange): Promise<BusinessMetricsSummary> {
    // KISS: Sequential execution to avoid type issues
    const userMetrics = await this.calculateUserAnalytics(timeRange);
    const transactionMetrics = await this.calculateTransactionAnalytics(timeRange);
    const revenueMetrics = await this.calculateRevenueMetrics(timeRange);
    const operationalEfficiencyMetrics = await this.operationalEfficiencyService!.getOrderFulfillmentMetrics(timeRange);
    const customerBehaviorMetrics = await this.customerBehaviorService!.getCustomerAcquisitionMetrics(timeRange);
    const productPerformanceMetrics = await this.productPerformanceService!.getProductSalesMetrics(timeRange);
    const salesFunnelMetrics = await this.salesFunnelService!.getLeadConversionMetrics(timeRange);
    const inventoryTurnoverMetrics = await this.inventoryTurnoverService!.getInventoryTurnoverRatio(timeRange);
    const financialKpiMetrics = await this.financialKpiService!.getGrossProfitMargin(timeRange);

    return {
      userMetrics,
      transactionMetrics,
      revenueMetrics,
      operationalEfficiencyMetrics,
      customerBehaviorMetrics,
      productPerformanceMetrics,
      salesFunnelMetrics,
      inventoryTurnoverMetrics,
      financialKpiMetrics,
      calculatedAt: new Date(),
      timeRange
    };
  }

  /**
   * Calculate user analytics metrics
   * Single Responsibility: Only handles user analytics coordination
   * KISS: Simple delegation to specialized service
   */
  async calculateUserAnalytics(timeRange: MetricTimeRange): Promise<UserMetrics> {
    if (!this.userAnalyticsService) {
      throw new Error('User Analytics Service is not available');
    }
    return this.userAnalyticsService.getActiveUsers(timeRange);
  }

  /**
   * Calculate transaction analytics metrics
   * Single Responsibility: Only handles transaction analytics coordination
   * KISS: Simple delegation to specialized service
   */
  async calculateTransactionAnalytics(timeRange: MetricTimeRange): Promise<TransactionMetrics> {
    if (!this.transactionAnalyticsService) {
      throw new Error('Transaction Analytics Service is not available');
    }
    return this.transactionAnalyticsService.getTransactionVolume(timeRange);
  }

  /**
   * Calculate revenue metrics
   * Single Responsibility: Only handles revenue metrics coordination
   * KISS: Simple delegation to specialized service
   */
  async calculateRevenueMetrics(timeRange: MetricTimeRange): Promise<RevenueMetrics> {
    if (!this.revenueMonitoringService) {
      throw new Error('Revenue Monitoring Service is not available');
    }
    return this.revenueMonitoringService.getTotalRevenue(timeRange);
  }
}