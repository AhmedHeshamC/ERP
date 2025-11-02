import { performance } from 'perf_hooks';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface LoadTestConfig {
  baseUrl: string;
  endpoints: LoadTestEndpoint[];
  concurrency: number;
  duration: number; // in seconds
  rampUpTime: number; // in seconds
  timeout: number; // in milliseconds
  headers?: Record<string, string>;
}

export interface LoadTestEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  weight?: number; // Weight for endpoint selection (default: 1)
  payload?: any; // For POST/PUT requests
  headers?: Record<string, string>;
  expectedStatus?: number;
}

export interface LoadTestResult {
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    duration: number;
    requestsPerSecond: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50ResponseTime: number;
    p90ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  };
  endpoints: {
    [path: string]: {
      requests: number;
      successful: number;
      failed: number;
      averageResponseTime: number;
      minResponseTime: number;
      maxResponseTime: number;
      responseTimes: number[];
      errors: Array<{ status: number; message: string; count: number }>;
    };
  };
  timeline: Array<{
    timestamp: number;
    requests: number;
    errors: number;
    averageResponseTime: number;
  }>;
  errors: Array<{
    endpoint: string;
    error: string;
    count: number;
  }>;
}

/**
 * Comprehensive Load Testing Framework
 *
 * Implements enterprise-grade load testing with:
 * - Concurrent request execution
 * - Weighted endpoint selection
 * - Response time analysis
 * - Error tracking and categorization
 * - Timeline-based performance monitoring
 * - Statistical analysis (percentiles)
 * - Real-time progress reporting
 */
