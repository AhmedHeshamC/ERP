import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  timestamp: Date;
  statusCode: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  memoryUsage?: number;
  cpuUsage?: number;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  lastAccessed: Date;
  requestsPerMinute: number;
}

export interface SystemMetrics {
  timestamp: Date;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: {
    user: number;
    system: number;
    idle: number;
  };
  activeConnections: number;
  queuedRequests: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'response_time' | 'error_rate' | 'memory' | 'cpu' | 'connection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowestEndpoints: EndpointStats[];
    busiestEndpoints: EndpointStats[];
    alerts: PerformanceAlert[];
  };
  endpoints: EndpointStats[];
  systemMetrics: SystemMetrics[];
  recommendations: string[];
}

/**
 * Enterprise-Grade Performance Monitoring Service
 *
 * Provides comprehensive performance monitoring with:
 * - Real-time metrics collection and analysis
 * - Automated alert generation
 * - Performance trend analysis
 * - System resource monitoring
 * - Performance recommendations
 * - Historical data analysis
 */
@Injectable()
export class PerformanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly configService: ConfigService;

  // Metrics storage (in production, use time-series database like InfluxDB)
  private metrics: PerformanceMetrics[] = [];
  private endpointStats: Map<string, EndpointStats> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private alerts: PerformanceAlert[] = [];

  // Configuration
  private readonly alertThresholds = {
    responseTime: 1000, // 1 second
    errorRate: 5, // 5%
    memoryUsage: 80, // 80%
    cpuUsage: 80, // 80%
    activeConnections: 1000,
  };

  // Monitoring intervals
  private systemMetricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  constructor(configService: ConfigService) {
    this.configService = configService;

    // Load configuration
    const thresholds = configService.get('PERFORMANCE_THRESHOLDS');
    if (thresholds) {
      Object.assign(this.alertThresholds, thresholds);
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing performance monitoring service');

    // Start monitoring intervals
    this.startSystemMetricsCollection();
    this.startCleanupProcess();
    this.startAlertMonitoring();

    this.logger.log('Performance monitoring service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down performance monitoring service');

    // Clear intervals
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    this.logger.log('Performance monitoring service shut down');
  }

  /**
   * Record performance metrics for a request
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    try {
      // Store metrics
      this.metrics.push(metrics);

      // Update endpoint statistics
      this.updateEndpointStats(metrics);

      // Check for immediate alerts
      this.checkImmediateAlerts(metrics);

      // Emit event for real-time monitoring
      
      this.logger.debug(`Recorded metrics for ${metrics.method} ${metrics.endpoint}: ${metrics.responseTime}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error recording performance metrics: ${errorMessage}`);
    }
  }

  /**
   * Get performance statistics for a specific endpoint
   */
  getEndpointStats(endpoint: string, method?: string): EndpointStats | null {
    const key = this.generateEndpointKey(endpoint, method);
    return this.endpointStats.get(key) || null;
  }

  /**
   * Get performance statistics for all endpoints
   */
  getAllEndpointStats(): EndpointStats[] {
    return Array.from(this.endpointStats.values());
  }

  /**
   * Get the slowest endpoints
   */
  getSlowestEndpoints(limit: number = 10): EndpointStats[] {
    return Array.from(this.endpointStats.values())
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, limit);
  }

  /**
   * Get the busiest endpoints
   */
  getBusiestEndpoints(limit: number = 10): EndpointStats[] {
    return Array.from(this.endpointStats.values())
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, limit);
  }

  /**
   * Get system metrics for a time range
   */
  getSystemMetrics(from?: Date, to?: Date): SystemMetrics[] {
    let metrics = this.systemMetrics;

    if (from) {
      metrics = metrics.filter(m => m.timestamp >= from);
    }

    if (to) {
      metrics = metrics.filter(m => m.timestamp <= to);
    }

    return metrics;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return this.alerts;
  }

  /**
   * Create a manual alert
   */
  createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    
    this.logger.warn(`Performance alert created: ${message} (${severity})`);
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
            this.logger.log(`Performance alert resolved: ${alert.message}`);
      return true;
    }
    return false;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(from: Date, to: Date): PerformanceReport {
    const period = { start: from, end: to };

    // Filter metrics for the period
    const periodMetrics = this.metrics.filter(
      m => m.timestamp >= from && m.timestamp <= to
    );

    const periodSystemMetrics = this.getSystemMetrics(from, to);
    const periodAlerts = this.alerts.filter(
      a => a.timestamp >= from && a.timestamp <= to
    );

    // Calculate summary statistics
    const totalRequests = periodMetrics.length;
    const averageResponseTime = totalRequests > 0
      ? periodMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
      : 0;

    const errorCount = periodMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const summary = {
      totalRequests,
      averageResponseTime,
      errorRate,
      slowestEndpoints: this.getSlowestEndpoints(5),
      busiestEndpoints: this.getBusiestEndpoints(5),
      alerts: periodAlerts,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, periodSystemMetrics);

    return {
      period,
      summary,
      endpoints: this.getAllEndpointStats(),
      systemMetrics: periodSystemMetrics,
      recommendations,
    };
  }

  /**
   * Get real-time performance overview
   */
  getRealtimeOverview(): {
    currentMetrics: {
      requestsPerMinute: number;
      averageResponseTime: number;
      errorRate: number;
      activeConnections: number;
    };
    activeAlerts: PerformanceAlert[];
    systemHealth: {
      status: 'healthy' | 'warning' | 'critical';
      memoryUsage: number;
      cpuUsage: number;
    };
  } {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneMinuteAgo);
    const requestsPerMinute = recentMetrics.length;

    const averageResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
      : 0;

    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = recentMetrics.length > 0 ? (errorCount / recentMetrics.length) * 100 : 0;

    const latestSystemMetric = this.systemMetrics[this.systemMetrics.length - 1];
    const activeConnections = latestSystemMetric?.activeConnections || 0;

    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const highAlerts = activeAlerts.filter(a => a.severity === 'high');

    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0 || errorRate > 10) {
      systemHealth = 'critical';
    } else if (highAlerts.length > 0 || errorRate > 5) {
      systemHealth = 'warning';
    }

    return {
      currentMetrics: {
        requestsPerMinute,
        averageResponseTime,
        errorRate,
        activeConnections,
      },
      activeAlerts,
      systemHealth: {
        status: systemHealth,
        memoryUsage: latestSystemMetric?.memoryUsage.percentage || 0,
        cpuUsage: latestSystemMetric?.cpuUsage.user || 0,
      },
    };
  }

  /**
   * Update endpoint statistics
   */
  private updateEndpointStats(metrics: PerformanceMetrics): void {
    const key = this.generateEndpointKey(metrics.endpoint, metrics.method);

    let stats = this.endpointStats.get(key);
    if (!stats) {
      stats = {
        endpoint: metrics.endpoint,
        method: metrics.method,
        totalRequests: 0,
        averageResponseTime: 0,
        minResponseTime: metrics.responseTime,
        maxResponseTime: metrics.responseTime,
        errorRate: 0,
        lastAccessed: metrics.timestamp,
        requestsPerMinute: 0,
      };
      this.endpointStats.set(key, stats);
    }

    // Update statistics
    stats.totalRequests++;
    stats.lastAccessed = metrics.timestamp;

    // Update response time statistics
    const totalResponseTime = stats.averageResponseTime * (stats.totalRequests - 1) + metrics.responseTime;
    stats.averageResponseTime = totalResponseTime / stats.totalRequests;
    stats.minResponseTime = Math.min(stats.minResponseTime, metrics.responseTime);
    stats.maxResponseTime = Math.max(stats.maxResponseTime, metrics.responseTime);

    // Update error rate
    const errorCount = this.metrics.filter(
      m => m.endpoint === metrics.endpoint &&
           m.method === metrics.method &&
           m.statusCode >= 400
    ).length;
    stats.errorRate = (errorCount / stats.totalRequests) * 100;

    // Calculate requests per minute (last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentRequests = this.metrics.filter(
      m => m.endpoint === metrics.endpoint &&
           m.method === metrics.method &&
           m.timestamp >= oneMinuteAgo
    ).length;
    stats.requestsPerMinute = recentRequests;
  }

  /**
   * Check for immediate alerts based on metrics
   */
  private checkImmediateAlerts(metrics: PerformanceMetrics): void {
    // Response time alert
    if (metrics.responseTime > this.alertThresholds.responseTime) {
      this.createAlert(
        'response_time',
        metrics.responseTime > this.alertThresholds.responseTime * 2 ? 'critical' : 'high',
        `High response time detected for ${metrics.method} ${metrics.endpoint}`,
        metrics.responseTime,
        this.alertThresholds.responseTime
      );
    }

    // Error rate alert (5xx errors)
    if (metrics.statusCode >= 500) {
      this.createAlert(
        'error_rate',
        'critical',
        `Server error detected for ${metrics.method} ${metrics.endpoint} (${metrics.statusCode})`,
        metrics.statusCode,
        500
      );
    }
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    const interval = this.configService.get('PERFORMANCE_METRICS_INTERVAL', 30000); // 30 seconds

    this.systemMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        this.systemMetrics.push(metrics);

        // Check system-level alerts
        this.checkSystemAlerts(metrics);

              } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error collecting system metrics: ${errorMessage}`);
      }
    }, interval);
  }

  /**
   * Start cleanup process for old metrics
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      try {
        this.cleanupOldMetrics();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error during metrics cleanup: ${errorMessage}`);
      }
    }, 60000); // Run every minute
  }

  /**
   * Start alert monitoring
   */
  private startAlertMonitoring(): void {
    this.alertCheckInterval = setInterval(() => {
      try {
        this.checkTrendAlerts();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error during alert monitoring: ${errorMessage}`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate memory usage percentage
    const totalMemory = require('os').totalmem();
    const usedMemory = memUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Get active connections (simplified)
    const activeConnections = this.metrics.filter(
      m => Date.now() - m.timestamp.getTime() < 30000 // Last 30 seconds
    ).length;

    return {
      timestamp: new Date(),
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round(memoryPercentage * 100) / 100,
      },
      cpuUsage: {
        user: cpuUsage.user / 1000000, // Convert to seconds
        system: cpuUsage.system / 1000000,
        idle: 0, // Would need more complex calculation
      },
      activeConnections,
      queuedRequests: 0, // Would need queue monitoring
    };
  }

  /**
   * Check system-level alerts
   */
  private checkSystemAlerts(metrics: SystemMetrics): void {
    // Memory usage alert
    if (metrics.memoryUsage.percentage > this.alertThresholds.memoryUsage) {
      this.createAlert(
        'memory',
        metrics.memoryUsage.percentage > 95 ? 'critical' : 'high',
        `High memory usage detected: ${metrics.memoryUsage.percentage.toFixed(1)}%`,
        metrics.memoryUsage.percentage,
        this.alertThresholds.memoryUsage
      );
    }

    // Active connections alert
    if (metrics.activeConnections > this.alertThresholds.activeConnections) {
      this.createAlert(
        'connection',
        'high',
        `High number of active connections: ${metrics.activeConnections}`,
        metrics.activeConnections,
        this.alertThresholds.activeConnections
      );
    }
  }

  /**
   * Check trend-based alerts
   */
  private checkTrendAlerts(): void {
    // Check endpoint error rates
    for (const stats of this.endpointStats.values()) {
      if (stats.errorRate > this.alertThresholds.errorRate && stats.totalRequests > 10) {
        this.createAlert(
          'error_rate',
          stats.errorRate > 10 ? 'critical' : 'medium',
          `High error rate for ${stats.method} ${stats.endpoint}: ${stats.errorRate.toFixed(1)}%`,
          stats.errorRate,
          this.alertThresholds.errorRate
        );
      }
    }
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old metrics
    this.metrics = this.metrics.filter(m => now - m.timestamp.getTime() < maxAge);

    // Clean up old system metrics
    this.systemMetrics = this.systemMetrics.filter(m => now - m.timestamp.getTime() < maxAge);

    // Clean up old resolved alerts
    this.alerts = this.alerts.filter(a =>
      !a.resolved || now - a.timestamp.getTime() < maxAge
    );

    // Limit size of endpoint stats
    if (this.endpointStats.size > 1000) {
      const sortedStats = Array.from(this.endpointStats.entries())
        .sort((a, b) => b[1].lastAccessed.getTime() - a[1].lastAccessed.getTime());

      // Keep only the 500 most recently accessed endpoints
      const toKeep = sortedStats.slice(0, 500);
      this.endpointStats = new Map(toKeep);
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    summary: PerformanceReport['summary'],
    systemMetrics: SystemMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (summary.averageResponseTime > 500) {
      recommendations.push('Consider implementing caching for frequently accessed data');
      recommendations.push('Review database query optimization');
    }

    // Error rate recommendations
    if (summary.errorRate > 2) {
      recommendations.push('Review error handling and logging');
      recommendations.push('Implement circuit breaker pattern for external services');
    }

    // Endpoint-specific recommendations
    for (const endpoint of summary.slowestEndpoints) {
      if (endpoint.averageResponseTime > 1000) {
        recommendations.push(`Optimize ${endpoint.method} ${endpoint.endpoint} - current avg: ${endpoint.averageResponseTime}ms`);
      }
    }

    // System recommendations
    const latestMetric = systemMetrics[systemMetrics.length - 1];
    if (latestMetric && latestMetric.memoryUsage.percentage > 70) {
      recommendations.push('Monitor memory usage and consider memory optimization');
    }

    // Alert recommendations
    if (summary.alerts.length > 0) {
      recommendations.push('Review and resolve active performance alerts');
    }

    return recommendations;
  }

  /**
   * Generate unique key for endpoint
   */
  private generateEndpointKey(endpoint: string, method?: string): string {
    return `${method || 'GET'}:${endpoint}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}