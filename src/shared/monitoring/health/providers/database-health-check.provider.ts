import { Injectable } from '@nestjs/common';
import { HealthCheck } from '../interfaces/health-check.interface';
import { IHealthCheckProvider } from '../interfaces/health-check-provider.interface';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Database Health Check Provider
 * Implements Single Responsibility Principle
 * Only responsible for checking database health
 */
@Injectable()
export class DatabaseHealthCheckProvider implements IHealthCheckProvider {
  constructor(private readonly prismaService: PrismaService) {}

  async performCheck(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.prismaService.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return {
          name: this.getName(),
          status: 'DOWN',
          responseTime,
          message: 'Database health check query failed',
          lastChecked: new Date(),
        };
      }

      // Get additional database metrics
      const connectionMetrics = await this.getConnectionMetrics();

      return {
        name: this.getName(),
        status: 'UP',
        responseTime,
        details: connectionMetrics,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: this.getName(),
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  getName(): string {
    return 'database';
  }

  isCritical(): boolean {
    return true; // Database is critical for system health
  }

  private async getConnectionMetrics(): Promise<any> {
    try {
      // Get connection pool metrics (PostgreSQL specific)
      const connectionStats = await (this.prismaService as any).$queryRaw`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
      `;

      return connectionStats;
    } catch (error) {
      // Return empty metrics if query fails
      return {};
    }
  }
}