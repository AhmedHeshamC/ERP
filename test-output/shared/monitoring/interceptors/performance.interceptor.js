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
exports.PerformanceInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const uuid_1 = require("uuid");
/**
 * Performance Monitoring Interceptor
 *
 * Automatically collects performance metrics for all API requests:
 * - Response time measurement
 * - Request/response logging
 * - Error tracking
 * - Memory usage monitoring
 * - User tracking for personal metrics
 */
let PerformanceInterceptor = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var PerformanceInterceptor = _classThis = class {
        constructor(performanceService) {
            this.performanceService = performanceService;
            this.logger = new common_1.Logger(PerformanceInterceptor.name);
        }
        intercept(context, next) {
            const request = context.switchToHttp().getRequest();
            const response = context.switchToHttp().getResponse();
            const startTime = Date.now();
            // Extract request information
            const method = request.method;
            const url = request.url;
            const userAgent = request.get('User-Agent');
            const ip = request.ip || request.connection.remoteAddress;
            const userId = this.extractUserId(request);
            // Generate correlation ID and trace ID for distributed tracing
            const correlationId = this.generateOrGetCorrelationId(request, response);
            const traceId = this.generateOrGetTraceId(request, response);
            // Enhanced request context tracking
            const enhancedContext = this.extractEnhancedContext(request);
            // Log request start with trace context
            this.logger.debug(`[${method}] ${url} - Request started [cid: ${correlationId}]`);
            return next.handle().pipe((0, operators_1.tap)(() => {
                // Request completed successfully
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                const statusCode = response.statusCode;
                // Collect memory usage
                const memoryUsage = process.memoryUsage();
                // Create enhanced performance metrics
                const metrics = {
                    endpoint: url,
                    method,
                    responseTime,
                    timestamp: new Date(),
                    statusCode,
                    userId,
                    userAgent,
                    ip,
                    memoryUsage: memoryUsage.heapUsed,
                    // Enhanced features
                    isSlowRequest: responseTime > 1000,
                    databaseQueries: enhancedContext.databaseQueries,
                    queryTime: enhancedContext.queryTime,
                    hasError: false,
                    cacheHit: enhancedContext.cacheHit,
                    cacheResponseTime: enhancedContext.cacheResponseTime,
                    cacheInvalidation: enhancedContext.cacheInvalidation,
                    invalidationTime: enhancedContext.invalidationTime,
                    memoryAlert: this.checkMemoryAlert(memoryUsage),
                    correlationId,
                    traceId,
                };
                // Record metrics with enhanced context
                try {
                    this.performanceService.recordMetrics(metrics);
                }
                catch (error) {
                    // Handle performance service failures gracefully
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.warn(`Failed to record performance metrics: ${errorMessage}`);
                }
                // Log request completion
                const logMessage = `[${method}] ${url} - ${statusCode} - ${responseTime}ms [cid: ${correlationId}]`;
                if (responseTime > 1000) {
                    this.logger.warn(`${logMessage} (SLOW)`);
                }
                else {
                    this.logger.debug(logMessage);
                }
                // Add performance headers
                response.set('X-Response-Time', `${responseTime}ms`);
                response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
                response.set('X-Correlation-Id', correlationId);
            }), (0, operators_1.catchError)((error) => {
                // Request failed
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                const statusCode = error.status || 500;
                // Collect memory usage
                const memoryUsage = process.memoryUsage();
                // Create enhanced performance metrics for error
                const metrics = {
                    endpoint: url,
                    method,
                    responseTime,
                    timestamp: new Date(),
                    statusCode,
                    userId,
                    userAgent,
                    ip,
                    memoryUsage: memoryUsage.heapUsed,
                    // Enhanced error features
                    isSlowRequest: responseTime > 1000,
                    hasError: true,
                    errorMessage: error.message,
                    correlationId,
                    traceId,
                };
                // Record metrics for error analysis
                try {
                    this.performanceService.recordMetrics(metrics);
                }
                catch (recordError) {
                    const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
                    this.logger.warn(`Failed to record error metrics: ${errorMessage}`);
                }
                // Log error with trace context
                this.logger.error(`[${method}] ${url} - ${statusCode} - ${responseTime}ms - Error: ${error.message} [cid: ${correlationId}]`, error.stack);
                // Add performance headers even for errors
                response.set('X-Response-Time', `${responseTime}ms`);
                response.set('X-Memory-Usage', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
                response.set('X-Correlation-Id', correlationId);
                // Re-throw the error
                throw error;
            }));
        }
        /**
         * Generate or get correlation ID for request tracing
         */
        generateOrGetCorrelationId(request, response) {
            // Check if correlation ID already exists in headers
            let correlationId = request.get('X-Correlation-Id') || request.get('x-correlation-id');
            if (!correlationId) {
                correlationId = (0, uuid_1.v4)();
                response.set('X-Correlation-Id', correlationId);
            }
            return correlationId;
        }
        /**
         * Generate or get trace ID for distributed tracing
         */
        generateOrGetTraceId(request, response) {
            // Check if trace ID already exists in headers
            let traceId = request.get('X-Trace-Id') || request.get('x-trace-id');
            if (!traceId) {
                traceId = (0, uuid_1.v4)();
                response.set('X-Trace-Id', traceId);
            }
            return traceId;
        }
        /**
         * Extract enhanced context from request
         */
        extractEnhancedContext(request) {
            // Extract database query information from headers or metadata
            const context = {};
            // Database query metrics
            const queryCountHeader = request.get('X-Query-Count');
            if (queryCountHeader) {
                context.databaseQueries = parseInt(queryCountHeader, 10);
            }
            const queryTimeHeader = request.get('X-Query-Time');
            if (queryTimeHeader) {
                context.queryTime = parseInt(queryTimeHeader, 10);
            }
            // Cache performance metrics
            const cacheStatusHeader = request.get('X-Cache-Status');
            if (cacheStatusHeader) {
                context.cacheHit = cacheStatusHeader === 'HIT';
            }
            const cacheTimeHeader = request.get('X-Cache-Time');
            if (cacheTimeHeader) {
                context.cacheResponseTime = parseInt(cacheTimeHeader, 10);
            }
            // Cache invalidation metrics
            const cacheInvalidationHeader = request.get('X-Cache-Invalidation');
            if (cacheInvalidationHeader) {
                context.cacheInvalidation = cacheInvalidationHeader === 'true';
            }
            const invalidationTimeHeader = request.get('X-Invalidation-Time');
            if (invalidationTimeHeader) {
                context.invalidationTime = parseInt(invalidationTimeHeader, 10);
            }
            return context;
        }
        /**
         * Check for memory usage alerts
         */
        checkMemoryAlert(memoryUsage) {
            const memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
            return memoryUsage.heapUsed > memoryThreshold;
        }
        /**
         * Extract user ID from request
         */
        extractUserId(request) {
            // Try to get user from different possible sources
            const user = request.user;
            if (user) {
                return user.id || user.userId || user.sub;
            }
            // Try JWT token payload
            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    // In a real implementation, you would decode the JWT token
                    // For now, returning undefined to keep it simple
                    return undefined;
                }
                catch (error) {
                    return undefined;
                }
            }
            return undefined;
        }
    };
    __setFunctionName(_classThis, "PerformanceInterceptor");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PerformanceInterceptor = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PerformanceInterceptor = _classThis;
})();
exports.PerformanceInterceptor = PerformanceInterceptor;
