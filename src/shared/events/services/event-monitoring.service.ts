import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IDomainEvent } from '../types/event.types';

/**
 * Event Monitoring and Metrics Service
 * Provides comprehensive event monitoring, metrics collection, and alerting with SOLID principles
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Handles event monitoring and metrics only
 * - Open/Closed: Extensible through new metric collectors and alerters
 * - Interface Segregation: Focused on monitoring operations only
 * - Dependency Inversion: Depends on abstractions for monitoring
 */
export interface EventMetrics {
  eventType: string;
  aggregateType: string;
  processingTime: number;
  timestamp: Date;
  status: 'success' | 'failed' | 'retry';
  handlerCount: number;
  middlewareCount: number;
  batchSize?: number;
}

export interface EventPerformanceStats {
  eventType: string;
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  minProcessingTime: number;
  maxProcessingTime: number;
  throughput: number; // events per minute
  errorRate: number;
  lastProcessed: Date;
}

export interface EventAlert {
  id: string;
  type: 'processing_time' | 'error_rate' | 'throughput' | 'queue_size';
  severity: 'low' | 'medium' | 'high' | 'critical';
  eventType?: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface MonitoringConfig {
  processingTimeThreshold: number; // milliseconds
  errorRateThreshold: number; // percentage
  throughputThreshold: number; // events per minute
  queueSizeThreshold: number;
  alertCooldown: number; // milliseconds
  metricsRetentionDays: number;
}

@Injectable()
export class EventMonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventMonitoringService.name);
  private readonly metrics: EventMetrics[] = [];
  private readonly alerts: Map<string, EventAlert> = new Map();
  private readonly performanceStats = new Map<string, EventPerformanceStats>();
  private readonly alertCooldowns = new Map<string, Date>();

  private config: MonitoringConfig = {
    processingTimeThreshold: 5000, // 5 seconds
    errorRateThreshold: 5, // 5%
    throughputThreshold: 100, // 100 events per minute
    queueSizeThreshold: 1000,
    alertCooldown: 300000, // 5 minutes
    metricsRetentionDays: 30
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Event Monitoring service');

    // Start monitoring intervals
    this.startMonitoring();
    this.startCleanupProcess();

    this.logger.log('Event Monitoring service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Event Monitoring service');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.log('Event Monitoring service shut down');
  }

  /**
   * Record event processing metrics
   * @param event The domain event
   * @param processingTime Processing time in milliseconds
   * @param status Processing status
   * @param handlerCount Number of handlers executed
   * @param middlewareCount Number of middleware executed
   * @param batchSize Batch size if applicable
   */
  recordEventMetrics(
    event: IDomainEvent,
    processingTime: number,
    status: 'success' | 'failed' | 'retry',
    handlerCount: number,
    middlewareCount: number,
    batchSize?: number
  ): void {
    const metric: EventMetrics = {
      eventType: event.type,
      aggregateType: event.aggregateType,
      processingTime,
      timestamp: new Date(),
      status,
      handlerCount,
      middlewareCount,
      batchSize
    };

    this.metrics.push(metric);
    this.updatePerformanceStats(metric);
    this.checkAlerts(metric);

    this.logger.debug(`Recorded metrics for event ${event.type}: ${processingTime}ms (${status})`);
  }

  /**
   * Get performance statistics for event types
   * @param eventType Optional event type filter
   * @returns Performance statistics
   */
  getPerformanceStats(eventType?: string): EventPerformanceStats[] {
    if (eventType) {
      const stats = this.performanceStats.get(eventType);
      return stats ? [stats] : [];
    }

    return Array.from(this.performanceStats.values());
  }

  /**
   * Get current alerts
   * @param includeResolved Whether to include resolved alerts
   * @returns Array of alerts
   */
  getAlerts(includeResolved: boolean = false): EventAlert[] {
    const alerts = Array.from(this.alerts.values());
    return includeResolved ? alerts : alerts.filter(alert => !alert.resolved);
  }

  /**
   * Acknowledge and resolve an alert
   * @param alertId The alert ID to resolve
   * @returns True if alert was resolved
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    this.logger.log(`Alert resolved: ${alertId}`);
    return true;
  }

  /**
   * Get event monitoring dashboard data
   * @returns Dashboard data
   */
  getDashboardData(): {
    totalEvents: number;
    successRate: number;
    averageProcessingTime: number;
    throughput: number;
    activeAlerts: number;
    topEventTypes: Array<{ eventType: string; count: number }>;
    recentMetrics: EventMetrics[];
  } {
    const recentMetrics = this.getRecentMetrics(3600000); // Last hour
    const totalEvents = recentMetrics.length;
    const successfulEvents = recentMetrics.filter(m => m.status === 'success').length;
    const successRate = totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 0;

    const averageProcessingTime = totalEvents > 0
      ? recentMetrics.reduce((sum, m) => sum + m.processingTime, 0) / totalEvents
      : 0;

    // Calculate throughput (events per minute in last hour)
    const throughput = recentMetrics.length / 60;

    // Count active alerts
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved).length;

    // Get top event types
    const eventTypeCounts = new Map<string, number>();
    recentMetrics.forEach(metric => {
      const count = eventTypeCounts.get(metric.eventType) || 0;
      eventTypeCounts.set(metric.eventType, count + 1);
    });

    const topEventTypes = Array.from(eventTypeCounts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents,
      successRate,
      averageProcessingTime,
      throughput,
      activeAlerts,
      topEventTypes,
      recentMetrics: recentMetrics.slice(-100) // Last 100 metrics
    };
  }

  /**
   * Update monitoring configuration
   * @param newConfig New configuration values
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Monitoring configuration updated');
  }

  /**
   * Export metrics for external analysis
   * @param startDate Start date for export
   * @param endDate End date for export
   * @param eventType Optional event type filter
   * @returns Exported metrics
   */
  exportMetrics(
    startDate?: Date,
    endDate?: Date,
    eventType?: string
  ): EventMetrics[] {
    let filteredMetrics = this.metrics;

    if (startDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= startDate);
    }

    if (endDate) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp <= endDate);
    }

    if (eventType) {
      filteredMetrics = filteredMetrics.filter(m => m.eventType === eventType);
    }

    return filteredMetrics;
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Check every minute
  }

  /**
   * Perform health check and update system metrics
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes

      if (recentMetrics.length === 0) {
        // No recent events - might indicate a problem
        this.checkNoEventsAlert();
        return;
      }

      // Check overall system health
      const errorRate = this.calculateErrorRate(recentMetrics);
      if (errorRate > this.config.errorRateThreshold) {
        this.triggerAlert('error_rate', 'high', `High error rate detected: ${errorRate.toFixed(2)}%`, errorRate);
      }

      const avgProcessingTime = this.calculateAverageProcessingTime(recentMetrics);
      if (avgProcessingTime > this.config.processingTimeThreshold) {
        this.triggerAlert('processing_time', 'medium', `High processing time detected: ${avgProcessingTime.toFixed(0)}ms`, avgProcessingTime);
      }

      this.logger.debug('Health check completed');
    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  /**
   * Update performance statistics for an event type
   */
  private updatePerformanceStats(metric: EventMetrics): void {
    const eventType = metric.eventType;
    const existing = this.performanceStats.get(eventType);

    if (!existing) {
      this.performanceStats.set(eventType, {
        eventType,
        totalProcessed: 1,
        successRate: metric.status === 'success' ? 100 : 0,
        averageProcessingTime: metric.processingTime,
        minProcessingTime: metric.processingTime,
        maxProcessingTime: metric.processingTime,
        throughput: 0,
        errorRate: metric.status === 'failed' ? 100 : 0,
        lastProcessed: metric.timestamp
      });
      return;
    }

    const total = existing.totalProcessed + 1;
    const successCount = metric.status === 'success' ? (existing.successRate * existing.totalProcessed / 100) + 1 : (existing.successRate * existing.totalProcessed / 100);
    const errorCount = metric.status === 'failed' ? (existing.errorRate * existing.totalProcessed / 100) + 1 : (existing.errorRate * existing.totalProcessed / 100);

    this.performanceStats.set(eventType, {
      ...existing,
      totalProcessed: total,
      successRate: (successCount / total) * 100,
      errorRate: (errorCount / total) * 100,
      averageProcessingTime: (existing.averageProcessingTime * existing.totalProcessed + metric.processingTime) / total,
      minProcessingTime: Math.min(existing.minProcessingTime, metric.processingTime),
      maxProcessingTime: Math.max(existing.maxProcessingTime, metric.processingTime),
      lastProcessed: metric.timestamp
    });
  }

  /**
   * Check for alerts based on metrics
   */
  private checkAlerts(metric: EventMetrics): void {
    // Check processing time alert
    if (metric.processingTime > this.config.processingTimeThreshold) {
      this.triggerAlert(
        'processing_time',
        'high',
        `Slow processing detected for ${metric.eventType}: ${metric.processingTime}ms`,
        metric.processingTime,
        metric.eventType
      );
    }

    // Check for repeated failures
    const recentFailures = this.getRecentFailures(metric.eventType, 300000); // Last 5 minutes
    if (recentFailures.length >= 5) {
      this.triggerAlert(
        'error_rate',
        'critical',
        `Multiple failures detected for ${metric.eventType}: ${recentFailures.length} in last 5 minutes`,
        recentFailures.length,
        metric.eventType
      );
    }
  }

  /**
   * Trigger an alert if not in cooldown
   */
  private triggerAlert(
    type: EventAlert['type'],
    severity: EventAlert['severity'],
    message: string,
    value: number,
    eventType?: string
  ): void {
    const alertKey = `${type}_${eventType || 'global'}`;

    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < this.config.alertCooldown) {
      return;
    }

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alert: EventAlert = {
      id: alertId,
      type,
      severity,
      eventType,
      message,
      value,
      threshold: this.getThresholdForType(type),
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.set(alertId, alert);
    this.alertCooldowns.set(alertKey, new Date());

    // Log alert
    this.logger.warn(`Alert triggered [${severity.toUpperCase()}]: ${message}`);

    // Send to external monitoring system
    this.sendAlertToMonitoring(alert);
  }

  /**
   * Get threshold value for alert type
   */
  private getThresholdForType(type: EventAlert['type']): number {
    switch (type) {
      case 'processing_time':
        return this.config.processingTimeThreshold;
      case 'error_rate':
        return this.config.errorRateThreshold;
      case 'throughput':
        return this.config.throughputThreshold;
      case 'queue_size':
        return this.config.queueSizeThreshold;
      default:
        return 0;
    }
  }

  /**
   * Send alert to external monitoring system
   */
  private sendAlertToMonitoring(alert: EventAlert): void {
    // TODO: Integrate with external monitoring systems
    // This could send alerts to services like:
    // - Slack
    // - PagerDuty
    // - DataDog
    // - Custom monitoring dashboard
    this.logger.debug(`Alert sent to monitoring: ${alert.message}`);
  }

  /**
   * Check for no events alert
   */
  private checkNoEventsAlert(): void {
    const alertKey = 'no_events_global';
    const lastAlert = this.alertCooldowns.get(alertKey);

    if (!lastAlert || Date.now() - lastAlert.getTime() > this.config.alertCooldown) {
      this.triggerAlert(
        'throughput',
        'medium',
        'No events processed in the last 5 minutes',
        0
      );
    }
  }

  /**
   * Get recent metrics within time window
   */
  private getRecentMetrics(timeWindowMs: number): EventMetrics[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get recent failures for an event type
   */
  private getRecentFailures(eventType: string, timeWindowMs: number): EventMetrics[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.metrics.filter(metric =>
      metric.timestamp >= cutoff &&
      metric.eventType === eventType &&
      metric.status === 'failed'
    );
  }

  /**
   * Calculate error rate from metrics
   */
  private calculateErrorRate(metrics: EventMetrics[]): number {
    if (metrics.length === 0) return 0;
    const failures = metrics.filter(m => m.status === 'failed').length;
    return (failures / metrics.length) * 100;
  }

  /**
   * Calculate average processing time from metrics
   */
  private calculateAverageProcessingTime(metrics: EventMetrics[]): number {
    if (metrics.length === 0) return 0;
    const totalTime = metrics.reduce((sum, m) => sum + m.processingTime, 0);
    return totalTime / metrics.length;
  }

  /**
   * Start cleanup process for old metrics
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Cleanup every hour
  }

  /**
   * Clean up old metrics based on retention policy
   */
  private cleanupOldMetrics(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.metricsRetentionDays);

    const initialCount = this.metrics.length;

    // Remove old metrics
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (this.metrics[i].timestamp < cutoffDate) {
        this.metrics.splice(i, 1);
      }
    }

    // Remove old resolved alerts
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < cutoffDate) {
        this.alerts.delete(alertId);
      }
    }

    const cleanedCount = initialCount - this.metrics.length;
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old metrics`);
    }
  }
}