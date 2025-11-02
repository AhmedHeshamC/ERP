import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EnhancedLoggerService } from '../logging/enhanced-logger.service';
import { PerformanceService } from '../performance.service';
import { HealthService } from '../health/health.service';
import { AlertService } from '../alerting/alert.service';
import { CacheService } from '../../cache/cache.service';

export interface DashboardData {
  overview: SystemOverview;
  performance: PerformanceMetrics;
  health: HealthMetrics;
  alerts: AlertMetrics;
  logs: LogMetrics;
  business: BusinessMetrics;
  infrastructure: InfrastructureMetrics;
  trends: TrendData;
  timestamp: Date;
}

export interface SystemOverview {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptime: number;
  healthScore: number;
  activeUsers: number;
  totalRequests: number;
  errorRate: number;
  responseTime: number;
  criticalAlerts: number;
  warningAlerts: number;
}

export interface PerformanceMetrics {
  requestsPerMinute: number;
  averageResponseTime: number;
  slowestEndpoints: Array<{ endpoint: string; avgTime: number; count: number }>;
  fastestEndpoints: Array<{ endpoint: string; avgTime: number; count: number }>;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  throughput: number;
  availability: number;
}

export interface HealthMetrics {
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  serviceHealth: Array<{ service: string; status: 'UP' | 'DOWN' | 'DEGRADED'; responseTime?: number }>;
  databaseStatus: 'UP' | 'DOWN' | 'DEGRADED';
  cacheStatus: 'UP' | 'DOWN' | 'DEGRADED';
  lastHealthCheck: Date;
  uptime: number;
  systemMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

export interface AlertMetrics {
  total: number;
  active: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  suppressed: number;
  byCategory: Record<string, number>;
  recentAlerts: Array<{
    id: string;
    name: string;
    severity: string;
    timestamp: Date;
    status: string;
  }>;
  trends: Array<{ time: Date; critical: number; high: number; medium: number; low: number }>;
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByHour: Array<{ hour: string; count: number }>;
  errorRate: number;
  topErrors: Array<{ error: string; count: number }>;
  recentLogs: Array<{
    id: string;
    level: string;
    message: string;
    timestamp: Date;
    context: string;
  }>;
  activeUsers: number;
  uniqueIPs: number;
}

export interface BusinessMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  sessionsToday: number;
  transactionsToday: number;
  revenueToday: number;
  ordersToday: number;
  conversionRate: number;
  topPages: Array<{ page: string; views: number; avgTime: number }>;
  userActivity: Array<{ hour: string; activeUsers: number }>;
  systemLoad: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface InfrastructureMetrics {
  serverMetrics: {
    cpu: { usage: number; cores: number; loadAverage: number[] };
    memory: { used: number; total: number; percentage: number };
    disk: { used: number; total: number; percentage: number };
    network: { bytesIn: number; bytesOut: number; connections: number };
  };
  databaseMetrics: {
    connections: number;
    queryTime: number;
    slowQueries: number;
    size: number;
  };
  cacheMetrics: {
    hitRate: number;
    memoryUsage: number;
    operations: number;
    evictions: number;
  };
  serviceMetrics: Array<{
    service: string;
    status: 'UP' | 'DOWN' | 'DEGRADED';
    responseTime: number;
    lastCheck: Date;
  }>;
}

export interface TrendData {
  performance: Array<{ time: Date; responseTime: number; requests: number; errorRate: number }>;
  health: Array<{ time: Date; score: number; status: string }>;
  alerts: Array<{ time: Date; critical: number; high: number; medium: number; low: number }>;
  business: Array<{ time: Date; users: number; transactions: number; revenue: number }>;
  infrastructure: Array<{ time: Date; cpu: number; memory: number; disk: number }>;
}

@Injectable()
export class DashboardService implements OnModuleInit {
  private readonly logger = new Logger(DashboardService.name);
  private cachedDashboardData: DashboardData | null = null;
  private cacheExpiry = 30000; // 30 seconds
  private lastCacheUpdate = 0;

  constructor(
    private readonly enhancedLogger: EnhancedLoggerService,
    private readonly performanceService: PerformanceService,
    private readonly healthService: HealthService,
    private readonly alertService: AlertService,
    private readonly cacheService: CacheService,
  ) {}

  onModuleInit() {
    this.logger.log('Dashboard service initialized');
  }

