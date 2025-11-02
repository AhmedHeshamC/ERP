import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import * as sinon from 'sinon';
import { AlertService } from '../../shared/monitoring/alerting/alert.service';

describe('Alerting System - Integration Tests', () => {
  let alertService: AlertService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create comprehensive mocks
    const mockLoggerService = {
      log: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
      info: sandbox.stub(),
      getLogStats: sandbox.stub().resolves({
        logsByLevel: { fatal: 0, error: 5, warn: 10, info: 100 }
      })
    };

    const mockPerformanceService = {
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

    const mockHealthService = {
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

    const mockConfigService = {
      get: sandbox.stub()
    };
    mockConfigService.get.withArgs('ALERT_EMAIL').returns('admin@example.com');
    mockConfigService.get.withArgs('ALERT_WEBHOOK_URL').returns('https://example.com/webhook');
    mockConfigService.get.withArgs('ALERT_WEBHOOK_TOKEN').returns('test-token');

    // Create service instance
    alertService = new AlertService(
      mockConfigService as any,
      mockLoggerService as any,
      mockPerformanceService as any,
      mockHealthService as any
    );

    // Initialize the alert service
    alertService.onModuleInit();
  });

  afterEach(() => {
    if (alertService) {
      alertService.onModuleDestroy();
    }
    sandbox.restore();
  });

  describe('Alert Management Integration', () => {
    it('should create, manage, and resolve alerts end-to-end', async () => {
      // Create an alert
      const createAlertDto = {
        name: 'Test Integration Alert',
        description: 'This is an integration test alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'integration-test',
        currentValue: 95,
        threshold: {
          metric: 'cpu_usage',
          operator: 'gt' as const,
          value: 80,
          severity: 'HIGH' as const
        },
        tags: ['integration', 'test'],
        metadata: { test: true }
      };

      const createdAlert = await alertService.createAlert(createAlertDto);

      expect(createdAlert).to.not.be.undefined;
      expect(createdAlert.name).to.equal('Test Integration Alert');
      expect(createdAlert.status).to.equal('ACTIVE');
      expect(createdAlert.id).to.be.a('string');

      // Get active alerts
      const activeAlerts = alertService.getActiveAlerts();
      expect(activeAlerts).to.have.length(1);
      expect(activeAlerts[0].id).to.equal(createdAlert.id);

      // Acknowledge the alert
      const acknowledgedAlert = await alertService.acknowledgeAlert(
        createdAlert.id,
        'test-user',
        'Investigating the issue'
      );

      expect(acknowledgedAlert).to.not.be.null;
      expect(acknowledgedAlert!.acknowledgedBy).to.equal('test-user');
      expect(acknowledgedAlert!.notes).to.equal('Investigating the issue');

      // Resolve the alert
      const resolvedAlert = await alertService.resolveAlert(
        createdAlert.id,
        'test-user',
        'Issue has been resolved'
      );

      expect(resolvedAlert).to.not.be.null;
      expect(resolvedAlert!.status).to.equal('RESOLVED');
      expect(resolvedAlert!.acknowledgedBy).to.equal('test-user');
      expect(resolvedAlert!.resolvedAt).to.be.instanceOf(Date);

      // Check that active alerts are now empty
      const activeAlertsAfterResolution = alertService.getActiveAlerts();
      expect(activeAlertsAfterResolution).to.have.length(0);
    });

    it('should handle alert suppression correctly', async () => {
      // Create an alert
      const createAlertDto = {
        name: 'Suppressible Alert',
        description: 'This alert can be suppressed',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      };

      const createdAlert = await alertService.createAlert(createAlertDto);

      // Suppress the alert
      const suppressedAlert = await alertService.suppressAlert(
        createdAlert.id,
        30, // 30 minutes
        'Maintenance window'
      );

      expect(suppressedAlert).to.not.be.null;
      expect(suppressedAlert!.status).to.equal('SUPPRESSED');
    });

    it('should filter and paginate alerts correctly', async () => {
      // Create multiple alerts with different properties
      await alertService.createAlert({
        name: 'High Priority Alert',
        description: 'High priority alert',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      await alertService.createAlert({
        name: 'Medium Priority Alert',
        description: 'Medium priority alert',
        severity: 'MEDIUM' as const,
        category: 'PERFORMANCE' as const,
        source: 'test'
      });

      await alertService.createAlert({
        name: 'Critical Alert',
        description: 'Critical priority alert',
        severity: 'CRITICAL' as const,
        category: 'SECURITY' as const,
        source: 'test'
      });

      // Test filtering by severity
      const highAlerts = alertService.getAlerts({ severity: 'HIGH' });
      expect(highAlerts.alerts).to.have.length(1);
      expect(highAlerts.alerts[0].severity).to.equal('HIGH');

      // Test filtering by category
      const systemAlerts = alertService.getAlerts({ category: 'SYSTEM' });
      expect(systemAlerts.alerts).to.have.length(1);
      expect(systemAlerts.alerts[0].category).to.equal('SYSTEM');

      // Test pagination
      const paginatedAlerts = alertService.getAlerts({ limit: 2, offset: 0 });
      expect(paginatedAlerts.alerts).to.have.length(2);
      expect(paginatedAlerts.total).to.equal(3);
      expect(paginatedAlerts.hasMore).to.be.true;

      const secondPage = alertService.getAlerts({ limit: 2, offset: 2 });
      expect(secondPage.alerts).to.have.length(1);
      expect(secondPage.hasMore).to.be.false;
    });

    it('should generate comprehensive alert statistics', async () => {
      // Create alerts with different properties
      await alertService.createAlert({
        name: 'System Alert 1',
        severity: 'HIGH' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      await alertService.createAlert({
        name: 'System Alert 2',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      const criticalAlert = await alertService.createAlert({
        name: 'Critical Alert',
        severity: 'CRITICAL' as const,
        category: 'SECURITY' as const,
        source: 'test'
      });

      // Resolve one alert
      await alertService.resolveAlert(criticalAlert.id, 'test-user', 'Resolved');

      // Get statistics
      const stats = alertService.getAlertStatistics(24);

      expect(stats.total).to.equal(3);
      expect(stats.active).to.equal(2);
      expect(stats.resolved).to.equal(1);
      expect(stats.bySeverity.HIGH).to.equal(1);
      expect(stats.bySeverity.MEDIUM).to.equal(1);
      expect(stats.bySeverity.CRITICAL).to.equal(1);
      expect(stats.byCategory.SYSTEM).to.equal(2);
      expect(stats.byCategory.SECURITY).to.equal(1);
      expect(stats.recentAlerts).to.have.length(3);
      expect(stats.topAlerts).to.be.an('array');
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should automatically trigger performance alerts', async () => {
      // Mock the performance service to return high response time
      const mockPerformanceService = (alertService as any).performanceService;
      mockPerformanceService.getAllEndpointStats.returns([
        {
          endpoint: '/api/slow',
          method: 'GET',
          totalRequests: 100,
          averageResponseTime: 3000, // High response time
          minResponseTime: 1000,
          maxResponseTime: 5000,
          errorRate: 2,
          lastAccessed: new Date(),
          requestsPerMinute: 5
        }
      ]);

      // Manually trigger alert checks
      await (alertService as any).performAlertChecks();

      // Check that performance alerts were created
      const activeAlerts = alertService.getActiveAlerts();
      const performanceAlerts = activeAlerts.filter(alert =>
        alert.category === 'PERFORMANCE'
      );

      expect(performanceAlerts.length).to.be.greaterThan(0);
      expect(performanceAlerts.some(alert => alert.name === 'High Response Time')).to.be.true;
    });

    it('should automatically trigger health alerts', async () => {
      // Mock the health service to return unhealthy status
      const mockHealthService = (alertService as any).healthService;
      mockHealthService.performHealthCheck.resolves({
        status: 'UNHEALTHY',
        overallScore: 30,
        checks: [
          { name: 'database', status: 'DOWN', responseTime: 1000, lastChecked: new Date() },
          { name: 'cache', status: 'UP', responseTime: 10, lastChecked: new Date() }
        ],
        duration: 1000,
        timestamp: new Date(),
        uptime: 1000000
      });

      // Manually trigger alert checks
      await (alertService as any).performAlertChecks();

      // Check that health alerts were created
      const activeAlerts = alertService.getActiveAlerts();
      const healthAlerts = activeAlerts.filter(alert =>
        alert.category === 'AVAILABILITY'
      );

      expect(healthAlerts.length).to.be.greaterThan(0);
      expect(healthAlerts.some(alert => alert.name === 'System Unhealthy')).to.be.true;
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle non-existent alert operations gracefully', async () => {
      const nonExistentId = 'non-existent-id';

      // Try to resolve non-existent alert
      const resolvedAlert = await alertService.resolveAlert(nonExistentId, 'test-user');
      expect(resolvedAlert).to.be.null;

      // Try to acknowledge non-existent alert
      const acknowledgedAlert = await alertService.acknowledgeAlert(nonExistentId, 'test-user');
      expect(acknowledgedAlert).to.be.null;

      // Try to suppress non-existent alert
      const suppressedAlert = await alertService.suppressAlert(nonExistentId, 30);
      expect(suppressedAlert).to.be.null;
    });

    it('should handle alert cooldown and suppression correctly', async () => {
      // Create an alert
      const alert = await alertService.createAlert({
        name: 'Cooldown Test Alert',
        description: 'Testing cooldown mechanism',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      // Try to create the same alert again (should be ignored due to cooldown)
      await alertService.createAlert({
        name: 'Cooldown Test Alert',
        description: 'Testing cooldown mechanism',
        severity: 'MEDIUM' as const,
        category: 'SYSTEM' as const,
        source: 'test'
      });

      // Should only have one active alert due to cooldown
      const activeAlerts = alertService.getActiveAlerts();
      expect(activeAlerts).to.have.length(1);
      expect(activeAlerts[0].id).to.equal(alert.id);
    });
  });

  describe('Service Lifecycle Integration', () => {
    it('should initialize and shutdown correctly', async () => {
      // Service should be initialized with default rules and channels
      const rules = (alertService as any).alertRules;
      const channels = (alertService as any).notificationChannels;

      expect(rules).to.be.an('array');
      expect(rules.length).to.be.greaterThan(0);
      expect(channels).to.be.an('array');
      expect(channels.length).to.be.greaterThan(0);

      // Should have monitoring interval set
      const monitoringInterval = (alertService as any).monitoringInterval;
      expect(monitoringInterval).to.not.be.null;

      // Shutdown should clean up resources
      alertService.onModuleDestroy();
      expect((alertService as any).monitoringInterval).to.be.null;
    });
  });
});