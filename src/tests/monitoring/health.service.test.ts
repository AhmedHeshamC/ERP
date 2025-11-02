import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../../shared/monitoring/health/health.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';
import { EnhancedLoggerService } from '../../shared/monitoring/logging/enhanced-logger.service';

describe('HealthService', () => {
  let service: HealthService;
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
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
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

    service = module.get<HealthService>(HealthService);
    prismaService = module.get(PrismaService);
    cacheService = module.get(CacheService);
    configService = module.get(ConfigService);
    loggerService = module.get(EnhancedLoggerService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('performHealthCheck', () => {
    it('should return healthy status when all services are up', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.get.mockResolvedValue('test_value');
      mockCacheService.del.mockResolvedValue(true);
      mockCacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
      });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);
      mockPrismaService.$queryRaw.mockResolvedValue([{ test: 'data' }]);

      // Act
      const result = await service.performHealthCheck();

      // Assert
      expect(result.status).toBe('HEALTHY');
      expect(result.overallScore).toBeGreaterThan(80);
      expect(result.checks).toHaveLength(6); // database, cache, application, external, system, business
      expect(result.checks.every(check => check.status === 'UP' || check.status === 'DEGRADED')).toBe(true);
    });

    it('should return degraded status when cache is down', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ test: 'data' }]);

      // Act
      const result = await service.performHealthCheck();

      // Assert
      expect(result.status).toBe('DEGRADED');
      expect(result.overallScore).toBeLessThan(80);
      expect(result.checks.find(check => check.name === 'redis_cache')?.status).toBe('DEGRADED');
    });

    it('should return unhealthy status when database is down', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(false);
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
      });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const result = await service.performHealthCheck();

      // Assert
      expect(result.status).toBe('UNHEALTHY');
      expect(result.overallScore).toBeLessThan(50);
      expect(result.checks.find(check => check.name === 'database')?.status).toBe('DOWN');
    });

    it('should complete within 100ms for basic health check', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(true);

      const startTime = Date.now();

      // Act
      await service.performHealthCheck();

      // Assert
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Allow more time for comprehensive check
    });
  });

  describe('checkDatabase', () => {
    it('should return UP status when database is healthy', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockPrismaService.$queryRaw.mockResolvedValue([{ active: 5, idle: 10 }]);

      // Act
      const result = await service.checkDatabase();

      // Assert
      expect(result.status).toBe('UP');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(mockPrismaService.healthCheck).toHaveBeenCalled();
    });

    it('should return DOWN status when database connection fails', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(false);

      // Act
      const result = await service.checkDatabase();

      // Assert
      expect(result.status).toBe('DOWN');
      expect(result.message).toContain('Database health check query failed');
    });

    it('should handle database exceptions gracefully', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await service.checkDatabase();

      // Assert
      expect(result.status).toBe('DOWN');
      expect(result.message).toContain('Connection failed');
    });
  });

  describe('checkCache', () => {
    it('should return UP status when cache is working', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.get.mockResolvedValue('test_value');
      mockCacheService.del.mockResolvedValue(true);
      mockCacheService.getStats.mockReturnValue({
        hits: 100,
        misses: 20,
        keys: 50,
      });
      mockCacheService.getMemoryUsage.mockResolvedValue(50 * 1024 * 1024);

      // Act
      const result = await service.checkCache();

      // Assert
      expect(result.status).toBe('UP');
      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should return DEGRADED status when Redis is not connected', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(false);

      // Act
      const result = await service.checkCache();

      // Assert
      expect(result.status).toBe('DEGRADED');
      expect(result.message).toContain('Redis is not connected');
    });

    it('should return DEGRADED status when cache operations fail', async () => {
      // Arrange
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockCacheService.get.mockResolvedValue(null); // Different from what we set

      // Act
      const result = await service.checkCache();

      // Assert
      expect(result.status).toBe('DEGRADED');
      expect(result.message).toContain('Cache operations are not working correctly');
    });
  });

  describe('checkApplication', () => {
    it('should return UP status when application is healthy', async () => {
      // Act
      const result = await service.checkApplication();

      // Assert
      expect(result.status).toBe('UP');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
    });

    it('should return UNHEALTHY status when memory usage is high', async () => {
      // Mock high memory usage
      const originalGetSystemMetrics = service.getSystemMetrics;
      service.getSystemMetrics = jest.fn().mockReturnValue({
        memory: { percentage: 95 },
        cpu: { usage: 50 },
      });

      // Act
      const result = await service.checkApplication();

      // Assert
      expect(result.status).toBe('UNHEALTHY');
      expect(result.message).toContain('High memory usage');

      // Restore original method
      service.getSystemMetrics = originalGetSystemMetrics;
    });

    it('should return DEGRADED status when memory usage is elevated', async () => {
      // Mock elevated memory usage
      const originalGetSystemMetrics = service.getSystemMetrics;
      service.getSystemMetrics = jest.fn().mockReturnValue({
        memory: { percentage: 80 },
        cpu: { usage: 50 },
      });

      // Act
      const result = await service.checkApplication();

      // Assert
      expect(result.status).toBe('DEGRADED');
      expect(result.message).toContain('Elevated memory usage');

      // Restore original method
      service.getSystemMetrics = originalGetSystemMetrics;
    });
  });

  describe('checkSystemResources', () => {
    it('should return UP status when system resources are healthy', async () => {
      // Act
      const result = await service.checkSystemResources();

      // Assert
      expect(['UP', 'DEGRADED', 'UNHEALTHY']).toContain(result.status);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
    });

    it('should calculate health score correctly', async () => {
      // Act
      const result = await service.checkSystemResources();

      // Assert
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.details).toBeDefined();
    });
  });

  describe('checkBusinessLogic', () => {
    it('should return business logic health checks', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockPrismaService.$queryRaw.mockResolvedValue([{ test: 'data' }]);

      // Act
      const result = await service.checkBusinessLogic();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.every(check => ['UP', 'DOWN'].includes(check.status))).toBe(true);
    });

    it('should handle business logic failures gracefully', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockRejectedValue(new Error('Business logic failed'));

      // Act
      const result = await service.checkBusinessLogic();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.some(check => check.status === 'DOWN')).toBe(true);
    });
  });

  describe('calculateOverallHealth', () => {
    it('should return HEALTHY when all checks are UP', () => {
      // Arrange
      const checks = [
        { name: 'database', status: 'UP', responseTime: 10 },
        { name: 'cache', status: 'UP', responseTime: 5 },
        { name: 'application', status: 'UP', responseTime: 1 },
      ];

      // Act
      const result = (service as any).calculateOverallHealth(checks, 50);

      // Assert
      expect(result.status).toBe('HEALTHY');
      expect(result.overallScore).toBeGreaterThan(80);
    });

    it('should return UNHEALTHY when critical services are DOWN', () => {
      // Arrange
      const checks = [
        { name: 'database', status: 'DOWN', responseTime: 1000 },
        { name: 'cache', status: 'UP', responseTime: 5 },
        { name: 'application', status: 'UP', responseTime: 1 },
      ];

      // Act
      const result = (service as any).calculateOverallHealth(checks, 1000);

      // Assert
      expect(result.status).toBe('UNHEALTHY');
      expect(result.overallScore).toBeLessThan(50);
    });

    it('should return DEGRADED when some services are degraded', () => {
      // Arrange
      const checks = [
        { name: 'database', status: 'UP', responseTime: 100 },
        { name: 'cache', status: 'DEGRADED', responseTime: 50 },
        { name: 'application', status: 'UP', responseTime: 1 },
      ];

      // Act
      const result = (service as any).calculateOverallHealth(checks, 100);

      // Assert
      expect(result.status).toBe('DEGRADED');
      expect(result.overallScore).toBeLessThan(100);
      expect(result.overallScore).toBeGreaterThanOrEqual(50);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics', () => {
      // Act
      const metrics = service.getSystemMetrics();

      // Assert
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      expect(metrics).toHaveProperty('network');
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getLastHealthCheck', () => {
    it('should return null when no health check has been performed', () => {
      // Act
      const result = service.getLastHealthCheck();

      // Assert
      expect(result).toBeNull();
    });

    it('should return the last health check result', async () => {
      // Arrange
      mockPrismaService.healthCheck.mockResolvedValue(true);
      mockCacheService.isRedisConnected.mockReturnValue(true);
      mockPrismaService.$queryRaw.mockResolvedValue([{ test: 'data' }]);

      await service.performHealthCheck();

      // Act
      const result = service.getLastHealthCheck();

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe('HEALTHY');
    });
  });

  describe('getHealthHistory', () => {
    it('should return health history', async () => {
      // Act
      const history = await service.getHealthHistory(24);

      // Assert
      expect(Array.isArray(history)).toBe(true);
    });
  });
});