  async getDashboardData(forceRefresh: boolean = false): Promise<DashboardData> {
    const now = Date.now();

    // Return cached data if still valid
    if (!forceRefresh && this.cachedDashboardData && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.cachedDashboardData;
    }

    this.logger.debug('Generating fresh dashboard data');

    try {
      const dashboardData: DashboardData = {
        overview: await this.getSystemOverview(),
        performance: await this.getPerformanceMetrics(),
        health: await this.getHealthMetrics(),
        alerts: await this.getAlertMetrics(),
        logs: await this.getLogMetrics(),
        business: await this.getBusinessMetrics(),
        infrastructure: await this.getInfrastructureMetrics(),
        trends: await this.getTrendData(),
        timestamp: new Date(),
      };

      this.cachedDashboardData = dashboardData;
      this.lastCacheUpdate = now;

      return dashboardData;
    } catch (error) {
      this.logger.error('Failed to generate dashboard data:', error);
      throw error;
    }
  }

  private async getSystemOverview(): Promise<SystemOverview> {
    const performanceStats = this.performanceService.getStats(300); // Last 5 minutes
    const healthResult = await this.healthService.performHealthCheck();
    const activeAlerts = this.alertService.getActiveAlerts();
    const logStats = await this.enhancedLogger.getLogStats(1); // Last hour

    const criticalAlerts = activeAlerts.filter(a => a.severity === 'CRITICAL').length;
    const warningAlerts = activeAlerts.filter(a => a.severity === 'HIGH').length;

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (criticalAlerts > 0 || healthResult.status === 'UNHEALTHY') {
      status = 'UNHEALTHY';
    } else if (warningAlerts > 3 || healthResult.status === 'DEGRADED' || performanceStats.errorRate > 5) {
      status = 'DEGRADED';
    }

    return {
      status,
      uptime: process.uptime() * 1000, // Convert to milliseconds
      healthScore: healthResult.overallScore,
      activeUsers: logStats.activeUsers,
      totalRequests: performanceStats.totalRequests,
      errorRate: performanceStats.errorRate,
      responseTime: performanceStats.averageResponseTime,
      criticalAlerts,
      warningAlerts,
    };
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const stats = this.performanceService.getStats(300); // Last 5 minutes
    const slowestEndpoints = this.performanceService.getSlowestEndpoints(5);
    const fastestEndpoints = this.performanceService.getMostActiveEndpoints(5)
      .map(endpoint => ({ ...endpoint, avgTime: endpoint.averageResponseTime }))
      .sort((a, b) => a.avgTime - b.avgTime)
      .slice(0, 5);

    return {
      requestsPerMinute: stats.requestsPerMinute,
      averageResponseTime: stats.averageResponseTime,
      slowestEndpoints: slowestEndpoints.map(e => ({
        endpoint: e.endpoint,
        avgTime: e.averageResponseTime,
        count: e.totalRequests,
      })),
      fastestEndpoints: fastestEndpoints.map(e => ({
        endpoint: e.endpoint,
        avgTime: e.averageResponseTime,
        count: e.totalRequests,
      })),
      cacheHitRate: stats.cacheHitRate,
      memoryUsage: stats.memoryUsage,
      cpuUsage: this.getCPUUsage(),
      activeConnections: stats.activeConnections,
      throughput: stats.totalRequests > 0 ? stats.totalRequests / 5 : 0, // Requests per minute in 5min window
      availability: stats.errorRate > 0 ? Math.max(0, 100 - stats.errorRate) : 100,
    };
  }

  private async getHealthMetrics(): Promise<HealthMetrics> {
    const healthResult = await this.healthService.performHealthCheck();
    const systemMetrics = this.healthService.getSystemMetrics();

    const serviceHealth = healthResult.checks.map(check => ({
      service: check.name,
      status: check.status as 'UP' | 'DOWN' | 'DEGRADED',
      responseTime: check.responseTime,
    }));

    const databaseCheck = healthResult.checks.find(c => c.name === 'database');
    const cacheCheck = healthResult.checks.find(c => c.name === 'redis_cache');

    return {
      overallStatus: healthResult.status,
      serviceHealth,
      databaseStatus: (databaseCheck?.status || 'DOWN') as 'UP' | 'DOWN' | 'DEGRADED',
      cacheStatus: (cacheCheck?.status || 'DOWN') as 'UP' | 'DOWN' | 'DEGRADED',
      lastHealthCheck: healthResult.timestamp,
      uptime: healthResult.uptime,
      systemMetrics: {
        cpu: systemMetrics.cpu.usage,
        memory: systemMetrics.memory.percentage,
        disk: systemMetrics.disk.percentage,
        network: systemMetrics.network.connections,
      },
    };
  }

