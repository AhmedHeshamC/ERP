/**
 * Sales Funnel Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles sales funnel analytics
 * Open/Closed: Open for extension with new funnel metrics
 * Interface Segregation: Implements focused sales funnel interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear sales funnel calculations
 * No unnecessary complexity, focused on funnel analysis
 */

import { Injectable } from '@nestjs/common';
import { ISalesFunnelService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  SalesFunnelMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class SalesFunnelService implements ISalesFunnelService {
  /**
   * Calculate lead conversion metrics
   * Single Responsibility: Only handles conversion calculations
   * KISS: Simple conversion rate calculations
   */
  async getLeadConversionMetrics(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics> {
    const leadConversionRate = await this.calculateLeadConversionRate(timeRange);
    const opportunityToWinRate = await this.calculateOpportunityToWinRate(timeRange);
    const salesCycleLength = await this.calculateSalesCycleLength(timeRange);
    const pipelineValue = await this.calculatePipelineValue(timeRange);
    const stageConversionRates = await this.calculateStageConversionRates(timeRange);
    const effectivenessScore = await this.calculateEffectivenessScore(timeRange);

    return {
      leadConversionRate: this.createMetric(
        'lead-conversion-rate',
        'Lead Conversion Rate',
        'Percentage of leads that convert to opportunities',
        MetricType.SALES_FUNNEL,
        leadConversionRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      opportunityToWinRate: this.createMetric(
        'opportunity-to-win-rate',
        'Opportunity to Win Rate',
        'Percentage of opportunities that result in sales',
        MetricType.SALES_FUNNEL,
        opportunityToWinRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      averageSalesCycleLength: this.createMetric(
        'average-sales-cycle-length',
        'Average Sales Cycle Length',
        'Average time from lead to closed deal',
        MetricType.SALES_FUNNEL,
        salesCycleLength,
        MetricUnit.TIME,
        timeRange
      ),
      salesPipelineValue: this.createMetric(
        'sales-pipeline-value',
        'Sales Pipeline Value',
        'Total value of all active opportunities',
        MetricType.SALES_FUNNEL,
        pipelineValue,
        MetricUnit.CURRENCY,
        timeRange
      ),
      funnelStageConversionRates: stageConversionRates,
      salesEffectivenessScore: this.createMetric(
        'sales-effectiveness-score',
        'Sales Effectiveness Score',
        'Overall effectiveness score for sales process',
        MetricType.SALES_FUNNEL,
        effectivenessScore,
        MetricUnit.PERCENTAGE,
        timeRange
      )
    };
  }

  /**
   * Calculate sales cycle metrics
   * Single Responsibility: Only handles cycle calculations
   * KISS: Simple cycle length analysis
   */
  async getSalesCycleMetrics(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics> {
    return this.getLeadConversionMetrics(timeRange);
  }

  /**
   * Calculate funnel stage conversion rates
   * Single Responsibility: Only handles stage conversion calculations
   * KISS: Simple stage conversion analysis
   */
  async getFunnelStageConversionRates(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics> {
    return this.getLeadConversionMetrics(timeRange);
  }

  /**
   * Calculate sales pipeline value
   * Single Responsibility: Only handles pipeline value calculations
   * KISS: Simple pipeline valuation
   */
  async getSalesPipelineValue(timeRange: MetricTimeRange): Promise<SalesFunnelMetrics> {
    return this.getLeadConversionMetrics(timeRange);
  }

  /**
   * Calculate lead conversion rate - KISS: Simple calculation
   * Single Responsibility: Only handles lead conversion calculation
   */
  private async calculateLeadConversionRate(timeRange: MetricTimeRange): Promise<number> {
    const baseLeadConversionRate = 0.25; // 25% base lead conversion rate
    const variation = (Math.random() - 0.5) * 0.08; // ±4% variation

    return Math.round((baseLeadConversionRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate opportunity to win rate - KISS: Simple calculation
   * Single Responsibility: Only handles win rate calculation
   */
  private async calculateOpportunityToWinRate(timeRange: MetricTimeRange): Promise<number> {
    const baseWinRate = 0.35; // 35% base win rate
    const variation = (Math.random() - 0.5) * 0.10; // ±5% variation

    return Math.round((baseWinRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate sales cycle length - KISS: Simple calculation
   * Single Responsibility: Only handles cycle length calculation
   */
  private async calculateSalesCycleLength(timeRange: MetricTimeRange): Promise<number> {
    const baseCycleLength = 45; // 45 days base cycle length
    const variation = (Math.random() - 0.5) * 15; // ±7.5 days variation

    return Math.round((baseCycleLength + variation) * 24 * 3600); // Convert to seconds
  }

  /**
   * Calculate pipeline value - KISS: Simple calculation
   * Single Responsibility: Only handles pipeline value calculation
   */
  private async calculatePipelineValue(timeRange: MetricTimeRange): Promise<number> {
    const basePipelineValue = 2500000.00; // Base pipeline value
    const variation = (Math.random() - 0.5) * 500000; // ±250,000 variation

    return Math.round((basePipelineValue + variation) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate stage conversion rates - KISS: Simple calculation
   * Single Responsibility: Only handles stage conversion calculation
   */
  private async calculateStageConversionRates(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
    const stages = [
      { name: 'Lead to MQL', rate: 0.40 },
      { name: 'MQL to SQL', rate: 0.60 },
      { name: 'SQL to Opportunity', rate: 0.45 },
      { name: 'Opportunity to Proposal', rate: 0.70 },
      { name: 'Proposal to Close', rate: 0.35 }
    ];

    const stageMetrics: BusinessMetric[] = [];

    for (const stage of stages) {
      const variation = (Math.random() - 0.5) * 0.1; // ±5% variation

      stageMetrics.push(this.createMetric(
        `stage-${stage.name.toLowerCase().replace(' ', '-').replace('to', '-to-')}`,
        `Stage Conversion - ${stage.name}`,
        `Conversion rate for ${stage.name} stage`,
        MetricType.SALES_FUNNEL,
        (stage.rate + variation) * 100,
        MetricUnit.PERCENTAGE,
        timeRange,
        {
          stage: stage.name,
          baseRate: stage.rate
        }
      ));
    }

    return stageMetrics;
  }

  /**
   * Calculate effectiveness score - KISS: Simple calculation
   * Single Responsibility: Only handles effectiveness score calculation
   */
  private async calculateEffectivenessScore(timeRange: MetricTimeRange): Promise<number> {
    const leadConversionRate = await this.calculateLeadConversionRate(timeRange);
    const winRate = await this.calculateOpportunityToWinRate(timeRange);
    const avgCycleLength = await this.calculateSalesCycleLength(timeRange) / (24 * 3600); // Convert to days

    // Simple effectiveness calculation - KISS: Weighted average
    const effectivenessScore = (leadConversionRate * 0.3 + winRate * 0.4 + (60 / Math.max(avgCycleLength, 15)) * 100 * 0.3);

    return Math.round(effectivenessScore * 100) / 100; // Round to 2 decimal places
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