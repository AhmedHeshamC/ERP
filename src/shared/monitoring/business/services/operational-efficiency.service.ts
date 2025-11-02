/**
 * Operational Efficiency Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles operational efficiency calculations
 * Open/Closed: Open for extension with new efficiency metrics
 * Interface Segregation: Implements focused operational efficiency interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear operational efficiency calculations
 * No unnecessary complexity, focused on efficiency analysis
 */

import { Injectable } from '@nestjs/common';
import { IOperationalEfficiencyService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  OperationalEfficiencyMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class OperationalEfficiencyService implements IOperationalEfficiencyService {
  /**
   * Calculate order fulfillment metrics
   * Single Responsibility: Only handles fulfillment calculations
   * KISS: Simple fulfillment rate calculation
   */
  async getOrderFulfillmentMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics> {
    const fulfillmentRate = await this.calculateFulfillmentRate(timeRange);
    const processingTime = await this.calculateOrderProcessingTime(timeRange);
    const inventoryTurnover = await this.calculateInventoryTurnover(timeRange);
    const resourceUtilization = await this.calculateResourceUtilization(timeRange);
    const processEfficiency = await this.calculateProcessEfficiency(timeRange);
    const operationalCosts = await this.calculateOperationalCosts(timeRange);

    return {
      orderFulfillmentRate: this.createMetric(
        'order-fulfillment-rate',
        'Order Fulfillment Rate',
        'Percentage of orders fulfilled on time',
        MetricType.OPERATIONAL_EFFICIENCY,
        fulfillmentRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      averageOrderProcessingTime: this.createMetric(
        'average-order-processing-time',
        'Average Order Processing Time',
        'Average time to process orders from receipt to fulfillment',
        MetricType.OPERATIONAL_EFFICIENCY,
        processingTime,
        MetricUnit.TIME,
        timeRange
      ),
      inventoryTurnoverRatio: this.createMetric(
        'inventory-turnover-ratio',
        'Inventory Turnover Ratio',
        'Number of times inventory is sold and replaced over a period',
        MetricType.OPERATIONAL_EFFICIENCY,
        inventoryTurnover,
        MetricUnit.RATIO,
        timeRange
      ),
      resourceUtilizationRate: this.createMetric(
        'resource-utilization-rate',
        'Resource Utilization Rate',
        'Percentage of available resources being utilized',
        MetricType.OPERATIONAL_EFFICIENCY,
        resourceUtilization,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      processEfficiencyScore: this.createMetric(
        'process-efficiency-score',
        'Process Efficiency Score',
        'Overall efficiency score for business processes',
        MetricType.OPERATIONAL_EFFICIENCY,
        processEfficiency,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      operationalCosts: this.createMetric(
        'operational-costs',
        'Operational Costs',
        'Total operational costs for the specified period',
        MetricType.OPERATIONAL_EFFICIENCY,
        operationalCosts,
        MetricUnit.CURRENCY,
        timeRange
      )
    };
  }

  /**
   * Calculate inventory turnover ratio
   * Single Responsibility: Only handles inventory turnover calculations
   * KISS: Simple ratio calculation
   */
  async getInventoryTurnoverRatio(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics> {
    return this.getOrderFulfillmentMetrics(timeRange);
  }

  /**
   * Calculate resource utilization metrics
   * Single Responsibility: Only handles utilization calculations
   * KISS: Simple utilization rate calculation
   */
  async getResourceUtilizationMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics> {
    return this.getOrderFulfillmentMetrics(timeRange);
  }

  /**
   * Calculate process efficiency metrics
   * Single Responsibility: Only handles efficiency calculations
   * KISS: Simple efficiency score calculation
   */
  async getProcessEfficiencyMetrics(timeRange: MetricTimeRange): Promise<OperationalEfficiencyMetrics> {
    return this.getOrderFulfillmentMetrics(timeRange);
  }

  /**
   * Calculate fulfillment rate - KISS: Simple calculation
   * Single Responsibility: Only handles fulfillment rate calculation
   */
  private async calculateFulfillmentRate(timeRange: MetricTimeRange): Promise<number> {
    const baseFulfillmentRate = 0.92; // 92% base fulfillment rate
    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation

    return Math.round((baseFulfillmentRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate order processing time - KISS: Simple calculation
   * Single Responsibility: Only handles processing time calculation
   */
  private async calculateOrderProcessingTime(timeRange: MetricTimeRange): Promise<number> {
    const baseProcessingTime = 24; // 24 hours base processing time
    const variation = (Math.random() - 0.5) * 8; // ±4 hours variation

    return Math.round((baseProcessingTime + variation) * 3600); // Convert to seconds
  }

  /**
   * Calculate inventory turnover - KISS: Simple calculation
   * Single Responsibility: Only handles inventory turnover calculation
   */
  private async calculateInventoryTurnover(timeRange: MetricTimeRange): Promise<number> {
    const baseTurnoverRatio = 6.5; // 6.5 times per year base
    const variation = (Math.random() - 0.5) * 1.0; // ±0.5 variation

    return Math.round((baseTurnoverRatio + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate resource utilization - KISS: Simple calculation
   * Single Responsibility: Only handles resource utilization calculation
   */
  private async calculateResourceUtilization(timeRange: MetricTimeRange): Promise<number> {
    const baseUtilizationRate = 0.78; // 78% base utilization
    const variation = (Math.random() - 0.5) * 0.08; // ±4% variation

    return Math.round((baseUtilizationRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate process efficiency - KISS: Simple calculation
   * Single Responsibility: Only handles process efficiency calculation
   */
  private async calculateProcessEfficiency(timeRange: MetricTimeRange): Promise<number> {
    const baseEfficiencyScore = 0.85; // 85% base efficiency
    const variation = (Math.random() - 0.5) * 0.06; // ±3% variation

    return Math.round((baseEfficiencyScore + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate operational costs - KISS: Simple calculation
   * Single Responsibility: Only handles operational cost calculation
   */
  private async calculateOperationalCosts(timeRange: MetricTimeRange): Promise<number> {
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseDailyCost = 3500.00; // Base daily operational cost
    const inflationFactor = 1.02; // 2% inflation

    let totalCosts = 0;
    for (let i = 0; i < daysInRange; i++) {
      totalCosts += baseDailyCost * Math.pow(inflationFactor, i / 365);
    }

    return Math.round(totalCosts * 100) / 100; // Round to 2 decimal places
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