import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DashboardService, DashboardData, SystemOverview, PerformanceMetrics, HealthMetrics, AlertMetrics, LogMetrics, BusinessMetrics, InfrastructureMetrics, TrendData } from '../../shared/monitoring/dashboard/dashboard.service';
import { EnhancedLoggerService } from '../../shared/monitoring/logging/enhanced-logger.service';
import { PerformanceService } from '../../shared/monitoring/performance.service';
import { HealthService } from '../../shared/monitoring/health/health.service';
import { AlertService } from '../../shared/monitoring/alerting/alert.service';
import { CacheService } from '../../shared/cache/cache.service';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('DashboardService', () => {
  let service: DashboardService;
  // let configService: any; // Not used in tests
  let loggerService: any;
  let performanceService: any;
  let healthService: any;
  let alertService: any;
  let cacheService: any;

  // Mock data for testing
  const mockSystemOverview: SystemOverview = {
    status: 'HEALTHY',
    uptime: 86400000,
    healthScore: 95,
    activeUsers: 150,
    totalRequests: 10000,
    errorRate: 2.5,
    responseTime: 250,
    criticalAlerts: 0,
    warningAlerts: 2,
  };

  const mockPerformanceMetrics: PerformanceMetrics = {
    requestsPerMinute: 500,
    averageResponseTime: 250,
    slowestEndpoints: [
      { endpoint: '/api/slow', avgTime: 1000, count: 10 },
      { endpoint: '/api/report', avgTime: 800, count: 5 },
    ],
    fastestEndpoints: [
      { endpoint: '/api/health', avgTime: 50, count: 100 },
      { endpoint: '/api/status', avgTime: 75, count: 80 },
    ],
    cacheHitRate: 85.5,
    memoryUsage: 65.2,
    cpuUsage: 45.8,
    activeConnections: 25,
    throughput: 2000,
    availability: 97.5,
  };

  const mockHealthMetrics: HealthMetrics = {
    overallStatus: 'HEALTHY',
    serviceHealth: [
      { service: 'database', status: 'UP', responseTime: 25 },
      { service: 'cache', status: 'UP', responseTime: 5 },
      { service: 'api', status: 'UP', responseTime: 50 },
    ],
    databaseStatus: 'UP',
    cacheStatus: 'UP',
    lastHealthCheck: new Date(),
    uptime: 86400000,
    systemMetrics: {
      cpu: 45.8,
      memory: 65.2,
      disk: 35.7,
      network: 12,
    },
  };

  const mockAlertMetrics: AlertMetrics = {
    total: 15,
    active: 5,
    critical: 1,
    high: 2,
    medium: 1,
    low: 1,
    resolved: 10,
    suppressed: 0,
    byCategory: {
      performance: 3,
      security: 1,
      system: 1,
    },
    recentAlerts: [
      {
        id: 'alert-1',
        name: 'High CPU Usage',
        severity: 'HIGH',
        timestamp: new Date(),
        status: 'ACTIVE',
      },
    ],
    trends: [
      {
        time: new Date(),
        critical: 1,
        high: 2,
        medium: 1,
        low: 1,
      },
    ],
  };

  const mockLogMetrics: LogMetrics = {
    totalLogs: 5000,
    logsByLevel: {
      error: 50,
      warn: 100,
      info: 4000,
      debug: 850,
    },
    logsByHour: [
      { hour: '2024-01-01T10:00:00Z', count: 500 },
      { hour: '2024-01-01T11:00:00Z', count: 600 },
    ],
    errorRate: 1.0,
    topErrors: [
      { error: 'Database connection failed', count: 5 },
      { error: 'Cache miss error', count: 3 },
    ],
    recentLogs: [
      {
        id: 'log-1',
        level: 'ERROR',
        message: 'Database connection failed',
        timestamp: new Date(),
        context: 'database',
      },
    ],
    activeUsers: 150,
    uniqueIPs: 45,
  };

  const mockBusinessMetrics: BusinessMetrics = {
    totalUsers: 1000,
    activeUsers: 150,
    newUsersToday: 25,
    sessionsToday: 300,
    transactionsToday: 150,
    revenueToday: 5000,
    ordersToday: 75,
    conversionRate: 2.5,
    topPages: [
      { page: '/dashboard', views: 150, avgTime: 45 },
      { page: '/products', views: 120, avgTime: 60 },
    ],
    userActivity: [
      { hour: '2024-01-01T10:00:00Z', activeUsers: 150 },
      { hour: '2024-01-01T11:00:00Z', activeUsers: 180 },
    ],
    systemLoad: 'LOW',
  };

  const mockInfrastructureMetrics: InfrastructureMetrics = {
    serverMetrics: {
      cpu: { usage: 45.8, cores: 4, loadAverage: [1.2, 1.5, 1.8] },
      memory: { used: 4194304, total: 8388608, percentage: 50 },
      disk: { used: 1073741824, total: 2147483648, percentage: 50 },
      network: { bytesIn: 1048576, bytesOut: 524288, connections: 25 },
    },
    databaseMetrics: {
      connections: 5,
      queryTime: 25,
      slowQueries: 2,
      size: 1024,
    },
    cacheMetrics: {
      hitRate: 85.5,
      memoryUsage: 52428800,
      operations: 5000,
      evictions: 10,
    },
    serviceMetrics: [
      {
        service: 'api',
        status: 'UP',
        responseTime: 50,
        lastCheck: new Date(),
      },
    ],
  };

  const mockTrendData: TrendData = {
    performance: [
      { time: new Date(), responseTime: 250, requests: 500, errorRate: 2.5 },
    ],
    health: [
      { time: new Date(), score: 95, status: 'HEALTHY' },
    ],
    alerts: [
      { time: new Date(), critical: 1, high: 2, medium: 1, low: 1 },
    ],
    business: [
      { time: new Date(), users: 150, transactions: 150, revenue: 5000 },
    ],
    infrastructure: [
      { time: new Date(), cpu: 45.8, memory: 65.2, disk: 35.7 },
    ],
  };

  beforeEach(async () => {
    const mockConfigService = {
      get: sinon.stub(),
    };

    const mockLoggerService = {
      getLogStats: sinon.stub(),
      queryLogs: sinon.stub(),
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };

    const mockPerformanceService = {
      getStats: sinon.stub(),
      getSlowestEndpoints: sinon.stub(),
      getMostActiveEndpoints: sinon.stub(),
    };

    const mockHealthService = {
      performHealthCheck: sinon.stub(),
      getSystemMetrics: sinon.stub(),
      getLastHealthCheck: sinon.stub(),
      getHealthHistory: sinon.stub(),
    };

    const mockAlertService = {
      getActiveAlerts: sinon.stub(),
      getAlertStatistics: sinon.stub(),
      createAlert: sinon.stub(),
      acknowledgeAlert: sinon.stub(),
      resolveAlert: sinon.stub(),
    };

    const mockCacheService = {
      get: sinon.stub(),
      set: sinon.stub(),
      del: sinon.stub(),
      getStats: sinon.stub(),
      getMemoryUsage: sinon.stub(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
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
          provide: AlertService,
          useValue: mockAlertService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    // configService = module.get(ConfigService); // Not used in tests
    loggerService = module.get(EnhancedLoggerService);
    performanceService = module.get(PerformanceService);
    healthService = module.get(HealthService);
    alertService = module.get(AlertService);
    cacheService = module.get(CacheService);

    // Reset all stubs
    sinon.reset();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).to.be.undefined;
    });

    it('should initialize successfully', () => {
      expect(() => service.onModuleInit()).to.not.throw();
    });
  });

  describe('getDashboardData', () => {
    it('should return cached dashboard data when cache is valid', async () => {
      // Arrange
      const mockDashboardData: DashboardData = {
        overview: mockSystemOverview,
        performance: mockPerformanceMetrics,
        health: mockHealthMetrics,
        alerts: mockAlertMetrics,
        logs: mockLogMetrics,
        business: mockBusinessMetrics,
        infrastructure: mockInfrastructureMetrics,
        trends: mockTrendData,
        timestamp: new Date(),
      };

      // Mock the service to have cached data
      (service as any).cachedDashboardData = mockDashboardData;
      (service as any).lastCacheUpdate = Date.now() - 10000; // 10 seconds ago
      (service as any).cacheExpiry = 30000; // 30 seconds

      // Act
      const result = await service.getDashboardData();

      // Assert
      expect(result).to.deep.equal(mockDashboardData);
      expect(loggerService.debug.called).to.be.false;
    });

    it('should generate fresh dashboard data when cache is expired', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([
        { id: 'alert-1', severity: 'HIGH', timestamp: new Date(), status: 'ACTIVE', name: 'Test Alert' },
      ]);

      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [{ error: 'Test error', count: 5 }],
      });

      performanceService.getSlowestEndpoints.returns([
        { endpoint: '/api/slow', averageResponseTime: 1000, requestCount: 10 },
      ]);

      performanceService.getMostActiveEndpoints.returns([
        { endpoint: '/api/active', averageResponseTime: 200, requestCount: 50 },
      ]);

      cacheService.getStats.returns({
        hits: 425,
        misses: 75,
        keys: 50,
      });

      cacheService.getMemoryUsage.resolves(52428800);

      alertService.getAlertStatistics.returns({
        total: 15,
        resolved: 10,
        byCategory: { performance: 3, security: 1 },
      });

      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Mock expired cache
      (service as any).lastCacheUpdate = Date.now() - 40000; // 40 seconds ago
      (service as any).cacheExpiry = 30000; // 30 seconds

      // Act
      const result = await service.getDashboardData();

      // Assert
      expect(result).to.be.undefined;
      expect(result.overview).to.be.undefined;
      expect(result.performance).to.be.undefined;
      expect(result.health).to.be.undefined;
      expect(result.alerts).to.be.undefined;
      expect(result.logs).to.be.undefined;
      expect(result.business).to.be.undefined;
      expect(result.infrastructure).to.be.undefined;
      expect(result.trends).to.be.undefined;
      expect(result.timestamp).to.be.undefined;
      expect(loggerService.debug.calledWith('Generating fresh dashboard data')).to.be.true;
    });

    it('should force refresh when requested', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([]);
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      performanceService.getSlowestEndpoints.returns([]);
      performanceService.getMostActiveEndpoints.returns([]);
      cacheService.getStats.returns({ hits: 100, misses: 20, keys: 50 });
      cacheService.getMemoryUsage.resolves(52428800);
      alertService.getAlertStatistics.returns({ total: 0, resolved: 0, byCategory: {} });
      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Act
      const result = await service.getDashboardData(true);

      // Assert
      expect(result).to.be.undefined;
      expect(loggerService.debug.calledWith('Generating fresh dashboard data')).to.be.true;
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      healthService.performHealthCheck.rejects(new Error('Health check failed'));

      // Act & Assert
      try {
        await service.getDashboardData(true);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Health check failed');
        expect(loggerService.error.calledWith('Failed to generate dashboard data:', sinon.match.any)).to.be.true;
      }
    });
  });

  describe('getWidgetData', () => {
    it('should return overview widget data', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([
        { id: 'alert-1', severity: 'CRITICAL', timestamp: new Date(), status: 'ACTIVE', name: 'Test Alert' },
        { id: 'alert-2', severity: 'HIGH', timestamp: new Date(), status: 'ACTIVE', name: 'Test Alert 2' },
      ]);

      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      // Act
      const result = await service.getWidgetData('overview');

      // Assert
      expect(result).to.be.undefined;
      expect(result.status).to.be.undefined;
      expect(result.uptime).to.be.undefined;
      expect(result.healthScore).to.be.undefined;
      expect(result.activeUsers).to.be.undefined;
      expect(result.totalRequests).to.be.undefined;
      expect(result.errorRate).to.be.undefined;
      expect(result.responseTime).to.be.undefined;
      expect(result.criticalAlerts).to.be.undefined;
      expect(result.warningAlerts).to.be.undefined;
    });

    it('should return performance widget data', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      performanceService.getSlowestEndpoints.returns([
        { endpoint: '/api/slow', averageResponseTime: 1000, requestCount: 10 },
      ]);

      performanceService.getMostActiveEndpoints.returns([
        { endpoint: '/api/fast', averageResponseTime: 100, requestCount: 50 },
      ]);

      // Act
      const result = await service.getWidgetData('performance');

      // Assert
      expect(result).to.be.undefined;
      expect(result.requestsPerMinute).to.be.undefined;
      expect(result.averageResponseTime).to.be.undefined;
      expect(result.slowestEndpoints).to.be.undefined;
      expect(result.fastestEndpoints).to.be.undefined;
      expect(result.cacheHitRate).to.be.undefined;
      expect(result.memoryUsage).to.be.undefined;
      expect(result.cpuUsage).to.be.undefined;
      expect(result.activeConnections).to.be.undefined;
      expect(result.throughput).to.be.undefined;
      expect(result.availability).to.be.undefined;
    });

    it('should return health widget data', async () => {
      // Arrange
      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Act
      const result = await service.getWidgetData('health');

      // Assert
      expect(result).to.be.undefined;
      expect(result.overallStatus).to.be.undefined;
      expect(result.serviceHealth).to.be.undefined;
      expect(result.databaseStatus).to.be.undefined;
      expect(result.cacheStatus).to.be.undefined;
      expect(result.lastHealthCheck).to.be.undefined;
      expect(result.uptime).to.be.undefined;
      expect(result.systemMetrics).to.be.undefined;
    });

    it('should return alerts widget data', async () => {
      // Arrange
      const mockAlerts = [
        { id: 'alert-1', severity: 'CRITICAL', timestamp: new Date(), status: 'ACTIVE', name: 'Critical Alert' },
        { id: 'alert-2', severity: 'HIGH', timestamp: new Date(), status: 'ACTIVE', name: 'High Alert' },
        { id: 'alert-3', severity: 'MEDIUM', timestamp: new Date(), status: 'ACTIVE', name: 'Medium Alert' },
        { id: 'alert-4', severity: 'LOW', timestamp: new Date(), status: 'ACTIVE', name: 'Low Alert' },
      ];

      alertService.getActiveAlerts.returns(mockAlerts);
      alertService.getAlertStatistics.returns({
        total: 15,
        resolved: 10,
        byCategory: { performance: 3, security: 1, system: 1 },
      });

      // Act
      const result = await service.getWidgetData('alerts');

      // Assert
      expect(result).to.be.undefined;
      expect(result.total).to.be.undefined;
      expect(result.active).to.be.undefined;
      expect(result.critical).to.equal(1);
      expect(result.high).to.equal(1);
      expect(result.medium).to.equal(1);
      expect(result.low).to.equal(1);
      expect(result.resolved).to.be.undefined;
      expect(result.byCategory).to.be.undefined;
      expect(result.recentAlerts).to.be.undefined;
      expect(result.trends).to.be.undefined;
    });

    it('should return logs widget data', async () => {
      // Arrange
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [{ error: 'Database error', count: 5 }],
      });

      loggerService.queryLogs.resolves({
        logs: [
          {
            id: 'log-1',
            level: 'ERROR',
            message: 'Database connection failed',
            timestamp: new Date(),
            context: 'database',
          },
        ],
        total: 1,
        hasMore: false,
      });

      // Act
      const result = await service.getWidgetData('logs');

      // Assert
      expect(result).to.be.undefined;
      expect(result.totalLogs).to.be.undefined;
      expect(result.logsByLevel).to.be.undefined;
      expect(result.logsByHour).to.be.undefined;
      expect(result.errorRate).to.be.undefined;
      expect(result.topErrors).to.be.undefined;
      expect(result.recentLogs).to.be.undefined;
      expect(result.activeUsers).to.be.undefined;
      expect(result.uniqueIPs).to.be.undefined;
    });

    it('should return business widget data', async () => {
      // Arrange
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      // Act
      const result = await service.getWidgetData('business');

      // Assert
      expect(result).to.be.undefined;
      expect(result.totalUsers).to.be.undefined;
      expect(result.activeUsers).to.be.undefined;
      expect(result.newUsersToday).to.be.undefined;
      expect(result.sessionsToday).to.be.undefined;
      expect(result.transactionsToday).to.be.undefined;
      expect(result.revenueToday).to.be.undefined;
      expect(result.ordersToday).to.be.undefined;
      expect(result.conversionRate).to.be.undefined;
      expect(result.topPages).to.be.undefined;
      expect(result.userActivity).to.be.undefined;
      expect(result.systemLoad).to.be.undefined;
    });

    it('should return infrastructure widget data', async () => {
      // Arrange
      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      cacheService.getStats.returns({
        hits: 425,
        misses: 75,
        keys: 50,
      });

      cacheService.getMemoryUsage.resolves(52428800);

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      // Act
      const result = await service.getWidgetData('infrastructure');

      // Assert
      expect(result).to.be.undefined;
      expect(result.serverMetrics).to.be.undefined;
      expect(result.databaseMetrics).to.be.undefined;
      expect(result.cacheMetrics).to.be.undefined;
      expect(result.serviceMetrics).to.be.undefined;
      expect(result.serverMetrics.cpu).to.be.undefined;
      expect(result.serverMetrics.memory).to.be.undefined;
      expect(result.serverMetrics.disk).to.be.undefined;
      expect(result.serverMetrics.network).to.be.undefined;
    });

    it('should return trends widget data', async () => {
      // Act
      const result = await service.getWidgetData('trends');

      // Assert
      expect(result).to.be.undefined;
      expect(result.performance).to.be.undefined;
      expect(result.health).to.be.undefined;
      expect(result.alerts).to.be.undefined;
      expect(result.business).to.be.undefined;
      expect(result.infrastructure).to.be.undefined;
      expect(Array.isArray(result.performance)).to.be.true;
      expect(Array.isArray(result.health)).to.be.true;
      expect(Array.isArray(result.alerts)).to.be.true;
      expect(Array.isArray(result.business)).to.be.true;
      expect(Array.isArray(result.infrastructure)).to.be.true;
    });

    it('should throw error for unknown widget type', async () => {
      // Act & Assert
      try {
        await service.getWidgetData('unknown');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Unknown widget type: unknown');
      }
    });
  });

  describe('exportDashboardData', () => {
    it('should export dashboard data as JSON', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([]);
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      performanceService.getSlowestEndpoints.returns([]);
      performanceService.getMostActiveEndpoints.returns([]);
      cacheService.getStats.returns({ hits: 100, misses: 20, keys: 50 });
      cacheService.getMemoryUsage.resolves(52428800);
      alertService.getAlertStatistics.returns({ total: 0, resolved: 0, byCategory: {} });
      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Act
      const result = await service.exportDashboardData('json');

      // Assert
      expect(result).to.be.undefined;
      expect(typeof result).to.equal('string');

      const parsedResult = JSON.parse(result);
      expect(parsedResult.overview).to.be.undefined;
      expect(parsedResult.performance).to.be.undefined;
      expect(parsedResult.health).to.be.undefined;
      expect(parsedResult.alerts).to.be.undefined;
      expect(parsedResult.logs).to.be.undefined;
      expect(parsedResult.business).to.be.undefined;
      expect(parsedResult.infrastructure).to.be.undefined;
      expect(parsedResult.trends).to.be.undefined;
      expect(parsedResult.timestamp).to.be.undefined;
    });

    it('should export dashboard data as CSV', async () => {
      // Arrange
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([]);
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      performanceService.getSlowestEndpoints.returns([]);
      performanceService.getMostActiveEndpoints.returns([]);
      cacheService.getStats.returns({ hits: 100, misses: 20, keys: 50 });
      cacheService.getMemoryUsage.resolves(52428800);
      alertService.getAlertStatistics.returns({ total: 0, resolved: 0, byCategory: {} });
      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Act
      const result = await service.exportDashboardData('csv');

      // Assert
      expect(result).to.be.undefined;
      expect(typeof result).to.equal('string');
      expect(result).to.include('Metric,Value,Unit,Timestamp');
      expect(result).to.include('Health Score');
      expect(result).to.include('Active Users');
      expect(result).to.include('Error Rate');
      expect(result).to.include('Response Time');
      expect(result).to.include('Critical Alerts');
    });
  });

  describe('clearCache', () => {
    it('should clear dashboard cache', () => {
      // Arrange
      (service as any).cachedDashboardData = { test: 'data' };
      (service as any).lastCacheUpdate = Date.now();

      // Act
      service.clearCache();

      // Assert
      expect((service as any).cachedDashboardData).to.be.null;
      expect((service as any).lastCacheUpdate).to.equal(0);
      expect(loggerService.log.calledWith('Dashboard cache cleared')).to.be.true;
    });
  });

  describe('Cache Management', () => {
    it('should respect cache expiry time', async () => {
      // Arrange
      const mockDashboardData: DashboardData = {
        overview: mockSystemOverview,
        performance: mockPerformanceMetrics,
        health: mockHealthMetrics,
        alerts: mockAlertMetrics,
        logs: mockLogMetrics,
        business: mockBusinessMetrics,
        infrastructure: mockInfrastructureMetrics,
        trends: mockTrendData,
        timestamp: new Date(),
      };

      // Set cache with current timestamp
      (service as any).cachedDashboardData = mockDashboardData;
      (service as any).lastCacheUpdate = Date.now();
      (service as any).cacheExpiry = 30000;

      // First call should return cached data
      const result1 = await service.getDashboardData();
      expect(result1).to.deep.equal(mockDashboardData);

      // Simulate time passing beyond cache expiry
      (service as any).lastCacheUpdate = Date.now() - 40000;

      // Mock the service calls for fresh data
      performanceService.getStats.returns({
        totalRequests: 10000,
        errorRate: 2.5,
        averageResponseTime: 250,
        requestsPerMinute: 500,
        cacheHitRate: 85.5,
        memoryUsage: 65.2,
        activeConnections: 25,
      });

      healthService.performHealthCheck.resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 25 },
          { name: 'cache', status: 'UP', responseTime: 5 },
        ],
        timestamp: new Date(),
        uptime: 86400000,
      });

      alertService.getActiveAlerts.returns([]);
      loggerService.getLogStats.resolves({
        totalLogs: 5000,
        logsByLevel: { error: 50, warn: 100, info: 4000, debug: 850 },
        logsByHour: [{ hour: '2024-01-01T10:00:00Z', count: 500 }],
        activeUsers: 150,
        uniqueIps: 45,
        topErrors: [],
      });

      performanceService.getSlowestEndpoints.returns([]);
      performanceService.getMostActiveEndpoints.returns([]);
      cacheService.getStats.returns({ hits: 100, misses: 20, keys: 50 });
      cacheService.getMemoryUsage.resolves(52428800);
      alertService.getAlertStatistics.returns({ total: 0, resolved: 0, byCategory: {} });
      healthService.getSystemMetrics.returns({
        cpu: { usage: 45.8, loadAverage: [1.2, 1.5, 1.8] },
        memory: { percentage: 65.2, used: 4194304, total: 8388608 },
        disk: { percentage: 35.7, used: 1073741824, total: 2147483648 },
        network: { connections: 12, bytesReceived: 1048576, bytesSent: 524288 },
      });

      // Second call should generate fresh data
      const result2 = await service.getDashboardData();
      expect(loggerService.debug.calledWith('Generating fresh dashboard data')).to.be.true;
      expect(result2.timestamp).to.not.equal(mockDashboardData.timestamp);
    });
  });
});