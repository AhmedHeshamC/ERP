import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportQueryDto,
  ScheduleType,
  ExecutionStatus,
  DeliveryStatus,
  ReportFormat,
  CreateDistributionListDto,
  DeliveryMethod,
  ManualReportTriggerDto,
  ScheduledReportResponse,
  ScheduledReportQueryResponse,
  ScheduledReportExecutionResponse,
  DistributionListResponse,
} from './dto/scheduled-reports.dto';


/**
 * Enterprise Scheduled Reports Service
 * Implements SOLID principles with single responsibility for scheduled report management
 * Follows KISS principle with clean, focused implementation
 * Comprehensive scheduled report system with cron-like functionality
 * OWASP security compliance with input validation and audit trails
 */
@Injectable()
export class ScheduledReportsService {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new scheduled report with comprehensive validation
   * Follows OWASP A01, A03, A07 security requirements
   */
  async createScheduledReport(createScheduledReportDto: CreateScheduledReportDto): Promise<ScheduledReportResponse> {
    try {
      this.logger.log(`Creating scheduled report!: ${createScheduledReportDto.name}`);

      // Input validation and sanitization (OWASP A03)
      if (!this.securityService.validateInput(createScheduledReportDto)) {
        this.logger.warn(`Invalid input data for scheduled report creation!: ${createScheduledReportDto.name}`);
        throw new BadRequestException('Invalid scheduled report data');
      }

      const sanitizedData = this.securityService.sanitizeInput(createScheduledReportDto) as CreateScheduledReportDto;

      // Validate report definition exists and is active
      const reportDefinition = await this.prismaService.reportDefinition.findUnique({
        where: { id: sanitizedData.reportDefinitionId },
        select: { id: true, name: true, type: true, category: true, isActive: true },
      });

      if (!reportDefinition) {
        this.logger.warn(`Report definition not found for scheduled report creation!: ${sanitizedData.reportDefinitionId}`);
        throw new NotFoundException(`Report definition not found`);
      }

      if (!reportDefinition.isActive) {
        this.logger.warn(`Inactive report definition attempted for scheduled report creation!: ${sanitizedData.reportDefinitionId}`);
        throw new BadRequestException(`Report definition is inactive`);
      }

      // Validate cron expression
      if (!this.validateCronExpression(sanitizedData.schedule)) {
        this.logger.warn(`Invalid cron expression!: ${sanitizedData.schedule}`);
        throw new BadRequestException('Invalid cron expression format');
      }

      // Calculate next run time
      const nextRunAt = this.calculateNextRunTime(sanitizedData.schedule, new Date());

      // Validate email recipients if email sending is enabled
      if (sanitizedData.sendEmail && (!sanitizedData.emailRecipients || sanitizedData.emailRecipients.length === 0)) {
        this.logger.warn(`Email sending enabled but no recipients provided for scheduled report!: ${sanitizedData.name}`);
        throw new BadRequestException('Email recipients are required when sendEmail is true');
      }

      // Create scheduled report
      const scheduledReport = await this.prismaService.scheduledReport.create({
        data: {
          ...sanitizedData,
          nextRunAt,
          emailRecipients: sanitizedData.emailRecipients || [],
          parameters: sanitizedData.parameters as Prisma.InputJsonValue | undefined,
        },
        include: {
          reportDefinition: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
            },
          },
        },
      });

      // Convert response format
      const response: ScheduledReportResponse = {
        ...scheduledReport,
        scheduleType: scheduledReport.scheduleType as ScheduleType,
        format: scheduledReport.format as ReportFormat,
        parameters: scheduledReport.parameters as Record<string, any>,
        description: scheduledReport.description || undefined,
        lastRunAt: scheduledReport.lastRunAt || undefined,
        emailSubject: scheduledReport.emailSubject || undefined,
        emailBody: scheduledReport.emailBody || undefined,
        archiveAfter: scheduledReport.archiveAfter || undefined,
        deleteAfter: scheduledReport.deleteAfter || undefined,
        createdBy: scheduledReport.createdBy || undefined,
        updatedBy: scheduledReport.updatedBy || undefined,
      };

