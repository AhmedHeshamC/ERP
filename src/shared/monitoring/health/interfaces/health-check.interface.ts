export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: Date;
  duration: number;
  checks: HealthCheck[];
  overallScore: number;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'UNHEALTHY';
  responseTime?: number;
  message?: string;
  details?: any;
  lastChecked: Date;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    connections: number;
    bytesReceived: number;
    bytesSent: number;
  };
}

export interface DatabaseHealthCheck {
  connectionStatus: boolean;
  responseTime: number;
  connectionMetrics?: any;
  error?: string;
}

export interface CacheHealthCheck {
  isConnected: boolean;
  operationsWorking: boolean;
  responseTime: number;
  stats?: any;
  error?: string;
}