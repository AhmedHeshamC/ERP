import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { EnhancedLoggerService } from '../logging/enhanced-logger.service';

export interface ServerMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
    model: string;
    speed: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    available: number;
    percentage: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    mountPoint: string;
    filesystem: string;
    iops: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    interfaces: NetworkInterface[];
    connections: number;
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
    errorsIn: number;
    errorsOut: number;
  };
  system: {
    uptime: number;
    hostname: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    processId: number;
    processUptime: number;
  };
}

export interface NetworkInterface {
  name: string;
  type: string;
  speed: number;
  mtu: number;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  errorsIn: number;
  errorsOut: number;
  droppedIn: number;
  droppedOut: number;
  isUp: boolean;
}

export interface DatabaseMetrics {
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
    waiting: number;
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    totalQueries: number;
    queriesPerSecond: number;
    deadlocks: number;
    lockWaitTime: number;
  };
  storage: {
    size: number;
    indexesSize: number;
    tablesCount: number;
    indexesCount: number;
    bloatSize: number;
    lastVacuum?: Date;
    lastAnalyze?: Date;
  };
  replication: {
    isReplica: boolean;
    replicationLag?: number;
    lastReplayTimestamp?: Date;
  };
  health: {
    isHealthy: boolean;
    lastCheck: Date;
    responseTime: number;
    status: 'UP' | 'DEGRADED' | 'DOWN';
  };
}

export interface CacheMetrics {
  redis: {
    connectedClients: number;
    usedMemory: number;
    maxMemory: number;
    memoryPercentage: number;
    hitRate: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    operationsPerSecond: number;
    evictedKeys: number;
    expiredKeys: number;
    connectedSlaves: number;
    uptime: number;
    version: string;
  };
  application: {
    cacheSize: number;
    hitRate: number;
    missRate: number;
    evictions: number;
    operations: number;
    averageResponseTime: number;
  };
  health: {
    isHealthy: boolean;
    lastCheck: Date;
    responseTime: number;
    status: 'UP' | 'DEGRADED' | 'DOWN';
  };
}

export interface ServiceMetrics {
  name: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'DATABASE' | 'CACHE' | 'QUEUE';
  status: 'UP' | 'DEGRADED' | 'DOWN';
  responseTime: number;
  lastCheck: Date;
  uptime: number;
  version?: string;
  endpoint?: string;
  errorRate: number;
  requestsPerMinute: number;
  metadata: Record<string, any>;
}

export interface ContainerMetrics {
  name: string;
  status: 'running' | 'stopped' | 'paused' | 'restarting';
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
  io: {
    readBytes: number;
    writeBytes: number;
  };
  uptime: number;
  restarts: number;
  health: 'healthy' | 'unhealthy' | 'none';
}

