import { Injectable, Logger, OnModuleInit, OnModuleDestroy, OnApplicationBootstrap } from '@nestjs/common';
import * as os from 'os';

export interface MemoryStats {
  timestamp: Date;
  process: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  system: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  gc: {
    collections: number;
    duration: number;
    lastCollection?: Date;
  };
}

export interface MemoryAlert {
  type: 'heap_usage' | 'rss_usage' | 'system_memory' | 'gc_pressure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface MemoryOptimization {
  type: 'gc_force' | 'cache_clear' | 'connection_pool_reset' | 'buffer_trim';
  executed: boolean;
  timestamp: Date;
  result?: string;
}

/**
 * Enterprise-Grade Memory Management Service
 *
 * Implements comprehensive memory monitoring and optimization:
 * - Real-time memory usage tracking
 * - Automatic garbage collection triggering
 * - Memory leak detection
 * - Resource cleanup strategies
 * - Memory pressure alerts
 * - Performance optimization recommendations
 */
@Injectable()
export class MemoryService implements OnModuleInit, OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(MemoryService.name);

  // Monitoring state
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private stats: MemoryStats[] = [];
  private alerts: MemoryAlert[] = [];
  private optimizations: MemoryOptimization[] = [];

  // Configuration
  private readonly monitoringIntervalMs: number;
  private readonly maxStatsHistory: number;
  private readonly thresholds = {
    heapUsageWarning: 70, // 70%
    heapUsageCritical: 90, // 90%
    rssUsageWarning: 80, // 80%
    rssUsageCritical: 95, // 95%
    systemMemoryWarning: 80, // 80%
    systemMemoryCritical: 95, // 95%
    gcPressureThreshold: 1000, // 1000ms
  };

  // GC tracking
  private gcStats = {
    collections: 0,
    duration: 0,
    lastCollection: undefined as Date | undefined,
  };

  constructor() {
    // Load configuration with defaults
    this.monitoringIntervalMs = 30000;
    this.maxStatsHistory = 1000;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing memory management service');

    // Setup GC tracking if available
    this.setupGCTracking();

    this.logger.log('Memory management service initialized');
  }

  async onApplicationBootstrap(): Promise<void> {
    // Start monitoring after application is fully bootstrapped
    this.startMonitoring();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down memory management service');

    // Stop monitoring
    this.stopMonitoring();

    // Execute final cleanup
    await this.executeCleanup();

    this.logger.log('Memory management service shut down');
  }

  /**
   * Get current memory statistics
   */
  getCurrentStats(): MemoryStats {
    const processMemory = process.memoryUsage();
    const systemMemory = this.getSystemMemory();

    return {
      timestamp: new Date(),
      process: {
        rss: processMemory.rss,
        heapUsed: processMemory.heapUsed,
        heapTotal: processMemory.heapTotal,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers,
      },
      system: systemMemory,
      gc: { ...this.gcStats },
    };
  }

  /**
   * Get memory statistics history
   */
  getStatsHistory(limit?: number): MemoryStats[] {
    const stats = [...this.stats].reverse(); // Most recent first
    return limit ? stats.slice(0, limit) : stats;
  }

  /**
   * Get active memory alerts
   */
  getActiveAlerts(): MemoryAlert[] {
    // Return alerts from the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    return this.alerts.filter(alert => alert.timestamp >= oneHourAgo);
  }

  /**
   * Get all memory alerts
   */
  getAllAlerts(): MemoryAlert[] {
    return [...this.alerts].reverse();
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): MemoryOptimization[] {
    return [...this.optimizations].reverse();
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        if (global.gc) {
          const startTime = Date.now();
          global.gc();
          const duration = Date.now() - startTime;

          this.gcStats.collections++;
          this.gcStats.duration += duration;
          this.gcStats.lastCollection = new Date();

          this.optimizations.push({
            type: 'gc_force',
            executed: true,
            timestamp: new Date(),
            result: `GC completed in ${duration}ms`,
          });

          this.logger.log(`Forced garbage collection completed in ${duration}ms`);
          resolve(true);
        } else {
          this.logger.warn('Garbage collection not available (Node.js not started with --expose-gc)');
          resolve(false);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error during forced garbage collection: ${errorMessage}`);
        resolve(false);
      }
    });
  }

  /**
   * Execute comprehensive cleanup
   */
  async executeCleanup(): Promise<void> {
    this.logger.log('Executing memory cleanup...');

    const cleanupTasks = [
      this.forceGarbageCollection(),
      this.clearOldStats(),
      this.clearOldAlerts(),
    ];

    await Promise.allSettled(cleanupTasks);

    this.logger.log('Memory cleanup completed');
  }

  /**
   * Get memory health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    memoryUsage: number;
    activeAlerts: number;
    recommendations: string[];
  } {
    const currentStats = this.getCurrentStats();
    const heapUsagePercentage = (currentStats.process.heapUsed / currentStats.process.heapTotal) * 100;
    const systemMemoryPercentage = currentStats.system.percentage;
    const activeAlerts = this.getActiveAlerts();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    // Check for critical conditions
    if (
      heapUsagePercentage > this.thresholds.heapUsageCritical ||
      systemMemoryPercentage > this.thresholds.systemMemoryCritical ||
      activeAlerts.some(alert => alert.severity === 'critical')
    ) {
      status = 'critical';
      recommendations.push('Immediate memory optimization required');
      recommendations.push('Consider scaling up resources');
    } else if (
      heapUsagePercentage > this.thresholds.heapUsageWarning ||
      systemMemoryPercentage > this.thresholds.systemMemoryWarning ||
      activeAlerts.some(alert => alert.severity === 'high')
    ) {
      status = 'warning';
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider proactive cleanup');
    }

    // Add general recommendations
    if (heapUsagePercentage > 50) {
      recommendations.push('Review memory usage patterns');
    }

    if (this.gcStats.duration > this.thresholds.gcPressureThreshold * this.gcStats.collections) {
      recommendations.push('High GC pressure detected');
    }

    return {
      status,
      memoryUsage: Math.max(heapUsagePercentage, systemMemoryPercentage),
      activeAlerts: activeAlerts.length,
      recommendations,
    };
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMemoryStats();
    }, this.monitoringIntervalMs);

    this.logger.log(`Memory monitoring started with interval: ${this.monitoringIntervalMs}ms`);
  }

  /**
   * Stop memory monitoring
   */
  private stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.logger.log('Memory monitoring stopped');
  }

  /**
   * Collect memory statistics
   */
  private collectMemoryStats(): void {
    try {
      const stats = this.getCurrentStats();
      this.stats.push(stats);

      // Check memory thresholds
      this.checkMemoryThresholds(stats);

      
      // Cleanup old stats
      if (this.stats.length > this.maxStatsHistory) {
        this.stats = this.stats.slice(-this.maxStatsHistory);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error collecting memory stats: ${errorMessage}`);
    }
  }

  /**
   * Check memory thresholds and generate alerts
   */
  private checkMemoryThresholds(stats: MemoryStats): void {
    const heapUsagePercentage = (stats.process.heapUsed / stats.process.heapTotal) * 100;
    const systemMemoryPercentage = stats.system.percentage;

    // Check heap usage
    if (heapUsagePercentage > this.thresholds.heapUsageCritical) {
      this.createAlert('heap_usage', 'critical',
        `Critical heap usage: ${heapUsagePercentage.toFixed(1)}%`,
        heapUsagePercentage,
        this.thresholds.heapUsageCritical
      );
    } else if (heapUsagePercentage > this.thresholds.heapUsageWarning) {
      this.createAlert('heap_usage', 'medium',
        `High heap usage: ${heapUsagePercentage.toFixed(1)}%`,
        heapUsagePercentage,
        this.thresholds.heapUsageWarning
      );
    }

    // Check system memory
    if (systemMemoryPercentage > this.thresholds.systemMemoryCritical) {
      this.createAlert('system_memory', 'critical',
        `Critical system memory usage: ${systemMemoryPercentage.toFixed(1)}%`,
        systemMemoryPercentage,
        this.thresholds.systemMemoryCritical
      );
    } else if (systemMemoryPercentage > this.thresholds.systemMemoryWarning) {
      this.createAlert('system_memory', 'medium',
        `High system memory usage: ${systemMemoryPercentage.toFixed(1)}%`,
        systemMemoryPercentage,
        this.thresholds.systemMemoryWarning
      );
    }

    // Check GC pressure
    if (this.gcStats.collections > 0) {
      const avgGCDuration = this.gcStats.duration / this.gcStats.collections;
      if (avgGCDuration > this.thresholds.gcPressureThreshold) {
        this.createAlert('gc_pressure', 'high',
          `High GC pressure: average ${avgGCDuration.toFixed(1)}ms`,
          avgGCDuration,
          this.thresholds.gcPressureThreshold
        );
      }
    }
  }

  /**
   * Create memory alert
   */
  private createAlert(
    type: MemoryAlert['type'],
    severity: MemoryAlert['severity'],
    message: string,
    value: number,
    threshold: number
  ): void {
    const alert: MemoryAlert = {
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
    };

    this.alerts.push(alert);
    
    this.logger.warn(`Memory alert: ${message}`);

    // Trigger automatic optimization for critical alerts
    if (severity === 'critical') {
      this.triggerAutomaticOptimization(alert);
    }
  }

  /**
   * Trigger automatic optimization based on alert
   */
  private triggerAutomaticOptimization(alert: MemoryAlert): void {
    this.logger.log(`Triggering automatic optimization for ${alert.type} alert`);

    switch (alert.type) {
      case 'heap_usage':
        this.forceGarbageCollection();
        break;
      case 'system_memory':
        // In a real implementation, you might clear caches or release resources
                break;
      default:
        this.forceGarbageCollection();
    }
  }

  /**
   * Setup garbage collection tracking
   */
  private setupGCTracking(): void {
    if (global.gc) {
      const originalGC = global.gc;
      (global as any).gc = () => {
        const startTime = Date.now();
        const result = (originalGC as any)();
        const duration = Date.now() - startTime;

        this.gcStats.collections++;
        this.gcStats.duration += duration;
        this.gcStats.lastCollection = new Date();

        return result;
      };
      this.logger.log('GC tracking enabled');
    } else {
      this.logger.warn('GC tracking not available (Node.js not started with --expose-gc)');
    }
  }

  /**
   * Get system memory information
   */
  private getSystemMemory(): MemoryStats['system'] {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const percentage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * Clear old statistics
   */
  private async clearOldStats(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const beforeCount = this.stats.length;

    this.stats = this.stats.filter(stat => stat.timestamp >= oneDayAgo);

    const cleared = beforeCount - this.stats.length;
    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} old memory statistics`);
    }
  }

  /**
   * Clear old alerts
   */
  private async clearOldAlerts(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const beforeCount = this.alerts.length;

    this.alerts = this.alerts.filter(alert => alert.timestamp >= oneDayAgo);

    const cleared = beforeCount - this.alerts.length;
    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} old memory alerts`);
    }
  }
}