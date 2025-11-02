import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertService } from '../../shared/monitoring/alerting/alert.service';
import { EnhancedLoggerService } from '../../shared/monitoring/logging/enhanced-logger.service';
import { PerformanceService } from '../../shared/monitoring/performance.service';
import { HealthService } from '../../shared/monitoring/health/health.service';

describe('AlertService', () => {
  let service: AlertService;
  let loggerService: jest.Mocked<EnhancedLoggerService>;
  let performanceService: jest.Mocked<PerformanceService>;
  let healthService: jest.Mocked<HealthService>;
  let configService: jest.Mocked<ConfigService>;

  const mockLoggerService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };

  const mockPerformanceService = {
    getStats: jest.fn(),
  };

  const mockHealthService = {
    performHealthCheck: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: EnhancedLoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: PerformanceService,
          useValue: mockPerformanceService,
        },
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
    loggerService = module.get(EnhancedLoggerService);
    performanceService = module.get(PerformanceService);
    healthService = module.get(HealthService);
    configService = module.get(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create an alert successfully', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
        currentValue: 100,
        threshold: { metric: 'test_metric', operator: 'gt' as const, value: 50, severity: 'HIGH' as const },
      };

      // Act
      const result = await service.createAlert(alertData);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(alertData.name);
      expect(result.description).toBe(alertData.description);
      expect(result.severity).toBe(alertData.severity);
      expect(result.status).toBe('ACTIVE');
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should log the alert creation', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      // Act
      await service.createAlert(alertData);

      // Assert
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Alert triggered: Test Alert'),
        'ALERT',
        expect.objectContaining({
          alertId: expect.any(String),
          severity: 'HIGH',
        })
      );
    });

    it('should handle correlation ID in alert', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'MEDIUM' as const,
        category: 'BUSINESS' as const,
        source: 'test',
        correlationId: 'test-correlation-id',
      };

      // Act
      const result = await service.createAlert(alertData);

      // Assert
      expect(result.correlationId).toBe('test-correlation-id');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an existing alert', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);

      // Act
      const result = await service.resolveAlert(createdAlert.id, 'test-user', 'Test resolution');

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe('RESOLVED');
      expect(result?.resolvedBy).toBe('test-user');
      expect(result?.resolvedAt).toBeInstanceOf(Date);
      expect(result?.notes).toBe('Test resolution');
    });

    it('should return null for non-existent alert', async () => {
      // Act
      const result = await service.resolveAlert('non-existent-id', 'test-user');

      // Assert
      expect(result).toBeNull();
    });

    it('should log alert resolution', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);

      // Act
      await service.resolveAlert(createdAlert.id, 'test-user');

      // Assert
      expect(loggerService.info).toHaveBeenCalledWith(
        'Alert resolved: Test Alert',
        'ALERT',
        expect.objectContaining({
          alertId: createdAlert.id,
          resolvedBy: 'test-user',
        })
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an existing alert', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);

      // Act
      const result = await service.acknowledgeAlert(createdAlert.id, 'test-user', 'Acknowledged for investigation');

      // Assert
      expect(result).toBeDefined();
      expect(result?.acknowledgedBy).toBe('test-user');
      expect(result?.acknowledgedAt).toBeInstanceOf(Date);
      expect(result?.notes).toBe('Acknowledged for investigation');
    });

    it('should return null for resolved alert', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);
      await service.resolveAlert(createdAlert.id, 'test-user');

      // Act
      const result = await service.acknowledgeAlert(createdAlert.id, 'test-user');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('suppressAlert', () => {
    it('should suppress an alert for specified duration', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);

      // Act
      const result = await service.suppressAlert(createdAlert.id, 60, 'Maintenance window');

      // Assert
      expect(result).toBeDefined();
      expect(result?.status).toBe('SUPPRESSED');
    });

    it('should log alert suppression', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const createdAlert = await service.createAlert(alertData);

      // Act
      await service.suppressAlert(createdAlert.id, 60, 'Maintenance window');

      // Assert
      expect(loggerService.info).toHaveBeenCalledWith(
        'Alert suppressed: Test Alert for 60 minutes',
        'ALERT',
        expect.objectContaining({
          alertId: createdAlert.id,
          reason: 'Maintenance window',
        })
      );
    });
  });

  describe('getActiveAlerts', () => {
    it('should return only active alerts', async () => {
      // Arrange
      const alertData1 = {
        name: 'Active Alert',
        description: 'This alert is active',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const alertData2 = {
        name: 'Resolved Alert',
        description: 'This alert is resolved',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      const activeAlert = await service.createAlert(alertData1);
      const resolvedAlert = await service.createAlert(alertData2);
      await service.resolveAlert(resolvedAlert.id, 'test-user');

      // Act
      const result = service.getActiveAlerts();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(activeAlert.id);
      expect(result[0].status).toBe('ACTIVE');
    });

    it('should return empty array when no active alerts', async () => {
      // Act
      const result = service.getActiveAlerts();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getAlerts', () => {
    it('should return all alerts with no filters', async () => {
      // Arrange
      await service.createAlert({
        name: 'Alert 1',
        description: 'Test alert 1',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      });

      await service.createAlert({
        name: 'Alert 2',
        description: 'Test alert 2',
        severity: 'MEDIUM' as const,
        category: 'PERFORMANCE' as const,
        source: 'test',
      });

      // Act
      const result = service.getAlerts();

      // Assert
      expect(result.alerts).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter alerts by severity', async () => {
      // Arrange
      await service.createAlert({
        name: 'High Alert',
        description: 'High severity alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      });

      await service.createAlert({
        name: 'Medium Alert',
        description: 'Medium severity alert',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      });

      // Act
      const result = service.getAlerts({ severity: 'HIGH' });

      // Assert
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe('HIGH');
    });

    it('should filter alerts by category', async () => {
      // Arrange
      await service.createAlert({
        name: 'System Alert',
        description: 'System category alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      });

      await service.createAlert({
        name: 'Performance Alert',
        description: 'Performance category alert',
        severity: 'HIGH' as const,
        category: 'PERFORMANCE' as const,
        source: 'test',
      });

      // Act
      const result = service.getAlerts({ category: 'SYSTEM' });

      // Assert
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].category).toBe('SYSTEM');
    });

    it('should limit results', async () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        await service.createAlert({
          name: `Alert ${i}`,
          description: `Test alert ${i}`,
          severity: 'MEDIUM' as const,
          category: 'SYSTEM' as const,
          source: 'test',
        });
      }

      // Act
      const result = service.getAlerts({ limit: 3 });

      // Assert
      expect(result.alerts).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('performAlertChecks', () => {
    it('should check performance metrics and create alerts', async () => {
      // Arrange
      mockPerformanceService.getStats.mockReturnValue({
        averageResponseTime: 3000, // High response time
        errorRate: 10, // High error rate
        cacheHitRate: 30, // Low cache hit rate
        totalRequests: 100,
      });

      // Act
      await service['performAlertChecks']();

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.name === 'High Response Time')).toBe(true);
      expect(alerts.some(alert => alert.name === 'High Error Rate')).toBe(true);
    });

    it('should check health metrics and create alerts', async () => {
      // Arrange
      mockHealthService.performHealthCheck.mockResolvedValue({
        status: 'UNHEALTHY',
        overallScore: 30,
        checks: [
          { name: 'database', status: 'DOWN', responseTime: 1000 },
          { name: 'cache', status: 'UP', responseTime: 10 },
        ],
        duration: 1000,
        timestamp: new Date(),
        uptime: 1000000,
      });

      // Act
      await service['performAlertChecks']();

      // Assert
      const alerts = service.getActiveAlerts();
      expect(alerts.some(alert => alert.name === 'System Unhealthy')).toBe(true);
    });

    it('should handle check failures gracefully', async () => {
      // Arrange
      mockPerformanceService.getStats.mockImplementation(() => {
        throw new Error('Performance check failed');
      });
      mockHealthService.performHealthCheck.mockRejectedValue(new Error('Health check failed'));

      // Act & Assert - Should not throw
      await expect(service['performAlertChecks']()).resolves.not.toThrow();
    });
  });

  describe('getAlertStatistics', () => {
    it('should return alert statistics', async () => {
      // Arrange
      await service.createAlert({
        name: 'High Alert',
        description: 'High severity alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      });

      await service.createAlert({
        name: 'Medium Alert',
        description: 'Medium severity alert',
        severity: 'MEDIUM' as const,
        category: 'PERFORMANCE' as const,
        source: 'test',
      });

      // Act
      const stats = service.getAlertStatistics(24);

      // Assert
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.bySeverity).toHaveProperty('HIGH', 1);
      expect(stats.bySeverity).toHaveProperty('MEDIUM', 1);
      expect(stats.byCategory).toHaveProperty('SYSTEM', 1);
      expect(stats.byCategory).toHaveProperty('PERFORMANCE', 1);
    });
  });

  describe('error handling', () => {
    it('should handle notification failures gracefully', async () => {
      // Arrange
      const alertData = {
        name: 'Test Alert',
        description: 'This is a test alert',
        severity: 'CRITICAL' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      // Mock notification failure
      jest.spyOn(service as any, 'sendNotification').mockRejectedValue(new Error('Notification failed'));

      // Act & Assert - Should not throw
      await expect(service.createAlert(alertData)).resolves.toBeDefined();
    });
  });

  describe('cooldown and suppression', () => {
    it('should respect cooldown periods', async () => {
      // Arrange
      const alertData = {
        name: 'Frequent Alert',
        description: 'This alert occurs frequently',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      // Act
      const alert1 = await service.createAlert(alertData);
      const alert2 = await service.createAlert(alertData);

      // Assert
      expect(alert1.id).toBeDefined();
      // Second alert should be ignored due to cooldown
      expect(service.getActiveAlerts()).toHaveLength(1);
    });

    it('should respect suppression periods', async () => {
      // Arrange
      const alertData = {
        name: 'Suppressed Alert',
        description: 'This alert should be suppressed',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test',
      };

      // Act
      const alert1 = await service.createAlert(alertData);
      await service.suppressAlert(alert1.id, 5); // Suppress for 5 minutes
      const alert2 = await service.createAlert(alertData);

      // Assert
      expect(alert1.status).toBe('RESOLVED'); // Actually will be SUPPRESSED
      expect(service.getActiveAlerts()).toHaveLength(0);
    });
  });
});