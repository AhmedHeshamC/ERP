import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AlertService, Alert } from './alert.service';
import { JwtAuthGuard } from '../../security/guards/jwt-auth.guard';
import { RolesGuard } from '../../security/guards/roles.guard';
import { Roles } from '../../security/decorators/roles.decorator';
import {
  CreateAlertDto,
  AlertQueryDto,
  AcknowledgeAlertDto,
  SuppressAlertDto,
  AlertStatisticsDto,
  AlertResponseDto,
  AlertListResponseDto,
  AlertSeverity,
  AlertStatus,
  AlertCategory
} from './dto/alert.dto';

// Helper functions to convert between Alert interface and DTOs
function alertToResponseDto(alert: Alert): AlertResponseDto {
  return {
    ...alert,
    severity: alert.severity as AlertSeverity,
    status: alert.status as AlertStatus,
    category: alert.category as AlertCategory,
    threshold: alert.threshold ? {
      ...alert.threshold,
      severity: alert.threshold.severity as AlertSeverity,
    } : undefined,
  };
}

function alertsToResponseDto(alerts: Alert[]): AlertResponseDto[] {
  return alerts.map(alert => alertToResponseDto(alert));
}

@ApiTags('Alerting')
@Controller('monitoring/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
  private readonly logger = new Logger(AlertController.name);

  constructor(private readonly alertService: AlertService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Get all alerts with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alerts retrieved successfully',
    type: AlertListResponseDto
  })
  async getAlerts(@Query() query: AlertQueryDto): Promise<AlertListResponseDto> {
    this.logger.log(`Getting alerts with filters: ${JSON.stringify(query)}`);

    const filters = {
      severity: query.severity,
      category: query.category,
      source: query.source,
      status: query.status,
      limit: query.limit ? parseInt(query.limit.toString()) : 100,
      offset: query.offset ? parseInt(query.offset.toString()) : 0,
    };

    const result = this.alertService.getAlerts(filters);

    return {
      alerts: alertsToResponseDto(result.alerts),
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Get all active alerts' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active alerts retrieved successfully',
    type: [AlertResponseDto]
  })
  async getActiveAlerts(): Promise<AlertResponseDto[]> {
    this.logger.log('Getting active alerts');
    const alerts = this.alertService.getActiveAlerts();
    return alertsToResponseDto(alerts);
  }

  @Get('statistics')
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiQuery({ name: 'hours', required: false, description: 'Time window in hours (default: 24)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert statistics retrieved successfully',
    type: AlertStatisticsDto
  })
  async getAlertStatistics(@Query('hours') hours?: number): Promise<any> {
    const timeWindow = hours ? parseInt(hours.toString()) : 24;
    this.logger.log(`Getting alert statistics for last ${timeWindow} hours`);

    return this.alertService.getAlertStatistics(timeWindow);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Get alert by ID' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert retrieved successfully',
    type: AlertResponseDto
  })
  async getAlertById(@Param('id') id: string): Promise<AlertResponseDto | null> {
    this.logger.log(`Getting alert by ID: ${id}`);

    const alerts = this.alertService.getAlerts();
    const alert = alerts.alerts.find(a => a.id === id);

    return alert ? alertToResponseDto(alert) : null;
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Create a new alert' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Alert created successfully',
    type: AlertResponseDto
  })
  async createAlert(@Body() createAlertDto: CreateAlertDto): Promise<AlertResponseDto> {
    this.logger.log(`Creating alert: ${createAlertDto.name}`);

    const alert = await this.alertService.createAlert(createAlertDto);
    return alertToResponseDto(alert);
  }

  @Put(':id/resolve')
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert resolved successfully',
    type: AlertResponseDto
  })
  async resolveAlert(
    @Param('id') id: string,
    @Body() resolveDto: { resolvedBy?: string; notes?: string }
  ): Promise<AlertResponseDto | null> {
    this.logger.log(`Resolving alert: ${id} by ${resolveDto.resolvedBy || 'unknown'}`);

    const alert = await this.alertService.resolveAlert(id, resolveDto.resolvedBy, resolveDto.notes);
    return alert ? alertToResponseDto(alert) : null;
  }

  @Put(':id/acknowledge')
  @Roles('ADMIN', 'MANAGER', 'OPS')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert acknowledged successfully',
    type: AlertResponseDto
  })
  async acknowledgeAlert(
    @Param('id') id: string,
    @Body() acknowledgeDto: AcknowledgeAlertDto
  ): Promise<AlertResponseDto | null> {
    this.logger.log(`Acknowledging alert: ${id} by ${acknowledgeDto.acknowledgedBy}`);

    const alert = await this.alertService.acknowledgeAlert(
      id,
      acknowledgeDto.acknowledgedBy,
      acknowledgeDto.notes
    );
    return alert ? alertToResponseDto(alert) : null;
  }

  @Put(':id/suppress')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Suppress an alert for a specified duration' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert suppressed successfully',
    type: AlertResponseDto
  })
  async suppressAlert(
    @Param('id') id: string,
    @Body() suppressDto: SuppressAlertDto
  ): Promise<AlertResponseDto | null> {
    this.logger.log(`Suppressing alert: ${id} for ${suppressDto.duration} minutes`);

    const alert = await this.alertService.suppressAlert(
      id,
      suppressDto.duration,
      suppressDto.reason
    );
    return alert ? alertToResponseDto(alert) : null;
  }

  @Post('check')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Manually trigger alert checks' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert checks completed successfully'
  })
  async triggerAlertChecks(): Promise<{ message: string; timestamp: Date }> {
    this.logger.log('Manually triggering alert checks');

    try {
      await this.alertService.performAlertChecks();
      return {
        message: 'Alert checks completed successfully',
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Alert checks failed:', error);
      throw error;
    }
  }

  @Get('rules')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all alert rules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Alert rules retrieved successfully'
  })
  async getAlertRules(): Promise<any[]> {
    this.logger.log('Getting alert rules');

    // Access private method through service instance
    return (this.alertService as any).alertRules || [];
  }

  @Get('channels')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all notification channels' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Notification channels retrieved successfully'
  })
  async getNotificationChannels(): Promise<any[]> {
    this.logger.log('Getting notification channels');

    // Access private method through service instance
    return (this.alertService as any).notificationChannels || [];
  }
}