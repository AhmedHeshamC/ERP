/**
 * Business Metrics Controller - Following SOLID Principles
 *
 * Single Responsibility: Only handles HTTP request/response for business metrics
 * Open/Closed: Open for extension with new metric endpoints
 * Interface Segregation: Focused controller with specific business metric endpoints
 * Dependency Inversion: Depends on service abstractions, not implementations
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple, clear API endpoints with proper validation
 * No unnecessary complexity, focused on business metrics delivery
 */

import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BusinessMetricsService } from '../services/business-metrics.service';
import {
  MetricTimeRange,
  BusinessMetricsSummary,
  UserMetrics,
  TransactionMetrics,
  RevenueMetrics
} from '../types/metric.types';
import { MetricTimeRangeDto } from '../dto/metric-time-range.dto';

@ApiTags('Business Metrics')
@Controller('business-metrics')
export class BusinessMetricsController {
  private readonly logger = new Logger(BusinessMetricsController.name);

  constructor(private readonly businessMetricsService: BusinessMetricsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get comprehensive business metrics summary' })
  @ApiResponse({ status: 200, description: 'Business metrics summary retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time range provided' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date for metrics calculation (ISO 8601 format)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date for metrics calculation (ISO 8601 format)' })
  async getBusinessMetricsSummary(
    @Query(new ValidationPipe({ transform: true })) query: MetricTimeRangeDto,
  ): Promise<BusinessMetricsSummary> {
    try {
      const timeRange: MetricTimeRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate)
      };

      // Validate time range - KISS: Simple validation
      this.validateTimeRange(timeRange);

      this.logger.log(`Retrieving business metrics summary for range: ${timeRange.startDate.toISOString()} to ${timeRange.endDate.toISOString()}`);

      return await this.businessMetricsService.getBusinessMetricsSummary(timeRange);
    } catch (error) {
      this.logger.error(`Error retrieving business metrics summary: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve business metrics summary: ${error.message}`);
    }
  }

  @Get('user-analytics')
  @ApiOperation({ summary: 'Get user analytics metrics' })
  @ApiResponse({ status: 200, description: 'User analytics metrics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time range provided' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date for metrics calculation (ISO 8601 format)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date for metrics calculation (ISO 8601 format)' })
  async getUserAnalytics(
    @Query(new ValidationPipe({ transform: true })) query: MetricTimeRangeDto,
  ): Promise<UserMetrics> {
    try {
      const timeRange: MetricTimeRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate)
      };

      // Validate time range - KISS: Simple validation
      this.validateTimeRange(timeRange);

      this.logger.log(`Retrieving user analytics for range: ${timeRange.startDate.toISOString()} to ${timeRange.endDate.toISOString()}`);

      return await this.businessMetricsService.calculateUserAnalytics(timeRange);
    } catch (error) {
      this.logger.error(`Error retrieving user analytics: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve user analytics: ${error.message}`);
    }
  }

  @Get('transaction-analytics')
  @ApiOperation({ summary: 'Get transaction analytics metrics' })
  @ApiResponse({ status: 200, description: 'Transaction analytics metrics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time range provided' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date for metrics calculation (ISO 8601 format)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date for metrics calculation (ISO 8601 format)' })
  async getTransactionAnalytics(
    @Query(new ValidationPipe({ transform: true })) query: MetricTimeRangeDto,
  ): Promise<TransactionMetrics> {
    try {
      const timeRange: MetricTimeRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate)
      };

      // Validate time range - KISS: Simple validation
      this.validateTimeRange(timeRange);

      this.logger.log(`Retrieving transaction analytics for range: ${timeRange.startDate.toISOString()} to ${timeRange.endDate.toISOString()}`);

      return await this.businessMetricsService.calculateTransactionAnalytics(timeRange);
    } catch (error) {
      this.logger.error(`Error retrieving transaction analytics: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve transaction analytics: ${error.message}`);
    }
  }

  @Get('revenue-metrics')
  @ApiOperation({ summary: 'Get revenue metrics' })
  @ApiResponse({ status: 200, description: 'Revenue metrics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid time range provided' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date for metrics calculation (ISO 8601 format)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date for metrics calculation (ISO 8601 format)' })
  async getRevenueMetrics(
    @Query(new ValidationPipe({ transform: true })) query: MetricTimeRangeDto,
  ): Promise<RevenueMetrics> {
    try {
      const timeRange: MetricTimeRange = {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate)
      };

      // Validate time range - KISS: Simple validation
      this.validateTimeRange(timeRange);

      this.logger.log(`Retrieving revenue metrics for range: ${timeRange.startDate.toISOString()} to ${timeRange.endDate.toISOString()}`);

      return await this.businessMetricsService.calculateRevenueMetrics(timeRange);
    } catch (error) {
      this.logger.error(`Error retrieving revenue metrics: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve revenue metrics: ${error.message}`);
    }
  }

  /**
   * Validate time range parameters - KISS: Simple validation logic
   * Single Responsibility: Only handles time range validation
   */
  private validateTimeRange(timeRange: MetricTimeRange): void {
    if (!timeRange.startDate || !timeRange.endDate) {
      throw new BadRequestException('Both startDate and endDate are required');
    }

    if (isNaN(timeRange.startDate.getTime()) || isNaN(timeRange.endDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use ISO 8601 format.');
    }

    if (timeRange.startDate >= timeRange.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // Prevent queries for very long ranges - KISS: Simple performance guard
    const daysInRange = Math.ceil((timeRange.endDate.getTime() - timeRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysInRange > 365) {
      throw new BadRequestException('Time range cannot exceed 365 days');
    }

    // Prevent future dates - KISS: Simple business rule
    const now = new Date();
    if (timeRange.endDate > now) {
      throw new BadRequestException('endDate cannot be in the future');
    }
  }
}