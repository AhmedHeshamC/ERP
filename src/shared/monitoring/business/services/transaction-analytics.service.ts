/**
 * Transaction Analytics Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles transaction analytics calculations
 * Open/Closed: Open for extension with new transaction metrics
 * Interface Segregation: Implements focused transaction analytics interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear transaction analytics calculations
 * No unnecessary complexity, focused on transaction performance analysis
 */

import { Injectable } from '@nestjs/common';
import { ITransactionAnalyticsService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  TransactionMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class TransactionAnalyticsService implements ITransactionAnalyticsService {
  /**
   * Calculate transaction volume metrics
   * Single Responsibility: Only handles volume calculations
   * KISS: Simple count-based calculations
   */
  async getTransactionVolume(timeRange: MetricTimeRange): Promise<TransactionMetrics> {
    const totalTransactions = await this.calculateTotalTransactions(timeRange);
    const successfulTransactions = await this.calculateSuccessfulTransactions(timeRange);
    const successRate = await this.calculateSuccessRate(timeRange);
    const avgTransactionValue = await this.calculateAverageTransactionValue(timeRange);
    const avgProcessingTime = await this.calculateAverageProcessingTime(timeRange);
    const volumeTrends = await this.calculateVolumeTrends(timeRange);

    return {
      totalTransactions: this.createMetric(
        'total-transactions',
        'Total Transactions',
        'Total number of transactions processed in the specified time range',
        MetricType.TRANSACTION_ANALYTICS,
        totalTransactions,
        MetricUnit.COUNT,
        timeRange
      ),
      successfulTransactions: this.createMetric(
        'successful-transactions',
        'Successful Transactions',
        'Number of successfully processed transactions',
        MetricType.TRANSACTION_ANALYTICS,
        successfulTransactions,
        MetricUnit.COUNT,
        timeRange
      ),
      transactionSuccessRate: this.createMetric(
        'transaction-success-rate',
        'Transaction Success Rate',
        'Percentage of transactions that were processed successfully',
        MetricType.TRANSACTION_ANALYTICS,
        successRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      averageTransactionValue: this.createMetric(
        'average-transaction-value',
        'Average Transaction Value',
        'Average monetary value of processed transactions',
        MetricType.TRANSACTION_ANALYTICS,
        avgTransactionValue,
        MetricUnit.CURRENCY,
        timeRange
      ),
      averageProcessingTime: this.createMetric(
        'average-processing-time',
        'Average Processing Time',
        'Average time taken to process transactions',
        MetricType.TRANSACTION_ANALYTICS,
        avgProcessingTime,
        MetricUnit.TIME,
        timeRange
      ),
      transactionVolumeTrends: volumeTrends
    };
  }

  /**
   * Calculate transaction success rate
   * Single Responsibility: Only handles success rate calculations
   * KISS: Simple percentage calculation
   */
  async getTransactionSuccessRate(timeRange: MetricTimeRange): Promise<TransactionMetrics> {
    return this.getTransactionVolume(timeRange);
  }

  /**
   * Calculate average transaction value
   * Single Responsibility: Only handles average value calculations
   * KISS: Simple arithmetic mean calculation
   */
  async getAverageTransactionValue(timeRange: MetricTimeRange): Promise<TransactionMetrics> {
    return this.getTransactionVolume(timeRange);
  }

  /**
   * Calculate transaction processing time metrics
   * Single Responsibility: Only handles processing time calculations
   * KISS: Simple time-based calculations
   */
  async getTransactionProcessingTime(timeRange: MetricTimeRange): Promise<TransactionMetrics> {
    return this.getTransactionVolume(timeRange);
  }

  /**
   * Calculate total transactions - KISS: Simple calculation
   * Single Responsibility: Only handles transaction counting
   */
  private async calculateTotalTransactions(timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would query transaction logs
    const hoursInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60));
    const baseHourlyTransactions = 45;
    const businessHoursMultiplier = 0.7; // 70% of transactions during business hours

    return Math.round(hoursInRange * baseHourlyTransactions * businessHoursMultiplier);
  }

  /**
   * Calculate successful transactions - KISS: Simple calculation
   * Single Responsibility: Only handles successful transaction counting
   */
  private async calculateSuccessfulTransactions(timeRange: MetricTimeRange): Promise<number> {
    const totalTransactions = await this.calculateTotalTransactions(timeRange);
    const baseSuccessRate = 0.94; // 94% base success rate
    const variation = (Math.random() - 0.5) * 0.04; // ±2% variation

    return Math.round(totalTransactions * (baseSuccessRate + variation));
  }

  /**
   * Calculate success rate - KISS: Simple percentage calculation
   * Single Responsibility: Only handles success rate calculation
   */
  private async calculateSuccessRate(timeRange: MetricTimeRange): Promise<number> {
    const totalTransactions = await this.calculateTotalTransactions(timeRange);
    const successfulTransactions = await this.calculateSuccessfulTransactions(timeRange);

    return Math.round((successfulTransactions / totalTransactions) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate average transaction value - KISS: Simple calculation
   * Single Responsibility: Only handles average value calculation
   */
  private async calculateAverageTransactionValue(_timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would aggregate transaction amounts
    const baseAverageValue = 1250.00; // Base average transaction value
    const variation = (Math.random() - 0.5) * 500; // ±250 variation

    return Math.round((baseAverageValue + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate average processing time - KISS: Simple calculation
   * Single Responsibility: Only handles processing time calculation
   */
  private async calculateAverageProcessingTime(_timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would analyze processing logs
    const baseProcessingTime = 2.5; // Base processing time in seconds
    const variation = (Math.random() - 0.5) * 1.0; // ±0.5 seconds variation

    return Math.round((baseProcessingTime + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate volume trends - KISS: Simple trend calculation
   * Single Responsibility: Only handles trend calculation
   */
  private async calculateVolumeTrends(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
    const trends: BusinessMetric[] = [];
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Create daily trend data points
    for (let i = 0; i < Math.min(daysInRange, 30); i++) { // Limit to 30 data points
      const date = new Date(timeRange.startDate);
      date.setDate(date.getDate() + i);

      const dayTimeRange = {
        startDate: new Date(date.setHours(0, 0, 0, 0)),
        endDate: new Date(date.setHours(23, 59, 59, 999))
      };

      const totalTransactions = await this.calculateTotalTransactions(dayTimeRange);

      trends.push(this.createMetric(
        `daily-transaction-volume-${i}`,
        `Daily Transaction Volume - ${date.toISOString().split('T')[0]}`,
        `Number of transactions processed on ${date.toISOString().split('T')[0]}`,
        MetricType.TRANSACTION_ANALYTICS,
        totalTransactions,
        MetricUnit.COUNT,
        dayTimeRange
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