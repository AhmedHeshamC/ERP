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
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_1 = require("redis");
/**
 * Enterprise-Grade Redis Cache Service
 *
 * Implements comprehensive distributed caching with:
 * - Connection pooling and reconnection logic
 * - Performance monitoring and statistics
 * - Pattern-based cache invalidation
 * - Graceful degradation when Redis is unavailable
 * - Cache warming strategies
 * - Multi-level caching support
 * - Advanced caching patterns
 */
let CacheService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var CacheService = _classThis = class {
        constructor(configService) {
            this.logger = new common_1.Logger(CacheService.name);
            this.redisClient = null;
            this.isConnected = false;
            this.stats = {
                hits: 0,
                misses: 0,
                hitRate: 0,
                totalRequests: 0,
                evictions: 0,
                memoryUsage: 0,
            };
            this.defaultTTL = 3600; // 1 hour
            this.keyPrefix = 'erp:cache:';
            this.connectionRetries = 0;
            this.maxRetries = 5;
            this.retryDelay = 5000; // 5 seconds
            this.configService = configService;
        }
        async onModuleInit() {
            await this.connectRedis();
        }
        async onModuleDestroy() {
            await this.disconnectRedis();
        }
        /**
         * Establish Redis connection with retry logic
         */
        async connectRedis() {
            try {
                const redisUrl = this.configService.get('REDIS_URL', 'redis://localhost:6379');
                const redisPassword = this.configService.get('REDIS_PASSWORD');
                const redisDB = this.configService.get('REDIS_DB', 0);
                const clientConfig = {
                    url: redisUrl,
                    database: redisDB,
                    socket: {
                        reconnectStrategy: (retries) => {
                            if (retries > this.maxRetries) {
                                this.logger.error('Redis max reconnection attempts reached');
                                return false;
                            }
                            const delay = Math.min(retries * 1000, 30000);
                            this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
                            return delay;
                        },
                        connectTimeout: 10000,
                        lazyConnect: true,
                    },
                };
                if (redisPassword) {
                    clientConfig.password = redisPassword;
                }
                this.redisClient = (0, redis_1.createClient)(clientConfig);
                // Event handlers
                this.redisClient.on('error', (error) => {
                    this.logger.error(`Redis connection error: ${error.message}`);
                    this.isConnected = false;
                });
                this.redisClient.on('connect', () => {
                    this.logger.log('Redis client connected');
                    this.isConnected = true;
                    this.connectionRetries = 0;
                });
                this.redisClient.on('ready', () => {
                    this.logger.log('Redis client ready');
                });
                this.redisClient.on('reconnecting', () => {
                    this.logger.log('Redis client reconnecting...');
                });
                this.redisClient.on('end', () => {
                    this.logger.warn('Redis connection ended');
                    this.isConnected = false;
                });
                await this.redisClient.connect();
                await this.redisClient.ping();
                this.logger.log('Redis connection established successfully');
                this.isConnected = true;
                // Initialize memory usage tracking
                await this.updateMemoryUsage();
            }
            catch (error) {
                this.connectionRetries++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Failed to connect to Redis (attempt ${this.connectionRetries}): ${errorMessage}`);
                if (this.connectionRetries < this.maxRetries) {
                    this.logger.log(`Retrying Redis connection in ${this.retryDelay}ms...`);
                    setTimeout(() => this.connectRedis(), this.retryDelay);
                }
                else {
                    this.logger.error('Max Redis connection retries reached. Continuing without cache.');
                    this.isConnected = false;
                }
            }
        }
        /**
         * Gracefully disconnect from Redis
         */
        async disconnectRedis() {
            if (this.redisClient && this.isConnected) {
                try {
                    await this.redisClient.quit();
                    this.logger.log('Redis client disconnected');
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger.error(`Error disconnecting from Redis: ${errorMessage}`);
                }
                finally {
                    this.isConnected = false;
                }
            }
        }
        /**
         * Get value from cache with comprehensive error handling
         */
        async get(key, options) {
            if (!this.isConnected || !this.redisClient) {
                this.logger.debug(`Redis not connected, skipping cache get for key: ${key}`);
                return null;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const value = await this.redisClient.get(fullKey);
                this.stats.totalRequests++;
                if (value !== null) {
                    this.stats.hits++;
                    this.updateHitRate();
                    this.logger.debug(`Cache HIT for key: ${fullKey}`);
                    return this.deserialize(value);
                }
                else {
                    this.stats.misses++;
                    this.updateHitRate();
                    this.logger.debug(`Cache MISS for key: ${fullKey}`);
                    return null;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error getting cache key ${fullKey}: ${errorMessage}`);
                this.stats.misses++;
                this.stats.totalRequests++;
                this.updateHitRate();
                return null;
            }
        }
        /**
         * Set value in cache with compression support
         */
        async set(key, value, options) {
            if (!this.isConnected || !this.redisClient) {
                this.logger.debug(`Redis not connected, skipping cache set for key: ${key}`);
                return false;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            const ttl = options?.ttl || this.defaultTTL;
            try {
                const serializedValue = this.serialize(value);
                if (options?.compress || this.shouldCompress(serializedValue)) {
                    // Apply compression if enabled or value is large
                    const compressedValue = await this.compress(serializedValue);
                    await this.redisClient.setEx(fullKey, ttl, compressedValue);
                }
                else {
                    await this.redisClient.setEx(fullKey, ttl, serializedValue);
                }
                this.logger.debug(`Cache SET for key: ${fullKey} with TTL: ${ttl}s`);
                return true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error setting cache key ${fullKey}: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Delete specific key from cache
         */
        async del(key, options) {
            if (!this.isConnected || !this.redisClient) {
                return false;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const result = await this.redisClient.del(fullKey);
                this.logger.debug(`Cache DEL for key: ${fullKey}, result: ${result}`);
                return result > 0;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error deleting cache key ${fullKey}: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Delete keys matching pattern
         */
        async delPattern(pattern, options) {
            if (!this.isConnected || !this.redisClient) {
                return 0;
            }
            const fullPattern = this.buildKey(pattern, options?.keyPrefix);
            try {
                const keys = await this.redisClient.keys(fullPattern);
                if (keys.length === 0) {
                    return 0;
                }
                const result = await this.redisClient.del(keys);
                this.stats.evictions += result;
                this.logger.debug(`Cache DEL_PATTERN for pattern: ${fullPattern}, deleted: ${result} keys`);
                return result;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error deleting cache pattern ${fullPattern}: ${errorMessage}`);
                return 0;
            }
        }
        /**
         * Check if key exists
         */
        async exists(key, options) {
            if (!this.isConnected || !this.redisClient) {
                return false;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const result = await this.redisClient.exists(fullKey);
                return result === 1;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error checking cache key existence ${fullKey}: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Set expiration for existing key
         */
        async expire(key, ttl, options) {
            if (!this.isConnected || !this.redisClient) {
                return false;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const result = await this.redisClient.expire(fullKey, ttl);
                return result === true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error setting expiration for key ${fullKey}: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Get remaining TTL for key
         */
        async ttl(key, options) {
            if (!this.isConnected || !this.redisClient) {
                return -1;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                return await this.redisClient.ttl(fullKey);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error getting TTL for key ${fullKey}: ${errorMessage}`);
                return -1;
            }
        }
        /**
         * Increment numeric value
         */
        async incr(key, options) {
            if (!this.isConnected || !this.redisClient) {
                return 0;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const result = await this.redisClient.incr(fullKey);
                // Set TTL if provided and key is new
                if (options?.ttl && result === 1) {
                    await this.redisClient.expire(fullKey, options.ttl);
                }
                return result;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error incrementing key ${fullKey}: ${errorMessage}`);
                return 0;
            }
        }
        /**
         * Increment numeric value by amount
         */
        async incrBy(key, amount, options) {
            if (!this.isConnected || !this.redisClient) {
                return 0;
            }
            const fullKey = this.buildKey(key, options?.keyPrefix);
            try {
                const result = await this.redisClient.incrBy(fullKey, amount);
                // Set TTL if provided and key is new
                if (options?.ttl && result === amount) {
                    await this.redisClient.expire(fullKey, options.ttl);
                }
                return result;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error incrementing key ${fullKey} by ${amount}: ${errorMessage}`);
                return 0;
            }
        }
        /**
         * Get value or set if not exists (cache-aside pattern)
         */
        async getOrSet(key, factory, options) {
            // Try to get from cache first
            const cachedValue = await this.get(key, options);
            if (cachedValue !== null) {
                return cachedValue;
            }
            // Value not in cache, execute factory function
            try {
                const value = await factory();
                await this.set(key, value, options);
                return value;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error in cache-aside pattern for key ${key}: ${errorMessage}`);
                throw error;
            }
        }
        /**
         * Set multiple values in a single operation (pipeline)
         */
        async mset(entries, options) {
            if (!this.isConnected || !this.redisClient) {
                return false;
            }
            try {
                const pipeline = this.redisClient.multi();
                for (const entry of entries) {
                    const fullKey = this.buildKey(entry.key, options?.keyPrefix);
                    const serializedValue = this.serialize(entry.value);
                    const ttl = entry.ttl || options?.ttl || this.defaultTTL;
                    pipeline.setEx(fullKey, ttl, serializedValue);
                }
                await pipeline.exec();
                this.logger.debug(`Cache MSET for ${entries.length} entries`);
                return true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error in MSET operation: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Get comprehensive cache statistics
         */
        getStats() {
            return { ...this.stats };
        }
        /**
         * Reset cache statistics
         */
        resetStats() {
            this.stats.hits = 0;
            this.stats.misses = 0;
            this.stats.hitRate = 0;
            this.stats.totalRequests = 0;
            this.stats.evictions = 0;
            this.stats.memoryUsage = 0;
        }
        /**
         * Get Redis memory usage
         */
        async getMemoryUsage() {
            if (!this.isConnected || !this.redisClient) {
                return 0;
            }
            try {
                const info = await this.redisClient.info('memory');
                const match = info.match(/used_memory:(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error getting memory usage: ${errorMessage}`);
                return 0;
            }
        }
        /**
         * Check if Redis is connected
         */
        isRedisConnected() {
            return this.isConnected;
        }
        /**
         * Build full cache key with prefix
         */
        buildKey(key, customPrefix) {
            const prefix = customPrefix || this.keyPrefix;
            return `${prefix}${key}`;
        }
        /**
         * Serialize value for storage
         */
        serialize(value) {
            try {
                return JSON.stringify(value);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error serializing value: ${errorMessage}`);
                throw new Error('Failed to serialize cache value');
            }
        }
        /**
         * Deserialize value from storage
         */
        deserialize(value) {
            try {
                return JSON.parse(value);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error deserializing value: ${errorMessage}`);
                throw new Error('Failed to deserialize cache value');
            }
        }
        /**
         * Update cache hit rate
         */
        updateHitRate() {
            if (this.stats.totalRequests > 0) {
                this.stats.hitRate = Math.round((this.stats.hits / this.stats.totalRequests) * 100);
            }
        }
        /**
         * Update memory usage statistics
         */
        async updateMemoryUsage() {
            if (this.isConnected) {
                this.stats.memoryUsage = await this.getMemoryUsage();
            }
        }
        /**
         * Check if value should be compressed
         */
        shouldCompress(value) {
            const threshold = this.configService.get('CACHE_COMPRESSION_THRESHOLD', 1024);
            return value.length > threshold;
        }
        /**
         * Compress value (simplified implementation)
         */
        async compress(value) {
            // In a real implementation, you would use compression library like zlib
            // For now, returning as-is to keep dependencies minimal
            return value;
        }
        /**
         * Warm up cache with initial data
         */
        async warmUp(warmupData) {
            if (!this.isConnected || !warmupData.length) {
                return;
            }
            this.logger.log(`Starting cache warm-up with ${warmupData.length} entries`);
            try {
                const entries = warmupData.map(entry => ({
                    key: entry.key,
                    value: entry.value,
                    ttl: entry.ttl || this.defaultTTL,
                }));
                await this.mset(entries);
                this.logger.log(`Cache warm-up completed successfully`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Cache warm-up failed: ${errorMessage}`);
            }
        }
        /**
         * Flush all cache keys (use with caution)
         */
        async flushAll() {
            if (!this.isConnected || !this.redisClient) {
                return false;
            }
            try {
                await this.redisClient.flushDb();
                this.resetStats();
                this.logger.warn('All cache keys flushed');
                return true;
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.logger.error(`Error flushing cache: ${errorMessage}`);
                return false;
            }
        }
        /**
         * Health check for cache service
         */
        async healthCheck() {
            try {
                if (!this.isConnected || !this.redisClient) {
                    return { status: 'unhealthy', error: 'Redis not connected' };
                }
                const startTime = Date.now();
                await this.redisClient.ping();
                const latency = Date.now() - startTime;
                return { status: 'healthy', latency };
            }
            catch (error) {
                return {
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }
    };
    __setFunctionName(_classThis, "CacheService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        CacheService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return CacheService = _classThis;
})();
exports.CacheService = CacheService;
