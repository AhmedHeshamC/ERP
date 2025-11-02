/**
 * User Analytics Service - Following SOLID Principles
 *
 * Single Responsibility: Only handles user analytics calculations
 * Open/Closed: Open for extension with new user metrics
 * Interface Segregation: Implements focused user analytics interface
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear user analytics calculations
 * No unnecessary complexity, focused on user behavior analysis
 */

import { Injectable } from '@nestjs/common';
import { IUserAnalyticsService } from '../interfaces/business-metric-services.interface';
import {
  MetricTimeRange,
  UserMetrics,
  BusinessMetric,
  MetricType,
  MetricUnit
} from '../types/metric.types';

@Injectable()
export class UserAnalyticsService implements IUserAnalyticsService {
  /**
   * Get active users metrics for the specified time range
   * Single Responsibility: Only handles active user calculations
   * KISS: Simple count-based calculations
   */
  async getActiveUsers(timeRange: MetricTimeRange): Promise<UserMetrics> {
    // const now = new Date(); // Unused but might be needed later

    // Simulate data queries - in real implementation, these would query actual data
    const activeUsers = await this.calculateActiveUsers(timeRange);
    const newUsers = await this.calculateNewUsers(timeRange);
    const engagementRate = await this.calculateEngagementRate(timeRange);
    const retentionRate = await this.calculateRetentionRate(timeRange);
    const avgSessionDuration = await this.calculateAverageSessionDuration(timeRange);
    const activityTrends = await this.calculateActivityTrends(timeRange);

    return {
      activeUsers: this.createMetric(
        'active-users',
        'Active Users',
        'Number of active users in the specified time range',
        MetricType.USER_ANALYTICS,
        activeUsers,
        MetricUnit.COUNT,
        timeRange
      ),
      newUsers: this.createMetric(
        'new-users',
        'New Users',
        'Number of new users acquired in the specified time range',
        MetricType.USER_ANALYTICS,
        newUsers,
        MetricUnit.COUNT,
        timeRange
      ),
      userEngagementRate: this.createMetric(
        'user-engagement-rate',
        'User Engagement Rate',
        'Percentage of active users who engaged with the system',
        MetricType.USER_ANALYTICS,
        engagementRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      userRetentionRate: this.createMetric(
        'user-retention-rate',
        'User Retention Rate',
        'Percentage of users who remained active over the period',
        MetricType.USER_ANALYTICS,
        retentionRate,
        MetricUnit.PERCENTAGE,
        timeRange
      ),
      averageSessionDuration: this.createMetric(
        'average-session-duration',
        'Average Session Duration',
        'Average time users spend in the system per session',
        MetricType.USER_ANALYTICS,
        avgSessionDuration,
        MetricUnit.TIME,
        timeRange
      ),
      userActivityTrends: activityTrends
    };
  }

  /**
   * Calculate user engagement metrics
   * Single Responsibility: Only handles engagement calculations
   * KISS: Simple engagement rate calculation
   */
  async getUserEngagementMetrics(timeRange: MetricTimeRange): Promise<UserMetrics> {
    return this.getActiveUsers(timeRange);
  }

  /**
   * Calculate user retention metrics
   * Single Responsibility: Only handles retention calculations
   * KISS: Simple retention rate calculation
   */
  async getUserRetentionMetrics(timeRange: MetricTimeRange): Promise<UserMetrics> {
    return this.getActiveUsers(timeRange);
  }

  /**
   * Calculate user activity trends
   * Single Responsibility: Only handles trend analysis
   * KISS: Simple trend calculation
   */
  async getUserActivityTrends(timeRange: MetricTimeRange): Promise<UserMetrics> {
    return this.getActiveUsers(timeRange);
  }

  /**
   * Calculate active users count - KISS: Simple calculation
   * Single Responsibility: Only handles active user counting
   */
  private async calculateActiveUsers(timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would query user activity logs
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const baseActiveUsers = 100;
    const growthRate = 0.05; // 5% daily growth

    return Math.round(baseActiveUsers * Math.pow(1 + growthRate, daysInRange));
  }

  /**
   * Calculate new users count - KISS: Simple calculation
   * Single Responsibility: Only handles new user counting
   */
  private async calculateNewUsers(timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would query user creation logs
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyNewUsers = 8;

    return Math.round(dailyNewUsers * daysInRange * (1 + Math.random() * 0.3)); // Add some variation
  }

  /**
   * Calculate engagement rate - KISS: Simple percentage calculation
   * Single Responsibility: Only handles engagement rate calculation
   */
  private async calculateEngagementRate(_timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would analyze user interactions
    const baseEngagementRate = 0.75; // 75% base engagement
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation

    return Math.round((baseEngagementRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate retention rate - KISS: Simple percentage calculation
   * Single Responsibility: Only handles retention rate calculation
   */
  private async calculateRetentionRate(_timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would compare user cohorts
    const baseRetentionRate = 0.85; // 85% base retention
    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation

    return Math.round((baseRetentionRate + variation) * 10000) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate average session duration - KISS: Simple time calculation
   * Single Responsibility: Only handles session duration calculation
   */
  private async calculateAverageSessionDuration(_timeRange: MetricTimeRange): Promise<number> {
    // Simulate calculation - in real implementation, this would analyze session logs
    const baseSessionDuration = 900; // 15 minutes in seconds
    const variation = (Math.random() - 0.5) * 300; // ±2.5 minutes variation

    return Math.round(baseSessionDuration + variation);
  }

  /**
   * Calculate activity trends - KISS: Simple trend calculation
   * Single Responsibility: Only handles trend calculation
   */
  private async calculateActivityTrends(timeRange: MetricTimeRange): Promise<BusinessMetric[]> {
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

      const activeUsers = await this.calculateActiveUsers(dayTimeRange);

      trends.push(this.createMetric(
        `daily-active-users-${i}`,
        `Daily Active Users - ${date.toISOString().split('T')[0]}`,
        `Number of active users on ${date.toISOString().split('T')[0]}`,
        MetricType.USER_ANALYTICS,
        activeUsers,
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