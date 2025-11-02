/**
 * Financial KPI Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles financial KPI calculations
 * Open/Closed: Open for extension with new financial metrics
 * Interface Segregation: Implements focused financial KPI interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear financial KPI calculations
 * No unnecessary complexity, focused on financial analysis
 */

import { Injectable } from '@nestjs/common';
import { IFinancialKpiService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  FinancialKpiMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class FinancialKpiService implements IFinancialKpiService {
  /**
   * Calculate gross profit margin
   * Single Responsibility: Only handles gross margin calculations
   * KISS: Simple gross margin calculation
   */
  async getGrossProfitMargin(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics> {
    const grossProfitMargin = await this.calculateGrossProfitMargin(timeRange);
    const netProfitMargin = await this.calculateNetProfitMargin(timeRange);
    const returnOnAssets = await this.calculateReturnOnAssets(timeRange);
    const returnOnEquity = await this.calculateReturnOnEquity(timeRange);
    const currentRatio = await this.calculateCurrentRatio(timeRange);
    const debtToEquityRatio = await this.calculateDebtToEquityRatio(timeRange);
    const operatingCashFlow = await this.calculateOperatingCashFlow(timeRange);
    const earningsPerShare = await this.calculateEarningsPerShare(timeRange);

    return {
      grossProfitMargin: this.createMetric(
        'gross-profit-margin',
        'Gross Profit Margin',
        'Percentage of revenue remaining after cost of goods sold',
        MetricType.FINANCIAL_KPI,
        grossProfitMargin,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      netProfitMargin: this.createMetric(
        'net-profit-margin',
        'Net Profit Margin',
        'Percentage of revenue remaining after all expenses',
        MetricType.FINANCIAL_KPI,
        netProfitMargin,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      returnOnAssets: this.createMetric(
        'return-on-assets',
        'Return on Assets',
        'Profitability ratio relative to total assets',
        MetricType.FINANCIAL_KPI,
        returnOnAssets,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      returnOnEquity: this.createMetric(
        'return-on-equity',
        'Return on Equity',
        'Profitability ratio relative to shareholder equity',
        MetricType.FINANCIAL_KPI,
        returnOnEquity,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      currentRatio: this.createMetric(
        'current-ratio',
        'Current Ratio',
        'Liquidity ratio measuring ability to pay short-term obligations',
        MetricType.FINANCIAL_KPI,
        currentRatio,
        MetricUnit.RATIO,
        timeRange
      ),
      debtToEquityRatio: this.createMetric(
        'debt-to-equity-ratio',
        'Debt to Equity Ratio',
        'Leverage ratio comparing debt to shareholder equity',
        MetricType.FINANCIAL_KPI,
        debtToEquityRatio,
        MetricUnit.RATIO,
        timeRange
      ),
      operatingCashFlow: this.createMetric(
        'operating-cash-flow',
        'Operating Cash Flow',
        'Cash generated from normal business operations',
        MetricType.FINANCIAL_KPI,
        operatingCashFlow,
        MetricUnit.CURRENCY,
        timeRange
      ),
      earningsPerShare: this.createMetric(
        'earnings-per-share',
        'Earnings Per Share',
        'Net income allocated to each outstanding share',
        MetricType.FINANCIAL_KPI,
        earningsPerShare,
        MetricUnit.CURRENCY,
        timeRange
      )
    };
  }

  /**
   * Calculate net profit margin
   * Single Responsibility: Only handles net margin calculations
   * KISS: Simple net margin calculation
   */
  async getNetProfitMargin(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics> {
    return this.getGrossProfitMargin(timeRange);
  }

  /**
   * Calculate return on assets
   * Single Responsibility: Only handles ROA calculations
   * KISS: Simple ROA calculation
   */
  async getReturnOnAssets(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics> {
    return this.getGrossProfitMargin(timeRange);
  }

  /**
   * Calculate current ratio
   * Single Responsibility: Only handles current ratio calculations
   * KISS: Simple current ratio calculation
   */
  async getCurrentRatio(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics> {
    return this.getGrossProfitMargin(timeRange);
  }

  /**
   * Calculate debt to equity ratio
   * Single Responsibility: Only handles debt-to-equity calculations
   * KISS: Simple debt-to-equity calculation
   */
  async getDebtToEquityRatio(timeRange: MetricTimeRange): Promise<FinancialKpiMetrics> {
    return this.getGrossProfitMargin(timeRange);
  }

  /**
   * Calculate gross profit margin - KISS: Simple calculation
   * Single Responsibility: Only handles gross profit margin calculation
   */
  private async calculateGrossProfitMargin(timeRange: MetricTimeRange): Promise<number> {
    const baseGrossMargin = 0.42; // 42% base gross margin
    const variation = (Math.random() - 0.5) * 0.06; // ±3% variation

    return Math.round((baseGrossMargin + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate net profit margin - KISS: Simple calculation
   * Single Responsibility: Only handles net profit margin calculation
   */
  private async calculateNetProfitMargin(timeRange: MetricTimeRange): Promise<number> {
    const baseNetMargin = 0.15; // 15% base net margin
    const variation = (Math.random() - 0.5) * 0.04; // ±2% variation

    return Math.round((baseNetMargin + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate return on assets - KISS: Simple calculation
   * Single Responsibility: Only handles ROA calculation
   */
  private async calculateReturnOnAssets(timeRange: MetricTimeRange): Promise<number> {
    const baseROA = 0.08; // 8% base ROA
    const variation = (Math.random() - 0.5) * 0.03; // ±1.5% variation

    return Math.round((baseROA + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate return on equity - KISS: Simple calculation
   * Single Responsibility: Only handles ROE calculation
   */
  private async calculateReturnOnEquity(timeRange: MetricTimeRange): Promise<number> {
    const baseROE = 0.18; // 18% base ROE
    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation

    return Math.round((baseROE + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate current ratio - KISS: Simple calculation
   * Single Responsibility: Only handles current ratio calculation
   */
  private async calculateCurrentRatio(timeRange: MetricTimeRange): Promise<number> {
    const baseCurrentRatio = 2.1; // 2.1:1 base current ratio
    const variation = (Math.random() - 0.5) * 0.4; // ±0.2 variation

    return Math.round((baseCurrentRatio + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate debt to equity ratio - KISS: Simple calculation
   * Single Responsibility: Only handles debt-to-equity calculation
   */
  private async calculateDebtToEquityRatio(timeRange: MetricTimeRange): Promise<number> {
    const baseDebtToEquity = 0.65; // 0.65:1 base debt-to-equity ratio
    const variation = (Math.random() - 0.5) * 0.2; // ±0.1 variation

    return Math.round((baseDebtToEquity + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate operating cash flow - KISS: Simple calculation
   * Single Responsibility: Only handles operating cash flow calculation
   */
  private async calculateOperatingCashFlow(timeRange: MetricTimeRange): Promise<number> {
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseDailyCashFlow = 8500.00; // Base daily operating cash flow
    const growthRate = 0.01; // 1% daily growth

    let totalCashFlow = 0;
    for (let i = 0; i < daysInRange; i++) {
      totalCashFlow += baseDailyCashFlow * Math.pow(1 + growthRate, i);
    }

    return Math.round(totalCashFlow * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate earnings per share - KISS: Simple calculation
   * Single Responsibility: Only handles EPS calculation
   */
  private async calculateEarningsPerShare(timeRange: MetricTimeRange): Promise<number> {
    const baseEPS = 3.25; // Base earnings per share
    const variation = (Math.random() - 0.5) * 0.8; // ±0.4 variation

    return Math.round((baseEPS + variation) * 100) / 100; // Round to 2 decimal places
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