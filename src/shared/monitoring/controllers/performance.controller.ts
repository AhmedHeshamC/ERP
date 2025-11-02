import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../security/guards/jwt-auth.guard';
import { RolesGuard } from '../../security/guards/roles.guard';
import { PerformanceService } from '../performance.service';
import { PerformanceReport } from '../performance.service';

@ApiTags('Performance Monitoring')
@Controller('performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get real-time performance overview' })
  @ApiResponse({ status: 200, description: 'Performance overview retrieved successfully' })
  async getOverview() {
    return {
      success: true,
      data: await this.performanceService.getRealtimeOverview(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('endpoints')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get performance statistics for all endpoints' })
  @ApiResponse({ status: 200, description: 'Endpoint statistics retrieved successfully' })
  async getEndpoints() {
    return {
      success: true,
      data: this.performanceService.getAllEndpointStats(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('endpoints/slowest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get slowest endpoints' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of endpoints to return' })
  @ApiResponse({ status: 200, description: 'Slowest endpoints retrieved successfully' })
  async getSlowestEndpoints(@Query('limit') limit?: number) {
    return {
      success: true,
      data: this.performanceService.getSlowestEndpoints(limit ? parseInt(limit.toString()) : 10),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('endpoints/busiest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get busiest endpoints' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of endpoints to return' })
  @ApiResponse({ status: 200, description: 'Busiest endpoints retrieved successfully' })
  async getBusiestEndpoints(@Query('limit') limit?: number) {
    return {
      success: true,
      data: this.performanceService.getBusiestEndpoints(limit ? parseInt(limit.toString()) : 10),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system-metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved successfully' })
  async getSystemMetrics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return {
      success: true,
      data: this.performanceService.getSystemMetrics(fromDate, toDate),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get performance alerts' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter active alerts only' })
  @ApiResponse({ status: 200, description: 'Performance alerts retrieved successfully' })
  async getAlerts(@Query('active') active?: string) {
    const alerts = active === 'true'
      ? this.performanceService.getActiveAlerts()
      : this.performanceService.getAllAlerts();

    return {
      success: true,
      data: alerts,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate performance report' })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'End date (ISO 8601)' })
  @ApiResponse({ status: 200, description: 'Performance report generated successfully' })
  async generateReport(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const report: PerformanceReport = this.performanceService.generateReport(fromDate, toDate);

    return {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get performance service health check' })
  @ApiResponse({ status: 200, description: 'Performance service health check completed' })
  async getHealthCheck() {
    // Get endpoint stats to check if service is working
    const endpointStats = this.performanceService.getAllEndpointStats();
    const activeAlerts = this.performanceService.getActiveAlerts();
    const overview = await this.performanceService.getRealtimeOverview();

    return {
      success: true,
      data: {
        status: 'healthy',
        metrics: {
          totalEndpoints: endpointStats.length,
          activeAlerts: activeAlerts.length,
          systemHealth: overview.systemHealth.status,
          currentRequests: overview.currentMetrics.requestsPerMinute,
        },
        checks: {
          metricsCollection: true,
          alertSystem: true,
          systemMonitoring: true,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}