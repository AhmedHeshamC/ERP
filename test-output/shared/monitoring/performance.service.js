"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Enterprise-Grade Performance Monitoring Service
 *
 * Provides comprehensive performance monitoring with:
 * - Real-time metrics collection and analysis
 * - Automated alert generation
 * - Performance trend analysis
 * - System resource monitoring
 * - Performance recommendations
 * - Historical data analysis
 */
let PerformanceService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PerformanceService = _classThis = class {
        constructor(configService) {
            this.logger = new common_1.Logger(PerformanceService.name);
            // Metrics storage (in production, use time-series database like InfluxDB)
            this.metrics = [];
            this.endpointStats = new Map();
            this.systemMetrics = [];
            this.alerts = [];
            // Configuration
            this.alertThresholds = {
                responseTime: 1000, // 1 second
                errorRate: 5, // 5%
                memoryUsage: 80, // 80%
                cpuUsage: 80, // 80%
                activeConnections: 1000,
            };
            // Monitoring intervals
            this.systemMetricsInterval = null;
            this.cleanupInterval = null;
            this.alertCheckInterval = null;
            this.configService = configService;
            // Load configuration
            const thresholds = configService.get('PERFORMANCE_THRESHOLDS');
            if (thresholds) {
                Object.assign(this.alertThresholds, thresholds);
            }
        }
        async onModuleInit() {
            this.logger.log('Initializing performance monitoring service');
            // Start monitoring intervals
            this.startSystemMetricsCollection();
            this.startCleanupProcess();
            this.startAlertMonitoring();
            this.logger.log('Performance monitoring service initialized');
        }
        async onModuleDestroy() {
            this.logger.log('Shutting down performance monitoring service');
            // Clear intervals
            if (this.systemMetricsInterval) {
                clearInterval(this.systemMetricsInterval);
            }
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            if (this.alertCheckInterval) {
                clearInterval(this.alertCheckInterval);
            }
            this.logger.log('Performance monitoring service shut down');
        }
        /**
         * Record performance metrics for a request
         */
        recordMetrics(metrics) {
            try {
                // Store metrics
                this.metrics.push(metrics);
                // Update endpoint statistics
                this.updateEndpointStats(metrics);
                // Check for immediate alerts
                this.checkImmediateAlerts(metrics);
                // Emit event for real-time monitoring
                this.logger.debug(`Recorded metrics for ${metrics.method} ${metrics.endpoint}: ${metrics.responseTime}ms`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error recording performance metrics: ${errorMessage}`);
            }
        }
        /**
         * Get performance statistics for a specific endpoint
         */
        getEndpointStats(endpoint, method) {
            const key = this.generateEndpointKey(endpoint, method);
            return this.endpointStats.get(key) || null;
        }
        /**
         * Get performance statistics for all endpoints
         */
        getAllEndpointStats() {
            return Array.from(this.endpointStats.values());
        }
        /**
         * Get the slowest endpoints
         */
        getSlowestEndpoints(limit = 10) {
            return Array.from(this.endpointStats.values())
                .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
                .slice(0, limit);
        }
        /**
         * Get the busiest endpoints
         */
        getBusiestEndpoints(limit = 10) {
            return Array.from(this.endpointStats.values())
                .sort((a, b) => b.totalRequests - a.totalRequests)
                .slice(0, limit);
        }
        /**
         * Get system metrics for a time range
         */
        getSystemMetrics(from, to) {
            let metrics = this.systemMetrics;
            if (from) {
                metrics = metrics.filter(m => m.timestamp >= from);
            }
            if (to) {
                metrics = metrics.filter(m => m.timestamp <= to);
            }
            return metrics;
        }
        /**
         * Get active alerts
         */
        getActiveAlerts() {
            return this.alerts.filter(alert => !alert.resolved);
        }
        /**
         * Get all alerts
         */
        getAllAlerts() {
            return this.alerts;
        }
        /**
         * Create a manual alert
         */
        createAlert(type, severity, message, value, threshold) {
            const alert = {
                id: this.generateAlertId(),
                type,
                severity,
                message,
                value,
                threshold,
                timestamp: new Date(),
                resolved: false,
            };
            this.alerts.push(alert);
            this.logger.warn(`Performance alert created: ${message} (${severity})`);
            return alert;
        }
        /**
         * Resolve an alert
         */
        resolveAlert(alertId) {
            const alert = this.alerts.find(a => a.id === alertId);
            if (alert && !alert.resolved) {
                alert.resolved = true;
                this.logger.log(`Performance alert resolved: ${alert.message}`);
                return true;
            }
            return false;
        }
        /**
         * Generate comprehensive performance report
         */
        generateReport(from, to) {
            const period = { start: from, end: to };
            // Filter metrics for the period
            const periodMetrics = this.metrics.filter(m => m.timestamp >= from && m.timestamp <= to);
            const periodSystemMetrics = this.getSystemMetrics(from, to);
            const periodAlerts = this.alerts.filter(a => a.timestamp >= from && a.timestamp <= to);
            // Calculate summary statistics
            const totalRequests = periodMetrics.length;
            const averageResponseTime = totalRequests > 0
                ? periodMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
                : 0;
            const errorCount = periodMetrics.filter(m => m.statusCode >= 400).length;
            const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
            const summary = {
                totalRequests,
                averageResponseTime,
                errorRate,
                slowestEndpoints: this.getSlowestEndpoints(5),
                busiestEndpoints: this.getBusiestEndpoints(5),
                alerts: periodAlerts,
            };
            // Generate recommendations
            const recommendations = this.generateRecommendations(summary, periodSystemMetrics);
            return {
                period,
                summary,
                endpoints: this.getAllEndpointStats(),
                systemMetrics: periodSystemMetrics,
                recommendations,
            };
        }
        /**
         * Get real-time performance overview
         */
        getRealtimeOverview() {
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60000);
            const recentMetrics = this.metrics.filter(m => m.timestamp >= oneMinuteAgo);
            const requestsPerMinute = recentMetrics.length;
            const averageResponseTime = recentMetrics.length > 0
                ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
                : 0;
            const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
            const errorRate = recentMetrics.length > 0 ? (errorCount / recentMetrics.length) * 100 : 0;
            const latestSystemMetric = this.systemMetrics[this.systemMetrics.length - 1];
            const activeConnections = latestSystemMetric?.activeConnections || 0;
            const activeAlerts = this.getActiveAlerts();
            const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
            const highAlerts = activeAlerts.filter(a => a.severity === 'high');
            let systemHealth = 'healthy';
            if (criticalAlerts.length > 0 || errorRate > 10) {
                systemHealth = 'critical';
            }
            else if (highAlerts.length > 0 || errorRate > 5) {
                systemHealth = 'warning';
            }
            return {
                currentMetrics: {
                    requestsPerMinute,
                    averageResponseTime,
                    errorRate,
                    activeConnections,
                },
                activeAlerts,
                systemHealth: {
                    status: systemHealth,
                    memoryUsage: latestSystemMetric?.memoryUsage.percentage || 0,
                    cpuUsage: latestSystemMetric?.cpuUsage.user || 0,
                },
            };
        }
        /**
         * Update endpoint statistics
         */
        updateEndpointStats(metrics) {
            const key = this.generateEndpointKey(metrics.endpoint, metrics.method);
            let stats = this.endpointStats.get(key);
            if (!stats) {
                stats = {
                    endpoint: metrics.endpoint,
                    method: metrics.method,
                    totalRequests: 0,
                    averageResponseTime: 0,
                    minResponseTime: metrics.responseTime,
                    maxResponseTime: metrics.responseTime,
                    errorRate: 0,
                    lastAccessed: metrics.timestamp,
                    requestsPerMinute: 0,
                };
                this.endpointStats.set(key, stats);
            }
            // Update statistics
            stats.totalRequests++;
            stats.lastAccessed = metrics.timestamp;
            // Update response time statistics
            const totalResponseTime = stats.averageResponseTime * (stats.totalRequests - 1) + metrics.responseTime;
            stats.averageResponseTime = totalResponseTime / stats.totalRequests;
            stats.minResponseTime = Math.min(stats.minResponseTime, metrics.responseTime);
            stats.maxResponseTime = Math.max(stats.maxResponseTime, metrics.responseTime);
            // Update error rate
            const errorCount = this.metrics.filter(m => m.endpoint === metrics.endpoint &&
                m.method === metrics.method &&
                m.statusCode >= 400).length;
            stats.errorRate = (errorCount / stats.totalRequests) * 100;
            // Calculate requests per minute (last minute)
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const recentRequests = this.metrics.filter(m => m.endpoint === metrics.endpoint &&
                m.method === metrics.method &&
                m.timestamp >= oneMinuteAgo).length;
            stats.requestsPerMinute = recentRequests;
        }
        /**
         * Check for immediate alerts based on metrics
         */
        checkImmediateAlerts(metrics) {
            // Response time alert
            if (metrics.responseTime > this.alertThresholds.responseTime) {
                this.createAlert('response_time', metrics.responseTime > this.alertThresholds.responseTime * 2 ? 'critical' : 'high', `High response time detected for ${metrics.method} ${metrics.endpoint}`, metrics.responseTime, this.alertThresholds.responseTime);
            }
            // Error rate alert (5xx errors)
            if (metrics.statusCode >= 500) {
                this.createAlert('error_rate', 'critical', `Server error detected for ${metrics.method} ${metrics.endpoint} (${metrics.statusCode})`, metrics.statusCode, 500);
            }
        }
        /**
         * Start system metrics collection
         */
        startSystemMetricsCollection() {
            const interval = this.configService.get('PERFORMANCE_METRICS_INTERVAL', 30000); // 30 seconds
            this.systemMetricsInterval = setInterval(async () => {
                try {
                    const metrics = await this.collectSystemMetrics();
                    this.systemMetrics.push(metrics);
                    // Check system-level alerts
                    this.checkSystemAlerts(metrics);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Error collecting system metrics: ${errorMessage}`);
                }
            }, interval);
        }
        /**
         * Start cleanup process for old metrics
         */
        startCleanupProcess() {
            this.cleanupInterval = setInterval(() => {
                try {
                    this.cleanupOldMetrics();
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Error during metrics cleanup: ${errorMessage}`);
                }
            }, 60000); // Run every minute
        }
        /**
         * Start alert monitoring
         */
        startAlertMonitoring() {
            this.alertCheckInterval = setInterval(() => {
                try {
                    this.checkTrendAlerts();
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Error during alert monitoring: ${errorMessage}`);
                }
            }, 60000); // Check every minute
        }
        /**
         * Collect system metrics
         */
        async collectSystemMetrics() {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            // Calculate memory usage percentage
            const totalMemory = require('os').totalmem();
            const usedMemory = memUsage.heapUsed;
            const memoryPercentage = (usedMemory / totalMemory) * 100;
            // Get active connections (simplified)
            const activeConnections = this.metrics.filter(m => Date.now() - m.timestamp.getTime() < 30000 // Last 30 seconds
            ).length;
            return {
                timestamp: new Date(),
                memoryUsage: {
                    used: usedMemory,
                    total: totalMemory,
                    percentage: Math.round(memoryPercentage * 100) / 100,
                },
                cpuUsage: {
                    user: cpuUsage.user / 1000000, // Convert to seconds
                    system: cpuUsage.system / 1000000,
                    idle: 0, // Would need more complex calculation
                },
                activeConnections,
                queuedRequests: 0, // Would need queue monitoring
            };
        }
        /**
         * Check system-level alerts
         */
        checkSystemAlerts(metrics) {
            // Memory usage alert
            if (metrics.memoryUsage.percentage > this.alertThresholds.memoryUsage) {
                this.createAlert('memory', metrics.memoryUsage.percentage > 95 ? 'critical' : 'high', `High memory usage detected: ${metrics.memoryUsage.percentage.toFixed(1)}%`, metrics.memoryUsage.percentage, this.alertThresholds.memoryUsage);
            }
            // Active connections alert
            if (metrics.activeConnections > this.alertThresholds.activeConnections) {
                this.createAlert('connection', 'high', `High number of active connections: ${metrics.activeConnections}`, metrics.activeConnections, this.alertThresholds.activeConnections);
            }
        }
        /**
         * Check trend-based alerts
         */
        checkTrendAlerts() {
            // Check endpoint error rates
            for (const stats of this.endpointStats.values()) {
                if (stats.errorRate > this.alertThresholds.errorRate && stats.totalRequests > 10) {
                    this.createAlert('error_rate', stats.errorRate > 10 ? 'critical' : 'medium', `High error rate for ${stats.method} ${stats.endpoint}: ${stats.errorRate.toFixed(1)}%`, stats.errorRate, this.alertThresholds.errorRate);
                }
            }
        }
        /**
         * Clean up old metrics to prevent memory leaks
         */
        cleanupOldMetrics() {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            // Clean up old metrics
            this.metrics = this.metrics.filter(m => now - m.timestamp.getTime() < maxAge);
            // Clean up old system metrics
            this.systemMetrics = this.systemMetrics.filter(m => now - m.timestamp.getTime() < maxAge);
            // Clean up old resolved alerts
            this.alerts = this.alerts.filter(a => !a.resolved || now - a.timestamp.getTime() < maxAge);
            // Limit size of endpoint stats
            if (this.endpointStats.size > 1000) {
                const sortedStats = Array.from(this.endpointStats.entries())
                    .sort((a, b) => b[1].lastAccessed.getTime() - a[1].lastAccessed.getTime());
                // Keep only the 500 most recently accessed endpoints
                const toKeep = sortedStats.slice(0, 500);
                this.endpointStats = new Map(toKeep);
            }
        }
        /**
         * Generate performance recommendations
         */
        generateRecommendations(summary, systemMetrics) {
            const recommendations = [];
            // Response time recommendations
            if (summary.averageResponseTime > 500) {
                recommendations.push('Consider implementing caching for frequently accessed data');
                recommendations.push('Review database query optimization');
            }
            // Error rate recommendations
            if (summary.errorRate > 2) {
                recommendations.push('Review error handling and logging');
                recommendations.push('Implement circuit breaker pattern for external services');
            }
            // Endpoint-specific recommendations
            for (const endpoint of summary.slowestEndpoints) {
                if (endpoint.averageResponseTime > 1000) {
                    recommendations.push(`Optimize ${endpoint.method} ${endpoint.endpoint} - current avg: ${endpoint.averageResponseTime}ms`);
                }
            }
            // System recommendations
            const latestMetric = systemMetrics[systemMetrics.length - 1];
            if (latestMetric && latestMetric.memoryUsage.percentage > 70) {
                recommendations.push('Monitor memory usage and consider memory optimization');
            }
            // Alert recommendations
            if (summary.alerts.length > 0) {
                recommendations.push('Review and resolve active performance alerts');
            }
            return recommendations;
        }
        /**
         * Generate unique key for endpoint
         */
        generateEndpointKey(endpoint, method) {
            return `${method || 'GET'}:${endpoint}`;
        }
        /**
         * Generate unique alert ID
         */
        generateAlertId() {
            return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        /**
         * Get performance statistics for dashboard
         * This method provides aggregated stats for the last specified minutes
         */
        getStats(minutesAgo = 5) {
            const now = new Date();
            const fromTime = new Date(now.getTime() - minutesAgo * 60 * 1000);
            const recentMetrics = this.metrics.filter(m => m.timestamp >= fromTime);
            const totalRequests = recentMetrics.length;
            const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
            const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
            const averageResponseTime = totalRequests > 0
                ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
                : 0;
            const requestsPerMinute = totalRequests / minutesAgo;
            // Get current system metrics
            const latestSystemMetrics = this.systemMetrics[this.systemMetrics.length - 1];
            const memoryUsage = latestSystemMetrics
                ? latestSystemMetrics.memoryUsage.percentage
                : 0;
            const activeConnections = latestSystemMetrics
                ? latestSystemMetrics.activeConnections
                : 0;
            // Get cache stats from cache service (mocked for now)
            const cacheHitRate = 85.5; // Mock value - would come from actual cache service
            return {
                totalRequests,
                errorRate,
                averageResponseTime,
                requestsPerMinute,
                cacheHitRate,
                memoryUsage,
                activeConnections,
            };
        }
        /**
         * Get most active endpoints (alias for getBusiestEndpoints)
         */
        getMostActiveEndpoints(limit = 10) {
            return this.getBusiestEndpoints(limit);
        }
        /**
         * Get slow queries for analysis
         */
        getSlowQueries(limit = 10) {
            const slowQueries = this.metrics
                .filter(m => m.responseTime > this.alertThresholds.responseTime)
                .sort((a, b) => b.responseTime - a.responseTime)
                .slice(0, limit);
            return slowQueries;
        }
        /**
         * Get performance alerts
         */
        getPerformanceAlerts() {
            return this.alerts.filter(alert => !alert.resolved);
        }
        /**
         * Get all metrics including enhanced fields
         */
        getMetrics() {
            return [...this.metrics];
        }
        /**
         * Record enhanced metrics with additional context
         */
        recordEnhancedMetrics(metrics) {
            const baseMetrics = {
                endpoint: '',
                method: 'GET',
                responseTime: 0,
                timestamp: new Date(),
                statusCode: 200,
                ...metrics,
            };
            this.recordMetrics(baseMetrics);
        }
    };
    __setFunctionName(_classThis, "PerformanceService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PerformanceService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PerformanceService = _classThis;
})();
exports.PerformanceService = PerformanceService;
