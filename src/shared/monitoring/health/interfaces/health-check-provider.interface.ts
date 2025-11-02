import { HealthCheck } from './health-check.interface';

/**
 * Interface for health check providers
 * Implements Dependency Inversion Principle
 */
export interface IHealthCheckProvider {
  /**
   * Perform a specific health check
   * @returns Promise<HealthCheck> The health check result
   */
  performCheck(): Promise<HealthCheck>;

  /**
   * Get the name of this health check
   */
  getName(): string;

  /**
   * Check if this health check is critical for overall system health
   */
  isCritical(): boolean;
}

/**
 * Interface for health status calculator
 * Implements Single Responsibility Principle
 */
export interface IHealthStatusCalculator {
  /**
   * Calculate overall health status from individual checks
   * @param checks Array of health check results
   * @param duration Total duration of all checks
   * @returns Overall health status with score
   */
  calculateOverallHealth(checks: HealthCheck[], duration: number): {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    overallScore: number;
  };

  /**
   * Calculate health score based on check results
   * @param checks Array of health check results
   * @returns Health score between 0-100
   */
  calculateHealthScore(checks: HealthCheck[]): number;
}

/**
 * Interface for health metrics collector
 * Implements Single Responsibility Principle
 */
export interface IHealthMetricsCollector {
  /**
   * Get current system metrics
   * @returns Current system metrics
   */
  getSystemMetrics(): any;

  /**
   * Get application-specific metrics
   * @returns Application metrics
   */
  getApplicationMetrics(): any;
}