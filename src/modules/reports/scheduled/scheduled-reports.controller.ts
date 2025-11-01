import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Logger,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/guards/roles.guard';
import { ScheduledReportsService } from './scheduled-reports.service';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportQueryDto,
  ManualReportTriggerDto,
  CreateDistributionListDto,
  ScheduledReportResponse,
  ScheduledReportQueryResponse,
  ScheduledReportExecutionResponse,
  DistributionListResponse,
  ReportFormat,
  ScheduleType,
  ExecutionStatus,
  DeliveryStatus,
} from './dto/scheduled-reports.dto';

/**
 * Scheduled Reports Controller
 * RESTful API endpoints for scheduled report management
 * Implements OWASP security best practices with validation and authorization
 * Follows SOLID principles with clear separation of concerns
 */
@ApiTags('Scheduled Reports')
@Controller('api/v1/scheduled-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ScheduledReportsController {
  private readonly logger = new Logger(ScheduledReportsController.name);

  constructor(private readonly scheduledReportsService: ScheduledReportsService) {}

  /**
   * Create a new scheduled report
   * OWASP A01: Proper authorization and input validation
   */
  @Post()
  @ApiOperation({ summary: 'Create a new scheduled report' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scheduled report created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report definition not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async createScheduledReport(
    @Body() createScheduledReportDto: CreateScheduledReportDto,
  ): Promise<ScheduledReportResponse> {
    this.logger.log(`Creating scheduled report!: ${createScheduledReportDto.name}`);
    return this.scheduledReportsService.createScheduledReport(createScheduledReportDto);
  }

  /**
   * Get all scheduled reports with filtering, pagination, and sorting
   * OWASP A01: Proper authorization and query validation
   */
  @Get()
  @ApiOperation({ summary: 'Get scheduled reports with filtering and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scheduled reports retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  @ApiQuery({ name: 'reportDefinitionId', required: false, description: 'Filter by report definition ID' })
  @ApiQuery({ name: 'scheduleType', required: false, enum: ScheduleType, description: 'Filter by schedule type' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'nextRunFrom', required: false, description: 'Filter by next run time from' })
  @ApiQuery({ name: 'nextRunTo', required: false, description: 'Filter by next run time to' })
  @ApiQuery({ name: 'skip', required: false, type: Number, description: 'Skip records for pagination' })
  @ApiQuery({ name: 'take', required: false, type: Number, description: 'Take records for pagination' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Sort order' })
  async getScheduledReports(
    @Query() queryDto: ScheduledReportQueryDto,
  ): Promise<ScheduledReportQueryResponse> {
    this.logger.log(`Fetching scheduled reports with query!: ${JSON.stringify(queryDto)}`);
    return this.scheduledReportsService.getScheduledReports(queryDto);
  }

  /**
   * Get a specific scheduled report by ID
   * OWASP A01: Proper authorization and ID validation
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled report by ID' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scheduled report retrieved successfully',
      })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Scheduled report not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getScheduledReportById(
    @Param('id') id: string,
  ): Promise<ScheduledReportResponse | null> {
    this.logger.log(`Fetching scheduled report by ID!: ${id}`);
    return this.scheduledReportsService.getScheduledReportById(id);
  }

  /**
   * Update a scheduled report
   * OWASP A01: Proper authorization and input validation
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update scheduled report' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scheduled report updated successfully',
      })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Scheduled report not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async updateScheduledReport(
    @Param('id') id: string,
    @Body() updateScheduledReportDto: UpdateScheduledReportDto,
  ): Promise<ScheduledReportResponse> {
    this.logger.log(`Updating scheduled report ${id}`);
    return this.scheduledReportsService.updateScheduledReport(id, updateScheduledReportDto);
  }

  /**
   * Trigger manual execution of a scheduled report
   * OWASP A01: Proper authorization and execution validation
   */
  @Post(':id/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual execution of scheduled report' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report execution triggered successfully',
      })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Scheduled report not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid trigger data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async triggerScheduledReport(
    @Param('id') id: string,
    @Body() triggerDto: ManualReportTriggerDto,
  ): Promise<ScheduledReportExecutionResponse> {
    this.logger.log(`Triggering manual execution for scheduled report!: ${id}`);
    return this.scheduledReportsService.triggerScheduledReport(id, triggerDto);
  }

  /**
   * Get execution history for a scheduled report
   * OWASP A01: Proper authorization
   */
  @Get(':id/executions')
  @ApiOperation({ summary: 'Get execution history for scheduled report' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Execution history retrieved successfully',
      })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Scheduled report not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getScheduledReportExecutions(
    @Param('id') id: string,
  ): Promise<ScheduledReportExecutionResponse[]> {
    this.logger.log(`Fetching execution history for scheduled report!: ${id}`);
    return this.scheduledReportsService.getScheduledReportExecutions(id);
  }

  /**
   * Add user to distribution list for a scheduled report
   * OWASP A01: Proper authorization and input validation
   */
  @Post(':id/distribution')
  @ApiOperation({ summary: 'Add user to distribution list' })
  @ApiParam({ name: 'id', description: 'Scheduled report ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User added to distribution list successfully',
      })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Scheduled report or user not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async createDistributionList(
    @Param('id') id: string,
    @Body() distributionDto: CreateDistributionListDto,
  ): Promise<DistributionListResponse> {
    this.logger.log(`Adding user to distribution list for scheduled report!: ${id}`);
    // Ensure the scheduled report ID matches the path parameter
    distributionDto.scheduledReportId = id;
    return this.scheduledReportsService.createDistributionList(distributionDto);
  }

  /**
   * Get dashboard statistics for scheduled reports
   * OWASP A01: Proper authorization
   */
  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get scheduled reports dashboard statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard statistics retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getScheduledReportStats(): Promise<any> {
    this.logger.log('Fetching scheduled reports dashboard statistics');
    // This would be implemented to return comprehensive statistics
    // For now, return a placeholder
    return {
      message: 'Dashboard statistics endpoint ready for implementation',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get common schedule templates
   * OWASP A01: Proper authorization
   */
  @Get('templates/schedules')
  @ApiOperation({ summary: 'Get common schedule templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schedule templates retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getScheduleTemplates(): Promise<any> {
    this.logger.log('Fetching schedule templates');
    return {
      templates: [
        {
          name: 'Daily Business Hours',
          cron: '0 9 * * *',
          description: 'Every day at 9:00 AM',
          scheduleType: ScheduleType.DAILY,
        },
        {
          name: 'Weekly Monday',
          cron: '0 9 * * 1',
          description: 'Every Monday at 9:00 AM',
          scheduleType: ScheduleType.WEEKLY,
        },
        {
          name: 'Monthly First Day',
          cron: '0 9 1 * *',
          description: 'First day of every month at 9:00 AM',
          scheduleType: ScheduleType.MONTHLY,
        },
        {
          name: 'Quarterly Report',
          cron: '0 9 1 */3 *',
          description: 'First day of every quarter at 9:00 AM',
          scheduleType: ScheduleType.QUARTERLY,
        },
        {
          name: 'End of Week',
          cron: '0 17 * * 5',
          description: 'Every Friday at 5:00 PM',
          scheduleType: ScheduleType.WEEKLY,
        },
        {
          name: 'Hourly Status',
          cron: '0 * * * *',
          description: 'Every hour at the top of the hour',
          scheduleType: ScheduleType.CUSTOM,
        },
      ],
    };
  }

  /**
   * Get available report formats
   * OWASP A01: Proper authorization
   */
  @Get('formats')
  @ApiOperation({ summary: 'Get available report formats' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report formats retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getReportFormats(): Promise<any> {
    this.logger.log('Fetching available report formats');
    return {
      formats: Object.values(ReportFormat).map(format => ({
        value: format,
        label: format.charAt(0) + format.slice(1).toLowerCase(),
        description: this.getFormatDescription(format),
      })),
    };
  }

  /**
   * Get available schedule types
   * OWASP A01: Proper authorization
   */
  @Get('schedule-types')
  @ApiOperation({ summary: 'Get available schedule types' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schedule types retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getScheduleTypes(): Promise<any> {
    this.logger.log('Fetching available schedule types');
    return {
      scheduleTypes: Object.values(ScheduleType).map(type => ({
        value: type,
        label: type.charAt(0) + type.slice(1).toLowerCase(),
        description: this.getScheduleTypeDescription(type),
      })),
    };
  }

  /**
   * Get execution status options
   * OWASP A01: Proper authorization
   */
  @Get('execution-statuses')
  @ApiOperation({ summary: 'Get execution status options' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Execution statuses retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getExecutionStatuses(): Promise<any> {
    this.logger.log('Fetching execution status options');
    return {
      statuses: Object.values(ExecutionStatus).map(status => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase(),
        description: this.getExecutionStatusDescription(status),
      })),
    };
  }

  /**
   * Get delivery status options
   * OWASP A01: Proper authorization
   */
  @Get('delivery-statuses')
  @ApiOperation({ summary: 'Get delivery status options' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Delivery statuses retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
  })
  async getDeliveryStatuses(): Promise<any> {
    this.logger.log('Fetching delivery status options');
    return {
      statuses: Object.values(DeliveryStatus).map(status => ({
        value: status,
        label: status.charAt(0) + status.slice(1).toLowerCase(),
        description: this.getDeliveryStatusDescription(status),
      })),
    };
  }

  // Private helper methods
  private getFormatDescription(format: ReportFormat): string {
    const descriptions = {
      [ReportFormat.PDF]: 'Portable Document Format - Best for printing and sharing',
      [ReportFormat.EXCEL]: 'Microsoft Excel - Best for data analysis and calculations',
      [ReportFormat.CSV]: 'Comma-Separated Values - Best for data import and processing',
      [ReportFormat.JSON]: 'JavaScript Object Notation - Best for web applications',
    };
    return descriptions[format] || format;
  }

  private getScheduleTypeDescription(type: ScheduleType): string {
    const descriptions = {
      [ScheduleType.DAILY]: 'Report runs once every day',
      [ScheduleType.WEEKLY]: 'Report runs once every week',
      [ScheduleType.MONTHLY]: 'Report runs once every month',
      [ScheduleType.QUARTERLY]: 'Report runs once every quarter',
      [ScheduleType.YEARLY]: 'Report runs once every year',
      [ScheduleType.CUSTOM]: 'Custom schedule with specific cron expression',
    };
    return descriptions[type] || type;
  }

  private getExecutionStatusDescription(status: ExecutionStatus): string {
    const descriptions = {
      [ExecutionStatus.PENDING]: 'Scheduled but not yet started',
      [ExecutionStatus.RUNNING]: 'Currently being generated',
      [ExecutionStatus.COMPLETED]: 'Successfully generated',
      [ExecutionStatus.FAILED]: 'Generation failed with errors',
      [ExecutionStatus.CANCELLED]: 'Generation was cancelled',
    };
    return descriptions[status] || status;
  }

  private getDeliveryStatusDescription(status: DeliveryStatus): string {
    const descriptions = {
      [DeliveryStatus.PENDING]: 'Waiting to be sent',
      [DeliveryStatus.SENDING]: 'Currently being sent',
      [DeliveryStatus.DELIVERED]: 'Successfully delivered to recipients',
      [DeliveryStatus.FAILED]: 'Delivery failed with errors',
    };
    return descriptions[status] || status;
  }
}