export interface InfrastructureSummary {
  timestamp: Date;
  server: ServerMetrics;
  database: DatabaseMetrics;
  cache: CacheMetrics;
  services: ServiceMetrics[];
  containers?: ContainerMetrics[];
  alerts: InfrastructureAlert[];
  healthScore: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

export interface InfrastructureAlert {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'SUPPRESSED';
  source: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface ResourceTrend {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  databaseConnections: number;
  cacheHitRate: number;
}

@Injectable()
export class InfrastructureService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InfrastructureService.name);
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsHistory: ResourceTrend[] = [];
  private maxHistorySize = 10080; // 7 days of minute-by-minute data
  private alerts: InfrastructureAlert[] = [];
  private lastMetrics: {
    server?: ServerMetrics;
    database?: DatabaseMetrics;
    cache?: CacheMetrics;
  } = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly enhancedLogger: EnhancedLoggerService,
  ) {}

  onModuleInit() {
    // Start monitoring every minute
    this.monitoringInterval = setInterval(() => {
      this.collectInfrastructureMetrics().catch(error => {
        this.logger.error('Infrastructure metrics collection failed:', error instanceof Error ? error : new Error(String(error)));
      });
    }, 60000); // 1 minute

    // Initial collection
    setTimeout(() => {
      this.collectInfrastructureMetrics().catch(error => {
        this.logger.error('Initial infrastructure metrics collection failed:', error);
      });
    }, 5000);

    this.logger.log('Infrastructure monitoring service initialized');
  }

  async collectInfrastructureMetrics(): Promise<void> {
    try {
      this.logger.debug('Collecting infrastructure metrics');

      const serverMetrics = await this.collectServerMetrics();
      const databaseMetrics = await this.collectDatabaseMetrics();
      const cacheMetrics = await this.collectCacheMetrics();
      await this.collectServiceMetrics();

      // Store last metrics
      this.lastMetrics = {
        server: serverMetrics,
        database: databaseMetrics,
        cache: cacheMetrics,
      };

      // Create trend data point
      const trend: ResourceTrend = {
        timestamp: new Date(),
        cpu: serverMetrics.cpu.usage,
        memory: serverMetrics.memory.percentage,
        disk: serverMetrics.disk.percentage,
        network: serverMetrics.network.bytesReceived + serverMetrics.network.bytesSent,
        databaseConnections: databaseMetrics.connections.active,
        cacheHitRate: cacheMetrics.redis.hitRate,
      };

      this.metricsHistory.unshift(trend);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(0, this.maxHistorySize);
      }

      // Check for infrastructure alerts
      await this.checkInfrastructureAlerts(serverMetrics, databaseMetrics, cacheMetrics);

      this.enhancedLogger.debug('Infrastructure metrics collection completed', 'INFRASTRUCTURE');
    } catch (error) {
      this.logger.error('Infrastructure metrics collection failed:', error instanceof Error ? error : new Error(String(error)));
      this.enhancedLogger.error('Infrastructure metrics collection failed', error instanceof Error ? error : undefined, 'INFRASTRUCTURE', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async collectServerMetrics(): Promise<ServerMetrics> {
    const os = require('os');
    const process = require('process');

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = process.memoryUsage();

    return {
      cpu: {
        usage: this.getCPUUsage(),
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Unknown',
        speed: os.cpus()[0]?.speed || 0,
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        available: freeMemory,
        percentage: (usedMemory / totalMemory) * 100,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
      system: {
        uptime: os.uptime(),
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        processId: process.pid,
        processUptime: process.uptime(),
      },
    };
  }

  private async collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      // Get connection pool metrics
      const connectionStats = await this.getDatabaseConnectionMetrics();

      // Get performance metrics
      const performanceStats = await this.getDatabasePerformanceMetrics();

      // Get storage metrics
      const storageStats = await this.getDatabaseStorageMetrics();

      // Check health
      const startTime = Date.now();
      const isHealthy = await this.prismaService.healthCheck();
      const responseTime = Date.now() - startTime;

      return {
        connections: connectionStats,
        performance: performanceStats,
        storage: storageStats,
        replication: await this.getDatabaseReplicationMetrics(),
        health: {
          isHealthy,
          lastCheck: new Date(),
          responseTime,
          status: isHealthy ? 'UP' : responseTime > 1000 ? 'DEGRADED' : 'DOWN',
        },
      };
    } catch (error) {
      this.logger.error('Failed to collect database metrics:', error);
      return this.getDefaultDatabaseMetrics();
    }
  }

  private async collectCacheMetrics(): Promise<CacheMetrics> {
    try {
      const redisConnected = this.cacheService.isRedisConnected();
      const startTime = Date.now();

      let redisMetrics = this.getDefaultRedisMetrics();

      if (redisConnected) {
        redisMetrics = await this.getRedisMetrics();
      }

      const responseTime = Date.now() - startTime;

      return {
        redis: redisMetrics,
        application: {
          cacheSize: 0, // Not available in CacheStats
          hitRate: this.cacheService.getStats().hits > 0 ?
            (this.cacheService.getStats().hits / (this.cacheService.getStats().hits + this.cacheService.getStats().misses)) * 100 : 0,
          missRate: this.cacheService.getStats().misses > 0 ?
            (this.cacheService.getStats().misses / (this.cacheService.getStats().hits + this.cacheService.getStats().misses)) * 100 : 0,
          evictions: this.cacheService.getStats().evictions,
          operations: this.cacheService.getStats().hits + this.cacheService.getStats().misses,
          averageResponseTime: responseTime,
        },
        health: {
          isHealthy: redisConnected,
          lastCheck: new Date(),
          responseTime,
          status: redisConnected ? 'UP' : 'DOWN',
        },
      };
    } catch (error) {
      this.logger.error('Failed to collect cache metrics:', error);
      return this.getDefaultCacheMetrics();
    }
  }

  private async collectServiceMetrics(): Promise<ServiceMetrics[]> {
    const services: ServiceMetrics[] = [];

    // Add database service
    services.push({
      name: 'PostgreSQL Database',
      type: 'DATABASE',
      status: this.lastMetrics.database?.health.status || 'DOWN',
      responseTime: this.lastMetrics.database?.health.responseTime || 0,
      lastCheck: this.lastMetrics.database?.health.lastCheck || new Date(),
      uptime: this.lastMetrics.database ? Date.now() - this.lastMetrics.database.health.lastCheck.getTime() : 0,
      version: '14.x', // Would be dynamic
      endpoint: this.configService.get<string>('app.database.url', 'localhost:5432'),
      errorRate: 0, // Would be calculated from actual metrics
      requestsPerMinute: 0, // Would be calculated from actual metrics
      metadata: {
        connections: this.lastMetrics.database?.connections.active || 0,
        slowQueries: this.lastMetrics.database?.performance.slowQueries || 0,
      },
    });

    // Add Redis cache service
    services.push({
      name: 'Redis Cache',
      type: 'CACHE',
      status: this.lastMetrics.cache?.health.status || 'DOWN',
      responseTime: this.lastMetrics.cache?.health.responseTime || 0,
      lastCheck: this.lastMetrics.cache?.health.lastCheck || new Date(),
      uptime: this.lastMetrics.cache?.redis.uptime || 0,
      version: this.lastMetrics.cache?.redis.version || 'unknown',
      endpoint: this.configService.get<string>('app.redis.url', 'localhost:6379'),
      errorRate: 0,
      requestsPerMinute: this.lastMetrics.cache?.redis.operationsPerSecond || 0,
      metadata: {
        memoryUsage: this.lastMetrics.cache?.redis.usedMemory || 0,
        hitRate: this.lastMetrics.cache?.redis.hitRate || 0,
        connectedClients: this.lastMetrics.cache?.redis.connectedClients || 0,
      },
    });

    // Add application service
    services.push({
      name: 'ERP Application',
      type: 'INTERNAL',
      status: 'UP', // Application is running if this code executes
      responseTime: 10, // Placeholder
      lastCheck: new Date(),
      uptime: process.uptime() * 1000,
      version: process.env.npm_package_version || '1.0.0',
      endpoint: 'http://localhost:3000',
      errorRate: 0, // Would be calculated from actual metrics
      requestsPerMinute: 0, // Would be calculated from actual metrics
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: this.lastMetrics.server?.memory.percentage || 0,
        cpuUsage: this.lastMetrics.server?.cpu.usage || 0,
      },
    });

    return services;
  }

  private async checkInfrastructureAlerts(
    serverMetrics: ServerMetrics,
    databaseMetrics: DatabaseMetrics,
    cacheMetrics: CacheMetrics,
  ): Promise<void> {
    // Check CPU usage
    if (serverMetrics.cpu.usage > 90) {
      await this.createInfrastructureAlert({
        name: 'High CPU Usage',
        description: `CPU usage is ${serverMetrics.cpu.usage.toFixed(2)}%`,
        severity: serverMetrics.cpu.usage > 95 ? 'CRITICAL' : 'HIGH',
        source: 'server',
        metric: 'cpu.usage',
        threshold: 90,
        currentValue: serverMetrics.cpu.usage,
        metadata: { loadAverage: serverMetrics.cpu.loadAverage },
      });
    }

    // Check memory usage
    if (serverMetrics.memory.percentage > 90) {
      await this.createInfrastructureAlert({
        name: 'High Memory Usage',
        description: `Memory usage is ${serverMetrics.memory.percentage.toFixed(2)}%`,
        severity: serverMetrics.memory.percentage > 95 ? 'CRITICAL' : 'HIGH',
        source: 'server',
        metric: 'memory.percentage',
        threshold: 90,
        currentValue: serverMetrics.memory.percentage,
        metadata: {
          used: serverMetrics.memory.used,
          total: serverMetrics.memory.total,
        },
      });
    }

    // Check disk usage
    if (serverMetrics.disk.percentage > 85) {
      await this.createInfrastructureAlert({
        name: 'High Disk Usage',
        description: `Disk usage is ${serverMetrics.disk.percentage.toFixed(2)}%`,
        severity: serverMetrics.disk.percentage > 95 ? 'CRITICAL' : 'HIGH',
        source: 'server',
        metric: 'disk.percentage',
        threshold: 85,
        currentValue: serverMetrics.disk.percentage,
        metadata: {
          mountPoint: serverMetrics.disk.mountPoint,
          used: serverMetrics.disk.used,
          total: serverMetrics.disk.total,
        },
      });
    }

    // Check database connections
    if (databaseMetrics.connections.active > databaseMetrics.connections.max * 0.8) {
      await this.createInfrastructureAlert({
        name: 'High Database Connections',
        description: `Database has ${databaseMetrics.connections.active} active connections (${databaseMetrics.connections.max} max)`,
        severity: 'HIGH',
        source: 'database',
        metric: 'connections.active',
        threshold: databaseMetrics.connections.max * 0.8,
        currentValue: databaseMetrics.connections.active,
        metadata: {
          totalConnections: databaseMetrics.connections.total,
          idleConnections: databaseMetrics.connections.idle,
        },
      });
    }

    // Check cache hit rate
    if (cacheMetrics.redis.hitRate < 50 && cacheMetrics.redis.keyspaceHits + cacheMetrics.redis.keyspaceMisses > 1000) {
      await this.createInfrastructureAlert({
        name: 'Low Cache Hit Rate',
        description: `Cache hit rate is ${cacheMetrics.redis.hitRate.toFixed(2)}%`,
        severity: 'MEDIUM',
        source: 'cache',
        metric: 'redis.hitRate',
        threshold: 50,
        currentValue: cacheMetrics.redis.hitRate,
        metadata: {
          hits: cacheMetrics.redis.keyspaceHits,
          misses: cacheMetrics.redis.keyspaceMisses,
        },
      });
    }
  }

  async getInfrastructureSummary(): Promise<InfrastructureSummary> {
    try {
      // Collect fresh metrics if needed
      if (!this.lastMetrics.server || !this.lastMetrics.database || !this.lastMetrics.cache) {
        await this.collectInfrastructureMetrics();
      }

      const services = await this.collectServiceMetrics();
      const healthScore = this.calculateInfrastructureHealthScore();
      const overallStatus = this.determineOverallStatus(healthScore);

      return {
        timestamp: new Date(),
        server: this.lastMetrics.server!,
        database: this.lastMetrics.database!,
        cache: this.lastMetrics.cache!,
        services,
        alerts: this.getActiveAlerts(),
        healthScore,
        overallStatus,
      };
    } catch (error) {
      this.logger.error('Failed to get infrastructure summary:', error);
      throw error;
    }
  }

  getResourceTrends(hours: number = 24): ResourceTrend[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(trend => trend.timestamp >= cutoff);
  }

  getInfrastructureAlerts(): InfrastructureAlert[] {
    return this.alerts;
  }

  getActiveAlerts(): InfrastructureAlert[] {
    return this.alerts.filter(alert => alert.status === 'ACTIVE');
  }

  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'RESOLVED';
      alert.resolvedAt = new Date();

      this.enhancedLogger.info(
        `Infrastructure alert resolved: ${alert.name}`,
        'INFRASTRUCTURE',
        { alertId, resolvedBy }
      );

      return true;
    }
    return false;
  }

  // Helper methods
  private getCPUUsage(): number {
    const cpus = require('os').cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu: any) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    return totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;
  }

  private async getDiskMetrics(): Promise<ServerMetrics['disk']> {
    // In a real implementation, you would use a library like 'diskusage'
    // For now, return mock data
    return {
      total: 100 * 1024 * 1024 * 1024, // 100GB
      used: 45 * 1024 * 1024 * 1024,  // 45GB
      free: 55 * 1024 * 1024 * 1024,  // 55GB
      percentage: 45,
      mountPoint: '/',
      filesystem: 'ext4',
      iops: 1000,
      readSpeed: 500,
      writeSpeed: 300,
    };
  }

  private async getNetworkMetrics(): Promise<ServerMetrics['network']> {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();

    const interfaces: NetworkInterface[] = [];
    let totalBytesReceived = 0;
    let totalBytesSent = 0;
    let totalPacketsReceived = 0;
    let totalPacketsSent = 0;
    let totalErrorsIn = 0;
    let totalErrorsOut = 0;

    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      if (Array.isArray(addrs)) {
        for (const addr of addrs) {
          if (!addr.internal) {
            // In a real implementation, you would get actual interface statistics
            interfaces.push({
              name,
              type: addr.family,
              speed: 1000,
              mtu: 1500,
              bytesReceived: Math.floor(Math.random() * 1000000),
              bytesSent: Math.floor(Math.random() * 1000000),
              packetsReceived: Math.floor(Math.random() * 10000),
              packetsSent: Math.floor(Math.random() * 10000),
              errorsIn: Math.floor(Math.random() * 10),
              errorsOut: Math.floor(Math.random() * 10),
              droppedIn: Math.floor(Math.random() * 5),
              droppedOut: Math.floor(Math.random() * 5),
              isUp: true,
            });

            totalBytesReceived += interfaces[interfaces.length - 1].bytesReceived;
            totalBytesSent += interfaces[interfaces.length - 1].bytesSent;
            totalPacketsReceived += interfaces[interfaces.length - 1].packetsReceived;
            totalPacketsSent += interfaces[interfaces.length - 1].packetsSent;
            totalErrorsIn += interfaces[interfaces.length - 1].errorsIn;
            totalErrorsOut += interfaces[interfaces.length - 1].errorsOut;
          }
        }
      }
    }

    return {
      interfaces,
      connections: Math.floor(Math.random() * 100) + 50,
      bytesReceived: totalBytesReceived,
      bytesSent: totalBytesSent,
      packetsReceived: totalPacketsReceived,
      packetsSent: totalPacketsSent,
      errorsIn: totalErrorsIn,
      errorsOut: totalErrorsOut,
    };
  }

  private async getDatabaseConnectionMetrics(): Promise<DatabaseMetrics['connections']> {
    try {
      // Get PostgreSQL connection stats
      const connectionStats = await this.prismaService.$queryRaw`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) FILTER (WHERE state = 'waiting') as waiting_connections
        FROM pg_stat_activity
      ` as any[];

      const stats = connectionStats[0];
      const maxConnections = 100; // Would get from actual config

      return {
        active: stats.active_connections,
        idle: stats.idle_connections,
        total: stats.total_connections,
        max: maxConnections,
        waiting: stats.waiting_connections,
      };
    } catch (error) {
      return {
        active: 0,
        idle: 0,
        total: 0,
        max: 100,
        waiting: 0,
      };
    }
  }

  private async getDatabasePerformanceMetrics(): Promise<DatabaseMetrics['performance']> {
    try {
      // Get performance stats
      const perfStats = await this.prismaService.$queryRaw`
        SELECT
          avg(EXTRACT(EPOCH FROM (query_end - query_start))) as avg_query_time,
          count(*) FILTER (WHERE EXTRACT(EPOCH FROM (query_end - query_start)) > 1) as slow_queries,
          count(*) as total_queries
        FROM pg_stat_statements
      ` as any[];

      const stats = perfStats[0];

      return {
        averageQueryTime: stats.avg_query_time ? parseFloat(stats.avg_query_time) * 1000 : 0,
        slowQueries: parseInt(stats.slow_queries) || 0,
        totalQueries: parseInt(stats.total_queries) || 0,
        queriesPerSecond: 0, // Would calculate from time window
        deadlocks: 0, // Would get from pg_stat_database
        lockWaitTime: 0, // Would get from pg_locks
      };
    } catch (error) {
      return {
        averageQueryTime: 0,
        slowQueries: 0,
        totalQueries: 0,
        queriesPerSecond: 0,
        deadlocks: 0,
        lockWaitTime: 0,
      };
    }
  }

  private async getDatabaseStorageMetrics(): Promise<DatabaseMetrics['storage']> {
    try {
      // Get storage stats
      const storageStats = await this.prismaService.$queryRaw`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as size,
          pg_size_pretty(sum(pg_relation_size(pg_class.oid))) as indexes_size,
          count(*) as tables_count
        FROM pg_class
        LEFT JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname NOT IN ('pg_catalog', 'information_schema')
      ` as any[];

      const stats = storageStats[0];

      return {
        size: this.parseSizeToBytes(stats.size),
        indexesSize: this.parseSizeToBytes(stats.indexes_size),
        tablesCount: parseInt(stats.tables_count) || 0,
        indexesCount: 0, // Would get from separate query
        bloatSize: 0, // Would calculate from pgstattuple
        lastVacuum: new Date(), // Would get from pg_stat_user_tables
        lastAnalyze: new Date(), // Would get from pg_stat_user_tables
      };
    } catch (error) {
      return {
        size: 0,
        indexesSize: 0,
        tablesCount: 0,
        indexesCount: 0,
        bloatSize: 0,
      };
    }
  }

  private async getDatabaseReplicationMetrics(): Promise<DatabaseMetrics['replication']> {
    // Check if this is a replica and get replication lag
    return {
      isReplica: false, // Would check from pg_is_in_recovery()
      replicationLag: 0,
      lastReplayTimestamp: undefined,
    };
  }

  private async getRedisMetrics(): Promise<CacheMetrics['redis']> {
    try {
      // In a real implementation, you would use Redis client info
      return {
        connectedClients: 5,
        usedMemory: 50 * 1024 * 1024, // 50MB
        maxMemory: 100 * 1024 * 1024, // 100MB
        memoryPercentage: 50,
        hitRate: 85,
        keyspaceHits: 1000,
        keyspaceMisses: 150,
        operationsPerSecond: 50,
        evictedKeys: 10,
        expiredKeys: 5,
        connectedSlaves: 0,
        uptime: 86400, // 1 day
        version: '6.2.6',
      };
    } catch (error) {
      return this.getDefaultRedisMetrics();
    }
  }

  private parseSizeToBytes(sizeStr: string): number {
    // Parse size string like "45MB" to bytes
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  private getDefaultDatabaseMetrics(): DatabaseMetrics {
    return {
      connections: { active: 0, idle: 0, total: 0, max: 100, waiting: 0 },
      performance: { averageQueryTime: 0, slowQueries: 0, totalQueries: 0, queriesPerSecond: 0, deadlocks: 0, lockWaitTime: 0 },
      storage: { size: 0, indexesSize: 0, tablesCount: 0, indexesCount: 0, bloatSize: 0 },
      replication: { isReplica: false },
      health: { isHealthy: false, lastCheck: new Date(), responseTime: 0, status: 'DOWN' },
    };
  }

  private getDefaultRedisMetrics(): CacheMetrics['redis'] {
    return {
      connectedClients: 0,
      usedMemory: 0,
      maxMemory: 0,
      memoryPercentage: 0,
      hitRate: 0,
      keyspaceHits: 0,
      keyspaceMisses: 0,
      operationsPerSecond: 0,
      evictedKeys: 0,
      expiredKeys: 0,
      connectedSlaves: 0,
      uptime: 0,
      version: 'unknown',
    };
  }

  private getDefaultCacheMetrics(): CacheMetrics {
    return {
      redis: this.getDefaultRedisMetrics(),
      application: {
        cacheSize: 0,
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        operations: 0,
        averageResponseTime: 0,
      },
      health: {
        isHealthy: false,
        lastCheck: new Date(),
        responseTime: 0,
        status: 'DOWN',
      },
    };
  }

  private calculateInfrastructureHealthScore(): number {
    let score = 100;

    // Deduct points for server issues
    if (this.lastMetrics.server) {
      if (this.lastMetrics.server.cpu.usage > 90) score -= 20;
      if (this.lastMetrics.server.memory.percentage > 90) score -= 20;
      if (this.lastMetrics.server.disk.percentage > 85) score -= 15;
    }

    // Deduct points for database issues
    if (this.lastMetrics.database && !this.lastMetrics.database.health.isHealthy) {
      score -= 30;
    }

    // Deduct points for cache issues
    if (this.lastMetrics.cache && !this.lastMetrics.cache.health.isHealthy) {
      score -= 15;
    }

    // Deduct points for active alerts
    const criticalAlerts = this.getActiveAlerts().filter(a => a.severity === 'CRITICAL').length;
    const highAlerts = this.getActiveAlerts().filter(a => a.severity === 'HIGH').length;

    score -= criticalAlerts * 25;
    score -= highAlerts * 10;

    return Math.max(0, Math.min(100, score));
  }

  private determineOverallStatus(healthScore: number): 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' {
    if (healthScore >= 80) return 'HEALTHY';
    if (healthScore >= 50) return 'DEGRADED';
    return 'UNHEALTHY';
  }

  private async createInfrastructureAlert(alertData: Omit<InfrastructureAlert, 'id' | 'timestamp' | 'status'>): Promise<void> {
    const alert: InfrastructureAlert = {
      id: this.generateId(),
      ...alertData,
      timestamp: new Date(),
      status: 'ACTIVE',
    };

    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a =>
      a.name === alert.name &&
      a.source === alert.source &&
      a.metric === alert.metric &&
      a.status === 'ACTIVE'
    );

    if (!existingAlert) {
      this.alerts.unshift(alert);

      this.enhancedLogger.warn(
        `Infrastructure alert triggered: ${alert.name}`,
        'INFRASTRUCTURE_ALERT',
        {
          alertId: alert.id,
          source: alert.source,
          metric: alert.metric,
          threshold: alert.threshold,
          currentValue: alert.currentValue,
          severity: alert.severity,
        }
      );
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  onModuleDestroy() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}