import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InfrastructureService } from '../../shared/monitoring/infrastructure/infrastructure.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EnhancedLoggerService } from '../../shared/monitoring/logging/enhanced-logger.service';

describe('InfrastructureService', () => {
  let service: InfrastructureService;
  let prismaService: jest.Mocked<PrismaService>;
  let cacheService: jest.Mocked<CacheService>;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<EnhancedLoggerService>;

  const mockPrismaService = {
    healthCheck: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockCacheService = {
    isRedisConnected: jest.fn(),
    getStats: jest.fn(),
    getMemoryUsage: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
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
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
    configService = module.get(ConfigService);
    loggerService = module.get(EnhancedLoggerService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('collectServerMetrics', () => {
    it('should collect server metrics successfully', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
      expect(metrics).toHaveProperty('system');

      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('loadAverage');
      expect(metrics.cpu).toHaveProperty('cores');

      expect(metrics.memory).toHaveProperty('total');
      expect(metrics.memory).toHaveProperty('used');
      expect(metrics.memory).toHaveProperty('percentage');

      expect(metrics.system).toHaveProperty('hostname');
      expect(metrics.system).toHaveProperty('platform');
      expect(metrics.system).toHaveProperty('uptime');
    });

    it('should return valid CPU usage', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
    });

    it('should return valid memory metrics', async () => {
      // Act
      const metrics = await service['collectServerMetrics']();

      // Assert
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.used).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.free).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('collectDatabaseMetrics', () => {
    it('should collect database metrics when healthy', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { total_connections: 10, active_connections: 5, idle_connections: 5, waiting_connections: 0 },
        { avg_query_time: 0.05, slow_queries: 2, total_queries: 1000 },
        { size: '1GB', indexes_size: '100MB', tables_count: 25 }
      ]);

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.health.isHealthy).toBe(true);
      expect(metrics.health.status).toBe('UP');
      expect(metrics.connections.active).toBeGreaterThanOrEqual(0);
      expect(metrics.performance.averageQueryTime).toBeGreaterThanOrEqual(0);
      expect(metrics.storage.size).toBeGreaterThan(0);
    });

    it('should handle database connection failure', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(false);
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics.health.isHealthy).toBe(false);
      expect(metrics.connections.active).toBe(0);
    });

    it('should return default metrics when database is unavailable', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockRejectedValue(new Error('Database unavailable'));
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Query failed'));

      // Act
      const metrics = await service['collectDatabaseMetrics']();

      // Assert
      expect(metrics.connections.active).toBe(0);
      expect(metrics.connections.total).toBe(0);
      expect(metrics.performance.averageQueryTime).toBe(0);
      expect(metrics.storage.size).toBe(0);
    });
  });

  describe('collectCacheMetrics', () => {
    it('should collect cache metrics when Redis is connected', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.getStats.mockReturnValue({
        hits: 800,
        misses: 200,
        keys: 100,
      });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.health.isHealthy).toBe(true);
      expect(metrics.health.status).toBe('UP');
      expect(metrics.application.hitRate).toBe(80); // 800/(800+200) * 100
      expect(metrics.redis.hitRate).toBeGreaterThan(0);
    });

    it('should handle Redis disconnection', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(false);

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.health.isHealthy).toBe(false);
      expect(metrics.health.status).toBe('DOWN');
      expect(metrics.redis.connectedClients).toBe(0);
      expect(metrics.redis.hitRate).toBe(0);
    });

    it('should calculate cache hit rate correctly', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.getStats.mockReturnValue({
        hits: 950,
        misses: 50,
        keys: 100,
      });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const metrics = await service['collectCacheMetrics']();

      // Assert
      expect(metrics.application.hitRate).toBe(95); // 950/(950+50) * 100
      expect(metrics.application.missRate).toBe(5);
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
      expect(services).toHaveLength(3);
      expect(services[0].name).toBe('PostgreSQL Database');
      expect(services[0].type).toBe('DATABASE');
      expect(services[1].name).toBe('Redis Cache');
      expect(services[1].type).toBe('CACHE');
      expect(services[2].name).toBe('ERP Application');
      expect(services[2].type).toBe('INTERNAL');
    });

    it('should include service metadata', async () => {
      // Arrange
      await service['collectDatabaseMetrics']();
      await service['collectCacheMetrics']();

      // Act
      const services = await service['collectServiceMetrics']();

      // Assert
      const dbService = services.find(s => s.type === 'DATABASE');
      expect(dbService?.metadata).toHaveProperty('connections');
      expect(dbService?.metadata).toHaveProperty('slowQueries');

      const cacheService = services.find(s => s.type === 'CACHE');
      expect(cacheService?.metadata).toHaveProperty('memoryUsage');
      expect(cacheService?.metadata).toHaveProperty('hitRate');
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
      expect(alerts.some(alert => alert.name === 'High CPU Usage')).toBe(true);
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).toBe(true);
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
      expect(alerts.some(alert => alert.name === 'High Memory Usage')).toBe(true);
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).toBe(true);
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
      expect(alerts.some(alert => alert.name === 'High Disk Usage')).toBe(true);
      expect(alerts.some(alert => alert.severity === 'CRITICAL')).toBe(true);
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
      expect(alerts.some(alert => alert.name === 'High Database Connections')).toBe(true);
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
      expect(alerts.some(alert => alert.name === 'Low Cache Hit Rate')).toBe(true);
    });
  });

  describe('getInfrastructureSummary', () => {
    it('should return complete infrastructure summary', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.getStats.mockReturnValue({ hits: 800, misses: 200, keys: 100 });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { total_connections: 10, active_connections: 5 },
        { avg_query_time: 0.05, slow_queries: 2 },
        { size: '1GB', tables_count: 25 }
      ]);

      // Act
      const summary = await service.getInfrastructureSummary();

      // Assert
      expect(summary).toBeDefined();
      expect(summary.timestamp).toBeInstanceOf(Date);
      expect(summary).toHaveProperty('server');
      expect(summary).toHaveProperty('database');
      expect(summary).toHaveProperty('cache');
      expect(summary).toHaveProperty('services');
      expect(summary).toHaveProperty('alerts');
      expect(summary).toHaveProperty('healthScore');
      expect(summary).toHaveProperty('overallStatus');

      expect(summary.services).toHaveLength(3);
      expect(['HEALTHY', 'DEGRADED', 'UNHEALTHY']).toContain(summary.overallStatus);
      expect(summary.healthScore).toBeGreaterThanOrEqual(0);
      expect(summary.healthScore).toBeLessThanOrEqual(100);
    });

    it('should collect fresh metrics when needed', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.getStats.mockReturnValue({ hits: 800, misses: 200, keys: 100 });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const summary = await service.getInfrastructureSummary();

      // Assert
      expect(mockPrismaService.healthCheck).toHaveBeenCalled();
      expect(mockCacheService.isRedisConnected).toHaveBeenCalled();
    });
  });

  describe('getResourceTrends', () => {
    it('should return resource trends for specified period', async () => {
      // Act
      const trends = service.getResourceTrends(24);

      // Assert
      expect(Array.isArray(trends)).toBe(true);
      if (trends.length > 0) {
        expect(trends[0]).toHaveProperty('timestamp');
        expect(trends[0]).toHaveProperty('cpu');
        expect(trends[0]).toHaveProperty('memory');
        expect(trends[0]).toHaveProperty('disk');
        expect(trends[0]).toHaveProperty('network');
        expect(trends[0]).toHaveProperty('databaseConnections');
        expect(trends[0]).toHaveProperty('cacheHitRate');
      }
    });

    it('should limit trends by time period', async () => {
      // Act
      const trends1h = service.getResourceTrends(1);
      const trends24h = service.getResourceTrends(24);

      // Assert
      expect(trends1h.length).toBeLessThanOrEqual(trends24h.length);
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
      expect(result).toBe(true);
      expect(loggerService.info).toHaveBeenCalledWith(
        'Infrastructure alert resolved',
        'INFRASTRUCTURE',
        expect.objectContaining({ alertId, resolvedBy: 'test-user' })
      );
    });

    it('should return false when resolving non-existent alert', async () => {
      // Act
      const result = await service.resolveAlert('non-existent-id', 'test-user');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('calculateInfrastructureHealthScore', () => {
    it('should return high score for healthy infrastructure', async () => {
      // Arrange
      service['lastMetrics'] = {
        server: {
          cpu: { usage: 30 },
          memory: { percentage: 40 },
          disk: { percentage: 25 },
        } as any,
        database: {
          health: { isHealthy: true },
        } as any,
        cache: {
          health: { isHealthy: true },
        } as any,
      };

      // Act
      const score = (service as any).calculateInfrastructureHealthScore();

      // Assert
      expect(score).toBeGreaterThan(80);
    });

    it('should return low score for unhealthy infrastructure', async () => {
      // Arrange
      service['lastMetrics'] = {
        server: {
          cpu: { usage: 95 },
          memory: { percentage: 95 },
          disk: { percentage: 95 },
        } as any,
        database: {
          health: { isHealthy: false },
        } as any,
        cache: {
          health: { isHealthy: false },
        } as any,
      };

      // Act
      const score = (service as any).calculateInfrastructureHealthScore();

      // Assert
      expect(score).toBeLessThan(50);
    });
  });

  describe('determineOverallStatus', () => {
    it('should return HEALTHY for high scores', () => {
      // Act
      const status = (service as any).determineOverallStatus(85);

      // Assert
      expect(status).toBe('HEALTHY');
    });

    it('should return DEGRADED for medium scores', () => {
      // Act
      const status = (service as any).determineOverallStatus(65);

      // Assert
      expect(status).toBe('DEGRADED');
    });

    it('should return UNHEALTHY for low scores', () => {
      // Act
      const status = (service as any).determineOverallStatus(35);

      // Assert
      expect(status).toBe('UNHEALTHY');
    });
  });

  describe('error handling', () => {
    it('should handle collection failures gracefully', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockRejectedValue(new Error('Database failed'));
      mockCacheService.isRedisConnected.mockImplementation(() => {
        throw new Error('Cache failed');
      });

      // Act & Assert - Should not throw
      await expect(service['collectInfrastructureMetrics']()).resolves.not.toThrow();
    });

    it('should use default metrics on collection failure', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockRejectedValue(new Error('Database failed'));
      mockCacheService.isRedisConnected.mockImplementation(() => {
        throw new Error('Cache failed');
      });

      // Act
      await service['collectInfrastructureMetrics']();
      const summary = await service.getInfrastructureSummary();

      // Assert
      expect(summary.database.connections.active).toBe(0);
      expect(summary.cache.redis.hitRate).toBe(0);
    });
  });
});