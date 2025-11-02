import { registerAs } from '@nestjs/config';

export interface PerformanceConfig {
  redis: {
    url: string;
    password?: string;
    db: number;
    maxRetries: number;
    retryDelay: number;
    connectTimeout: number;
    compressionThreshold: number;
  };
  cache: {
    defaultTTL: number;
    keyPrefix: string;
    maxSize: number;
    cleanupInterval: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
      cpuUsage: number;
      activeConnections: number;
    };
  };
  jobs: {
    maxConcurrency: number;
    retryDelay: number;
    maxAttempts: number;
    cleanupInterval: number;
  };
  api: {
    compression: boolean;
    rateLimiting: boolean;
    maxRequestSize: string;
    timeout: number;
  };
  database: {
    connectionPool: {
      min: number;
      max: number;
      idleTimeoutMillis: number;
      acquireTimeoutMillis: number;
    };
    queryTimeout: number;
    slowQueryThreshold: number;
  };
}

export default registerAs('performance', (): PerformanceConfig => ({
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '5', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '5000', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    compressionThreshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024', 10),
  },
  cache: {
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '3600', 10),
    keyPrefix: process.env.CACHE_KEY_PREFIX || 'erp:cache:',
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '10000', 10),
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '300000', 10),
  },
  monitoring: {
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
    metricsInterval: parseInt(process.env.PERFORMANCE_METRICS_INTERVAL || '30000', 10),
    alertThresholds: {
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '1000', 10),
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '5.0'),
      memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '80.0'),
      cpuUsage: parseFloat(process.env.ALERT_CPU_USAGE || '80.0'),
      activeConnections: parseInt(process.env.ALERT_ACTIVE_CONNECTIONS || '1000', 10),
    },
  },
  jobs: {
    maxConcurrency: parseInt(process.env.JOB_MAX_CONCURRENCY || '5', 10),
    retryDelay: parseInt(process.env.JOB_RETRY_DELAY || '5000', 10),
    maxAttempts: parseInt(process.env.JOB_MAX_ATTEMPTS || '3', 10),
    cleanupInterval: parseInt(process.env.JOB_CLEANUP_INTERVAL || '60000', 10),
  },
  api: {
    compression: process.env.API_COMPRESSION !== 'false',
    rateLimiting: process.env.API_RATE_LIMITING !== 'false',
    maxRequestSize: process.env.API_MAX_REQUEST_SIZE || '10mb',
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
  },
  database: {
    connectionPool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10),
    },
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
  },
}));