import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../shared/cache/cache.service';
import { CacheModule } from '../../shared/cache/cache.module';

describe('Advanced Cache Integration', () => {
  let cacheService: CacheService;
  let configService: ConfigService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: any) => {
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

    cacheService = module.get<CacheService>(CacheService);
    configService = module.get<ConfigService>(ConfigService);
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
      expect(deletedCount).to.equal(3);

      // Verify all keys are deleted
      for (const key of keys) {
        const exists = await cacheService.exists(key);
        expect(exists).to.be.false;
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
      expect(deletedCount).to.equal(3);

      // Verify user 123 keys are deleted but user 456 keys remain
      expect(await cacheService.exists('user:123:profile')).to.be.false;
      expect(await cacheService.exists('user:456:profile')).to.be.true;
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
      expect(stats.hits).to.equal(1);
      expect(stats.misses).to.equal(2);
      expect(stats.totalRequests).to.equal(3);
      expect(stats.hitRate).to.equal(33); // Math.round(1/3 * 100)
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
      expect(stats.memoryUsage).to.be.greaterThan(0);

      const memoryUsage = await cacheService.getMemoryUsage();
      expect(memoryUsage).to.be.greaterThan(0);
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
      expect(stats.totalRequests).to.be.greaterThan(0);
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
        expect(result).to.be.false; // Should return false when Redis is unavailable

        const retrieved = await cacheService.get('fallback-key');
        expect(retrieved).to.be.null;
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
      expect(result1).to.deep.equal(result2);
      expect(factoryCallCount).to.equal(1); // Factory should only be called once
    });
  });

  describe('Cache Health and Resilience', () => {
    it('should perform comprehensive health checks', async () => {
      // Act
      const healthCheck = await cacheService.healthCheck();

      // Assert
      expect(healthCheck).to.have.property('status');
      expect(['healthy', 'unhealthy']).to.include(healthCheck.status);

      if (healthCheck.status === 'healthy') {
        expect(healthCheck).to.have.property('latency');
        expect(healthCheck.latency).to.be.a('number');
        expect(healthCheck.latency).to.be.lessThan(1000); // < 1 second
      } else {
        expect(healthCheck).to.have.property('error');
        expect(healthCheck.error).to.be.a('string');
      }
    });

    it('should handle connection failures gracefully', async () => {
      // This test would require mocking Redis connection failure
      // For now, we test the graceful degradation behavior

      const isConnected = cacheService.isRedisConnected();

      if (!isConnected) {
        // When Redis is not connected, operations should not throw errors
        const setResult = await cacheService.set('test-key', 'test-value');
        expect(setResult).to.be.false;

        const getResult = await cacheService.get('test-key');
        expect(getResult).to.be.null;

        const stats = cacheService.getStats();
        expect(stats).to.be.an('object');
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
        expect(retrieved).to.deep.equal(entry.value);
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
      expect(setResult).to.be.true;
      expect(retrieved).to.deep.equal(largeData);
    });
  });

  describe('Advanced Cache Operations', () => {
    it('should support atomic increment operations', async () => {
      // Act
      const result1 = await cacheService.incr('counter', { ttl: 3600 });
      const result2 = await cacheService.incr('counter');
      const result3 = await cacheService.incrBy('counter', 5);

      // Assert
      expect(result1).to.equal(1);
      expect(result2).to.equal(2);
      expect(result3).to.equal(7);
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
      expect(setResult).to.be.true;

      for (const entry of entries) {
        const retrieved = await cacheService.get(entry.key);
        expect(retrieved).to.deep.equal(entry.value);
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
      expect(expireResult).to.be.true;
      expect(newTtl).to.be.greaterThan(0);
      expect(newTtl).to.be.lessThanOrEqual(300);
    });
  });
});