      this.logger.log(`Successfully created scheduled report!: ${scheduledReport.id} for report definition: ${reportDefinition.name}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create scheduled report: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create scheduled report');
    }
  }

  /**
   * Get scheduled reports with pagination, filtering, and sorting
   * Implements efficient querying with proper indexing
   */
  async getScheduledReports(queryDto: ScheduledReportQueryDto): Promise<ScheduledReportQueryResponse> {
    try {
      this.logger.log(`Fetching scheduled reports with query!: ${JSON.stringify(queryDto)}`);

      const {
        reportDefinitionId,
        scheduleType,
        isActive,
        nextRunFrom,
        nextRunTo,
        skip,
        take,
        sortBy,
        sortOrder,
      } = queryDto;

      // Build where clause for filtering
      const where: any = {};

      if (reportDefinitionId) {
        where.reportDefinitionId = reportDefinitionId;
      }

      if (scheduleType) {
        where.scheduleType = scheduleType;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (nextRunFrom || nextRunTo) {
        where.nextRunAt = {};
        if (nextRunFrom) {
          where.nextRunAt.gte = new Date(nextRunFrom);
        }
        if (nextRunTo) {
          where.nextRunAt.lte = new Date(nextRunTo);
        }
      }

      // Execute queries in parallel for performance
      const [scheduledReports, total] = await Promise.all([
        this.prismaService.scheduledReport.findMany({
          where,
          skip,
          take,
          orderBy: (() => {
        const orderBy: any = {};
        orderBy[sortBy || 'createdAt'] = sortOrder;
        return orderBy;
      })(),
          include: {
            reportDefinition: {
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
              },
            },
          },
        }),
        this.prismaService.scheduledReport.count({ where }),
      ]);

      // Convert response format
      const reportsWithTypes = scheduledReports.map(report => ({
        ...report,
        scheduleType: report.scheduleType as ScheduleType,
        format: report.format as ReportFormat,
        parameters: report.parameters as Record<string, any>,
        description: report.description || undefined,
        lastRunAt: report.lastRunAt || undefined,
        emailSubject: report.emailSubject || undefined,
        emailBody: report.emailBody || undefined,
        archiveAfter: report.archiveAfter || undefined,
        deleteAfter: report.deleteAfter || undefined,
        createdBy: report.createdBy || undefined,
        updatedBy: report.updatedBy || undefined,
      }));

      this.logger.log(`Retrieved ${reportsWithTypes.length} scheduled reports out of ${total} total`);

      return {
        scheduledReports: reportsWithTypes,
        total: total || 0,
        skip: skip || 0,
        take: take || 10,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch scheduled reports: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to fetch scheduled reports');
    }
  }

  /**
   * Get scheduled report by ID with proper error handling
   */
  async getScheduledReportById(id: string): Promise<ScheduledReportResponse | null> {
    try {
      this.logger.log(`Fetching scheduled report by ID!: ${id}`);

      const scheduledReport = await this.prismaService.scheduledReport.findUnique({
        where: { id },
        include: {
          reportDefinition: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
            },
          },
        },
      });

      if (!scheduledReport) {
        this.logger.warn(`Scheduled report not found!: ${id}`);
        return null;
      }

      // Convert response format
      const response: ScheduledReportResponse = {
        ...scheduledReport,
        scheduleType: scheduledReport.scheduleType as ScheduleType,
        format: scheduledReport.format as ReportFormat,
        parameters: scheduledReport.parameters as Record<string, any>,
        description: scheduledReport.description || undefined,
        lastRunAt: scheduledReport.lastRunAt || undefined,
        emailSubject: scheduledReport.emailSubject || undefined,
        emailBody: scheduledReport.emailBody || undefined,
        archiveAfter: scheduledReport.archiveAfter || undefined,
        deleteAfter: scheduledReport.deleteAfter || undefined,
        createdBy: scheduledReport.createdBy || undefined,
        updatedBy: scheduledReport.updatedBy || undefined,
      };

      this.logger.log(`Successfully retrieved scheduled report!: ${id}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to fetch scheduled report by ID ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to fetch scheduled report');
    }
  }

  /**
   * Update scheduled report with comprehensive validation
   */
  async updateScheduledReport(id: string, updateScheduledReportDto: UpdateScheduledReportDto): Promise<ScheduledReportResponse> {
    try {
      this.logger.log(`Updating scheduled report ${id} with data!: ${JSON.stringify(updateScheduledReportDto)}`);

      // Check if scheduled report exists
      const existingReport = await this.prismaService.scheduledReport.findUnique({
        where: { id },
      });

      if (!existingReport) {
        this.logger.warn(`Scheduled report update attempted for non-existent ID!: ${id}`);
        throw new NotFoundException(`Scheduled report not found`);
      }

      // Input validation and sanitization
      if (!this.securityService.validateInput(updateScheduledReportDto)) {
        this.logger.warn(`Invalid input data for scheduled report update!: ${id}`);
        throw new BadRequestException('Invalid scheduled report data');
      }

      const sanitizedData = this.securityService.sanitizeInput(updateScheduledReportDto) as UpdateScheduledReportDto;

      // Validate cron expression if provided
      if (sanitizedData.schedule && !this.validateCronExpression(sanitizedData.schedule)) {
        this.logger.warn(`Invalid cron expression for update!: ${sanitizedData.schedule}`);
        throw new BadRequestException('Invalid cron expression format');
      }

      // Recalculate next run time if schedule changed
      const updateData: any = { ...sanitizedData };

      if (sanitizedData.schedule) {
        updateData.nextRunAt = this.calculateNextRunTime(sanitizedData.schedule, new Date());
      }

      // Update scheduled report
      const updatedReport = await this.prismaService.scheduledReport.update({
        where: { id },
        data: updateData,
        include: {
          reportDefinition: {
            select: {
              id: true,
              name: true,
              type: true,
              category: true,
            },
          },
        },
      });

      // Convert response format and handle null to undefined conversion
      const response: ScheduledReportResponse = {
        id: updatedReport.id,
        reportDefinitionId: updatedReport.reportDefinitionId,
        reportDefinition: updatedReport.reportDefinition ? {
          id: updatedReport.reportDefinition.id,
          name: updatedReport.reportDefinition.name,
          type: updatedReport.reportDefinition.type,
          category: updatedReport.reportDefinition.category,
        } : undefined,
        name: updatedReport.name,
        description: updatedReport.description || undefined,
        schedule: updatedReport.schedule,
        scheduleType: updatedReport.scheduleType as ScheduleType,
        isActive: updatedReport.isActive,
        nextRunAt: updatedReport.nextRunAt || new Date(),
        lastRunAt: updatedReport.lastRunAt || undefined,
        parameters: updatedReport.parameters as Record<string, any>,
        format: updatedReport.format as ReportFormat,
        timezone: updatedReport.timezone,
        sendEmail: updatedReport.sendEmail,
        emailRecipients: updatedReport.emailRecipients || [],
        emailSubject: updatedReport.emailSubject || undefined,
        emailBody: updatedReport.emailBody || undefined,
        maxRetries: updatedReport.maxRetries,
        archiveAfter: updatedReport.archiveAfter || undefined,
        deleteAfter: updatedReport.deleteAfter || undefined,
        createdAt: updatedReport.createdAt,
        updatedAt: updatedReport.updatedAt,
        createdBy: updatedReport.createdBy || undefined,
        updatedBy: updatedReport.updatedBy || undefined,
      };

      this.logger.log(`Successfully updated scheduled report!: ${updatedReport.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update scheduled report ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to update scheduled report');
    }
  }

  /**
   * Trigger manual execution of a scheduled report
   */
  async triggerScheduledReport(id: string, triggerDto: ManualReportTriggerDto): Promise<ScheduledReportExecutionResponse> {
    try {
      this.logger.log(`Triggering manual execution for scheduled report!: ${id}`);

      // Validate scheduled report exists
      const scheduledReport = await this.prismaService.scheduledReport.findUnique({
        where: { id },
      });

      if (!scheduledReport) {
        this.logger.warn(`Scheduled report not found for trigger!: ${id}`);
        throw new NotFoundException('Scheduled report not found');
      }

      // Get report definition
      const reportDefinition = await this.prismaService.reportDefinition.findUnique({
        where: { id: scheduledReport.reportDefinitionId },
      });

      if (!reportDefinition) {
        throw new NotFoundException('Associated report definition not found');
      }

      // Input validation
      if (!this.securityService.validateInput(triggerDto)) {
        throw new BadRequestException('Invalid trigger data');
      }

      const sanitizedData = this.securityService.sanitizeInput(triggerDto);

      // Create execution record
      const now = new Date();
      const execution = await this.prismaService.scheduledReportExecution.create({
        data: {
          scheduledReportId: id,
          scheduledAt: now,
          startedAt: now,
          status: ExecutionStatus.RUNNING,
          retryCount: 0,
          deliveryStatus: DeliveryStatus.PENDING,
          deliveryAttempts: 0,
          createdAt: now,
          createdBy: 'manual-trigger',
        },
        include: {
          scheduledReport: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Generate report asynchronously (in real implementation, this would be a background job)
      try {
        const generatedReport = await this.generateReportForExecution(execution.id, scheduledReport, reportDefinition, sanitizedData);

        // Fetch updated execution with generated report
        const updatedExecution = await this.prismaService.scheduledReportExecution.findUnique({
          where: { id: execution.id },
          include: {
            scheduledReport: {
              select: {
                id: true,
                name: true,
              },
            },
            generatedReport: {
              select: {
                id: true,
                name: true,
                status: true,
                fileUrl: true,
              },
            },
          },
        });

        if (!updatedExecution) {
          throw new InternalServerErrorException('Failed to retrieve execution after report generation');
        }

        // Convert response format
        const response: ScheduledReportExecutionResponse = {
          ...updatedExecution,
          status: updatedExecution.status as ExecutionStatus,
          deliveryStatus: updatedExecution.deliveryStatus as DeliveryStatus,
          executionTimeMs: updatedExecution.executionTimeMs || 0,
          generatedReportId: generatedReport.id,
          completedAt: updatedExecution.completedAt || undefined,
          generatedReport: generatedReport || undefined,
          errorMessage: updatedExecution.errorMessage || undefined,
          createdBy: updatedExecution.createdBy || undefined,
        };

        this.logger.log(`Successfully triggered execution for scheduled report!: ${execution.id}`);
        return response;

      } catch (error) {
        // Update execution with error
        await this.prismaService.scheduledReportExecution.update({
          where: { id: execution.id },
          data: {
            status: ExecutionStatus.FAILED,
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            executionTimeMs: Date.now() - now.getTime(),
          },
        });
        throw error;
      }

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to trigger scheduled report ${id}: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to trigger scheduled report');
    }
  }

  /**
   * Get execution history for a scheduled report
   */
  async getScheduledReportExecutions(scheduledReportId: string): Promise<ScheduledReportExecutionResponse[]> {
    try {
      this.logger.log(`Fetching execution history for scheduled report!: ${scheduledReportId}`);

      const executions = await this.prismaService.scheduledReportExecution.findMany({
        where: { scheduledReportId },
        orderBy: { scheduledAt: 'desc' },
        include: {
          scheduledReport: {
            select: {
              id: true,
              name: true,
            },
          },
          generatedReport: {
            select: {
              id: true,
              name: true,
              status: true,
              fileUrl: true,
            },
          },
        },
      });

      // Convert response format
      const response = executions.map(execution => ({
        ...execution,
        status: execution.status as ExecutionStatus,
        deliveryStatus: execution.deliveryStatus as DeliveryStatus,
        executionTimeMs: execution.executionTimeMs || 0,
        completedAt: execution.completedAt || undefined,
        generatedReportId: execution.generatedReportId || undefined,
        generatedReport: execution.generatedReport ? {
          ...execution.generatedReport,
          fileUrl: execution.generatedReport.fileUrl || undefined,
        } : undefined,
        errorMessage: execution.errorMessage || undefined,
        createdBy: execution.createdBy || undefined,
      }));

      this.logger.log(`Retrieved ${response.length} executions for scheduled report!: ${scheduledReportId}`);
      return response;

    } catch (error) {
      this.logger.error(`Failed to fetch execution history: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to fetch execution history');
    }
  }

  /**
   * Create distribution list entry for a scheduled report
   */
  async createDistributionList(distributionDto: CreateDistributionListDto): Promise<DistributionListResponse> {
    try {
      this.logger.log(`Creating distribution list entry for scheduled report!: ${distributionDto.scheduledReportId}`);

      // Input validation
      if (!this.securityService.validateInput(distributionDto)) {
        throw new BadRequestException('Invalid distribution list data');
      }

      const sanitizedData = this.securityService.sanitizeInput(distributionDto) as CreateDistributionListDto;

      // Validate scheduled report exists
      const scheduledReport = await this.prismaService.scheduledReport.findUnique({
        where: { id: sanitizedData.scheduledReportId },
      });

      if (!scheduledReport) {
        throw new NotFoundException('Scheduled report not found');
      }

      // Validate user exists
      const user = await this.prismaService.user.findUnique({
        where: { id: sanitizedData.userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Create distribution list entry
      const distribution = await this.prismaService.scheduledReportDistributionList.create({
        data: sanitizedData,
        include: {
          scheduledReport: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Convert response format
      const response: DistributionListResponse = {
        ...distribution,
        deliveryMethod: distribution.deliveryMethod as DeliveryMethod,
        preferredFormat: distribution.preferredFormat ? distribution.preferredFormat as ReportFormat : undefined,
        unsubscribedAt: distribution.unsubscribedAt || undefined,
        customSubject: distribution.customSubject || undefined,
        customBody: distribution.customBody || undefined,
        createdBy: distribution.createdBy || undefined,
      };

      this.logger.log(`Successfully created distribution list entry!: ${distribution.id}`);
      return response;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create distribution list: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create distribution list');
    }
  }

  
  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRunTime(cronExpression: string, fromDate: Date): Date {
    // For simplicity, this is a basic implementation
    // In production, use a proper cron parser library
    const parts = cronExpression.split(' ');

    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, _day, _month, __________dayOfWeek] = parts;

    // Start from tomorrow to ensure next run
    const nextRun = new Date(fromDate);

    // Handle specific day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    if (__________dayOfWeek !== '*') {
      const targetDayOfWeek = parseInt(__________dayOfWeek, 10);
      const currentDayOfWeek = nextRun.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

      // Calculate days to add to reach target day
      let daysToAdd = (targetDayOfWeek - currentDayOfWeek + 7) % 7;

      // If it's the same day, we want next week's occurrence
      if (daysToAdd === 0) {
        daysToAdd = 7;
      }

      nextRun.setUTCDate(nextRun.getUTCDate() + daysToAdd);
    } else {
      // Default to next day for daily schedules
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    // Set time from cron expression (using UTC as expected by tests)
    if (hour !== '*') {
      nextRun.setUTCHours(parseInt(hour, 10));
    }
    if (minute !== '*') {
      nextRun.setUTCMinutes(parseInt(minute, 10));
    }
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    return nextRun;
  }

  /**
   * Validate cron expression format
   */
  private validateCronExpression(cronExpression: string): boolean {
    if (!cronExpression || cronExpression.trim() === '') {
      return false;
    }

    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      return false;
    }

    const [minute, hour, _day, _month, __________dayOfWeek] = parts;

    // Basic validation - in production, use a proper cron validator
    try {
      // Validate minute (0-59, *, */N, or ranges)
      if (!this.validateCronField(minute, 0, 59)) {
        return false;
      }

      // Validate hour (0-23, *, */N, or ranges)
      if (!this.validateCronField(hour, 0, 23)) {
        return false;
      }

      // Validate day (1-31, *, */N, or ranges)
      if (!this.validateCronField(_day, 1, 31)) {
        return false;
      }

      // Validate month (1-12, *, */N, or ranges)
      if (!this.validateCronField(_month, 1, 12)) {
        return false;
      }

      // Validate day of week (0-6, *, */N, or ranges)
      if (!this.validateCronField(__________dayOfWeek, 0, 6)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate individual cron field
   */
  private validateCronField(field: string, min: number, max: number): boolean {
    if (field === '*') {
      return true;
    }

    // Handle step values like */15
    if (field.startsWith('*/')) {
      const step = field.substring(2);
      return /^\d+$/.test(step) && parseInt(step) > 0;
    }

    // Handle ranges like 1-5
    if (field.includes('-')) {
      const [start, end] = field.split('-');
      return /^\d+$/.test(start) && /^\d+$/.test(end) &&
             parseInt(start) >= min && parseInt(start) <= max &&
             parseInt(end) >= min && parseInt(end) <= max &&
             parseInt(start) <= parseInt(end);
    }

    // Handle comma-separated values like 1,2,3
    if (field.includes(',')) {
      const values = field.split(',');
      return values.every(v => /^\d+$/.test(v) && parseInt(v) >= min && parseInt(v) <= max);
    }

    // Handle single numbers
    return /^\d+$/.test(field) && parseInt(field) >= min && parseInt(field) <= max;
  }

  /**
   * Generate report for execution (simplified implementation)
   */
  private async generateReportForExecution(
    executionId: string,
    scheduledReport: any,
    reportDefinition: any,
    triggerData: ManualReportTriggerDto,
  ): Promise<any> {
    // This is a simplified implementation
    // In production, integrate with existing ReportsService
    const now = new Date();

    const generatedReport = await this.prismaService.generatedReport.create({
      data: {
        reportDefinitionId: reportDefinition.id,
        name: `${scheduledReport.name} - ${now.toISOString()}`,
        parameters: triggerData.parameters || scheduledReport.parameters,
        data: {
          generatedAt: now,
          type: reportDefinition.type,
          category: reportDefinition.category,
          // Mock data - in production, generate actual report
          mockData: 'Report content here',
        },
        format: triggerData.format || scheduledReport.format,
        status: 'COMPLETED',
        generatedAt: now,
        fileUrl: `https://example.com/reports/${executionId}.${triggerData.format || scheduledReport.format}`,
      },
    });

    // Update execution with generated report
    await this.prismaService.scheduledReportExecution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.COMPLETED,
        completedAt: now,
        generatedReportId: generatedReport.id,
        executionTimeMs: Date.now() - now.getTime(),
      },
    });

    return generatedReport;
  }

  /**
   * Get comprehensive dashboard statistics for scheduled reports
   * Provides insights into report usage, execution status, and performance
   */
  async getDashboardStatistics(): Promise<any> {
    try {
      this.logger.log('Calculating scheduled reports dashboard statistics');

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all statistics in parallel for better performance
      const [
        totalReports,
        activeReports,
        inactiveReports,
        totalExecutions,
        recentExecutions,
        successfulExecutions,
        failedExecutions,
        pendingExecutions,
        executionsByStatus,
        executionsByScheduleType,
        reportsByFormat,
        reportsByScheduleType,
        executionTrends,
        topPerformingReports,
        recentlyFailedReports,
        nextDueReports,
      ] = await Promise.all([
        // Basic report counts
        this.prismaService.scheduledReport.count(),
        this.prismaService.scheduledReport.count({ where: { isActive: true } }),
        this.prismaService.scheduledReport.count({ where: { isActive: false } }),

        // Execution statistics
        this.prismaService.scheduledReportExecution.count(),
        this.prismaService.scheduledReportExecution.count({
          where: { createdAt: { gte: thirtyDaysAgo } }
        }),
        this.prismaService.scheduledReportExecution.count({
          where: { status: ExecutionStatus.COMPLETED }
        }),
        this.prismaService.scheduledReportExecution.count({
          where: { status: ExecutionStatus.FAILED }
        }),
        this.prismaService.scheduledReportExecution.count({
          where: { status: ExecutionStatus.PENDING }
        }),

        // Grouped statistics
        this.getExecutionsByStatus(),
        this.getExecutionsByScheduleType(),
        this.getReportsByFormat(),
        this.getReportsByScheduleType(),
        this.getExecutionTrends(thirtyDaysAgo),
        this.getTopPerformingReports(5),
        this.getRecentlyFailedReports(5),
        this.getNextDueReports(5),
      ]);

      // Calculate derived metrics
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
      const failureRate = totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;
      const averageExecutionsPerDay = recentExecutions / 30;
      const activeRate = totalReports > 0 ? (activeReports / totalReports) * 100 : 0;

      const statistics = {
        overview: {
          totalReports,
          activeReports,
          inactiveReports,
          totalExecutions,
          successRate: Math.round(successRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100,
          activeRate: Math.round(activeRate * 100) / 100,
          averageExecutionsPerDay: Math.round(averageExecutionsPerDay * 100) / 100,
        },

        executionStats: {
          successfulExecutions,
          failedExecutions,
          pendingExecutions,
          recentExecutions, // Last 30 days
          executionsByStatus,
          executionsByScheduleType,
        },

        reportStats: {
          reportsByFormat,
          reportsByScheduleType,
        },

        trends: {
          executionTrends,
        },

        insights: {
          topPerformingReports,
          recentlyFailedReports,
          nextDueReports,
        },

        generatedAt: now.toISOString(),
      };

      this.logger.log('Successfully calculated dashboard statistics');
      return statistics;

    } catch (error) {
      this.logger.error(`Failed to calculate dashboard statistics: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to calculate dashboard statistics');
    }
  }

  /**
   * Get executions grouped by status
   */
  private async getExecutionsByStatus(): Promise<Record<string, number>> {
    const results = await this.prismaService.scheduledReportExecution.groupBy({
      by: ['status'],
      _count: true,
    });

    return results.reduce((acc, result) => {
      acc[result.status] = result._count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get executions grouped by schedule type
   */
  private async getExecutionsByScheduleType(): Promise<Record<string, number>> {
    const results = await this.prismaService.scheduledReportExecution.findMany({
      select: {
        scheduledReport: {
          select: { scheduleType: true }
        },
        status: true,
      },
    });

    return results.reduce((acc, execution) => {
      const scheduleType = execution.scheduledReport.scheduleType;
      acc[scheduleType] = (acc[scheduleType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get reports grouped by format
   */
  private async getReportsByFormat(): Promise<Record<string, number>> {
    const results = await this.prismaService.scheduledReport.groupBy({
      by: ['format'],
      _count: true,
    });

    return results.reduce((acc, result) => {
      acc[result.format] = result._count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get reports grouped by schedule type
   */
  private async getReportsByScheduleType(): Promise<Record<string, number>> {
    const results = await this.prismaService.scheduledReport.groupBy({
      by: ['scheduleType'],
      _count: true,
    });

    return results.reduce((acc, result) => {
      acc[result.scheduleType] = result._count;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get execution trends over time (daily counts)
   */
  private async getExecutionTrends(sinceDate: Date): Promise<Array<{ date: string; count: number; successRate: number }>> {
    // Get daily execution counts and success rates
    const executions = await this.prismaService.scheduledReportExecution.findMany({
      where: {
        createdAt: { gte: sinceDate }
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyStats = executions.reduce((acc, execution) => {
      const date = execution.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, successful: 0 };
      }
      acc[date].total++;
      if (execution.status === ExecutionStatus.COMPLETED) {
        acc[date].successful++;
      }
      return acc;
    }, {} as Record<string, { total: number; successful: number }>);

    // Convert to trend format
    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      count: stats.total,
      successRate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 10000) / 100 : 0,
    }));
  }

  /**
   * Get top performing reports (most successful executions)
   */
  private async getTopPerformingReports(limit: number): Promise<Array<{ id: string; name: string; successRate: number; totalExecutions: number }>> {
    const reports = await this.prismaService.scheduledReport.findMany({
      include: {
        scheduledExecutions: {
          select: { status: true }
        }
      },
      where: {
        scheduledExecutions: {
          some: {} // Only include reports with executions
        }
      }
    });

    return reports
      .map(report => {
        const totalExecutions = report.scheduledExecutions.length;
        const successfulExecutions = report.scheduledExecutions.filter(e => e.status === ExecutionStatus.COMPLETED).length;
        const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

        return {
          id: report.id,
          name: report.name,
          successRate: Math.round(successRate * 100) / 100,
          totalExecutions,
        };
      })
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  /**
   * Get recently failed reports
   */
  private async getRecentlyFailedReports(limit: number): Promise<Array<{ id: string; name: string; lastFailure: Date; failureCount: number }>> {
    const reports = await this.prismaService.scheduledReport.findMany({
      include: {
        scheduledExecutions: {
          where: {
            status: ExecutionStatus.FAILED,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }
      },
      where: {
        scheduledExecutions: {
          some: {
            status: ExecutionStatus.FAILED,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        }
      }
    });

    return reports
      .map(report => ({
        id: report.id,
        name: report.name,
        lastFailure: report.scheduledExecutions[0]?.createdAt || new Date(),
        failureCount: report.scheduledExecutions.length,
      }))
      .sort((a, b) => b.lastFailure.getTime() - a.lastFailure.getTime())
      .slice(0, limit);
  }

  /**
   * Get reports that are due to run next
   */
  private async getNextDueReports(limit: number): Promise<Array<{ id: string; name: string; nextRunAt: Date; scheduleType: string }>> {
    const reports = await this.prismaService.scheduledReport.findMany({
      where: {
        isActive: true,
        nextRunAt: { gte: new Date() }
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        nextRunAt: true,
        scheduleType: true,
      }
    });

    return reports;
  }
}