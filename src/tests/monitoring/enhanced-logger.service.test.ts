import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EnhancedLoggerService, LogLevel, LogEntry } from '../../shared/monitoring/logging/enhanced-logger.service';
import { expect } from 'chai';
import { spy, stub } from 'sinon';

describe('EnhancedLoggerService', () => {
  let service: EnhancedLoggerService;

  const mockConfigService = {
    get: stub(),
  };

  beforeEach(async () => {
    // Reset all stubs
    mockConfigService.get.resetHistory();

    // Setup default config values
    mockConfigService.get.callsFake((key: string, defaultValue?: any) => {
      const configMap: Record<string, any> = {
        'LOG_RETENTION_DEBUG': 7,
        'LOG_RETENTION_INFO': 30,
        'LOG_RETENTION_WARN': 90,
        'LOG_RETENTION_ERROR': 365,
        'LOG_RETENTION_FATAL': 365,
        'NODE_ENV': 'test',
        'APP_ENV': 'test',
      };
      return configMap[key] !== undefined ? configMap[key] : defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedLoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EnhancedLoggerService>(EnhancedLoggerService);
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).to.be.an('object');
      expect(service).to.be.instanceOf(EnhancedLoggerService);
    });

    it('should initialize with default retention config', () => {
      expect(service).to.be.an('object');
      // Service should initialize without throwing errors
    });

    it('should setup cleanup and flush intervals on module init', async () => {
      const setIntervalSpy = spy(global, 'setInterval');

      await service.onModuleInit();

      expect(setIntervalSpy.calledTwice).to.be.true;
      expect(setIntervalSpy.firstCall.args[1]).to.equal(60000); // cleanup
      expect(setIntervalSpy.secondCall.args[1]).to.equal(5000); // flush

      setIntervalSpy.restore();
    });

    it('should clear intervals on module destroy', async () => {
      const clearIntervalSpy = spy(global, 'clearInterval');

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(clearIntervalSpy.calledTwice).to.be.true;

      clearIntervalSpy.restore();
    });
  });

  describe('Log Entry Creation', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should create a basic log entry with required fields', () => {
      const entry = service.createLogEntry(LogLevel.INFO, 'Test message', 'TEST_CONTEXT');

      expect(entry).to.have.property('level', LogLevel.INFO);
      expect(entry).to.have.property('message', 'Test message');
      expect(entry).to.have.property('context', 'TEST_CONTEXT');
      expect(entry).to.have.property('source', 'test');
      expect(entry).to.have.property('environment', 'test');

      expect(entry).to.have.property('id');
      expect(entry.id).to.match(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
      expect(entry).to.have.property('correlationId');
      expect(entry).to.have.property('timestamp');
      expect(entry.timestamp).to.be.instanceOf(Date);
    });

    it('should create log entry with metadata', () => {
      const metadata = { userId: '123', action: 'create' };
      const entry = service.createLogEntry(LogLevel.INFO, 'Test message', 'TEST_CONTEXT', metadata);

      expect(entry).to.have.property('metadata');
      expect(entry.metadata).to.deep.equal(metadata);
    });

    it('should create log entry with error details', () => {
      const error = new Error('Test error');
      const entry = service.createLogEntry(LogLevel.ERROR, 'Error occurred', 'ERROR_CONTEXT', undefined, error);

      expect(entry).to.have.property('error');
      expect(entry.error).to.have.property('name', 'Error');
      expect(entry.error).to.have.property('message', 'Test error');
      expect(entry.error).to.have.property('stack');
      expect(entry.error!.stack).to.include('Error: Test error');
    });

    it('should generate unique correlation IDs', () => {
      const entry1 = service.createLogEntry(LogLevel.INFO, 'Message 1');
      const entry2 = service.createLogEntry(LogLevel.INFO, 'Message 2');

      expect(entry1.correlationId).to.not.equal(entry2.correlationId);
    });

    it('should generate unique log IDs', () => {
      const entry1 = service.createLogEntry(LogLevel.INFO, 'Message 1');
      const entry2 = service.createLogEntry(LogLevel.INFO, 'Message 2');

      expect(entry1.id).to.not.equal(entry2.id);
    });

    it('should add automatic tags based on log content', () => {
      const entry = service.createLogEntry(LogLevel.ERROR, 'Test error', 'AUTH', { userId: '123' });

      expect(entry.tags).to.include('error');
      expect(entry.tags).to.include('auth');
      expect(entry.tags).to.include('user');
      expect(entry.tags).to.include(LogLevel.ERROR);
    });
  });

  describe('Basic Logging Methods', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should log debug messages', () => {
      const consoleSpy = spy(service['logger'], 'debug');

      service.debug('Debug message', 'DEBUG_CONTEXT', { debug: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[DEBUG_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.deep.equal({ debug: true });

      consoleSpy.restore();
    });

    it('should log info messages', () => {
      const consoleSpy = spy(service['logger'], 'log');

      service.info('Info message', 'INFO_CONTEXT', { info: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[INFO_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.deep.equal({ info: true });

      consoleSpy.restore();
    });

    it('should log warning messages', () => {
      const consoleSpy = spy(service['logger'], 'warn');

      service.warn('Warning message', 'WARN_CONTEXT', { warn: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[WARN_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.deep.equal({ warn: true });

      consoleSpy.restore();
    });

    it('should log error messages without error object', () => {
      const consoleSpy = spy(service['logger'], 'error');

      service.error('Error message', undefined, 'ERROR_CONTEXT', { error: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[ERROR_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.be.undefined;
      expect(consoleSpy.firstCall.args[2]).to.deep.equal({ error: true });

      consoleSpy.restore();
    });

    it('should log error messages with error object', () => {
      const consoleSpy = spy(service['logger'], 'error');
      const error = new Error('Test error');

      service.error('Error message', error, 'ERROR_CONTEXT', { error: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[ERROR_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.equal(error.stack);
      expect(consoleSpy.firstCall.args[2]).to.deep.equal({ error: true });

      consoleSpy.restore();
    });

    it('should log fatal messages', () => {
      const consoleSpy = spy(service['logger'], 'error');

      service.fatal('Fatal message', undefined, 'FATAL_CONTEXT', { fatal: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[FATAL] [FATAL_CONTEXT]');
      expect(consoleSpy.firstCall.args[1]).to.be.undefined;
      expect(consoleSpy.firstCall.args[2]).to.deep.equal({ fatal: true });

      consoleSpy.restore();
    });
  });

  describe('Request Logging', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should log successful requests as INFO', () => {
      const consoleSpy = spy(service['logger'], 'log');

      service.logRequest('GET', '/api/test', 200, 150, 'user123', { success: true });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[HTTP]');
      expect(consoleSpy.firstCall.args[0]).to.include('GET /api/test - 200 (150ms)');
      expect(consoleSpy.firstCall.args[1]).to.deep.equal({ success: true });

      consoleSpy.restore();
    });

    it('should log 4xx requests as WARN', () => {
      const consoleSpy = spy(service['logger'], 'warn');

      service.logRequest('POST', '/api/test', 400, 100, 'user123');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[HTTP]');
      expect(consoleSpy.firstCall.args[0]).to.include('POST /api/test - 400 (100ms)');

      consoleSpy.restore();
    });

    it('should log 5xx requests as ERROR', () => {
      const consoleSpy = spy(service['logger'], 'error');

      service.logRequest('PUT', '/api/test', 500, 200, 'user123');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[HTTP]');
      expect(consoleSpy.firstCall.args[0]).to.include('PUT /api/test - 500 (200ms)');

      consoleSpy.restore();
    });

    it('should include request metadata in log entry', async () => {
      await service.onModuleInit();

      service.logRequest('GET', '/api/test', 200, 150, 'user123', { apiKey: 'secret' });

      // Manually flush buffer to ensure log is processed
      await (service as any).flushBuffer();

      const logs = await service.queryLogs({ limit: 1 });
      expect(logs.logs[0]).to.have.property('method', 'GET');
      expect(logs.logs[0]).to.have.property('url', '/api/test');
      expect(logs.logs[0]).to.have.property('statusCode', 200);
      expect(logs.logs[0]).to.have.property('duration', 150);
      expect(logs.logs[0]).to.have.property('userId', 'user123');
    });
  });

  describe('Business Event Logging', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should log business events with proper metadata', () => {
      const consoleSpy = spy(service['logger'], 'log');

      service.logBusinessEvent('USER_CREATED', 'User', 'user123', 'admin456', { role: 'admin' });

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[BUSINESS]');
      expect(consoleSpy.firstCall.args[0]).to.include('Business Event: USER_CREATED on User user123');
      expect(consoleSpy.firstCall.args[1]).to.deep.include({
        businessEvent: 'USER_CREATED',
        entityType: 'User',
        entityId: 'user123',
        userId: 'admin456',
        role: 'admin',
      });

      consoleSpy.restore();
    });

    it('should add business-related tags', async () => {
      await service.onModuleInit();

      service.logBusinessEvent('ORDER_CREATED', 'Order', 'order123', 'user456');

      // Manually flush buffer to ensure log is processed
      await (service as any).flushBuffer();

      const logs = await service.queryLogs({ limit: 1 });
      expect(logs.logs[0].tags).to.include('business');
      expect(logs.logs[0].tags).to.include('ORDER_CREATED');
      expect(logs.logs[0].tags).to.include('order');
    });
  });

  describe('Security Event Logging', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should log CRITICAL security events as FATAL', () => {
      const consoleSpy = spy(service['logger'], 'error');

      service.logSecurityEvent('UNAUTHORIZED_ACCESS', 'CRITICAL', 'user123', '192.168.1.1');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[SECURITY]');
      expect(consoleSpy.firstCall.args[0]).to.include('[FATAL] Security Event: UNAUTHORIZED_ACCESS (CRITICAL)');
      expect(consoleSpy.firstCall.args[1]).to.deep.include({
        securityEvent: 'UNAUTHORIZED_ACCESS',
        severity: 'CRITICAL',
        userId: 'user123',
        ip: '192.168.1.1',
      });

      consoleSpy.restore();
    });

    it('should log HIGH security events as ERROR', () => {
      const consoleSpy = spy(service['logger'], 'error');

      service.logSecurityEvent('SUSPICIOUS_ACTIVITY', 'HIGH', 'user123');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[SECURITY]');
      expect(consoleSpy.firstCall.args[0]).to.include('Security Event: SUSPICIOUS_ACTIVITY (HIGH)');
      expect(consoleSpy.firstCall.args[1]).to.deep.include({
        securityEvent: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        userId: 'user123',
      });

      consoleSpy.restore();
    });

    it('should log MEDIUM security events as WARN', () => {
      const consoleSpy = spy(service['logger'], 'warn');

      service.logSecurityEvent('MULTIPLE_LOGIN_ATTEMPTS', 'MEDIUM', 'user123');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[SECURITY]');
      expect(consoleSpy.firstCall.args[0]).to.include('Security Event: MULTIPLE_LOGIN_ATTEMPTS (MEDIUM)');

      consoleSpy.restore();
    });

    it('should log LOW security events as INFO', () => {
      const consoleSpy = spy(service['logger'], 'log');

      service.logSecurityEvent('PASSWORD_CHANGE', 'LOW', 'user123');

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.include('[SECURITY]');
      expect(consoleSpy.firstCall.args[0]).to.include('Security Event: PASSWORD_CHANGE (LOW)');

      consoleSpy.restore();
    });

    it('should add security-related tags', async () => {
      await service.onModuleInit();

      service.logSecurityEvent('LOGIN_FAILED', 'MEDIUM', 'user123', '192.168.1.1');

      // Manually flush buffer to ensure log is processed
      await (service as any).flushBuffer();

      const logs = await service.queryLogs({ limit: 1 });
      expect(logs.logs[0].tags).to.include('security');
      expect(logs.logs[0].tags).to.include('LOGIN_FAILED');
      expect(logs.logs[0].tags).to.include('MEDIUM');
    });
  });

  describe('Log Buffer and Flushing', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should add logs to buffer before flushing', () => {
      const initialBufferSize = service['logBuffer'].length;

      service.info('Test message');

      expect(service['logBuffer'].length).to.equal(initialBufferSize + 1);
    });

    it('should flush buffer when called manually', async () => {
      service.info('Test message 1');
      service.info('Test message 2');

      expect(service['logBuffer'].length).to.equal(2);
      expect(service['logs'].length).to.equal(0);

      await (service as any).flushBuffer();

      expect(service['logBuffer'].length).to.equal(0);
      expect(service['logs'].length).to.equal(2);
    });

    it('should immediately flush error and fatal logs', async () => {
      const flushSpy = spy(service as any, 'flushBuffer');

      service.error('Error message');
      service.fatal('Fatal message');

      expect(flushSpy.calledTwice).to.be.true;

      flushSpy.restore();
    });

    it('should limit logs to maxLogs after flushing', async () => {
      const maxLogs = 10;
      service['maxLogs'] = maxLogs;

      // Add more logs than maxLogs
      for (let i = 0; i < maxLogs + 5; i++) {
        service.info(`Message ${i}`);
      }

      await (service as any).flushBuffer();

      expect(service['logs'].length).to.be.at.most(maxLogs);
    });
  });

  describe('Log Querying', () => {
    beforeEach(async () => {
      await service.onModuleInit();

      // Add test logs
      service.info('Info message 1', 'TEST1', { userId: 'user1' });
      service.error('Error message 1', undefined, 'TEST2', { userId: 'user2' });
      service.warn('Warning message 1', 'TEST3', { userId: 'user1' });
      service.debug('Debug message 1', 'TEST1', { userId: 'user3' });

      await (service as any).flushBuffer();
    });

    it('should return all logs when no filters provided', async () => {
      const result = await service.queryLogs({});

      expect(result.logs).to.have.length(4);
      expect(result.total).to.equal(4);
      expect(result.hasMore).to.be.false;
    });

    it('should filter logs by level', async () => {
      const result = await service.queryLogs({ level: LogLevel.ERROR });

      expect(result.logs).to.have.length(1);
      expect(result.logs[0].level).to.equal(LogLevel.ERROR);
      expect(result.total).to.equal(1);
    });

    it('should filter logs by context', async () => {
      const result = await service.queryLogs({ context: 'TEST1' });

      expect(result.logs).to.have.length(2);
      expect(result.logs.every(log => log.context === 'TEST1')).to.be.true;
    });

    it('should filter logs by userId', async () => {
      const result = await service.queryLogs({ userId: 'user1' });

      expect(result.logs).to.have.length(2);
      expect(result.logs.every(log => log.metadata?.userId === 'user1')).to.be.true;
    });

    it('should filter logs by search term', async () => {
      const result = await service.queryLogs({ search: 'Error' });

      expect(result.logs).to.have.length(1);
      expect(result.logs[0].message).to.include('Error');
    });

    it('should filter logs by tags', async () => {
      const result = await service.queryLogs({ tags: ['error'] });

      expect(result.logs).to.have.length(1);
      expect(result.logs[0].tags).to.include('error');
    });

    it('should paginate results', async () => {
      const result1 = await service.queryLogs({ limit: 2, offset: 0 });
      const result2 = await service.queryLogs({ limit: 2, offset: 2 });

      expect(result1.logs).to.have.length(2);
      expect(result2.logs).to.have.length(2);
      expect(result1.logs[0].id).to.not.equal(result2.logs[0].id);
    });

    it('should return hasMore correctly', async () => {
      const result = await service.queryLogs({ limit: 2 });

      expect(result.logs).to.have.length(2);
      expect(result.total).to.equal(4);
      expect(result.hasMore).to.be.true;
    });

    it('should sort logs by timestamp (newest first)', async () => {
      const result = await service.queryLogs({});

      for (let i = 1; i < result.logs.length; i++) {
        expect(result.logs[i-1].timestamp.getTime()).to.be.at.least(
          result.logs[i].timestamp.getTime()
        );
      }
    });
  });

  describe('Log Statistics', () => {
    beforeEach(async () => {
      await service.onModuleInit();

      // Add test logs with different timestamps
      service.info('Info message 1', 'TEST1');
      service.error('Error message 1', undefined, 'TEST2');
      service.warn('Warning message 1', 'TEST3');
      service.logRequest('GET', '/test1', 200, 100);
      service.logRequest('GET', '/test2', 500, 2000); // Slow request

      await (service as any).flushBuffer();
    });

    it('should return log statistics for default 24 hours', async () => {
      const stats = await service.getLogStats();

      expect(stats).to.have.property('totalLogs');
      expect(stats).to.have.property('logsByLevel');
      expect(stats).to.have.property('logsByHour');
      expect(stats).to.have.property('topErrors');
      expect(stats).to.have.property('averageResponseTime');
      expect(stats).to.have.property('slowestRequests');
      expect(stats).to.have.property('activeUsers');
      expect(stats).to.have.property('uniqueIps');

      expect(stats.logsByLevel).to.have.property(LogLevel.DEBUG);
      expect(stats.logsByLevel).to.have.property(LogLevel.INFO);
      expect(stats.logsByLevel).to.have.property(LogLevel.WARN);
      expect(stats.logsByLevel).to.have.property(LogLevel.ERROR);
      expect(stats.logsByLevel).to.have.property(LogLevel.FATAL);
    });

    it('should return correct logs by level counts', async () => {
      const stats = await service.getLogStats();

      expect(stats.logsByLevel[LogLevel.INFO]).to.be.greaterThan(0);
      expect(stats.logsByLevel[LogLevel.ERROR]).to.be.greaterThan(0);
      expect(stats.logsByLevel[LogLevel.WARN]).to.be.greaterThan(0);
    });

    it('should identify slow requests', async () => {
      const stats = await service.getLogStats();

      expect(stats.slowestRequests.length).to.be.greaterThan(0);
      expect(stats.slowestRequests[0]).to.have.property('url');
      expect(stats.slowestRequests[0]).to.have.property('duration');
      expect(stats.slowestRequests[0]).to.have.property('timestamp');
    });

    it('should calculate average response time', async () => {
      const stats = await service.getLogStats();

      expect(stats.averageResponseTime).to.be.greaterThan(0);
    });

    it('should return hourly log distribution', async () => {
      const stats = await service.getLogStats(1); // Last 1 hour

      expect(stats.logsByHour).to.have.length(1);
      expect(stats.logsByHour[0]).to.have.property('hour');
      expect(stats.logsByHour[0]).to.have.property('count');
    });
  });

  describe('Log Export', () => {
    beforeEach(async () => {
      await service.onModuleInit();

      service.info('Info message 1', 'TEST1', { userId: 'user1' });
      service.error('Error message 1', undefined, 'TEST2', { userId: 'user2' });

      await (service as any).flushBuffer();
    });

    it('should export logs in JSON format', async () => {
      const json = await service.exportLogs({});

      expect(() => JSON.parse(json)).to.not.throw();

      const parsed = JSON.parse(json);
      expect(parsed).to.be.an('array');
      expect(parsed.length).to.be.greaterThan(0);
    });

    it('should export logs in CSV format', async () => {
      const csv = await service.exportLogs({}, 'csv');

      expect(csv).to.include('id,correlationId,timestamp,level,message');
      expect(csv).to.include('Info message 1');
      expect(csv.split('\n').length).to.be.greaterThan(1); // Header + data rows
    });

    it('should limit export to 10,000 logs', async () => {
      // Add many logs
      for (let i = 0; i < 100; i++) {
        service.info(`Message ${i}`);
      }
      await (service as any).flushBuffer();

      const json = await service.exportLogs({});
      const parsed = JSON.parse(json);

      expect(parsed.length).to.be.at.most(10000);
    });
  });

  describe('Log Cleanup and Retention', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should clean up old logs based on retention policy', async () => {
      // Add an old log entry
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const oldLog: LogEntry = {
        id: 'old-log-id',
        correlationId: 'test-corr',
        timestamp: oldDate,
        level: LogLevel.DEBUG,
        message: 'Old debug message',
        source: 'test',
        environment: 'test',
      };

      service['logs'].push(oldLog);

      // Add a recent log
      service.info('Recent message');
      await (service as any).flushBuffer();

      const initialCount = service['logs'].length;
      await service['cleanupOldLogs']();

      // Old debug log should be removed (retention 7 days for debug)
      expect(service['logs'].length).to.be.lessThan(initialCount);
      expect(service['logs'].find(log => log.id === 'old-log-id')).to.be.undefined;
    });

    it('should keep error logs longer than debug logs', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      const oldDebugLog: LogEntry = {
        id: 'old-debug-id',
        correlationId: 'test-corr',
        timestamp: oldDate,
        level: LogLevel.DEBUG,
        message: 'Old debug message',
        source: 'test',
        environment: 'test',
      };

      const oldErrorLog: LogEntry = {
        id: 'old-error-id',
        correlationId: 'test-corr',
        timestamp: oldDate,
        level: LogLevel.ERROR,
        message: 'Old error message',
        source: 'test',
        environment: 'test',
      };

      service['logs'].push(oldDebugLog, oldErrorLog);

      await service['cleanupOldLogs']();

      // Debug log should be removed, error log should remain
      expect(service['logs'].find(log => log.id === 'old-debug-id')).to.be.undefined;
      expect(service['logs'].find(log => log.id === 'old-error-id')).to.not.be.undefined;
    });
  });

  describe('Configuration and Customization', () => {
    it('should use custom retention config from environment', async () => {
      mockConfigService.get.resetHistory();
      mockConfigService.get.callsFake((key: string, defaultValue?: any) => {
        if (key === 'LOG_RETENTION_DEBUG') return 5;
        if (key === 'LOG_RETENTION_ERROR') return 180;
        return defaultValue;
      });

      const newService = new EnhancedLoggerService(mockConfigService as any);
      await newService.onModuleInit();

      const retention = (newService as any).retentionConfig;
      expect(retention.debug).to.equal(5);
      expect(retention.error).to.equal(180);

      await newService.onModuleDestroy();
    });

    it('should handle missing config values gracefully', async () => {
      mockConfigService.get.resetHistory();
      mockConfigService.get.returns(undefined);

      const newService = new EnhancedLoggerService(mockConfigService as any);
      await newService.onModuleInit();

      expect(newService).to.be.an('object');

      await newService.onModuleDestroy();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle high volume logging without memory leaks', async () => {
      await service.onModuleInit();

      const initialMemory = process.memoryUsage().heapUsed;

      // Add many logs
      for (let i = 0; i < 1000; i++) {
        service.info(`Message ${i}`, 'PERF_TEST', { iteration: i });
      }

      await (service as any).flushBuffer();

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024);
    });

    it('should complete log operations within acceptable time limits', async () => {
      await service.onModuleInit();

      const startTime = Date.now();

      // Add and query logs
      for (let i = 0; i < 100; i++) {
        service.info(`Performance test message ${i}`);
      }

      await (service as any).flushBuffer();
      await service.queryLogs({});
      await service.getLogStats();

      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).to.be.lessThan(5000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle circular objects in metadata', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      expect(() => {
        service.info('Message with circular reference', 'TEST', circular);
      }).to.not.throw();
    });

    it('should handle extremely long messages', () => {
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        service.info(longMessage);
      }).to.not.throw();
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Special chars: \n\t\r"\'\\😀🚀';

      expect(() => {
        service.info(specialMessage);
      }).to.not.throw();
    });

    it('should handle null/undefined metadata gracefully', () => {
      expect(() => {
        service.info('Message', 'CONTEXT', null as any);
      }).to.not.throw();

      expect(() => {
        service.info('Message', 'CONTEXT', undefined);
      }).to.not.throw();
    });

    it('should handle invalid dates in queries', async () => {
      const invalidDate = new Date('invalid');

      const result = await service.queryLogs({
        startTime: invalidDate,
      });

      expect(result.logs).to.be.an('array');
    });

    it('should handle empty string search terms', async () => {
      const result = await service.queryLogs({
        search: '',
      });

      expect(result.logs).to.be.an('array');
    });

    it('should handle very large limit values in queries', async () => {
      const result = await service.queryLogs({
        limit: 999999,
      });

      expect(result.logs).to.be.an('array');
      expect(result.logs.length).to.be.at.most(service['logs'].length);
    });
  });
});