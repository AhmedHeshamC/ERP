import { Injectable, Inject } from '@nestjs/common';
import { HealthCheck, SystemMetrics } from '../interfaces/health-check.interface';
import { IHealthCheckProvider, IHealthMetricsCollector } from '../interfaces/health-check-provider.interface';
import * as os from 'os';
import * as process from 'process';

/**
 * System Resources Health Check Provider
 * Implements Single Responsibility Principle
 * Only responsible for checking system resource health
 */
@Injectable()
export class SystemHealthCheckProvider implements IHealthCheckProvider {
  constructor(@Inject('IHealthMetricsCollector') private readonly metricsCollector: IHealthMetricsCollector) {}

  async performCheck(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const metrics = this.metricsCollector.getSystemMetrics();
      const responseTime = Date.now() - startTime;

      let status: 'UP' | 'DEGRADED' | 'DOWN' | 'UNHEALTHY' = 'UP';
      const issues: string[] = [];

      // Check CPU usage
      if (metrics.cpu.usage > 90) {
        status = 'UNHEALTHY';
        issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
      } else if (metrics.cpu.usage > 75) {
        status = 'DEGRADED';
        issues.push(`Elevated CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
      }

      // Check memory usage
      if (metrics.memory.percentage > 90) {
        status = 'UNHEALTHY';
        issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
      } else if (metrics.memory.percentage > 75) {
        status = status === 'UP' ? 'DEGRADED' : status;
        issues.push(`Elevated memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
      }

      // Check disk usage
      if (metrics.disk.percentage > 90) {
        status = 'UNHEALTHY';
        issues.push(`High disk usage: ${metrics.disk.percentage.toFixed(2)}%`);
      } else if (metrics.disk.percentage > 80) {
        status = status === 'UP' ? 'DEGRADED' : status;
        issues.push(`Elevated disk usage: ${metrics.disk.percentage.toFixed(2)}%`);
      }

      return {
        name: this.getName(),
        status,
        responseTime,
        message: issues.length > 0 ? issues.join(', ') : 'System resources are healthy',
        details: metrics,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: this.getName(),
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `System resources check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  getName(): string {
    return 'system_resources';
  }

  isCritical(): boolean {
    return true; // System resources are critical for application health
  }
}

/**
 * Default implementation of health metrics collector
 */
@Injectable()
export class DefaultHealthMetricsCollector implements IHealthMetricsCollector {
  getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        loadAverage: os.loadavg(),
      },
      memory: {
        used: memUsage.rss,
        total: os.totalmem(),
        percentage: (memUsage.rss / os.totalmem()) * 100,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
      disk: {
        used: 0, // Would need fs-stats package for real disk usage
        total: 0,
        percentage: 0,
      },
      network: {
        connections: 0, // Would need additional tracking
        bytesReceived: 0,
        bytesSent: 0,
      },
    };
  }

  getApplicationMetrics(): any {
    return {
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }
}