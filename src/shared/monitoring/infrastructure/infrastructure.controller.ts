import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { InfrastructureService, InfrastructureSummary, ResourceTrend, InfrastructureAlert } from './infrastructure.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

export interface InfrastructureQueryDto {
  hours?: number;
  limit?: number;
  offset?: number;
}

export interface ResolveAlertDto {
  resolvedBy: string;
  notes?: string;
}

@ApiTags('Infrastructure Monitoring')
@Controller('infrastructure')
export class InfrastructureController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get complete infrastructure summary' })
  @ApiResponse({ status: 200, description: 'Infrastructure summary retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getInfrastructureSummary(): Promise<InfrastructureSummary> {
    return this.infrastructureService.getInfrastructureSummary();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get resource utilization trends' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Hours of history to retrieve (default: 24)' })
  @ApiResponse({ status: 200, description: 'Resource trends retrieved successfully' })
  async getResourceTrends(@Query('hours') hours?: number): Promise<ResourceTrend[]> {
    return this.infrastructureService.getResourceTrends(hours || 24);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get all infrastructure alerts' })
  @ApiResponse({ status: 200, description: 'Infrastructure alerts retrieved successfully' })
  async getInfrastructureAlerts(): Promise<InfrastructureAlert[]> {
    return this.infrastructureService.getInfrastructureAlerts();
  }

  @Get('alerts/active')
  @ApiOperation({ summary: 'Get active infrastructure alerts' })
  @ApiResponse({ status: 200, description: 'Active alerts retrieved successfully' })
  async getActiveAlerts(): Promise<InfrastructureAlert[]> {
    return this.infrastructureService.getActiveAlerts();
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve an infrastructure alert' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() resolveDto: ResolveAlertDto,
  ): Promise<{ success: boolean; message: string }> {
    const success = await this.infrastructureService.resolveAlert(id, resolveDto.resolvedBy);

    if (success) {
      return {
        success: true,
        message: 'Alert resolved successfully',
      };
    } else {
      return {
        success: false,
        message: 'Alert not found or could not be resolved',
      };
    }
  }

  @Get('server')
  @ApiOperation({ summary: 'Get current server metrics' })
  @ApiResponse({ status: 200, description: 'Server metrics retrieved successfully' })
  async getServerMetrics(): Promise<any> {
    // Return the latest server metrics
    const summary = await this.infrastructureService.getInfrastructureSummary();
    return summary.server;
  }

  @Get('database')
  @ApiOperation({ summary: 'Get current database metrics' })
  @ApiResponse({ status: 200, description: 'Database metrics retrieved successfully' })
  async getDatabaseMetrics(): Promise<any> {
    const summary = await this.infrastructureService.getInfrastructureSummary();
    return summary.database;
  }

  @Get('cache')
  @ApiOperation({ summary: 'Get current cache metrics' })
  @ApiResponse({ status: 200, description: 'Cache metrics retrieved successfully' })
  async getCacheMetrics(): Promise<any> {
    const summary = await this.infrastructureService.getInfrastructureSummary();
    return summary.cache;
  }

  @Get('services')
  @ApiOperation({ summary: 'Get service health metrics' })
  @ApiResponse({ status: 200, description: 'Service metrics retrieved successfully' })
  async getServiceMetrics(): Promise<any[]> {
    const summary = await this.infrastructureService.getInfrastructureSummary();
    return summary.services;
  }

  @Get('health-score')
  @ApiOperation({ summary: 'Get overall infrastructure health score' })
  @ApiResponse({ status: 200, description: 'Health score retrieved successfully' })
  async getHealthScore(): Promise<{ score: number; status: string }> {
    const summary = await this.infrastructureService.getInfrastructureSummary();
    return {
      score: summary.healthScore,
      status: summary.overallStatus,
    };
  }
}