  private async getAlertMetrics(): Promise<AlertMetrics> {
    const activeAlerts = this.alertService.getActiveAlerts();
    const stats = this.alertService.getAlertStatistics(24); // Last 24 hours

    const recentAlerts = activeAlerts.slice(0, 10).map(alert => ({
      id: alert.id,
      name: alert.name,
      severity: alert.severity,
      timestamp: alert.timestamp,
      status: alert.status,
    }));

    const trends = this.generateAlertTrends(24); // Last 24 hours

    return {
      total: stats.total,
      active: activeAlerts.length,
      critical: activeAlerts.filter(a => a.severity === 'CRITICAL').length,
      high: activeAlerts.filter(a => a.severity === 'HIGH').length,
      medium: activeAlerts.filter(a => a.severity === 'MEDIUM').length,
      low: activeAlerts.filter(a => a.severity === 'LOW').length,
      resolved: stats.resolved,
      suppressed: activeAlerts.filter(a => a.status === 'SUPPRESSED').length,
      byCategory: stats.byCategory,
      recentAlerts,
      trends,
    };
  }

  private async getLogMetrics(): Promise<LogMetrics> {
    const stats = await this.enhancedLogger.getLogStats(1); // Last hour
    const recentLogsQuery = await this.enhancedLogger.queryLogs({
      limit: 10,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    });

    const recentLogs = recentLogsQuery.logs.map(log => ({
      id: log.id,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      context: log.context || 'UNKNOWN',
    }));

    return {
      totalLogs: stats.totalLogs,
      logsByLevel: stats.logsByLevel,
      logsByHour: stats.logsByHour,
      errorRate: stats.totalLogs > 0 ?
        ((stats.logsByLevel.error + stats.logsByLevel.fatal) / stats.totalLogs) * 100 : 0,
      topErrors: stats.topErrors,
      recentLogs,
      activeUsers: stats.activeUsers,
      uniqueIPs: stats.uniqueIps,
    };
  }

  private async getBusinessMetrics(): Promise<BusinessMetrics> {
    // In a real implementation, these would come from actual business data
    // For now, we'll use mock data based on available metrics

    const logStats = await this.enhancedLogger.getLogStats(24); // Last 24 hours
    const performanceStats = this.performanceService.getStats(1440); // Last 24 hours

    const systemLoad = performanceStats.averageResponseTime > 1000 ? 'HIGH' :
                      performanceStats.averageResponseTime > 500 ? 'MEDIUM' : 'LOW';

    return {
      totalUsers: logStats.activeUsers,
      activeUsers: logStats.activeUsers,
      newUsersToday: Math.floor(Math.random() * 10) + 1, // Mock data
      sessionsToday: logStats.activeUsers * 2, // Estimate
      transactionsToday: Math.floor(performanceStats.totalRequests * 0.3), // Estimate
      revenueToday: Math.floor(Math.random() * 10000) + 1000, // Mock data
      ordersToday: Math.floor(Math.random() * 100) + 10, // Mock data
      conversionRate: 2.5, // Mock data
      topPages: [ // Mock data
        { page: '/dashboard', views: 150, avgTime: 45 },
        { page: '/orders', views: 120, avgTime: 30 },
        { page: '/products', views: 100, avgTime: 60 },
        { page: '/reports', views: 80, avgTime: 120 },
        { page: '/settings', views: 50, avgTime: 25 },
      ],
      userActivity: this.generateUserActivityTrends(24), // Last 24 hours
      systemLoad,
    };
  }

  private async getInfrastructureMetrics(): Promise<InfrastructureMetrics> {
    const systemMetrics = this.healthService.getSystemMetrics();
    const cacheStats = this.cacheService.getStats();
    const healthResult = await this.healthService.performHealthCheck();

    return {
      serverMetrics: {
        cpu: {
          usage: systemMetrics.cpu.usage,
          cores: require('os').cpus().length,
          loadAverage: systemMetrics.cpu.loadAverage,
        },
        memory: {
          used: systemMetrics.memory.used,
          total: systemMetrics.memory.total,
          percentage: systemMetrics.memory.percentage,
        },
        disk: {
          used: systemMetrics.disk.used,
          total: systemMetrics.disk.total,
          percentage: systemMetrics.disk.percentage,
        },
        network: {
          bytesIn: systemMetrics.network.bytesReceived,
          bytesOut: systemMetrics.network.bytesSent,
          connections: systemMetrics.network.connections,
        },
      },
      databaseMetrics: {
        connections: 5, // Mock data - would come from actual DB metrics
        queryTime: 25, // Mock data
        slowQueries: 2, // Mock data
        size: 1024, // Mock data in MB
      },
      cacheMetrics: {
        hitRate: cacheStats.hits > 0 ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100 : 0,
        memoryUsage: await this.cacheService.getMemoryUsage(),
        operations: cacheStats.hits + cacheStats.misses,
        evictions: 0, // Would come from Redis info
      },
      serviceMetrics: healthResult.checks.map(check => ({
        service: check.name,
        status: check.status as 'UP' | 'DOWN' | 'DEGRADED',
        responseTime: check.responseTime || 0,
        lastCheck: check.lastChecked,
      })),
    };
  }

