import { Injectable } from '@nestjs/common';
import { HealthCheck } from '../interfaces/health-check.interface';
import { IHealthStatusCalculator } from '../interfaces/health-check-provider.interface';

/**
 * Health Status Calculator
 * Implements Single Responsibility Principle
 * Only responsible for calculating overall health status
 */
@Injectable()
export class HealthStatusCalculator implements IHealthStatusCalculator {
  calculateOverallHealth(checks: HealthCheck[], _duration: number): {
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    overallScore: number;
  } {
    // const upChecks = checks.filter(c => c.status === 'UP').length; // Available for future use
    const downChecks = checks.filter(c => c.status === 'DOWN').length;
    const degradedChecks = checks.filter(c => c.status === 'DEGRADED').length;
    const unhealthyChecks = checks.filter(c => c.status === 'UNHEALTHY').length;
    const totalChecks = checks.length;

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    let overallScore = 100;

    // Critical failures immediately make system unhealthy
    if (downChecks > 0 || unhealthyChecks > 0) {
      status = 'UNHEALTHY';
      overallScore = Math.max(0, 100 - ((downChecks + unhealthyChecks) / totalChecks) * 100);
    } else if (degradedChecks > 0) {
      status = 'DEGRADED';
      overallScore = Math.max(50, 100 - (degradedChecks / totalChecks) * 30);
    }

    // Penalize for slow response times
    const avgResponseTime = checks.reduce((sum, check) => sum + (check.responseTime || 0), 0) / totalChecks;
    if (avgResponseTime > 1000) {
      overallScore -= 20;
    } else if (avgResponseTime > 500) {
      overallScore -= 10;
    }

    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
      status,
      overallScore,
    };
  }

  calculateHealthScore(checks: HealthCheck[]): number {
    if (checks.length === 0) return 100;

    let score = 100;
    const totalChecks = checks.length;

    // Count different status types
    const upChecks = checks.filter(c => c.status === 'UP').length;
    const downChecks = checks.filter(c => c.status === 'DOWN').length;
    const degradedChecks = checks.filter(c => c.status === 'DEGRADED').length;
    const unhealthyChecks = checks.filter(c => c.status === 'UNHEALTHY').length;

    // Heavy penalty for down/unhealthy checks
    if (downChecks > 0 || unhealthyChecks > 0) {
      score -= ((downChecks + unhealthyChecks) / totalChecks) * 60;
    }

    // Light penalty for degraded checks
    if (degradedChecks > 0) {
      score -= (degradedChecks / totalChecks) * 20;
    }

    // Bonus for all up checks
    if (upChecks === totalChecks) {
      score = Math.min(100, score + 5);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}