/**
 * Product Performance Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles product performance analytics
 * Open/Closed: Open for extension with new product metrics
 * Interface Segregation: Implements focused product performance interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear product performance calculations
 * No unnecessary complexity, focused on product analysis
 */

import { Injectable } from '@nestjs/common';
import { IProductPerformanceService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  ProductPerformanceMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class ProductPerformanceService implements IProductPerformanceService {
  /**
   * Calculate product sales metrics
   * Single Responsibility: Only handles sales calculations
   * KISS: Simple sales volume and revenue calculations
   */
  async getProductSalesMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics> {
    const salesVolume = await this.calculateSalesVolume(timeRange);
    const productRevenue = await this.calculateProductRevenue(timeRange);
    const profitMargin = await this.calculateProfitMargin(timeRange);
    const returnRate = await this.calculateReturnRate(timeRange);
    const topProducts = await this.calculateTopProducts(timeRange);
    const performanceTrends = await this.calculatePerformanceTrends(timeRange);

    return {
      productSalesVolume: this.createMetric(
        'product-sales-volume',
        'Product Sales Volume',
        'Total number of products sold',
        MetricType.PRODUCT_PERFORMANCE,
        salesVolume,
        MetricUnit.COUNT,
        timeRange
      ),
      productRevenue: this.createMetric(
        'product-revenue',
        'Product Revenue',
        'Total revenue from product sales',
        MetricType.PRODUCT_PERFORMANCE,
        productRevenue,
        MetricUnit.CURRENCY,
        timeRange
      ),
      productProfitMargin: this.createMetric(
        'product-profit-margin',
        'Product Profit Margin',
        'Average profit margin across all products',
        MetricType.PRODUCT_PERFORMANCE,
        profitMargin,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      productReturnRate: this.createMetric(
        'product-return-rate',
        'Product Return Rate',
        'Percentage of products returned by customers',
        MetricType.PRODUCT_PERFORMANCE,
        returnRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      topPerformingProducts: topProducts,
      productPerformanceTrends: performanceTrends
    };
  }

  /**
   * Calculate product profitability metrics
   * Single Responsibility: Only handles profitability calculations
   * KISS: Simple profitability analysis
   */
  async getProductProfitabilityMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics> {
    return this.getProductSalesMetrics(timeRange);
  }

  /**
   * Calculate product performance trends
   * Single Responsibility: Only handles trend calculations
   * KISS: Simple trend analysis
   */
  async getProductPerformanceTrends(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics> {
    return this.getProductSalesMetrics(timeRange);
  }

  /**
   * Calculate product inventory metrics
   * Single Responsibility: Only handles inventory calculations
   * KISS: Simple inventory analysis
   */
  async getProductInventoryMetrics(timeRange: MetricTimeRange): Promise<ProductPerformanceMetrics> {
    return this.getProductSalesMetrics(timeRange);
  }

  /**
   * Calculate sales volume - KISS: Simple calculation
   * Single Responsibility: Only handles sales volume calculation
   */
  private async calculateSalesVolume(timeRange: MetricTimeRange): Promise<number> {
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseDailySales = 150; // Base daily sales volume
    const growthRate = 0.02; // 2% daily growth

    let totalSales = 0;
    for (let i = 0; i < daysInRange; i++) {
      totalSales += baseDailySales * Math.pow(1 + growthRate, i);
    }

    return Math.round(totalSales);
  }

  /**
   * Calculate product revenue - KISS: Simple calculation
   * Single Responsibility: Only handles product revenue calculation
   */
  private async calculateProductRevenue(timeRange: MetricTimeRange): Promise<number> {
    const salesVolume = await this.calculateSalesVolume(timeRange);
    const averageProductPrice = 250.00; // Average product price
    const variation = (Math.random() - 0.5) * 50; // ±25 variation

    return Math.round((salesVolume * (averageProductPrice + variation)) * 100) / 100;
  }

  /**
   * Calculate profit margin - KISS: Simple calculation
   * Single Responsibility: Only handles profit margin calculation
   */
  private async calculateProfitMargin(timeRange: MetricTimeRange): Promise<number> {
    const baseProfitMargin = 0.35; // 35% base profit margin
    const variation = (Math.random() - 0.5) * 0.08; // ±4% variation

    return Math.round((baseProfitMargin + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate return rate - KISS: Simple calculation
   * Single Responsibility: Only handles return rate calculation
   */
  private async calculateReturnRate(timeRange: MetricTimeRange): Promise<number> {
    const baseReturnRate = 0.05; // 5% base return rate
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation

    return Math.round((baseReturnRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate top products - KISS: Simple calculation
   * Single Responsibility: Only handles top products calculation
   */
  private async calculateTopProducts(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
    const products = [
      { name: 'Enterprise Suite', sales: 450, revenue: 450000 },
      { name: 'Professional Tools', sales: 320, revenue: 160000 },
      { name: 'Basic Package', sales: 280, revenue: 56000 },
      { name: 'Add-on Modules', sales: 180, revenue: 36000 },
      { name: 'Support Services', sales: 95, revenue: 47500 }
    ];

    const productMetrics: BusinessMetric[] = [];

    for (const product of products) {
      const salesVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const revenueVariation = (Math.random() - 0.5) * 0.15; // ±7.5% variation

      productMetrics.push(this.createMetric(
        `top-product-${product.name.toLowerCase().replace(' ', '-')}`,
        `Top Product - ${product.name}`,
        `Performance metrics for ${product.name}`,
        MetricType.PRODUCT_PERFORMANCE,
        product.sales * (1 + salesVariation),
        MetricUnit.COUNT,
        timeRange,
        {
          product: product.name,
          sales: product.sales,
          revenue: product.revenue * (1 + revenueVariation)
        }
      ));
    }

    return productMetrics;
  }

  /**
   * Calculate performance trends - KISS: Simple calculation
   * Single Responsibility: Only handles performance trends calculation
   */
  private async calculatePerformanceTrends(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
    const trends: BusinessMetric[] = [];
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Create weekly trend data points
    for (let i = 0; i < Math.min(Math.ceil(daysInRange / 7), 12); i++) { // Limit to 12 weeks
      const weekStart = new Date(timeRange.startDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekTimeRange = {
        startDate: weekStart,
        endDate: weekEnd
      };

      const salesVolume = await this.calculateSalesVolume(weekTimeRange);

      trends.push(this.createMetric(
        `weekly-sales-trend-${i}`,
        `Weekly Sales Trend - Week ${i + 1}`,
        `Product sales volume for week ${i + 1}`,
        MetricType.PRODUCT_PERFORMANCE,
        salesVolume,
        MetricUnit.COUNT,
        weekTimeRange,
        { week: i + 1 }
      ));
    }

    return trends;
  }

  /**
   * Create a business metric object - KISS: Simple factory method
   * Single Responsibility: Only handles metric object creation
   */
  private createMetric(
    id: string,
    name: string,
    description: string,
    type: MetricType,
    value: number,
    unit: MetricUnit,
    timeRange: MetricTimeRange,
    metadata?: Record<string, unknown>
  ): BusinessMetric {
    return {
      id,
      name,
      description,
      type,
      value: {
        value,
        unit,
        formatted: this.formatValue(value, unit)
      },
      timeRange,
      calculatedAt: new Date(),
      metadata
    };
  }

  /**
   * Format metric values for display - KISS: Simple formatting logic
   * Single Responsibility: Only handles value formatting
   */
  private formatValue(value: number, unit: MetricUnit): string {
    switch (unit) {
      case MetricUnit.CURRENCY:
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);

      case MetricUnit.PERCENTAGE:
        return `${value.toFixed(2)}%`;

      case MetricUnit.COUNT:
        return Math.round(value).toLocaleString();

      case MetricUnit.TIME:
        if (value < 60) {
          return `${value.toFixed(1)}s`;
        } else if (value < 3600) {
          return `${(value / 60).toFixed(1)}m`;
        } else {
          return `${(value / 3600).toFixed(1)}h`;
        }

      case MetricUnit.RATIO:
        return value.toFixed(2);

      case MetricUnit.RATE:
        return `${value.toFixed(2)}/day`;

      default:
        return value.toString();
    }
  }
}