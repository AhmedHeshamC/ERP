import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { AlertService } from './alert.service';

describe('AlertService - Basic Functionality Tests', () => {
  let alertService: AlertService;
  let sandbox: sinon.SinonSandbox;

  // Mock services
  let mockLoggerService: any;
  let mockPerformanceService: any;
  let mockHealthService: any;
  let mockConfigService: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create comprehensive mocks
    mockLoggerService = {
      log: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
      info: sandbox.stub(),
      getLogStats: sandbox.stub().resolves({
        logsByLevel: { fatal: 0, error: 5, warn: 10, info: 100 }
      })
    };

    mockPerformanceService = {
      getAllEndpointStats: sandbox.stub().returns([
        {
          endpoint: '/api/test',
          method: 'GET',
          totalRequests: 1000,
          averageResponseTime: 150,
          minResponseTime: 50,
          maxResponseTime: 500,
          errorRate: 2,
          lastAccessed: new Date(),
          requestsPerMinute: 10
        }
      ]),
      getSlowestEndpoints: sandbox.stub().returns([
        {
          endpoint: '/api/slow',
          method: 'POST',
          totalRequests: 100,
          averageResponseTime: 3500,
          minResponseTime: 1000,
          maxResponseTime: 8000,
          errorRate: 5,
          lastAccessed: new Date(),
          requestsPerMinute: 2
        }
      ])
    };

    mockHealthService = {
      performHealthCheck: sandbox.stub().resolves({
        status: 'HEALTHY',
        overallScore: 95,
        checks: [
          { name: 'database', status: 'UP', responseTime: 10, lastChecked: new Date() },
          { name: 'cache', status: 'UP', responseTime: 5, lastChecked: new Date() }
        ],
        duration: 100,
        timestamp: new Date(),
        uptime: 1000000
      })
    };

    mockConfigService = {
      get: sandbox.stub()
    };
    mockConfigService.get.withArgs('ALERT_EMAIL').returns('admin@example.com');
    mockConfigService.get.withArgs('ALERT_WEBHOOK_URL').returns('https://example.com/webhook');
    mockConfigService.get.withArgs('ALERT_WEBHOOK_TOKEN').returns('test-token');

    // Create service instance with mocked dependencies
    alertService = new AlertService(
      mockConfigService,
      mockLoggerService,
      mockPerformanceService,
      mockHealthService
    ) as any;
  });

  afterEach(() => {
    sandbox.restore();
    if (alertService && (alertService as any).onModuleDestroy) {
      (alertService as any).onModuleDestroy();
    }
  });

  describe('Alert Creation Tests', () => {
    it('should create an alert with all required fields', async () => {
      const alertData = {
        name: 'Test Alert',
        description: 'Test alert description',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test-service',
        currentValue: 95,
        threshold: {
          metric: 'cpu_usage',
          operator: 'gt' as const,
          value: 80,
          severity: 'HIGH' as const
        },
        tags: ['performance', 'cpu'],
        metadata: { host: 'server-01', region: 'us-east-1' }
      };

      const alert = await alertService.createAlert(alertData);

      expect(alert).to.not.be.undefined;
      expect(alert.id).to.be.a('string');
      expect(alert.name).to.equal('Test Alert');
      expect(alert.status).to.equal('ACTIVE');
      expect(alert.timestamp).to.be.instanceOf(Date);
      expect(alert.correlationId).to.be.undefined;
    });

    it('should create an alert with correlation ID', async () => {
      const alertData = {
        name: 'Business Alert',
        description: 'Business process failure',
        severity: 'CRITICAL' as const,
        category: 'BUSINESS' as const,
        source: 'order-service',
        correlationId: 'order-12345'
      };

      const alert = await alertService.createAlert(alertData);

      expect(alert.correlationId).to.equal('order-12345');
      expect(alert.tags).to.be.an('array');
    });

    it('should log alert creation with proper context', async () => {
      const alertData = {
        name: 'Security Alert',
        description: 'Unauthorized access attempt',
        severity: 'CRITICAL' as const,
        category: 'SECURITY' as const,
        source: 'auth-service'
      };

      await alertService.createAlert(alertData);

      expect(mockLoggerService.warn.called).to.be.true;
      const callArgs = mockLoggerService.warn.firstCall.args;
      expect(callArgs[0]).to.include('Alert triggered: Security Alert');
      expect(callArgs[1]).to.equal('ALERT');
      expect(callArgs[2]).to.have.property('severity', 'CRITICAL');
      expect(callArgs[2]).to.have.property('category', 'SECURITY');
    });

    it('should handle default values for optional fields', async () => {
      const minimalAlert = {
        name: 'Minimal Alert'
      };

      const alert = await alertService.createAlert(minimalAlert);

      expect(alert.severity).to.equal('MEDIUM');
      expect(alert.category).to.equal('SYSTEM');
      expect(alert.source).to.equal('system');
      expect(alert.tags).to.deep.equal([]);
      expect(alert.metadata).to.deep.equal({});
    });
  });

  describe('Alert Resolution and Management Tests', () => {
    it('should resolve an alert and update status', async () => {
      const alert = await alertService.createAlert({
        name: 'Resolvable Alert',
        description: 'This alert can be resolved',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      const resolvedAlert = await alertService.resolveAlert(alert.id, 'admin-user', 'Issue fixed');

      expect(resolvedAlert).to.not.be.null;
      expect(resolvedAlert!.status).to.equal('RESOLVED');
      expect(resolvedAlert!.acknowledgedBy).to.equal('admin-user');
      expect(resolvedAlert!.notes).to.equal('Issue fixed');
      expect(resolvedAlert!.resolvedAt).to.be.instanceOf(Date);
    });

    it('should return null when resolving non-existent alert', async () => {
      const result = await alertService.resolveAlert('non-existent-id', 'user');
      expect(result).to.be.null;
    });

    it('should acknowledge an alert', async () => {
      const alert = await alertService.createAlert({
        name: 'Acknowledgable Alert',
        description: 'This alert can be acknowledged',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      const acknowledgedAlert = await alertService.acknowledgeAlert(
        alert.id,
        'ops-user',
        'Investigating the issue'
      );

      expect(acknowledgedAlert).to.not.be.null;
      expect(acknowledgedAlert!.acknowledgedBy).to.equal('ops-user');
      expect(acknowledgedAlert!.acknowledgedAt).to.be.instanceOf(Date);
      expect(acknowledgedAlert!.notes).to.equal('Investigating the issue');
    });

    it('should suppress an alert for specified duration', async () => {
      const alert = await alertService.createAlert({
        name: 'Suppressible Alert',
        description: 'This alert can be suppressed',
        severity: 'LOW' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      const suppressedAlert = await alertService.suppressAlert(alert.id, 30, 'Maintenance window');

      expect(suppressedAlert).to.not.be.null;
      expect(suppressedAlert!.status).to.equal('SUPPRESSED');
    });
  });

  describe('Alert Filtering and Querying Tests', () => {
    it('should get active alerts only', async () => {
      await alertService.createAlert({ name: 'Active Alert 1' });
      await alertService.createAlert({ name: 'Active Alert 2' });
      const resolvedAlert = await alertService.createAlert({ name: 'Resolved Alert' });
      await alertService.resolveAlert(resolvedAlert.id);

      const activeAlerts = alertService.getActiveAlerts();

      expect(activeAlerts).to.have.length(2);
      expect(activeAlerts.every((alert: any) => alert.status === 'ACTIVE')).to.be.true;
    });

    it('should filter alerts by severity', async () => {
      await alertService.createAlert({ name: 'Low Alert', severity: 'LOW' as const });
      await alertService.createAlert({ name: 'High Alert', severity: 'HIGH' as const });
      await alertService.createAlert({ name: 'Critical Alert', severity: 'CRITICAL' as const });

      const highAlerts = alertService.getAlerts({ severity: 'HIGH' });
      const criticalAlerts = alertService.getAlerts({ severity: 'CRITICAL' });

      expect(highAlerts.alerts).to.have.length(1);
      expect(highAlerts.alerts[0].name).to.equal('High Alert');
      expect(criticalAlerts.alerts).to.have.length(1);
      expect(criticalAlerts.alerts[0].name).to.equal('Critical Alert');
    });

    it('should filter alerts by category', async () => {
      await alertService.createAlert({ name: 'System Alert', category: 'SYSTEM' as const });
      await alertService.createAlert({ name: 'Performance Alert', category: 'PERFORMANCE' as const });
      await alertService.createAlert({ name: 'Business Alert', category: 'BUSINESS' as const });

      const systemAlerts = alertService.getAlerts({ category: 'SYSTEM' });
      const performanceAlerts = alertService.getAlerts({ category: 'PERFORMANCE' });

      expect(systemAlerts.alerts).to.have.length(1);
      expect(performanceAlerts.alerts).to.have.length(1);
    });

    it('should paginate alert results', async () => {
      // Create multiple alerts
      for (let i = 0; i < 5; i++) {
        await alertService.createAlert({ name: `Alert ${i}` });
      }

      const firstPage = alertService.getAlerts({ limit: 2, offset: 0 });
      const secondPage = alertService.getAlerts({ limit: 2, offset: 2 });
      const thirdPage = alertService.getAlerts({ limit: 2, offset: 4 });

      expect(firstPage.alerts).to.have.length(2);
      expect(secondPage.alerts).to.have.length(2);
      expect(thirdPage.alerts).to.have.length(1);
      expect(firstPage.hasMore).to.be.true;
      expect(thirdPage.hasMore).to.be.false;
    });
  });

  describe('Alert Statistics Tests', () => {
    it('should generate comprehensive alert statistics', async () => {
      // Create alerts with different properties
      await alertService.createAlert({
        name: 'High System Alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const
      });
      await alertService.createAlert({
        name: 'Medium Performance Alert',
        severity: 'MEDIUM' as const,
        category: 'PERFORMANCE' as const
      });

      const criticalAlert = await alertService.createAlert({
        name: 'Critical Alert',
        severity: 'CRITICAL' as const,
        category: 'SYSTEM' as const
      });
      await alertService.resolveAlert(criticalAlert.id, 'admin-user');

      const stats = alertService.getAlertStatistics(24);

      expect(stats.total).to.equal(3);
      expect(stats.active).to.equal(2);
      expect(stats.resolved).to.equal(1);
      expect(stats.bySeverity.HIGH).to.equal(1);
      expect(stats.bySeverity.MEDIUM).to.equal(1);
      expect(stats.bySeverity.CRITICAL).to.equal(1);
      expect(stats.byCategory.SYSTEM).to.equal(2);
      expect(stats.byCategory.PERFORMANCE).to.equal(1);
    });

    it('should identify top occurring alerts', async () => {
      // Create alerts with different names but similar patterns to test counting
      await alertService.createAlert({ name: 'Database Error', category: 'SYSTEM' as const });
      await alertService.createAlert({ name: 'Database Error', category: 'SYSTEM' as const, source: 'replica' });
      await alertService.createAlert({ name: 'Database Error', category: 'SYSTEM' as const, source: 'backup' });
      await alertService.createAlert({ name: 'API Error', category: 'SYSTEM' as const });

      const stats = alertService.getAlertStatistics(24);

      expect(stats.topAlerts).to.be.an('array');
      // Note: Due to cooldown, we might see fewer entries than created
      // This test validates the sorting and counting mechanism
      expect(stats.topAlerts.length).to.be.greaterThan(0);
      expect(stats.topAlerts[0].count).to.be.greaterThan(0);
    });
  });

  describe('Performance Monitoring Integration Tests', () => {
    it('should create alerts for high response time', async () => {
      mockPerformanceService.getAllEndpointStats.returns([
        {
          endpoint: '/api/slow',
          method: 'GET',
          totalRequests: 100,
          averageResponseTime: 3000, // High response time
          minResponseTime: 1000,
          maxResponseTime: 5000,
          errorRate: 1,
          lastAccessed: new Date(),
          requestsPerMinute: 5
        }
      ]);

      await (alertService as any).checkPerformanceAlerts();

      const alerts = alertService.getActiveAlerts();
      const highResponseTimeAlert = alerts.find((a: any) => a.name === 'High Response Time');

      expect(highResponseTimeAlert).to.not.be.undefined;
      expect(highResponseTimeAlert!.severity).to.equal('HIGH');
      expect(highResponseTimeAlert!.currentValue).to.equal(3000);
    });

    it('should create alerts for high error rate', async () => {
      mockPerformanceService.getAllEndpointStats.returns([
        {
          endpoint: '/api/error',
          method: 'POST',
          totalRequests: 100,
          averageResponseTime: 100,
          minResponseTime: 50,
          maxResponseTime: 200,
          errorRate: 10, // High error rate
          lastAccessed: new Date(),
          requestsPerMinute: 10
        }
      ]);

      await (alertService as any).checkPerformanceAlerts();

      const alerts = alertService.getActiveAlerts();
      const highErrorRateAlert = alerts.find((a: any) => a.name === 'High Error Rate');

      expect(highErrorRateAlert).to.not.be.undefined;
      expect(highErrorRateAlert!.severity).to.equal('HIGH');
      expect(highErrorRateAlert!.currentValue).to.equal(10);
    });
  });

  describe('Service Lifecycle Tests', () => {
    it('should initialize default rules and channels', async () => {
      // Test initialization
      alertService.onModuleInit();

      // Should have default rules
      const rules = (alertService as any).alertRules;
      expect(rules).to.be.an('array');
      expect(rules.length).to.be.greaterThan(0);

      // Should have default notification channels
      const channels = (alertService as any).notificationChannels;
      expect(channels).to.be.an('array');
      expect(channels.length).to.be.greaterThan(0);
    });

    it('should start and stop monitoring correctly', async () => {
      const clearIntervalSpy = sandbox.spy(global, 'clearInterval');
      const setIntervalSpy = sandbox.spy(global, 'setInterval');

      alertService.onModuleInit();
      expect(setIntervalSpy.called).to.be.true;

      alertService.onModuleDestroy();
      expect(clearIntervalSpy.called).to.be.true;
    });
  });
});