  private async getTrendData(): Promise<TrendData> {
    // Generate trend data for the last 24 hours in 1-hour intervals
    const hours = 24;

    return {
      performance: this.generatePerformanceTrends(hours),
      health: this.generateHealthTrends(hours),
      alerts: this.generateAlertTrends(hours),
      business: this.generateBusinessTrends(hours),
      infrastructure: this.generateInfrastructureTrends(hours),
    };
  }

  private generatePerformanceTrends(hours: number): Array<{ time: Date; responseTime: number; requests: number; errorRate: number }> {
    const trends = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      // In a real implementation, these would be actual historical data
      trends.push({
        time,
        responseTime: 200 + Math.random() * 300,
        requests: Math.floor(Math.random() * 1000) + 500,
        errorRate: Math.random() * 5,
      });
    }
    return trends;
  }

  private generateHealthTrends(hours: number): Array<{ time: Date; score: number; status: string }> {
    const trends = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const score = 70 + Math.random() * 30;
      trends.push({
        time,
        score,
        status: score > 90 ? 'HEALTHY' : score > 70 ? 'DEGRADED' : 'UNHEALTHY',
      });
    }
    return trends;
  }

  private generateAlertTrends(hours: number): Array<{ time: Date; critical: number; high: number; medium: number; low: number }> {
    const trends = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const total = Math.floor(Math.random() * 10);
      trends.push({
        time,
        critical: Math.floor(total * 0.2),
        high: Math.floor(total * 0.3),
        medium: Math.floor(total * 0.3),
        low: Math.floor(total * 0.2),
      });
    }
    return trends;
  }

  private generateBusinessTrends(hours: number): Array<{ time: Date; users: number; transactions: number; revenue: number }> {
    const trends = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      trends.push({
        time,
        users: Math.floor(Math.random() * 100) + 20,
        transactions: Math.floor(Math.random() * 50) + 10,
        revenue: Math.floor(Math.random() * 1000) + 100,
      });
    }
    return trends;
  }

  private generateInfrastructureTrends(hours: number): Array<{ time: Date; cpu: number; memory: number; disk: number }> {
    const trends = [];
    const now = new Date();
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      trends.push({
        time,
        cpu: 20 + Math.random() * 60,
        memory: 30 + Math.random() * 50,
        disk: 40 + Math.random() * 30,
      });
    }
    return trends;
  }

  private generateUserActivityTrends(hours: number): Array<{ hour: string; activeUsers: number }> {
    const trends = [];
    const now = new Date();
    for (let i = 0; i < hours; i++) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      trends.push({
        hour: hour.toISOString(),
        activeUsers: Math.floor(Math.random() * 50) + 10,
      });
    }
    return trends.reverse();
  }

  private getCPUUsage(): number {
    // Simple CPU usage calculation
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage
  }

  async getWidgetData(widgetType: string): Promise<any> {
    switch (widgetType) {
      case 'overview':
        return this.getSystemOverview();
      case 'performance':
        return this.getPerformanceMetrics();
      case 'health':
        return this.getHealthMetrics();
      case 'alerts':
        return this.getAlertMetrics();
      case 'logs':
        return this.getLogMetrics();
      case 'business':
        return this.getBusinessMetrics();
      case 'infrastructure':
        return this.getInfrastructureMetrics();
      case 'trends':
        return this.getTrendData();
      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  async exportDashboardData(format: 'json' | 'csv' = 'json'): Promise<string> {
    const data = await this.getDashboardData(true);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    // CSV export (simplified)
    const csvData = [
      'Metric,Value,Unit,Timestamp',
      `Health Score,${data.overview.healthScore},%,${data.timestamp}`,
      `Active Users,${data.overview.activeUsers},count,${data.timestamp}`,
      `Error Rate,${data.overview.errorRate},%,${data.timestamp}`,
      `Response Time,${data.overview.responseTime},ms,${data.timestamp}`,
      `Critical Alerts,${data.overview.criticalAlerts},count,${data.timestamp}`,
    ].join('\n');

    return csvData;
  }

  clearCache(): void {
    this.cachedDashboardData = null;
    this.lastCacheUpdate = 0;
    this.logger.log('Dashboard cache cleared');
  }
}