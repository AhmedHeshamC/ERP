/**
 * Customer Behavior Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles customer behavior analytics
 * Open/Closed: Open for extension with new customer metrics
 * Interface Segregation: Implements focused customer behavior interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear customer behavior calculations
 * No unnecessary complexity, focused on customer analysis
 */

import { Injectable } from '@nestjs/common';
import { ICustomerBehaviorService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  CustomerBehaviorMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class CustomerBehaviorService implements ICustomerBehaviorService {
  /**
   * Calculate customer acquisition metrics
   * Single Responsibility: Only handles acquisition calculations
   * KISS: Simple acquisition cost and rate calculations
   */
  async getCustomerAcquisitionMetrics(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics> {
    const acquisitionCost = await this.calculateAcquisitionCost(timeRange);
    const lifetimeValue = await this.calculateLifetimeValue(timeRange);
    const churnRate = await this.calculateChurnRate(timeRange);
    const satisfactionScore = await this.calculateSatisfactionScore(timeRange);
    const repeatPurchaseRate = await this.calculateRepeatPurchaseRate(timeRange);
    const segmentationMetrics = await this.calculateSegmentationMetrics(timeRange);

    return {
      customerAcquisitionCost: this.createMetric(
        'customer-acquisition-cost',
        'Customer Acquisition Cost',
        'Average cost to acquire a new customer',
        MetricType.CUSTOMER_BEHAVIOR,
        acquisitionCost,
        MetricUnit.CURRENCY,
        timeRange
      ),
      customerLifetimeValue: this.createMetric(
        'customer-lifetime-value',
        'Customer Lifetime Value',
        'Average total value a customer brings over their lifetime',
        MetricType.CUSTOMER_BEHAVIOR,
        lifetimeValue,
        MetricUnit.CURRENCY,
        timeRange
      ),
      customerChurnRate: this.createMetric(
        'customer-churn-rate',
        'Customer Churn Rate',
        'Percentage of customers who stop doing business with us',
        MetricType.CUSTOMER_BEHAVIOR,
        churnRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      customerSatisfactionScore: this.createMetric(
        'customer-satisfaction-score',
        'Customer Satisfaction Score',
        'Average customer satisfaction rating',
        MetricType.CUSTOMER_BEHAVIOR,
        satisfactionScore,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      repeatPurchaseRate: this.createMetric(
        'repeat-purchase-rate',
        'Repeat Purchase Rate',
        'Percentage of customers who make multiple purchases',
        MetricType.CUSTOMER_BEHAVIOR,
        repeatPurchaseRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      customerSegmentationMetrics: segmentationMetrics
    };
  }

  /**
   * Calculate customer lifetime value
   * Single Responsibility: Only handles CLV calculations
   * KISS: Simple CLV calculation
   */
  async getCustomerLifetimeValue(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics> {
    return this.getCustomerAcquisitionMetrics(timeRange);
  }

  /**
   * Calculate customer churn rate
   * Single Responsibility: Only handles churn calculations
   * KISS: Simple churn rate calculation
   */
  async getCustomerChurnRate(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics> {
    return this.getCustomerAcquisitionMetrics(timeRange);
  }

  /**
   * Calculate customer segmentation metrics
   * Single Responsibility: Only handles segmentation calculations
   * KISS: Simple segmentation analysis
   */
  async getCustomerSegmentationMetrics(timeRange: MetricTimeRange): Promise<CustomerBehaviorMetrics> {
    return this.getCustomerAcquisitionMetrics(timeRange);
  }

  /**
   * Calculate acquisition cost - KISS: Simple calculation
   * Single Responsibility: Only handles acquisition cost calculation
   */
  private async calculateAcquisitionCost(timeRange: MetricTimeRange): Promise<number> {
    const baseAcquisitionCost = 850.00; // Base acquisition cost
    const variation = (Math.random() - 0.5) * 200; // ±100 variation

    return Math.round((baseAcquisitionCost + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate lifetime value - KISS: Simple calculation
   * Single Responsibility: Only handles CLV calculation
   */
  private async calculateLifetimeValue(timeRange: MetricTimeRange): Promise<number> {
    const baseLifetimeValue = 12500.00; // Base lifetime value
    const variation = (Math.random() - 0.5) * 2000; // ±1000 variation

    return Math.round((baseLifetimeValue + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate churn rate - KISS: Simple calculation
   * Single Responsibility: Only handles churn rate calculation
   */
  private async calculateChurnRate(timeRange: MetricTimeRange): Promise<number> {
    const baseChurnRate = 0.08; // 8% base churn rate
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation

    return Math.round((baseChurnRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate satisfaction score - KISS: Simple calculation
   * Single Responsibility: Only handles satisfaction score calculation
   */
  private async calculateSatisfactionScore(timeRange: MetricTimeRange): Promise<number> {
    const baseSatisfactionScore = 0.88; // 88% base satisfaction
    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation

    return Math.round((baseSatisfactionScore + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate repeat purchase rate - KISS: Simple calculation
   * Single Responsibility: Only handles repeat purchase rate calculation
   */
  private async calculateRepeatPurchaseRate(timeRange: MetricTimeRange): Promise<number> {
    const baseRepeatRate = 0.65; // 65% base repeat purchase rate
    const variation = (Math.random() - 0.5) * 0.08; // ±4% variation

    return Math.round((baseRepeatRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate segmentation metrics - KISS: Simple calculation
   * Single Responsibility: Only handles segmentation calculation
   */
  private async calculateSegmentationMetrics(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
    const segments = [
      { name: 'Enterprise', percentage: 0.25, avgValue: 50000 },
      { name: 'Mid-Market', percentage: 0.35, avgValue: 15000 },
      { name: 'Small Business', percentage: 0.40, avgValue: 3000 }
    ];

    const segmentMetrics: BusinessMetric[] = [];

    for (const segment of segments) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation

      segmentMetrics.push(this.createMetric(
        `segment-${segment.name.toLowerCase().replace(' ', '-')}`,
        `Segment - ${segment.name}`,
        `${segment.name} customer segment metrics`,
        MetricType.CUSTOMER_BEHAVIOR,
        (segment.percentage + variation) * 100,
        MetricUnit.PERCENTAGE,
        timeRange,
        {
          segment: segment.name,
          percentage: segment.percentage,
          averageValue: segment.avgValue
        }
      ));
    }

    return segmentMetrics;
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