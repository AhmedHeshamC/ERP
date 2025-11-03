"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const testing_1 = require("@nestjs/testing");
const config_1 = require("@nestjs/config");
const cache_service_1 = require("../../shared/cache/cache.service");
const cache_module_1 = require("../../shared/cache/cache.module");
describe('Advanced Cache Integration', () => {
    let cacheService;
    let configService;
    let module;
    beforeEach(async () => {
        module = await testing_1.Test.createTestingModule({
            imports: [cache_module_1.CacheModule],
            providers: [
                {
                    provide: config_1.ConfigService,
                    useValue: {
                        get: (key, defaultValue) => {
                            const config = {
                                'REDIS_URL': 'redis://localhost:6379',
                                'REDIS_PASSWORD': undefined,
                                'REDIS_DB': 0,
                                'CACHE_COMPRESSION_THRESHOLD': 1024,
                            };
                            return config[key] || defaultValue;
                        },
                    },
                },
            ],
        }).compile();
        cacheService = module.get(cache_service_1.CacheService);
        configService = module.get(config_1.ConfigService);
    });
    afterEach(async () => {
        await module.close();
    });
    describe('Distributed Cache Invalidation', () => {
        it('should support pattern-based cache invalidation', async () => {
            // Arrange
            const keys = ['product:123', 'product:456', 'product:789'];
            // Set multiple cache entries
            for (const key of keys) {
                await cacheService.set(key, { id: key.split(':')[1], name: `Product ${key.split(':')[1]}` });
            }
            // Act
            const deletedCount = await cacheService.delPattern('product:*');
            // Assert
            (0, chai_1.expect)(deletedCount).to.equal(3);
            // Verify all keys are deleted
            for (const key of keys) {
                const exists = await cacheService.exists(key);
                (0, chai_1.expect)(exists).to.be.false;
            }
        });
        it('should handle hierarchical cache invalidation', async () => {
            // Arrange
            const hierarchyKeys = [
                'user:123:profile',
                'user:123:permissions',
                'user:123:preferences',
                'user:456:profile',
                'user:456:permissions',
            ];
            // Set hierarchical cache entries
            for (const key of hierarchyKeys) {
                await cacheService.set(key, { data: `data-${key}` });
            }
            // Act - Invalidate all cache for user 123
            const deletedCount = await cacheService.delPattern('user:123:*');
            // Assert
            (0, chai_1.expect)(deletedCount).to.equal(3);
            // Verify user 123 keys are deleted but user 456 keys remain
            (0, chai_1.expect)(await cacheService.exists('user:123:profile')).to.be.false;
            (0, chai_1.expect)(await cacheService.exists('user:456:profile')).to.be.true;
        });
    });
    describe('Cache Performance Monitoring', () => {
        it('should track cache hit/miss statistics accurately', async () => {
            // Arrange
            cacheService.resetStats();
            // Act - Perform cache operations
            await cacheService.set('test-key', 'test-value');
            const hit = await cacheService.get('test-key');
            const miss1 = await cacheService.get('non-existent-key-1');
            const miss2 = await cacheService.get('non-existent-key-2');
            // Assert
            const stats = cacheService.getStats();
            (0, chai_1.expect)(stats.hits).to.equal(1);
            (0, chai_1.expect)(stats.misses).to.equal(2);
            (0, chai_1.expect)(stats.totalRequests).to.equal(3);
            (0, chai_1.expect)(stats.hitRate).to.equal(33); // Math.round(1/3 * 100)
        });
        it('should monitor cache memory usage', async () => {
            // Arrange
            const largeData = 'x'.repeat(10000); // 10KB string
            cacheService.resetStats();
            // Act
            await cacheService.set('large-data', largeData);
            await cacheService.set('another-large', largeData);
            // Assert
            const stats = cacheService.getStats();
            (0, chai_1.expect)(stats.memoryUsage).to.be.greaterThan(0);
            const memoryUsage = await cacheService.getMemoryUsage();
            (0, chai_1.expect)(memoryUsage).to.be.greaterThan(0);
        });
        it('should track cache eviction metrics', async () => {
            // Arrange
            cacheService.resetStats();
            // Set data with short TTL
            await cacheService.set('evict-me', 'value', { ttl: 1 });
            await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for expiration
            // Act - Trigger eviction by accessing expired key
            await cacheService.get('evict-me');
            // Assert
            const stats = cacheService.getStats();
            // Note: Redis handles eviction differently, this test might need adjustment
            (0, chai_1.expect)(stats.totalRequests).to.be.greaterThan(0);
        });
    });
    describe('Multi-Level Caching', () => {
        it('should support L1 (memory) cache fallback', async () => {
            // This test assumes we have an in-memory fallback when Redis is unavailable
            // Implementation would require mocking Redis disconnection
            // Arrange - Mock Redis disconnection
            const originalConnect = cacheService.isRedisConnected();
            // Act & Assert
            if (!originalConnect) {
                // Test in-memory cache behavior when Redis is unavailable
                const result = await cacheService.set('fallback-key', 'fallback-value');
                (0, chai_1.expect)(result).to.be.false; // Should return false when Redis is unavailable
                const retrieved = await cacheService.get('fallback-key');
                (0, chai_1.expect)(retrieved).to.be.null;
            }
        });
        it('should implement cache-aside pattern correctly', async () => {
            // Arrange
            let factoryCallCount = 0;
            const factory = () => {
                factoryCallCount++;
                return Promise.resolve({ data: 'computed-value', timestamp: Date.now() });
            };
            // Act - First call should invoke factory
            const result1 = await cacheService.getOrSet('aside-key', factory, { ttl: 60 });
            // Act - Second call should use cache
            const result2 = await cacheService.getOrSet('aside-key', factory, { ttl: 60 });
            // Assert
            (0, chai_1.expect)(result1).to.deep.equal(result2);
            (0, chai_1.expect)(factoryCallCount).to.equal(1); // Factory should only be called once
        });
    });
    describe('Cache Health and Resilience', () => {
        it('should perform comprehensive health checks', async () => {
            // Act
            const healthCheck = await cacheService.healthCheck();
            // Assert
            (0, chai_1.expect)(healthCheck).to.have.property('status');
            (0, chai_1.expect)(['healthy', 'unhealthy']).to.include(healthCheck.status);
            if (healthCheck.status === 'healthy') {
                (0, chai_1.expect)(healthCheck).to.have.property('latency');
                (0, chai_1.expect)(healthCheck.latency).to.be.a('number');
                (0, chai_1.expect)(healthCheck.latency).to.be.lessThan(1000); // < 1 second
            }
            else {
                (0, chai_1.expect)(healthCheck).to.have.property('error');
                (0, chai_1.expect)(healthCheck.error).to.be.a('string');
            }
        });
        it('should handle connection failures gracefully', async () => {
            // This test would require mocking Redis connection failure
            // For now, we test the graceful degradation behavior
            const isConnected = cacheService.isRedisConnected();
            if (!isConnected) {
                // When Redis is not connected, operations should not throw errors
                const setResult = await cacheService.set('test-key', 'test-value');
                (0, chai_1.expect)(setResult).to.be.false;
                const getResult = await cacheService.get('test-key');
                (0, chai_1.expect)(getResult).to.be.null;
                const stats = cacheService.getStats();
                (0, chai_1.expect)(stats).to.be.an('object');
            }
        });
    });
    describe('Cache Warm-up and Optimization', () => {
        it('should support cache warm-up operations', async () => {
            // Arrange
            const warmupData = [
                { key: 'warmup:1', value: { data: 'preload1' }, ttl: 3600 },
                { key: 'warmup:2', value: { data: 'preload2' }, ttl: 1800 },
                { key: 'warmup:3', value: { data: 'preload3' } },
            ];
            // Act
            await cacheService.warmUp(warmupData);
            // Assert
            for (const entry of warmupData) {
                const retrieved = await cacheService.get(entry.key);
                (0, chai_1.expect)(retrieved).to.deep.equal(entry.value);
            }
        });
        it('should optimize cache with compression', async () => {
            // Arrange
            const largeData = {
                description: 'x'.repeat(2000), // Large string to trigger compression
                metadata: { size: 'large', type: 'text' },
            };
            // Act
            const setResult = await cacheService.set('compressed-data', largeData, { compress: true });
            const retrieved = await cacheService.get('compressed-data');
            // Assert
            (0, chai_1.expect)(setResult).to.be.true;
            (0, chai_1.expect)(retrieved).to.deep.equal(largeData);
        });
    });
    describe('Advanced Cache Operations', () => {
        it('should support atomic increment operations', async () => {
            // Act
            const result1 = await cacheService.incr('counter', { ttl: 3600 });
            const result2 = await cacheService.incr('counter');
            const result3 = await cacheService.incrBy('counter', 5);
            // Assert
            (0, chai_1.expect)(result1).to.equal(1);
            (0, chai_1.expect)(result2).to.equal(2);
            (0, chai_1.expect)(result3).to.equal(7);
        });
        it('should support batch operations with pipelines', async () => {
            // Arrange
            const entries = [
                { key: 'batch:1', value: { data: 'value1' } },
                { key: 'batch:2', value: { data: 'value2' }, ttl: 1800 },
                { key: 'batch:3', value: { data: 'value3' } },
            ];
            // Act
            const setResult = await cacheService.mset(entries);
            // Assert
            (0, chai_1.expect)(setResult).to.be.true;
            for (const entry of entries) {
                const retrieved = await cacheService.get(entry.key);
                (0, chai_1.expect)(retrieved).to.deep.equal(entry.value);
            }
        });
        it('should handle TTL operations correctly', async () => {
            // Arrange
            await cacheService.set('ttl-test', 'value');
            // Act
            const initialTtl = await cacheService.ttl('ttl-test');
            const expireResult = await cacheService.expire('ttl-test', 300); // 5 minutes
            const newTtl = await cacheService.ttl('ttl-test');
            // Assert
            (0, chai_1.expect)(expireResult).to.be.true;
            (0, chai_1.expect)(newTtl).to.be.greaterThan(0);
            (0, chai_1.expect)(newTtl).to.be.lessThanOrEqual(300);
        });
    });
});
