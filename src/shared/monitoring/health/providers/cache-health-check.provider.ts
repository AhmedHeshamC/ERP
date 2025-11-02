import { Injectable } from '@nestjs/common';
import { HealthCheck } from '../interfaces/health-check.interface';
import { IHealthCheckProvider } from '../interfaces/health-check-provider.interface';
import { CacheService } from '../../../cache/cache.service';

/**
 * Cache Health Check Provider
 * Implements Single Responsibility Principle
 * Only responsible for checking cache/Redis health
 */
@Injectable()
export class CacheHealthCheckProvider implements IHealthCheckProvider {
  constructor(private readonly cacheService: CacheService) {}

  async performCheck(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const isConnected = this.cacheService.isRedisConnected();
      const responseTime = Date.now() - startTime;

      if (!isConnected) {
        return {
          name: this.getName(),
          status: 'DEGRADED',
          responseTime,
          message: 'Redis is not connected',
          lastChecked: new Date(),
        };
      }

      // Test cache operations
      const testKey = 'health_check_test';
      await this.cacheService.set(testKey, 'test_value');
      const retrievedValue = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);

      if (retrievedValue !== 'test_value') {
        return {
          name: this.getName(),
          status: 'DEGRADED',
          responseTime,
          message: 'Cache operations are not working correctly',
          lastChecked: new Date(),
        };
      }

      const cacheStats = this.cacheService.getStats();

      return {
        name: this.getName(),
        status: 'UP',
        responseTime,
        details: {
          ...cacheStats,
          memoryUsage: await this.cacheService.getMemoryUsage(),
        },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: this.getName(),
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Cache health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  getName(): string {
    return 'redis_cache';
  }

  isCritical(): boolean {
    return false; // Cache is important but not critical for basic functionality
  }
}