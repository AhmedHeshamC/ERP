import { Module } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { PerformanceInterceptor } from './interceptors/performance.interceptor';
import { HealthService } from './health/health.service';
import { HealthController } from './health/health.controller';
import { DatabaseHealthCheckProvider } from './health/providers/database-health-check.provider';
import { CacheHealthCheckProvider } from './health/providers/cache-health-check.provider';
import { SystemHealthCheckProvider, DefaultHealthMetricsCollector } from './health/providers/system-health-check.provider';
import { HealthStatusCalculator } from './health/calculators/health-status.calculator';
import { EnhancedLoggerService } from './logging/enhanced-logger.service';
import { LoggingController } from './logging/logging.controller';
import { AlertService } from './alerting/alert.service';
import { AlertController } from './alerting/alert.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { BusinessMetricsService } from './business/business-metrics.service';
import { ErrorTrackingService } from './errors/error-tracking.service';
import { InfrastructureService } from './infrastructure/infrastructure.service';
import { InfrastructureController } from './infrastructure/infrastructure.controller';
import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [CacheModule, PrismaModule],
  providers: [
    // Core monitoring services
    PerformanceService,
    PerformanceInterceptor,

    // Health monitoring
    HealthService,

    // Health check providers
    DatabaseHealthCheckProvider,
    CacheHealthCheckProvider,
    SystemHealthCheckProvider,

    // Health infrastructure
    HealthStatusCalculator,
    DefaultHealthMetricsCollector,
    {
      provide: 'IHealthMetricsCollector',
      useClass: DefaultHealthMetricsCollector,
    },

    // Logging infrastructure
    EnhancedLoggerService,

    // Alerting system
    AlertService,

    // Dashboard and visualization
    DashboardService,

    // Business metrics
    BusinessMetricsService,

    // Error tracking
    ErrorTrackingService,

    // Infrastructure monitoring
    InfrastructureService,
  ],
  controllers: [
    // Performance controllers
    PerformanceController,

    // Health controllers
    HealthController,

    // Logging controllers
    LoggingController,

    // Alerting controllers
    AlertController,

    // Dashboard controllers
    DashboardController,

    // Infrastructure controllers
    InfrastructureController,
  ],
  exports: [
    PerformanceService,
    PerformanceInterceptor,
    HealthService,
    EnhancedLoggerService,
    AlertService,
    DashboardService,
    BusinessMetricsService,
    ErrorTrackingService,
    InfrastructureService,
  ],
})
export class MonitoringModule {}