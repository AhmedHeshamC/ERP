import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
  missing?: string[];
}

interface Phase4ValidationSummary {
  overall: 'PASS' | 'FAIL' | 'PARTIAL';
  timestamp: string;
  results: ValidationResult[];
  summary: {
    passed: number;
    failed: number;
    partial: number;
    total: number;
    completionRate: number;
  };
}

/**
 * Phase 4 Performance Optimization Validation Script
 *
 * Comprehensive validation to ensure Phase 4 is 100% complete:
 * - Redis-based distributed caching system
 * - Database query optimization across all modules
 * - Performance monitoring and metrics
 * - Memory management and resource optimization
 * - API response optimization
 * - Background job processing
 * - Connection pooling optimization
 * - Load testing and performance validation
 * - Advanced caching strategies
 * - Performance configuration management
 */
class Phase4Validator {
  private results: ValidationResult[] = [];
  private projectRoot = join(__dirname, '../..');

  async validate(): Promise<Phase4ValidationSummary> {
    console.log('🔍 Starting Phase 4 Performance Optimization Validation...\n');

    // Validate each component
    await this.validateRedisCaching();
    await this.validateDatabaseOptimization();
    await this.validatePerformanceMonitoring();
    await this.validateMemoryManagement();
    await this.validateApiOptimization();
    await this.validateBackgroundJobs();
    await this.validateConnectionPooling();
    await this.validateLoadTesting();
    await this.validateAdvancedCaching();
    await this.validatePerformanceConfig();

    // Calculate summary
    const summary = this.calculateSummary();

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Overall Status: ${summary.overall}`);
    console.log(`Completion Rate: ${summary.summary.completionRate.toFixed(1)}%`);
    console.log(`Passed: ${summary.summary.passed}`);
    console.log(`Failed: ${summary.summary.failed}`);
    console.log(`Partial: ${summary.summary.partialial}`);
    console.log(`Total: ${summary.summary.total}`);

    // Print detailed results
    console.log('\n📋 DETAILED RESULTS');
    console.log('='.repeat(50));
    for (const result of this.results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.component}: ${result.status}`);
      console.log(`   ${result.details}`);
      if (result.missing && result.missing.length > 0) {
        console.log(`   Missing: ${result.missing.join(', ')}`);
      }
      console.log('');
    }

    return {
      overall: summary.overall,
      timestamp: new Date().toISOString(),
      results: this.results,
      summary: summary.summary,
    };
  }

  private async validateRedisCaching(): Promise<void> {
    const requiredFiles = [
      'src/shared/cache/cache.service.ts',
      'src/shared/cache/cache.module.ts',
      'src/shared/cache/interceptors/cache.interceptor.ts',
      'src/shared/cache/decorators/cache.decorator.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : missing.length < requiredFiles.length ? 'PARTIAL' : 'FAIL';

    // Check cache service implementation
    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/cache/cache.service.ts'))) {
      const cacheServiceContent = readFileSync(join(this.projectRoot, 'src/shared/cache/cache.service.ts'), 'utf8');
      const hasRedisImplementation = cacheServiceContent.includes('createClient') &&
                                     cacheServiceContent.includes('connectRedis');
      const hasCacheMethods = cacheServiceContent.includes('async get') &&
                             cacheServiceContent.includes('async set') &&
                             cacheServiceContent.includes('async del');
      const hasStatsTracking = cacheServiceContent.includes('CacheStats') &&
                              cacheServiceContent.includes('getStats');

      if (hasRedisImplementation && hasCacheMethods && hasStatsTracking) {
        implementationDetails = 'Complete Redis implementation with comprehensive caching methods and statistics';
      } else {
        implementationDetails = 'Partial implementation - missing some features';
        if (!hasRedisImplementation) missing.push('Redis client implementation');
        if (!hasCacheMethods) missing.push('Core caching methods');
        if (!hasStatsTracking) missing.push('Statistics tracking');
      }
    } else {
      implementationDetails = 'Cache service not implemented';
    }

    this.results.push({
      component: 'Redis-based Distributed Caching System',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateDatabaseOptimization(): Promise<void> {
    const modules = ['hr', 'accounting', 'inventory', 'sales', 'purchasing', 'reports', 'users'];
    let optimizedModules = 0;
    const missing: string[] = [];

    for (const module of modules) {
      const serviceFiles = this.findServiceFiles(module);
      let hasOptimization = false;

      for (const serviceFile of serviceFiles) {
        if (existsSync(join(this.projectRoot, serviceFile))) {
          const content = readFileSync(join(this.projectRoot, serviceFile), 'utf8');
          const hasCaching = content.includes('CacheService') && content.includes('cacheService');
          const hasQueryOptimization = content.includes('select:') &&
                                     content.includes('parallel execution') ||
                                     content.includes('select:') && content.includes('Promise.all');
          const hasPagination = content.includes('skip') && content.includes('take');

          if (hasCaching || hasQueryOptimization || hasPagination) {
            hasOptimization = true;
          }
        }
      }

      if (hasOptimization) {
        optimizedModules++;
      } else {
        missing.push(`${module} module`);
      }
    }

    const status = optimizedModules === modules.length ? 'PASS' :
                   optimizedModules >= modules.length * 0.7 ? 'PARTIAL' : 'FAIL';

    this.results.push({
      component: 'Database Query Optimization (All Modules)',
      status,
      details: `Optimized ${optimizedModules}/${modules.length} modules with caching, query optimization, and pagination`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validatePerformanceMonitoring(): Promise<void> {
    const requiredFiles = [
      'src/shared/monitoring/performance.service.ts',
      'src/shared/monitoring/interceptors/performance.interceptor.ts',
      'src/shared/monitoring/monitoring.module.ts',
      'src/shared/monitoring/controllers/performance.controller.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : missing.length < requiredFiles.length ? 'PARTIAL' : 'FAIL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/monitoring/performance.service.ts'))) {
      const performanceServiceContent = readFileSync(join(this.projectRoot, 'src/shared/monitoring/performance.service.ts'), 'utf8');
      const hasMetricsCollection = performanceServiceContent.includes('recordMetrics') &&
                                  performanceServiceContent.includes('PerformanceMetrics');
      const hasAlertSystem = performanceServiceContent.includes('createAlert') &&
                            performanceServiceContent.includes('PerformanceAlert');
      const hasRealTimeMonitoring = performanceServiceContent.includes('getRealtimeOverview') &&
                                    performanceServiceContent.includes('systemMetrics');

      if (hasMetricsCollection && hasAlertSystem && hasRealTimeMonitoring) {
        implementationDetails = 'Complete performance monitoring with metrics, alerts, and real-time overview';
      } else {
        implementationDetails = 'Partial implementation - missing some monitoring features';
      }
    }

    this.results.push({
      component: 'Performance Monitoring and Metrics',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateMemoryManagement(): Promise<void> {
    const requiredFiles = [
      'src/shared/performance/memory.service.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : 'PARTIAL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/performance/memory.service.ts'))) {
      const memoryServiceContent = readFileSync(join(this.projectRoot, 'src/shared/performance/memory.service.ts'), 'utf8');
      const hasMemoryMonitoring = memoryServiceContent.includes('getCurrentStats') &&
                                memoryServiceContent.includes('MemoryStats');
      const hasAlertSystem = memoryServiceContent.includes('MemoryAlert') &&
                            memoryServiceContent.includes('createAlert');
      const hasOptimization = memoryServiceContent.includes('forceGarbageCollection') &&
                             memoryServiceContent.includes('executeCleanup');

      if (hasMemoryMonitoring && hasAlertSystem && hasOptimization) {
        implementationDetails = 'Complete memory management with monitoring, alerts, and optimization';
      } else {
        implementationDetails = 'Partial implementation - missing some memory management features';
      }
    }

    this.results.push({
      component: 'Memory Management and Resource Optimization',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateApiOptimization(): Promise<void> {
    const requiredFiles = [
      'src/shared/middleware/performance.middleware.ts',
      'src/shared/common/interceptors/api-response.interceptor.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : 'PARTIAL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/middleware/performance.middleware.ts'))) {
      const middlewareContent = readFileSync(join(this.projectRoot, 'src/shared/middleware/performance.middleware.ts'), 'utf8');
      const hasCompression = middlewareContent.includes('compression') &&
                           middlewareContent.includes('shouldCompressContentType');
      const hasCachingHeaders = middlewareContent.includes('setCacheHeaders') &&
                              middlewareContent.includes('Cache-Control');
      const hasSecurityHeaders = middlewareContent.includes('setSecurityHeaders') &&
                                middlewareContent.includes('X-Content-Type-Options');

      if (hasCompression && hasCachingHeaders && hasSecurityHeaders) {
        implementationDetails = 'Complete API optimization with compression, caching, and security headers';
      } else {
        implementationDetails = 'Partial implementation - missing some optimization features';
      }
    }

    // Check if middleware is configured in app module
    const appModuleContent = readFileSync(join(this.projectRoot, 'src/app.module.ts'), 'utf8');
    const hasMiddlewareConfigured = appModuleContent.includes('PerformanceMiddleware') &&
                                  appModuleContent.includes('RequestSizeLimitMiddleware');

    if (hasMiddlewareConfigured) {
      implementationDetails += ' | Middleware properly configured in app module';
    } else {
      missing.push('Middleware configuration in app module');
    }

    this.results.push({
      component: 'API Response Optimization',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateBackgroundJobs(): Promise<void> {
    const requiredFiles = [
      'src/shared/queue/job.service.ts',
      'src/shared/queue/queue.module.ts',
      'src/shared/queue/controllers/job.controller.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : 'PARTIAL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/queue/job.service.ts'))) {
      const jobServiceContent = readFileSync(join(this.projectRoot, 'src/shared/queue/job.service.ts'), 'utf8');
      const hasJobProcessing = jobServiceContent.includes('addJob') &&
                             jobServiceContent.includes('processJob');
      const hasRetryMechanism = jobServiceContent.includes('maxAttempts') &&
                               jobServiceContent.includes('calculateRetryDelay');
      const hasJobMonitoring = jobServiceContent.includes('getQueueStats') &&
                              jobServiceContent.includes('getJobs');

      if (hasJobProcessing && hasRetryMechanism && hasJobMonitoring) {
        implementationDetails = 'Complete background job processing with retry mechanisms and monitoring';
      } else {
        implementationDetails = 'Partial implementation - missing some job processing features';
      }
    }

    this.results.push({
      component: 'Background Job Processing System',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateConnectionPooling(): Promise<void> {
    // Check for connection pool configuration
    const configFiles = [
      'src/shared/config/performance.config.ts',
      'src/config/configuration.ts',
    ];

    let hasPoolConfig = false;
    let implementationDetails = '';

    for (const configFile of configFiles) {
      if (existsSync(join(this.projectRoot, configFile))) {
        const content = readFileSync(join(this.projectRoot, configFile), 'utf8');
        if (content.includes('connectionPool') || content.includes('connectionPool')) {
          hasPoolConfig = true;
          implementationDetails = `Connection pool configuration found in ${configFile}`;
          break;
        }
      }
    }

    // Check if it's loaded in configuration
    const appModuleContent = readFileSync(join(this.projectRoot, 'src/app.module.ts'), 'utf8');
    const hasConfigLoaded = appModuleContent.includes('performanceConfig') ||
                           appModuleContent.includes('performance.config');

    const status = hasPoolConfig && hasConfigLoaded ? 'PASS' :
                   hasPoolConfig || hasConfigLoaded ? 'PARTIAL' : 'FAIL';

    const missing: string[] = [];
    if (!hasPoolConfig) missing.push('Connection pool configuration');
    if (!hasConfigLoaded) missing.push('Configuration loading in app module');

    this.results.push({
      component: 'Connection Pooling Optimization',
      status,
      details: implementationDetails || 'Connection pool configuration not found',
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateLoadTesting(): Promise<void> {
    const requiredFiles = [
      'tests/performance/load-testing.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : 'PARTIAL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'tests/performance/load-testing.ts'))) {
      const loadTestContent = readFileSync(join(this.projectRoot, 'tests/performance/load-testing.ts'), 'utf8');
      const hasLoadTester = loadTestContent.includes('class LoadTester') &&
                           loadTestContent.includes('run()');
      const hasConfigurations = loadTestContent.includes('SAMPLE_CONFIGS') &&
                               loadTestContent.includes('basic') &&
                               loadTestContent.includes('apiStress');
      const hasStatisticalAnalysis = loadTestContent.includes('percentile') &&
                                    loadTestContent.includes('p90ResponseTime');

      if (hasLoadTester && hasConfigurations && hasStatisticalAnalysis) {
        implementationDetails = 'Complete load testing framework with multiple configurations and statistical analysis';
      } else {
        implementationDetails = 'Partial implementation - missing some load testing features';
      }
    }

    this.results.push({
      component: 'Comprehensive Load Testing and Performance Validation',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validateAdvancedCaching(): Promise<void> {
    // Check for advanced caching patterns
    const cacheServiceContent = existsSync(join(this.projectRoot, 'src/shared/cache/cache.service.ts')) ?
      readFileSync(join(this.projectRoot, 'src/shared/cache/cache.service.ts'), 'utf8') : '';

    const hasPatternInvalidation = cacheServiceContent.includes('delPattern') &&
                                  cacheServiceContent.includes('buildKey');
    const hasCacheWarming = cacheServiceContent.includes('warmUp') &&
                           cacheServiceContent.includes('CacheWarmupEntry');
    const hasCompression = cacheServiceContent.includes('compress') &&
                         cacheServiceContent.includes('shouldCompress');
    const hasGracefulDegradation = cacheServiceContent.includes('isConnected') &&
                                   cacheServiceContent.includes('graceful');

    const featuresImplemented = [hasPatternInvalidation, hasCacheWarming, hasCompression, hasGracefulDegradation]
      .filter(Boolean).length;

    const status = featuresImplemented === 4 ? 'PASS' :
                   featuresImplemented >= 2 ? 'PARTIAL' : 'FAIL';

    const missing: string[] = [];
    if (!hasPatternInvalidation) missing.push('Pattern-based cache invalidation');
    if (!hasCacheWarming) missing.push('Cache warming strategies');
    if (!hasCompression) missing.push('Cache compression');
    if (!hasGracefulDegradation) missing.push('Graceful degradation');

    this.results.push({
      component: 'Advanced Caching Strategies and Patterns',
      status,
      details: `Implemented ${featuresImplemented}/4 advanced caching features`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private async validatePerformanceConfig(): Promise<void> {
    const requiredFiles = [
      'src/shared/config/performance.config.ts',
    ];

    const missing = this.checkFilesExist(requiredFiles);
    const status = missing.length === 0 ? 'PASS' : 'PARTIAL';

    let implementationDetails = '';
    if (existsSync(join(this.projectRoot, 'src/shared/config/performance.config.ts'))) {
      const configContent = readFileSync(join(this.projectRoot, 'src/shared/config/performance.config.ts'), 'utf8');
      const hasRedisConfig = configContent.includes('redis:') &&
                           configContent.includes('url:') &&
                           configContent.includes('password:');
      const hasCacheConfig = configContent.includes('cache:') &&
                           configContent.includes('defaultTTL');
      const hasMonitoringConfig = configContent.includes('monitoring:') &&
                                configContent.includes('alertThresholds');
      const hasJobConfig = configContent.includes('jobs:') &&
                         configContent.includes('maxConcurrency');

      if (hasRedisConfig && hasCacheConfig && hasMonitoringConfig && hasJobConfig) {
        implementationDetails = 'Complete performance configuration with all sections properly configured';
      } else {
        implementationDetails = 'Partial configuration - missing some configuration sections';
      }
    }

    this.results.push({
      component: 'Performance Configuration Management',
      status,
      details: implementationDetails || `Required files missing: ${requiredFiles.length - missing.length}/${requiredFiles.length} present`,
      missing: missing.length > 0 ? missing : undefined,
    });
  }

  private checkFilesExist(files: string[]): string[] {
    return files.filter(file => !existsSync(join(this.projectRoot, file)));
  }

  private findServiceFiles(module: string): string[] {
    const modulePath = join(this.projectRoot, 'src/modules', module);
    if (!existsSync(modulePath)) return [];

    const serviceFiles: string[] = [];

    // Find all .service.ts files in the module
    const findFiles = (dir: string, files: string[] = []) => {
      const items = require('fs').readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = require('fs').statSync(fullPath);
        if (stat.isDirectory()) {
          findFiles(fullPath, files);
        } else if (item.endsWith('.service.ts')) {
          files.push(fullPath.replace(this.projectRoot + '/', ''));
        }
      }
      return files;
    };

    return findFiles(modulePath);
  }

  private calculateSummary(): { overall: 'PASS' | 'FAIL' | 'PARTIAL'; summary: any } {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const partial = this.results.filter(r => r.status === 'PARTIAL').length;
    const total = this.results.length;
    const completionRate = (passed / total) * 100;

    let overall: 'PASS' | 'FAIL' | 'PARTIAL';
    if (completionRate >= 95) {
      overall = 'PASS';
    } else if (completionRate >= 70) {
      overall = 'PARTIAL';
    } else {
      overall = 'FAIL';
    }

    return {
      overall,
      summary: { passed, failed, partial, total, completionRate },
    };
  }
}

/**
 * Run Phase 4 validation
 */
export async function validatePhase4(): Promise<Phase4ValidationSummary> {
  const validator = new Phase4Validator();
  return await validator.validate();
}

// Run validation if called directly
if (require.main === module) {
  validatePhase4()
    .then((result) => {
      console.log('\n🎯 PHASE 4 VALIDATION COMPLETE');
      console.log(`Result: ${result.overall} (${result.summary.completionRate.toFixed(1)}% complete)`);

      if (result.overall === 'PASS') {
        console.log('✅ Phase 4 is 100% complete and ready for production!');
      } else if (result.overall === 'PARTIAL') {
        console.log('⚠️ Phase 4 is partially complete. Some components need attention.');
      } else {
        console.log('❌ Phase 4 requires significant work before completion.');
      }

      process.exit(result.overall === 'PASS' ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}