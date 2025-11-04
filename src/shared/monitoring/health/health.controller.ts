import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/guards/roles.guard';
import { HealthService } from './health.service';
import { HealthCheckResult } from './interfaces/health-check.interface';

@ApiTags('Health Monitoring')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Basic health check - responds within 100ms',
    description: 'Lightweight health check for load balancers and monitoring systems'
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number' },
      }
    }
  })
  async basicHealthCheck(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    timestamp: Date;
    uptime: number;
  }> {
    const startTime = Date.now();

    try {
      // Quick basic checks - must complete within 100ms
      const lastCheck = this.healthService.getLastHealthCheck();
      const uptime = Date.now() - process.uptime() * 1000;

      // If we have a recent health check (within last 30 seconds), use it
      if (lastCheck && (Date.now() - lastCheck.timestamp.getTime()) < 30000) {
        return {
          status: lastCheck.status,
          timestamp: lastCheck.timestamp,
          uptime,
        };
      }

      // Otherwise, do a minimal health check
      const systemMetrics = this.healthService.getSystemMetrics();

      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';

      if (systemMetrics.memory.percentage > 90) {
        status = 'UNHEALTHY';
      } else if (systemMetrics.memory.percentage > 75) {
        status = 'DEGRADED';
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Basic health check completed in ${duration}ms`);

      return {
        status,
        timestamp: new Date(),
        uptime,
      };
    } catch (error) {
      this.logger.error('Basic health check failed:', error);
      return {
        status: 'UNHEALTHY',
        timestamp: new Date(),
        uptime: Date.now() - process.uptime() * 1000,
      };
    }
  }

  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comprehensive health check with detailed metrics',
    description: 'Full system health check including all services and components'
  })
  @ApiResponse({ status: 200, description: 'Detailed health information retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async detailedHealthCheck(): Promise<HealthCheckResult> {
    this.logger.log('Detailed health check requested');

    try {
      const result = await this.healthService.performHealthCheck();
      return result;
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      throw error;
    }
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe - checks if service is ready to accept traffic',
    description: 'Kubernetes readiness probe endpoint'
  })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async readinessCheck(): Promise<{
    status: 'READY' | 'NOT_READY';
    timestamp: Date;
    checks: Array<{ name: string; ready: boolean; message?: string }>;
  }> {
    const startTime = Date.now();

    try {
      const checks = [];

      // Check database
      const dbHealthy = await this.healthService.checkDatabase();
      checks.push({
        name: 'database',
        ready: dbHealthy.status === 'UP',
        message: dbHealthy.message,
      });

      // Check cache
      const cacheHealthy = await this.healthService.checkCache();
      checks.push({
        name: 'cache',
        ready: ['UP', 'DEGRADED'].includes(cacheHealthy.status),
        message: cacheHealthy.message,
      });

      const allReady = checks.every(check => check.ready);
      const duration = Date.now() - startTime;

      this.logger.debug(`Readiness check completed in ${duration}ms: ${allReady ? 'READY' : 'NOT_READY'}`);

      if (allReady) {
        return {
          status: 'READY',
          timestamp: new Date(),
          checks,
        };
      } else {
        return {
          status: 'NOT_READY',
          timestamp: new Date(),
          checks,
        };
      }
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      return {
        status: 'NOT_READY',
        timestamp: new Date(),
        checks: [{
          name: 'readiness_check',
          ready: false,
          message: `Readiness check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
      };
    }
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe - checks if service is alive',
    description: 'Kubernetes liveness probe endpoint'
  })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  @ApiResponse({ status: 503, description: 'Service is not alive' })
  async livenessCheck(): Promise<{
    status: 'ALIVE' | 'NOT_ALIVE';
    timestamp: Date;
    uptime: number;
  }> {
    try {
      // Simple liveness check - is the process responsive?
      const uptime = process.uptime() * 1000; // Convert to milliseconds

      return {
        status: 'ALIVE',
        timestamp: new Date(),
        uptime,
      };
    } catch (error) {
      this.logger.error('Liveness check failed:', error);
      return {
        status: 'NOT_ALIVE',
        timestamp: new Date(),
        uptime: process.uptime() * 1000,
      };
    }
  }

  @Get('database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check database health' })
  @ApiResponse({ status: 200, description: 'Database health status retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async databaseHealth() {
    this.logger.log('Database health check requested');

    try {
      const result = await this.healthService.checkDatabase();
      return result;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      throw error;
    }
  }

  @Get('cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check cache health' })
  @ApiResponse({ status: 200, description: 'Cache health status retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async cacheHealth() {
    this.logger.log('Cache health check requested');

    try {
      const result = await this.healthService.checkCache();
      return result;
    } catch (error) {
      this.logger.error('Cache health check failed:', error);
      throw error;
    }
  }

  @Get('system')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check system resources health' })
  @ApiResponse({ status: 200, description: 'System resources health status retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async systemHealth() {
    this.logger.log('System health check requested');

    try {
      const result = await this.healthService.checkSystemResources();
      return result;
    } catch (error) {
      this.logger.error('System health check failed:', error);
      throw error;
    }
  }

  @Get('business')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check business logic health' })
  @ApiResponse({ status: 200, description: 'Business logic health status retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async businessHealth() {
    this.logger.log('Business health check requested');

    try {
      const results = await this.healthService.checkBusinessLogic();
      return {
        status: results.every(r => r.status === 'UP') ? 'HEALTHY' :
              results.some(r => r.status === 'DOWN') ? 'UNHEALTHY' : 'DEGRADED',
        timestamp: new Date(),
        checks: results,
      };
    } catch (error) {
      this.logger.error('Business health check failed:', error);
      throw error;
    }
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get health check history' })
  @ApiResponse({ status: 200, description: 'Health check history retrieved successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getHealthHistory(@Query('hours') hours?: number) {
    this.logger.log(`Health history requested for ${hours || 24} hours`);

    try {
      const history = await this.healthService.getHealthHistory(hours ? parseInt(hours.toString()) : 24);
      return {
        history,
        count: history.length,
        period: `${hours || 24} hours`,
      };
    } catch (error) {
      this.logger.error('Failed to get health history:', error);
      throw error;
    }
  }

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger immediate health check' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async triggerHealthCheck() {
    this.logger.log('Manual health check triggered');

    try {
      const result = await this.healthService.performHealthCheck();
      return {
        message: 'Health check completed successfully',
        result,
      };
    } catch (error) {
      this.logger.error('Manual health check failed:', error);
      throw error;
    }
  }
}