export class LoadTester {
  private config: LoadTestConfig;
  private isRunning = false;
  private results: LoadTestResult;
  private activeRequests = 0;
  private startTime = 0;
  private endTime = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
    this.initializeResults();
  }

  /**
   * Execute the load test
   */
  async run(): Promise<LoadTestResult> {
    if (this.isRunning) {
      throw new Error('Load test is already running');
    }

    this.isRunning = true;
    this.startTime = performance.now();
    this.initializeResults();

    console.log(`Starting load test for ${this.config.duration}s with ${this.config.concurrency} concurrent users`);
    console.log(`Target: ${this.config.baseUrl}`);
    console.log(`Endpoints: ${this.config.endpoints.map(e => e.path).join(', ')}`);

    try {
      // Start concurrent workers
      const workers: Promise<void>[] = [];
      for (let i = 0; i < this.config.concurrency; i++) {
        workers.push(this.runWorker(i, this.config.rampUpTime * 1000 / this.config.concurrency * i));
      }

      // Start timeline monitoring
      const timelineMonitor = this.startTimelineMonitoring();

      // Wait for all workers to complete
      await Promise.all(workers);

      // Stop timeline monitoring
      clearInterval(timelineMonitor);
      this.endTime = performance.now();

      // Calculate final results
      this.calculateFinalResults();

      this.isRunning = false;
      console.log('Load test completed');

      return this.results;

    } catch (error) {
      this.isRunning = false;
      console.error('Load test failed:', error);
      throw error;
    }
  }

  /**
   * Initialize results structure
   */
  private initializeResults(): void {
    this.results = {
      summary: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        duration: 0,
        requestsPerSecond: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
      },
      endpoints: {},
      timeline: [],
      errors: [],
    };

    // Initialize endpoint results
    for (const endpoint of this.config.endpoints) {
      this.results.endpoints[endpoint.path] = {
        requests: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        responseTimes: [],
        errors: [],
      };
    }
  }

  /**
   * Run a single worker
   */
  private async runWorker(workerId: number, delay: number): Promise<void> {
    // Wait for ramp-up delay
    if (delay > 0) {
      await this.sleep(delay);
    }

    const endTime = this.startTime + (this.config.duration * 1000);
    let requestCount = 0;

    while (performance.now() < endTime && this.isRunning) {
      try {
        // Select endpoint based on weights
        const endpoint = this.selectEndpoint();
        await this.makeRequest(endpoint, workerId, requestCount);
        requestCount++;
      } catch (error) {
        console.error(`Worker ${workerId} error:`, error);
      }
    }

    console.log(`Worker ${workerId} completed ${requestCount} requests`);
  }

  /**
   * Select an endpoint based on weights
   */
  private selectEndpoint(): LoadTestEndpoint {
    const totalWeight = this.config.endpoints.reduce((sum, e) => sum + (e.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of this.config.endpoints) {
      random -= (endpoint.weight || 1);
      if (random <= 0) {
        return endpoint;
      }
    }

    return this.config.endpoints[0]; // Fallback
  }

  /**
   * Make an HTTP request
   */
  private async makeRequest(endpoint: LoadTestEndpoint, workerId: number, requestId: number): Promise<void> {
    const startTime = performance.now();
    this.activeRequests++;

    try {
      const url = new URL(endpoint.path, this.config.baseUrl);
      const method = endpoint.method;
      const headers = {
        ...this.config.headers,
        ...endpoint.headers,
        'Content-Type': 'application/json',
        'User-Agent': `LoadTester/${workerId}/${requestId}`,
      };

      const payload = endpoint.payload ? JSON.stringify(endpoint.payload) : undefined;

      const response = await this.makeHttpRequest(url, method, headers, payload);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.recordRequest(endpoint.path, response.status || 0, responseTime, response.error);

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      this.recordRequest(endpoint.path, 0, responseTime, error.message);
    } finally {
      this.activeRequests--;
    }
  }

  /**
   * Make HTTP request using Node.js http/https modules
   */
  private makeHttpRequest(
    url: URL,
    method: string,
    headers: Record<string, string>,
    payload?: string
  ): Promise<{ status?: number; error?: string }> {
    return new Promise((resolve) => {
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      const timeout = this.config.timeout || 30000;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        timeout,
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode });
        });
      });

      req.on('error', (error) => {
        resolve({ error: error.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'Request timeout' });
      });

      if (payload) {
        req.write(payload);
      }

      req.end();
    });
  }

  /**
   * Record request results
   */
  private recordRequest(path: string, status: number, responseTime: number, error?: string): void {
    const endpoint = this.results.endpoints[path];
    if (!endpoint) return;

    endpoint.requests++;
    endpoint.responseTimes.push(responseTime);
    endpoint.minResponseTime = Math.min(endpoint.minResponseTime, responseTime);
    endpoint.maxResponseTime = Math.max(endpoint.maxResponseTime, responseTime);

    if (status >= 200 && status < 300) {
      endpoint.successful++;
      this.results.summary.successfulRequests++;
    } else {
      endpoint.failed++;
      this.results.summary.failedRequests++;

      // Track errors
      const errorMessage = error || `HTTP ${status}`;
      const existingError = endpoint.errors.find(e => e.status === status && e.message === errorMessage);
      if (existingError) {
        existingError.count++;
      } else {
        endpoint.errors.push({ status, message: errorMessage, count: 1 });
      }

      // Track global errors
      const globalError = this.results.errors.find(e => e.endpoint === path && e.error === errorMessage);
      if (globalError) {
        globalError.count++;
      } else {
        this.results.errors.push({ endpoint: path, error: errorMessage, count: 1 });
      }
    }

    this.results.summary.totalRequests++;
    this.results.summary.minResponseTime = Math.min(this.results.summary.minResponseTime, responseTime);
    this.results.summary.maxResponseTime = Math.max(this.results.summary.maxResponseTime, responseTime);
  }

  /**
   * Start timeline monitoring
   */
  private startTimelineMonitoring(): NodeJS.Timeout {
    return setInterval(() => {
      const now = performance.now();
      const duration = (now - this.startTime) / 1000;

      // Calculate current RPS and average response time
      let recentRequests = 0;
      let totalResponseTime = 0;
      let recentCount = 0;

      const oneSecondAgo = now - 1000;
      for (const endpoint of Object.values(this.results.endpoints)) {
        for (let i = endpoint.responseTimes.length - 1; i >= 0; i--) {
          // Note: In a real implementation, you'd need to track timestamps for each request
          recentCount++;
          totalResponseTime += endpoint.responseTimes[i];
        }
        recentRequests += endpoint.requests;
      }

      this.results.timeline.push({
        timestamp: Math.floor(duration),
        requests: recentRequests,
        errors: this.results.summary.failedRequests,
        averageResponseTime: recentCount > 0 ? totalResponseTime / recentCount : 0,
      });

      // Progress reporting
      if (Math.floor(duration) % 10 === 0) {
        const progress = (duration / this.config.duration) * 100;
        console.log(`Progress: ${progress.toFixed(1)}% - Requests: ${this.results.summary.totalRequests} - Active: ${this.activeRequests}`);
      }
    }, 1000);
  }

  /**
   * Calculate final results and statistics
   */
  private calculateFinalResults(): void {
    const allResponseTimes: number[] = [];
    let totalResponseTime = 0;

    // Collect all response times
    for (const endpoint of Object.values(this.results.endpoints)) {
      endpoint.averageResponseTime = endpoint.responseTimes.length > 0
        ? endpoint.responseTimes.reduce((sum, time) => sum + time, 0) / endpoint.responseTimes.length
        : 0;

      allResponseTimes.push(...endpoint.responseTimes);
      totalResponseTime += endpoint.responseTimes.reduce((sum, time) => sum + time, 0);
    }

    // Calculate summary statistics
    this.results.summary.duration = (this.endTime - this.startTime) / 1000;
    this.results.summary.requestsPerSecond = this.results.summary.totalRequests / this.results.summary.duration;
    this.results.summary.averageResponseTime = this.results.summary.totalRequests > 0
      ? totalResponseTime / this.results.summary.totalRequests
      : 0;
    this.results.summary.errorRate = this.results.summary.totalRequests > 0
      ? (this.results.summary.failedRequests / this.results.summary.totalRequests) * 100
      : 0;

    // Calculate percentiles
    if (allResponseTimes.length > 0) {
      allResponseTimes.sort((a, b) => a - b);
      this.results.summary.p50ResponseTime = this.calculatePercentile(allResponseTimes, 50);
      this.results.summary.p90ResponseTime = this.calculatePercentile(allResponseTimes, 90);
      this.results.summary.p95ResponseTime = this.calculatePercentile(allResponseTimes, 95);
      this.results.summary.p99ResponseTime = this.calculatePercentile(allResponseTimes, 99);
    }

    // Clean up response time arrays to save memory
    for (const endpoint of Object.values(this.results.endpoints)) {
      endpoint.responseTimes = [];
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print results summary
   */
  printResults(): void {
    console.log('\n=== LOAD TEST RESULTS ===');
    console.log(`Duration: ${this.results.summary.duration.toFixed(2)}s`);
    console.log(`Total Requests: ${this.results.summary.totalRequests}`);
    console.log(`Successful: ${this.results.summary.successfulRequests}`);
    console.log(`Failed: ${this.results.summary.failedRequests}`);
    console.log(`Requests/sec: ${this.results.summary.requestsPerSecond.toFixed(2)}`);
    console.log(`Error Rate: ${this.results.summary.errorRate.toFixed(2)}%`);
    console.log(`Average Response Time: ${this.results.summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`Min Response Time: ${this.results.summary.minResponseTime.toFixed(2)}ms`);
    console.log(`Max Response Time: ${this.results.summary.maxResponseTime.toFixed(2)}ms`);
    console.log(`50th Percentile: ${this.results.summary.p50ResponseTime.toFixed(2)}ms`);
    console.log(`90th Percentile: ${this.results.summary.p90ResponseTime.toFixed(2)}ms`);
    console.log(`95th Percentile: ${this.results.summary.p95ResponseTime.toFixed(2)}ms`);
    console.log(`99th Percentile: ${this.results.summary.p99ResponseTime.toFixed(2)}ms`);

    console.log('\n=== ENDPOINT BREAKDOWN ===');
    for (const [path, stats] of Object.entries(this.results.endpoints)) {
      console.log(`${path}:`);
      console.log(`  Requests: ${stats.requests}`);
      console.log(`  Success Rate: ${((stats.successful / stats.requests) * 100).toFixed(2)}%`);
      console.log(`  Avg Response Time: ${stats.averageResponseTime.toFixed(2)}ms`);
      console.log(`  Min/Max: ${stats.minResponseTime.toFixed(2)}ms / ${stats.maxResponseTime.toFixed(2)}ms`);

      if (stats.errors.length > 0) {
        console.log(`  Errors:`);
        for (const error of stats.errors) {
          console.log(`    ${error.message} (${error.count} times)`);
        }
      }
    }

    if (this.results.errors.length > 0) {
      console.log('\n=== TOP ERRORS ===');
      const topErrors = this.results.errors
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      for (const error of topErrors) {
        console.log(`${error.endpoint}: ${error.error} (${error.count} times)`);
      }
    }
  }
}

/**
 * Example usage and test configurations
 */
export const SAMPLE_CONFIGS = {
  // Basic load test
  basic: {
    baseUrl: 'http://localhost:3000',
    endpoints: [
      { path: '/api/health', method: 'GET' as const, weight: 1 },
      { path: '/api/users', method: 'GET' as const, weight: 2 },
      { path: '/api/employees', method: 'GET' as const, weight: 2 },
    ],
    concurrency: 10,
    duration: 60,
    rampUpTime: 10,
    timeout: 30000,
  } as LoadTestConfig,

  // API stress test
  apiStress: {
    baseUrl: 'http://localhost:3000',
    endpoints: [
      { path: '/api/users', method: 'GET' as const, weight: 3 },
      { path: '/api/customers', method: 'GET' as const, weight: 3 },
      { path: '/api/products', method: 'GET' as const, weight: 3 },
      { path: '/api/performance/overview', method: 'GET' as const, weight: 1 },
    ],
    concurrency: 50,
    duration: 300,
    rampUpTime: 30,
    timeout: 30000,
  } as LoadTestConfig,

  // Write-heavy test
  writeHeavy: {
    baseUrl: 'http://localhost:3000',
    endpoints: [
      { path: '/api/employees', method: 'POST' as const, weight: 2, payload: { name: 'Test Employee' } },
      { path: '/api/customers', method: 'POST' as const, weight: 2, payload: { name: 'Test Customer' } },
      { path: '/api/users', method: 'GET' as const, weight: 1 },
    ],
    concurrency: 20,
    duration: 120,
    rampUpTime: 15,
    timeout: 30000,
  } as LoadTestConfig,
};

/**
 * Quick test runner
 */
export async function runQuickTest(config: LoadTestConfig): Promise<void> {
  const tester = new LoadTester(config);
  try {
    const results = await tester.run();
    tester.printResults();
    return results;
  } catch (error) {
    console.error('Load test failed:', error);
    throw error;
  }
}