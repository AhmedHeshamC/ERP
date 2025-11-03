"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const testing_1 = require("@nestjs/testing");
const performance_interceptor_1 = require("../../shared/monitoring/interceptors/performance.interceptor");
const performance_service_1 = require("../../shared/monitoring/performance.service");
const rxjs_1 = require("rxjs");
describe('Enhanced Performance Interceptor', () => {
    let interceptor;
    let module;
    beforeEach(async () => {
        module = await testing_1.Test.createTestingModule({
            providers: [
                performance_interceptor_1.PerformanceInterceptor,
                {
                    provide: performance_service_1.PerformanceService,
                    useValue: {
                        recordMetrics: () => { },
                        getMetrics: () => [],
                        getSlowQueries: () => [],
                        getPerformanceAlerts: () => [],
                    },
                },
            ],
        }).compile();
        interceptor = module.get(performance_interceptor_1.PerformanceInterceptor);
    });
    describe('Basic Request Profiling', () => {
        it('should process requests without errors', async () => {
            // Arrange
            const context = createMockContext('GET', '/api/products');
            const callHandler = createMockCallHandler({ data: 'test response' });
            // Act & Assert - Should not throw error
            const result = await interceptor.intercept(context, callHandler).toPromise();
            (0, chai_1.expect)(result).to.not.be.undefined;
        });
        it('should track correlation IDs for distributed tracing', async () => {
            // Arrange
            const context = createMockContext('GET', '/api/orders/123');
            const callHandler = createMockCallHandler({ data: { order: { id: 123 } } });
            // Act
            await interceptor.intercept(context, callHandler).toPromise();
            // Assert
            const response = context.switchToHttp().getResponse();
            (0, chai_1.expect)(response.header('x-correlation-id')).to.be.a('string');
        });
        it('should handle errors gracefully', async () => {
            // Arrange
            const context = createMockContext('DELETE', '/api/products/123');
            const error = new Error('Product not found');
            const callHandler = createMockCallHandler(error, 0, true);
            // Act & Assert
            try {
                await interceptor.intercept(context, callHandler).toPromise();
                chai_1.expect.fail('Should have thrown an error');
            }
            catch (err) {
                (0, chai_1.expect)(err).to.equal(error);
            }
        });
    });
    describe('Performance Headers', () => {
        it('should add performance headers to responses', async () => {
            // Arrange
            const context = createMockContext('GET', '/api/test');
            const callHandler = createMockCallHandler({ data: 'test response' });
            // Act
            await interceptor.intercept(context, callHandler).toPromise();
            // Assert
            const response = context.switchToHttp().getResponse();
            (0, chai_1.expect)(response.header('x-response-time')).to.be.a('string');
            (0, chai_1.expect)(response.header('x-memory-usage')).to.be.a('string');
            (0, chai_1.expect)(response.header('x-correlation-id')).to.be.a('string');
        });
    });
    // Helper functions
    function createMockContext(method, url, additional = {}) {
        const headers = {};
        const mockRequest = {
            method,
            url,
            get: (header) => additional.headers?.[header],
            ip: additional.ip || '127.0.0.1',
            user: additional.user,
            body: additional.body || {},
            ...additional,
        };
        const mockResponse = {
            statusCode: 200,
            headers: headers,
            set: (key, value) => {
                headers[key] = value;
            },
            header: (key) => headers[key],
        };
        return {
            switchToHttp: () => ({
                getRequest: () => mockRequest,
                getResponse: () => mockResponse,
            }),
        };
    }
    function createMockCallHandler(response, delay = 0, shouldError = false) {
        return {
            handle: () => {
                if (shouldError) {
                    return (0, rxjs_1.throwError)(() => response);
                }
                return new Promise(resolve => {
                    setTimeout(() => resolve((0, rxjs_1.of)(response)), delay);
                });
            },
        };
    }
});
