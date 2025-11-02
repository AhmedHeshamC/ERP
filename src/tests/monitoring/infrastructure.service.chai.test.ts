import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InfrastructureService } from '../../shared/monitoring/infrastructure/infrastructure.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EnhancedLoggerService } from '../../shared/monitoring/logging/enhanced-logger.service';

describe('InfrastructureService', () => {
  let service: InfrastructureService;

  const mockPrismaService = {
    healthCheck: async () => true,
    $queryRaw: async () => [],
  };

  const mockCacheService = {
    isRedisConnected: () => true,
    getStats: () => ({ hits: 800, misses: 200, keys: 100 }),
    getMemoryUsage: async () => 50 * 1024 * 1024,
  };

  const mockConfigService = {
    get: (_key: string, defaultValue?: any) => defaultValue,
  };

  const mockLoggerService = {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    info: () => {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfrastructureService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EnhancedLoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<InfrastructureService>(InfrastructureService);
  });

  afterEach(() => {
    // Clean up any intervals
    service['onModuleDestroy']();
  });

  describe('collectServerMetrics', () => {
    it('should collect server metrics successfully', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics).to.be.an('object');
      expect(metrics).to.have.property('cpu');
      expect(metrics).to.have.property('memory');
      expect(metrics).to.have.property('disk');
      expect(metrics).to.have.property('network');
      expect(metrics).to.have.property('system');

      expect(metrics.cpu).to.have.property('usage');
      expect(metrics.cpu).to.have.property('loadAverage');
      expect(metrics.cpu).to.have.property('cores');

      expect(metrics.memory).to.have.property('total');
      expect(metrics.memory).to.have.property('used');
      expect(metrics.memory).to.have.property('percentage');

      expect(metrics.system).to.have.property('hostname');
      expect(metrics.system).to.have.property('platform');
      expect(metrics.system).to.have.property('uptime');
    });

    it('should return valid CPU usage', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics.cpu.usage).to.be.at.least(0);
      expect(metrics.cpu.usage).to.be.at.most(100);
    });

    it('should return valid memory metrics', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics.memory.total).to.be.greaterThan(0);
      expect(metrics.memory.used).to.be.at.least(0);
      expect(metrics.memory.free).to.be.at.least(0);
      expect(metrics.memory.percentage).to.be.at.least(0);
      expect(metrics.memory.percentage).to.be.at.most(100);
    });
  });

  describe('collectDatabaseMetrics', () => {
    it('should collect database metrics when healthy', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => true;
      mockPrismaService.$queryRaw = async () => [
        { total_connections: 10, active_connections: 5, idle_connections: 5, waiting_connections: 0 },
        { avg_query_time: 0.05, slow_queries: 2, total_queries: 1000 },
        { size: '1GB', indexes_size: '100MB', tables_count: 25 }
      ] as any;

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics).to.be.an('object');
      expect(metrics.health.isHealthy).to.be.true;
      expect(metrics.health.status).to.equal('UP');
      expect(metrics.connections.active).to.be.at.least(0);
      expect(metrics.performance.averageQueryTime).to.be.at.least(0);
      expect(metrics.storage.size).to.be.greaterThan(0);
    });

    it('should handle database connection failure', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => false;
      mockPrismaService.$queryRaw = async () => { throw new Error('Connection failed'); };

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics.health.isHealthy).to.be.false;
      expect(metrics.connections.active).to.equal(0);
    });

    it('should return default metrics when database is unavailable', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => { throw new Error('Database unavailable'); };
      mockPrismaService.$queryRaw = async () => { throw new Error('Query failed'); };

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics.connections.active).to.equal(0);
      expect(metrics.connections.total).to.equal(0);
      expect(metrics.performance.averageQueryTime).to.equal(0);
      expect(metrics.storage.size).to.equal(0);
    });
  });

  describe('collectCacheMetrics', () => {
    it('should collect cache metrics when Redis is connected', async () => {
      // Arrange
      mockCacheService.isRedisConnected = () => true;
      mockCacheService.getStats = () => ({ hits: 800, misses: 200, keys: 100 });
      mockCacheService.getMemoryUsage = async () => 50 * 1024 * 1024;

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.health.isHealthy).to.be.true;
      expect(metrics.health.status).to.equal('UP');
      expect(metrics.application.hitRate).to.equal(80); // 800/(800+200) * 100
      expect(metrics.redis.hitRate).to.be.greaterThan(0);
    });

    it('should handle Redis disconnection', async () => {
      // Arrange
      mockCacheService.isRedisConnected = () => false;

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.health.isHealthy).to.be.false;
      expect(metrics.health.status).to.equal('DOWN');
      expect(metrics.redis.connectedClients).to.equal(0);
      expect(metrics.redis.hitRate).to.equal(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      // Arrange
      mockCacheService.isRedisConnected = () => true;
      mockCacheService.getStats = () => ({ hits: 950, misses: 50, keys: 100 });
      mockCacheService.getMemoryUsage = async () => 50 * 1024 * 1024;

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.application.hitRate).to.equal(95); // 950/(950+50) * 100
      expect(metrics.application.missRate).to.equal(5);
    });
  });

  describe('collectServiceMetrics', () => {
    it('should collect metrics for all services', async () => {
      // Arrange
      await service['collectDatabaseMetrics']();
      await service['collectCacheMetrics']();

      // Act
      const services = await service['collectServiceMetrics']();

      // Assert
      expect(services).to.have.length(3);
      expect(services[0].name).to.equal('PostgreSQL Database');
      expect(services[0].type).to.equal('DATABASE');
      expect(services[1].name).to.equal('Redis Cache');
      expect(services[1].type).to.equal('CACHE');
      expect(services[2].name).to.equal('ERP Application');
      expect(services[2].type).to.equal('INTERNAL');
    });

    it('should include service metadata', async () => {
      // Arrange
      await service['collectDatabaseMetrics']();
      await service['collectCacheMetrics']();

      // Act
      const services = await service['collectServiceMetrics']();

      // Assert
      const dbService = services.find(s => s.type === 'DATABASE');
      expect(dbService?.metadata).to.have.property('connections');
      expect(dbService?.metadata).to.have.property('slowQueries');

      const cacheService = services.find(s => s.type === 'CACHE');
      expect(cacheService?.metadata).to.have.property('memoryUsage');
      expect(cacheService?.metadata).to.have.property('hitRate');
    });
  });

  describe('checkInfrastructureAlerts', () => {
    it('should create high CPU usage alert', async () => {
      // Arrange
      const serverMetrics = {
        cpu: { usage: 95 },
        memory: { percentage: 50 },
        disk: { percentage: 30 },
      } as any;

      // Act
      await service['checkInfrastructureAlerts'](serverMetrics, {} as any, {} as any);

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'High CPU Usage')).to.be.true;
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).to.be.true;
    });

    it('should create high memory usage alert', async () => {
      // Arrange
      const serverMetrics = {
        cpu: { usage: 50 },
        memory: { percentage: 95 },
        disk: { percentage: 30 },
      } as any;

      // Act
      await service['checkInfrastructureAlerts'](serverMetrics, {} as any, {} as any);

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'High Memory Usage')).to.be.true;
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).to.be.true;
    });

    it('should create high disk usage alert', async () => {
      // Arrange
      const serverMetrics = {
        cpu: { usage: 50 },
        memory: { percentage: 50 },
        disk: { percentage: 90 },
      } as any;

      // Act
      await service['checkInfrastructureAlerts'](serverMetrics, {} as any, {} as any);

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'High Disk Usage')).to.be.true;
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).to.be.true;
    });

    it('should create database connection alert', async () => {
      // Arrange
      const databaseMetrics = {
        connections: { active: 85, max: 100 },
      } as any;

      // Act
      await service['checkInfrastructureAlerts']({} as any, databaseMetrics, {} as any);

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'High Database Connections')).to.be.true;
    });

    it('should create low cache hit rate alert', async () => {
      // Arrange
      const cacheMetrics = {
        redis: {
          hitRate: 30,
          keyspaceHits: 300,
          keyspaceMisses: 700,
        },
      } as any;

      // Act
      await service['checkInfrastructureAlerts']({} as any, {} as any, cacheMetrics);

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'Low Cache Hit Rate')).to.be.true;
    });
  });

  describe('getInfrastructureSummary', () => {
    it('should return complete infrastructure summary', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => true;
      mockCacheService.isRedisConnected = () => true;
      mockCacheService.getStats = () => ({ hits: 800, misses: 200, keys: 100 });
      mockCacheService.getMemoryUsage = async () => 50 * 1024 * 1024;
      mockPrismaService.$queryRaw = async () => [
        { total_connections: 10, active_connections: 5 },
        { avg_query_time: 0.05, slow_queries: 2 },
        { size: '1GB', tables_count: 25 }
      ] as any;

      // Act
      const summary = await service.getInfrastructureSummary();

      // Assert
      expect(summary).to.be.an('object');
      expect(summary.timestamp).to.be.instanceOf(Date);
      expect(summary).to.have.property('server');
      expect(summary).to.have.property('database');
      expect(summary).to.have.property('cache');
      expect(summary).to.have.property('services');
      expect(summary).to.have.property('alerts');
      expect(summary).to.have.property('healthScore');
      expect(summary).to.have.property('overallStatus');

      expect(summary.services).to.have.length(3);
      expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).to.include(summary.overallStatus);
      expect(summary.healthScore).to.be.at.least(0);
      expect(summary.healthScore).to.be.at.most(100);
    });

    it('should collect fresh metrics when needed', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => true;
      mockCacheService.isRedisConnected = () => true;
      mockCacheService.getStats = () => ({ hits: 800, misses: 200, keys: 100 });
      mockCacheService.getMemoryUsage = async () => 50 * 1024 * 1024;

      // Act
      const summary = await service.getInfrastructureSummary();

      // Assert - Service should call health check and redis check
      expect(summary).to.be.an('object');
    });
  });

  describe('getResourceTrends', () => {
    it('should return resource trends for specified period', async () => {
      // Act
      const trends = service.getResourceTrends(24);

      // Assert
      expect(trends).to.be.an('array');
      if (trends.length > 0) {
        expect(trends[0]).to.have.property('timestamp');
        expect(trends[0]).to.have.property('cpu');
        expect(trends[0]).to.have.property('memory');
        expect(trends[0]).to.have.property('disk');
        expect(trends[0]).to.have.property('network');
        expect(trends[0]).to.have.property('databaseConnections');
        expect(trends[0]).to.have.property('cacheHitRate');
      }
    });

    it('should limit trends by time period', async () => {
      // Act
      const trends1h = service.getResourceTrends(1);
      const trends24h = service.getResourceTrends(24);

      // Assert
      expect(trends1h.length).to.be.at.most(trends24h.length);
    });
  });

  describe('alert management', () => {
    it('should resolve infrastructure alerts', async () => {
      // Arrange
      const serverMetrics = {
        cpu: { usage: 95 },
        memory: { percentage: 50 },
        disk: { percentage: 30 },
      } as any;

      await service['checkInfrastructureAlerts'](serverMetrics, {} as any, {} as any);
      const alerts = service.getActiveAlerts();
      const alertId = alerts[0]?.id;

      // Act
      const result = await service.resolveAlert(alertId!, 'test-user');

      // Assert
      expect(result).to.be.true;
    });

    it('should return false when resolving non-existent alert', async () => {
      // Act
      const result = await service.resolveAlert('non-existent-id', 'test-user');

      // Assert
      expect(result).to.be.false;
    });
  });

  describe('error handling', () => {
    it('should handle collection failures gracefully', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => { throw new Error('Database failed'); };
      mockCacheService.isRedisConnected = () => { throw new Error('Cache failed'); };

      // Act & Assert - Should not throw
      await expect(service['collectInfrastructureMetrics']()).to.not.be.rejected;
    });

    it('should use default metrics on collection failure', async () => {
      // Arrange
      mockPrismaService.healthCheck = async () => { throw new Error('Database failed'); };
      mockCacheService.isRedisConnected = () => { throw new Error('Cache failed'); };

      // Act
      await service['collectInfrastructureMetrics']();
      const summary = await service.getInfrastructureSummary();

      // Assert
      expect(summary.database.connections.active).to.equal(0);
      expect(summary.cache.redis.hitRate).to.equal(0);
    });
  });
});