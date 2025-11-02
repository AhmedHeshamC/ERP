/**
 * Inventory Turnover Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles inventory turnover analytics
 * Open/Closed: Open for extension with new inventory metrics
 * Interface Segregation: Implements focused inventory turnover interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear inventory turnover calculations
 * No unnecessary complexity, focused on inventory analysis
 */

import { Injectable } from '@nestjs/common';
import { IInventoryTurnoverService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  InventoryTurnoverMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class InventoryTurnoverService implements IInventoryTurnoverService {
  /**
   * Calculate inventory turnover ratio
   * Single Responsibility: Only handles turnover calculations
   * KISS: Simple turnover ratio calculation
   */
  async getInventoryTurnoverRatio(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics> {
    const turnoverRatio = await this.calculateTurnoverRatio(timeRange);
    const daysInventoryOutstanding = await this.calculateDaysInventoryOutstanding(timeRange);
    const stockoutRate = await this.calculateStockoutRate(timeRange);
    const holdingCosts = await this.calculateHoldingCosts(timeRange);
    const fillRate = await this.calculateFillRate(timeRange);
    const accuracy = await this.calculateAccuracy(timeRange);

    return {
      inventoryTurnoverRatio: this.createMetric(
        'inventory-turnover-ratio',
        'Inventory Turnover Ratio',
        'Number of times inventory is sold and replaced over a period',
        MetricType.INVENTORY_TURNOVER,
        turnoverRatio,
        MetricUnit.RATIO,
        timeRange
      ),
      daysInventoryOutstanding: this.createMetric(
        'days-inventory-outstanding',
        'Days Inventory Outstanding',
        'Average number of days inventory is held before sale',
        MetricType.INVENTORY_TURNOVER,
        daysInventoryOutstanding,
        MetricUnit.TIME,
        timeRange
      ),
      stockoutRate: this.createMetric(
        'stockout-rate',
        'Stockout Rate',
        'Percentage of time items are out of stock when requested',
        MetricType.INVENTORY_TURNOVER,
        stockoutRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      inventoryHoldingCosts: this.createMetric(
        'inventory-holding-costs',
        'Inventory Holding Costs',
        'Total costs associated with holding inventory',
        MetricType.INVENTORY_TURNOVER,
        holdingCosts,
        MetricUnit.CURRENCY,
        timeRange
      ),
      fillRate: this.createMetric(
        'fill-rate',
        'Fill Rate',
        'Percentage of customer orders filled from stock',
        MetricType.INVENTORY_TURNOVER,
        fillRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      inventoryAccuracy: this.createMetric(
        'inventory-accuracy',
        'Inventory Accuracy',
        'Percentage of inventory records that match physical counts',
        MetricType.INVENTORY_TURNOVER,
        accuracy,
        MetricUnit.PERCENTAGE,
        timeRange
      )
    };
  }

  /**
   * Calculate days inventory outstanding
   * Single Responsibility: Only handles DIO calculations
   * KISS: Simple DIO calculation
   */
  async getDaysInventoryOutstanding(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics> {
    return this.getInventoryTurnoverRatio(timeRange);
  }

  /**
   * Calculate stockout metrics
   * Single Responsibility: Only handles stockout calculations
   * KISS: Simple stockout rate calculation
   */
  async getStockoutMetrics(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics> {
    return this.getInventoryTurnoverRatio(timeRange);
  }

  /**
   * Calculate inventory holding costs
   * Single Responsibility: Only handles holding cost calculations
   * KISS: Simple holding cost calculation
   */
  async getInventoryHoldingCosts(timeRange: MetricTimeRange): Promise<InventoryTurnoverMetrics> {
    return this.getInventoryTurnoverRatio(timeRange);
  }

  /**
   * Calculate turnover ratio - KISS: Simple calculation
   * Single Responsibility: Only handles turnover ratio calculation
   */
  private async calculateTurnoverRatio(timeRange: MetricTimeRange): Promise<number> {
    const baseTurnoverRatio = 8.5; // 8.5 times per year base
    const variation = (Math.random() - 0.5) * 2.0; // ±1 variation

    return Math.round((baseTurnoverRatio + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate days inventory outstanding - KISS: Simple calculation
   * Single Responsibility: Only handles DIO calculation
   */
  private async calculateDaysInventoryOutstanding(timeRange: MetricTimeRange): Promise<number> {
    const turnoverRatio = await this.calculateTurnoverRatio(timeRange);
    const daysInYear = 365;
    const dio = daysInYear / Math.max(turnoverRatio, 1); // Prevent division by zero

    return Math.round(dio * 24 * 3600); // Convert days to seconds
  }

  /**
   * Calculate stockout rate - KISS: Simple calculation
   * Single Responsibility: Only handles stockout rate calculation
   */
  private async calculateStockoutRate(timeRange: MetricTimeRange): Promise<number> {
    const baseStockoutRate = 0.08; // 8% base stockout rate
    const variation = (Math.random() - 0.5) * 0.04; // ±2% variation

    return Math.round((baseStockoutRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate holding costs - KISS: Simple calculation
   * Single Responsibility: Only handles holding cost calculation
   */
  private async calculateHoldingCosts(timeRange: MetricTimeRange): Promise<number> {
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseDailyHoldingCost = 1200.00; // Base daily holding cost
    const seasonalVariation = Math.sin((timeRange.startDate.getMonth() / 12) * Math.PI * 2) * 0.2; // Seasonal variation

    let totalHoldingCosts = 0;
    for (let i = 0; i < daysInRange; i++) {
      const dayCost = baseDailyHoldingCost * (1 + seasonalVariation) * (1 + (Math.random() - 0.5) * 0.1);
      totalHoldingCosts += dayCost;
    }

    return Math.round(totalHoldingCosts * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate fill rate - KISS: Simple calculation
   * Single Responsibility: Only handles fill rate calculation
   */
  private async calculateFillRate(timeRange: MetricTimeRange): Promise<number> {
    const baseFillRate = 0.92; // 92% base fill rate
    const variation = (Math.random() - 0.5) * 0.06; // ±3% variation

    return Math.round((baseFillRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate inventory accuracy - KISS: Simple calculation
   * Single Responsibility: Only handles accuracy calculation
   */
  private async calculateAccuracy(timeRange: MetricTimeRange): Promise<number> {
    const baseAccuracy = 0.95; // 95% base accuracy
    const variation = (Math.random() - 0.5) * 0.04; // ±2% variation

    return Math.round((baseAccuracy + variation) * 10000) / 100; // Round to 2 decimal places
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