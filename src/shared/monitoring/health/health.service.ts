import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { HealthCheckResult, HealthCheck } from './interfaces/health-check.interface';
import { IHealthCheckProvider, IHealthMetricsCollector } from './interfaces/health-check-provider.interface';
import { DatabaseHealthCheckProvider } from './providers/database-health-check.provider';
import { CacheHealthCheckProvider } from './providers/cache-health-check.provider';
import { SystemHealthCheckProvider } from './providers/system-health-check.provider';
import { HealthStatusCalculator } from './calculators/health-status.calculator';

@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger(HealthService.name);
  private startTime = Date.now();
  private lastHealthCheck: HealthCheckResult | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Health check providers - following Dependency Inversion Principle
  private readonly healthCheckProviders: IHealthCheckProvider[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @Inject('IHealthMetricsCollector') private readonly metricsCollector: IHealthMetricsCollector,
    private readonly statusCalculator: HealthStatusCalculator,
  ) {
    // Initialize health check providers - following Open/Closed Principle
    this.healthCheckProviders = [
      new DatabaseHealthCheckProvider(prismaService),
      new CacheHealthCheckProvider(cacheService),
      new SystemHealthCheckProvider(metricsCollector),
    ];
  }

  onModuleInit() {
    // Run health checks every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error('Scheduled health check failed:', error);
      });
    }, 30000);

    // Perform initial health check
    setTimeout(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error('Initial health check failed:', error);
      });
    }, 5000);
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    this.logger.debug('Starting comprehensive health check');

    const checks: HealthCheck[] = [];

    try {
      // Execute all health check providers in parallel for efficiency
      const providerResults = await Promise.allSettled(
        this.healthCheckProviders.map(provider => provider.performCheck())
      );

      // Process results from providers
      providerResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          checks.push(result.value);
        } else {
          const providerName = this.healthCheckProviders[index].getName();
          checks.push({
            name: providerName,
            status: 'DOWN',
            message: `Health check provider failed: ${result.reason?.message || 'Unknown error'}`,
            lastChecked: new Date(),
          });
        }
      });

      // Add application-specific health checks
      checks.push(await this.checkApplication());

      // Add business logic health checks
      const businessChecks = await this.checkBusinessLogic();
      checks.push(...businessChecks);

      // Add external services check if configured
      const externalServiceCheck = await this.checkExternalServices();
      if (externalServiceCheck) {
        checks.push(externalServiceCheck);
      }

    } catch (error) {
      this.logger.error('Health check execution failed:', error);
      checks.push({
        name: 'health_check_execution',
        status: 'DOWN',
        message: `Health check execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      });
    }

    const duration = Date.now() - startTime;
    const statusResult = this.statusCalculator.calculateOverallHealth(checks, duration);

    const result: HealthCheckResult = {
      ...statusResult,
      timestamp: new Date(),
      duration,
      checks,
      uptime: Date.now() - this.startTime,
    };

    this.lastHealthCheck = result;
    this.logger.log(`Health check completed: ${result.status} (${result.overallScore}/100) in ${duration}ms`);

    return result;
  }

  async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.prismaService.healthCheck();
      const responseTime = Date.now() - startTime;

      if (!isHealthy) {
        return {
          name: 'database',
          status: 'DOWN',
          responseTime,
          message: 'Database health check query failed',
          lastChecked: new Date(),
        };
      }

      // Additional database metrics
      const connectionMetrics = await this.getDatabaseMetrics();

      return {
        name: 'database',
        status: 'UP',
        responseTime,
        details: connectionMetrics,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      const isConnected = this.cacheService.isRedisConnected();
      const responseTime = Date.now() - startTime;

      if (!isConnected) {
        return {
          name: 'redis_cache',
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
          name: 'redis_cache',
          status: 'DEGRADED',
          responseTime,
          message: 'Cache operations are not working correctly',
          lastChecked: new Date(),
        };
      }

      const cacheStats = this.cacheService.getStats();

      return {
        name: 'redis_cache',
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
        name: 'redis_cache',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Cache health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkApplication(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      const metrics = this.getSystemMetrics();
      const responseTime = Date.now() - startTime;

      // Check memory usage
      if (metrics.memory.percentage > 90) {
        return {
          name: 'application',
          status: 'UNHEALTHY',
          responseTime,
          message: `High memory usage: ${metrics.memory.percentage.toFixed(2)}%`,
          details: metrics,
          lastChecked: new Date(),
        };
      }

      if (metrics.memory.percentage > 75) {
        return {
          name: 'application',
          status: 'DEGRADED',
          responseTime,
          message: `Elevated memory usage: ${metrics.memory.percentage.toFixed(2)}%`,
          details: metrics,
          lastChecked: new Date(),
        };
      }

      return {
        name: 'application',
        status: 'UP',
        responseTime,
        details: metrics,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'application',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Application health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    const services: string[] = [];

    try {
      // Check external service dependencies
      const externalServiceUrls = this.configService.get<string[]>('EXTERNAL_SERVICES', []);

      if (externalServiceUrls.length === 0) {
        return {
          name: 'external_services',
          status: 'UP',
          responseTime: Date.now() - startTime,
          message: 'No external services configured',
          lastChecked: new Date(),
        };
      }

      const results = await Promise.allSettled(
        externalServiceUrls.map(async (url) => {
          const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          return { url, status: response.ok, responseTime: Date.now() - startTime };
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status).length;
      const total = results.length;

      if (successful === 0) {
        return {
          name: 'external_services',
          status: 'DOWN',
          responseTime: Date.now() - startTime,
          message: `All ${total} external services are unavailable`,
          details: { services, successRate: 0 },
          lastChecked: new Date(),
        };
      }

      if (successful < total) {
        return {
          name: 'external_services',
          status: 'DEGRADED',
          responseTime: Date.now() - startTime,
          message: `${successful}/${total} external services are available`,
          details: { services, successRate: (successful / total) * 100 },
          lastChecked: new Date(),
        };
      }

      return {
        name: 'external_services',
        status: 'UP',
        responseTime: Date.now() - startTime,
        message: `All ${total} external services are available`,
        details: { services, successRate: 100 },
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'external_services',
        status: 'DEGRADED',
        responseTime: Date.now() - startTime,
        message: `External services check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkSystemResources(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      const metrics = this.getSystemMetrics();
      const responseTime = Date.now() - startTime;

      let status: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
      const issues: string[] = [];

      // Check CPU usage
      if (metrics.cpu.usage > 90) {
        status = 'DOWN';
        issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
      } else if (metrics.cpu.usage > 75) {
        status = 'DEGRADED';
        issues.push(`Elevated CPU usage: ${metrics.cpu.usage.toFixed(2)}%`);
      }

      // Check memory usage
      if (metrics.memory.percentage > 90) {
        status = 'DOWN';
        issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
      } else if (metrics.memory.percentage > 75) {
        status = status === 'UP' ? 'DEGRADED' : status;
        issues.push(`Elevated memory usage: ${metrics.memory.percentage.toFixed(2)}%`);
      }

      // Check disk usage
      if (metrics.disk.percentage > 90) {
        status = 'DOWN';
        issues.push(`High disk usage: ${metrics.disk.percentage.toFixed(2)}%`);
      } else if (metrics.disk.percentage > 80) {
        status = status === 'UP' ? 'DEGRADED' : status;
        issues.push(`Elevated disk usage: ${metrics.disk.percentage.toFixed(2)}%`);
      }

      return {
        name: 'system_resources',
        status,
        responseTime,
        message: issues.length > 0 ? issues.join(', ') : 'System resources are healthy',
        details: metrics,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'system_resources',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `System resources check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkBusinessLogic(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const startTime = Date.now();

    try {
      // Check if critical business operations are working
      const businessChecks = await Promise.allSettled([
        this.checkUserAuthentication(),
        this.checkDatabaseOperations(),
        this.checkCriticalBusinessProcesses(),
      ]);

      businessChecks.forEach((result, index) => {
        const checkNames = ['user_authentication', 'database_operations', 'business_processes'];

        if (result.status === 'fulfilled') {
          checks.push(result.value);
        } else {
          checks.push({
            name: checkNames[index],
            status: 'DOWN',
            responseTime: Date.now() - startTime,
            message: `Business logic check failed: ${result.reason?.message || 'Unknown error'}`,
            lastChecked: new Date(),
          });
        }
      });

    } catch (error) {
      this.logger.error('Business logic health checks failed:', error);
    }

    return checks;
  }

  async checkUserAuthentication(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Simple check - can we access the users table?
      await (this.prismaService as any).user.findFirst({
        select: { id: true },
        take: 1,
      });

      return {
        name: 'user_authentication',
        status: 'UP',
        responseTime: Date.now() - startTime,
        message: 'User authentication system is operational',
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'user_authentication',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `User authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkDatabaseOperations(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Test basic database operations
      await (this.prismaService as any).$queryRaw`SELECT 1 as test`;

      return {
        name: 'database_operations',
        status: 'UP',
        responseTime: Date.now() - startTime,
        message: 'Database operations are working correctly',
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        name: 'database_operations',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Database operations check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  async checkCriticalBusinessProcesses(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check if critical tables are accessible
      const criticalTables = ['users', 'accounts', 'products'];
      const checks = await Promise.allSettled(
        criticalTables.map(table =>
          (this.prismaService as any).$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}" LIMIT 1`)
        )
      );

      const successful = checks.filter(c => c.status === 'fulfilled').length;
      const total = checks.length;

      if (successful === total) {
        return {
          name: 'business_processes',
          status: 'UP',
          responseTime: Date.now() - startTime,
          message: 'All critical business processes are operational',
          lastChecked: new Date(),
        };
      } else if (successful > 0) {
        return {
          name: 'business_processes',
          status: 'DEGRADED',
          responseTime: Date.now() - startTime,
          message: `${successful}/${total} business processes are operational`,
          lastChecked: new Date(),
        };
      } else {
        return {
          name: 'business_processes',
          status: 'DOWN',
          responseTime: Date.now() - startTime,
          message: 'No critical business processes are operational',
          lastChecked: new Date(),
        };
      }
    } catch (error) {
      return {
        name: 'business_processes',
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        message: `Business processes check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Get system metrics using the injected metrics collector
   * Follows Dependency Inversion Principle
   */
  getSystemMetrics(): any {
    return this.metricsCollector.getSystemMetrics();
  }

  /**
   * Add a new health check provider at runtime
   * Follows Open/Closed Principle - extension without modification
   */
  addHealthCheckProvider(provider: IHealthCheckProvider): void {
    this.healthCheckProviders.push(provider);
    this.logger.log(`Added health check provider: ${provider.getName()}`);
  }

  /**
   * Get all registered health check providers
   */
  getHealthCheckProviders(): IHealthCheckProvider[] {
    return [...this.healthCheckProviders];
  }

  async getDatabaseMetrics(): Promise<any> {
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
      this.logger.warn('Could not fetch database metrics:', error);
      return {};
    }
  }

  getLastHealthCheck(): HealthCheckResult | null {
    return this.lastHealthCheck;
  }

  async getHealthHistory(_hours: number = 24): Promise<HealthCheckResult[]> {
    // In a real implementation, this would store health check results in a database
    // For now, return the last health check
    return this.lastHealthCheck ? [this.lastHealthCheck] : [];
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}