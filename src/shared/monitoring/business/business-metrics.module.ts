/**
 * Business Metrics Module - Following SOLID Principles
 *
 * Single Responsibility: Only handles business metrics module configuration
 * Open/Closed: Open for extension with new providers and controllers
 * Interface Segregation: Focused module with business metrics dependencies
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple module configuration with clear dependencies
 * No unnecessary complexity, focused on module setup
 */

import { Module } from '@nestjs/common';
import { BusinessMetricsController } from './controllers/business-metrics.controller';
import { BusinessMetricsService } from './services/business-metrics.service';
import { UserAnalyticsService } from './services/user-analytics.service';
import { TransactionAnalyticsService } from './services/transaction-analytics.service';
import { RevenueMonitoringService } from './services/revenue-monitoring.service';
import { OperationalEfficiencyService } from './services/operational-efficiency.service';
import { CustomerBehaviorService } from './services/customer-behavior.service';
import { ProductPerformanceService } from './services/product-performance.service';
import { SalesFunnelService } from './services/sales-funnel.service';
import { InventoryTurnoverService } from './services/inventory-turnover.service';
import { FinancialKpiService } from './services/financial-kpi.service';

@Module({
  controllers: [BusinessMetricsController],
  providers: [
    // Core Business Metrics Service
    BusinessMetricsService,

    // Business Analytics Services - KISS: Simple dependency injection
    UserAnalyticsService,
    TransactionAnalyticsService,
    RevenueMonitoringService,
    OperationalEfficiencyService,
    CustomerBehaviorService,
    ProductPerformanceService,
    SalesFunnelService,
    InventoryTurnoverService,
    FinancialKpiService,
  ],
  exports: [
    // Export services for use in other modules
    BusinessMetricsService,
    UserAnalyticsService,
    TransactionAnalyticsService,
    RevenueMonitoringService,
    OperationalEfficiencyService,
    CustomerBehaviorService,
    ProductPerformanceService,
    SalesFunnelService,
    InventoryTurnoverService,
    FinancialKpiService,
  ],
})
export class BusinessMetricsModule {}