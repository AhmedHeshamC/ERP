/**
 * Metric Calculator Interface - Following SOLID Principles
 *
 * Single Responsibility: Only handles metric calculation interface definition
 * Open/Closed: Open for implementation with different calculation strategies
 * Interface Segregation: Focused interface for metric calculation operations
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 * Liskov Substitution: Consistent interface for all metric calculators
 *
 * KISS Principle: Simple, focused interface for metric calculations
 * No unnecessary complexity, focused on calculation contract
 */

import {
  BusinessMetric,
  MetricTimeRange,
  MetricCalculationRequest,
  MetricCalculationResult
} from '../types/metric.types';

export interface IMetricCalculator {
  /**
   * Calculate a business metric for the given time range
   * Single Responsibility: Only handles metric calculation
   */
  calculateMetric(request: MetricCalculationRequest): Promise<MetricCalculationResult>;

  /**
   * Get metric definition and metadata
   * Single Responsibility: Only handles metric metadata
   */
  getMetricDefinition(): {
    name: string;
    description: string;
    unit: string;
    category: string;
  };

  /**
   * Validate calculation request parameters
   * Single Responsibility: Only handles request validation
   */
  validateRequest(request: MetricCalculationRequest): boolean;

  /**
   * Get supported data sources for this metric
   * Single Responsibility: Only handles data source information
   */
  getSupportedDataSources(): string[];

  /**
   * Estimate calculation time and resource requirements
   * Single Responsibility: Only handles performance estimation
   */
  estimateCalculationComplexity(request: MetricCalculationRequest): {
    estimatedTime: number;
    resourceIntensity: 'low' | 'medium' | 'high';
  };
}