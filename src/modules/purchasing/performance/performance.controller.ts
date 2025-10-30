import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { SupplierPerformanceService } from './performance.service';
import {
  CreateSupplierPerformanceDto,
  UpdateSupplierPerformanceDto,
  SupplierPerformanceQueryDto,
  SupplierPerformanceResponse,
  SupplierPerformanceQueryResponse,
  PerformanceAnalyticsResponse,
  CreateScorecardDetailDto,
  CreatePerformanceEventDto,
} from './dto/performance.dto';

/**
 * Enterprise Supplier Performance Controller
 * RESTful API endpoints for supplier performance management
 * OWASP security compliance with proper authentication and authorization
 */
@ApiTags('Supplier Performance')
@ApiBearerAuth()
@Controller('supplier-performance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierPerformanceController {
  constructor(private readonly supplierPerformanceService: SupplierPerformanceService) {}

  /**
   * Create a new supplier performance record
   * POST /api/v1/supplier-performance
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create supplier performance record' })
  @ApiResponse({ status: 201, description: 'Performance record created successfully', type: SupplierPerformanceResponse })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Performance record already exists' })
  async createPerformance(
    @Body() createPerformanceDto: CreateSupplierPerformanceDto,
    @Request() req: any,
  ): Promise<SupplierPerformanceResponse> {
    // Add current user as calculator if not specified
    if (!createPerformanceDto.calculatedBy) {
      createPerformanceDto.calculatedBy = req.user.id;
    }

    return this.supplierPerformanceService.createSupplierPerformance(createPerformanceDto);
  }

  /**
   * Get supplier performance records with filtering and pagination
   * GET /api/v1/supplier-performance
   */
  @Get()
  @ApiOperation({ summary: 'Get supplier performance records' })
  @ApiResponse({ status: 200, description: 'Performance records retrieved successfully', type: SupplierPerformanceQueryResponse })
  @ApiQuery({ name: 'supplierId', required: false, description: 'Filter by supplier ID' })
  @ApiQuery({ name: 'period', required: false, description: 'Filter by period (YYYY-MM)' })
  @ApiQuery({ name: 'tier', required: false, description: 'Filter by supplier tier', enum: ['PREFERRED', 'APPROVED', 'STANDARD', 'CONDITIONAL', 'UNDER_REVIEW'] })
  @ApiQuery({ name: 'minOverallScore', required: false, description: 'Minimum overall score' })
  @ApiQuery({ name: 'maxOverallScore', required: false, description: 'Maximum overall score' })
  @ApiQuery({ name: 'periodFrom', required: false, description: 'Period start filter (YYYY-MM)' })
  @ApiQuery({ name: 'periodTo', required: false, description: 'Period end filter (YYYY-MM)' })
  @ApiQuery({ name: 'skip', required: false, description: 'Number of records to skip', example: 0 })
  @ApiQuery({ name: 'take', required: false, description: 'Number of records to take', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field', example: 'createdAt' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order', enum: ['asc', 'desc'], example: 'desc' })
  async getPerformances(@Query() queryDto: SupplierPerformanceQueryDto): Promise<SupplierPerformanceQueryResponse> {
    return this.supplierPerformanceService.getSupplierPerformance(queryDto);
  }

  /**
   * Get supplier performance record by ID
   * GET /api/v1/supplier-performance/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get supplier performance by ID' })
  @ApiResponse({ status: 200, description: 'Performance record found', type: SupplierPerformanceResponse })
  @ApiResponse({ status: 404, description: 'Performance record not found' })
  @ApiParam({ name: 'id', description: 'Performance record ID' })
  async getPerformanceById(@Param('id') id: string): Promise<SupplierPerformanceResponse> {
    const performance = await this.supplierPerformanceService.getSupplierPerformanceById(id);

    if (!performance) {
      throw new NotFoundException(`Performance record with ID ${id} not found`);
    }

    return performance;
  }

  /**
   * Update supplier performance record
   * PUT /api/v1/supplier-performance/:id
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update supplier performance record' })
  @ApiResponse({ status: 200, description: 'Performance record updated successfully', type: SupplierPerformanceResponse })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Performance record not found' })
  @ApiParam({ name: 'id', description: 'Performance record ID' })
  async updatePerformance(
    @Param('id') id: string,
    @Body() updatePerformanceDto: UpdateSupplierPerformanceDto,
    @Request() req: any,
  ): Promise<SupplierPerformanceResponse> {
    // Add current user as reviewer if not specified
    if (!updatePerformanceDto.reviewedBy) {
      updatePerformanceDto.reviewedBy = req.user.id;
    }

    return this.supplierPerformanceService.updateSupplierPerformance(id, updatePerformanceDto);
  }

  /**
   * Get comprehensive performance analytics
   * GET /api/v1/supplier-performance/analytics
   */
  @Get('analytics/dashboard')
  @ApiOperation({ summary: 'Get performance analytics dashboard' })
  @ApiResponse({ status: 200, description: 'Performance analytics retrieved successfully', type: PerformanceAnalyticsResponse })
  async getAnalytics(): Promise<PerformanceAnalyticsResponse> {
    return this.supplierPerformanceService.calculatePerformanceAnalytics();
  }

  /**
   * Add scorecard detail to performance record
   * POST /api/v1/supplier-performance/scorecard
   */
  @Post('scorecard')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add scorecard detail' })
  @ApiResponse({ status: 201, description: 'Scorecard detail added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Performance record not found' })
  async addScorecardDetail(@Body() detailDto: CreateScorecardDetailDto): Promise<any> {
    return this.supplierPerformanceService.addScorecardDetail(detailDto);
  }

  /**
   * Record performance event
   * POST /api/v1/supplier-performance/events
   */
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record performance event' })
  @ApiResponse({ status: 201, description: 'Performance event recorded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async recordPerformanceEvent(@Body() eventDto: CreatePerformanceEventDto): Promise<any> {
    return this.supplierPerformanceService.recordPerformanceEvent(eventDto);
  }

  /**
   * Get performance trends for a specific supplier
   * GET /api/v1/supplier-performance/trends/:supplierId
   */
  @Get('trends/:supplierId')
  @ApiOperation({ summary: 'Get supplier performance trends' })
  @ApiResponse({ status: 200, description: 'Performance trends retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiQuery({ name: 'periods', required: false, description: 'Number of periods to analyze', example: 12 })
  async getSupplierTrends(
    @Param('supplierId') supplierId: string,
    @Query('periods') periods?: number,
  ): Promise<any> {
    // Implementation for trend analysis would go here
    // For now, delegate to the main service with appropriate filters
    const queryDto: SupplierPerformanceQueryDto = {
      supplierId,
      take: periods || 12,
      sortBy: 'period',
      sortOrder: 'desc',
    };

    return this.supplierPerformanceService.getSupplierPerformance(queryDto);
  }

  /**
   * Get top performing suppliers
   * GET /api/v1/supplier-performance/top-performers
   */
  @Get('top-performers')
  @ApiOperation({ summary: 'Get top performing suppliers' })
  @ApiResponse({ status: 200, description: 'Top performers retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of top performers to return', example: 10 })
  @ApiQuery({ name: 'tier', required: false, description: 'Filter by tier', enum: ['PREFERRED', 'APPROVED', 'STANDARD'] })
  async getTopPerformers(
    @Query('limit') limit?: number,
    @Query('tier') tier?: string,
  ): Promise<any> {
    const queryDto: SupplierPerformanceQueryDto = {
      tier: tier as any,
      minOverallScore: 80, // Only high performers
      take: limit || 10,
      sortBy: 'overallScore',
      sortOrder: 'desc',
    };

    return this.supplierPerformanceService.getSupplierPerformance(queryDto);
  }

  /**
   * Get suppliers requiring attention
   * GET /api/v1/supplier-performance/attention-required
   */
  @Get('attention-required')
  @ApiOperation({ summary: 'Get suppliers requiring attention' })
  @ApiResponse({ status: 200, description: 'Suppliers requiring attention retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of suppliers to return', example: 10 })
  async getSuppliersRequiringAttention(@Query('limit') limit?: number): Promise<any> {
    const queryDto: SupplierPerformanceQueryDto = {
      maxOverallScore: 70, // Low performers
      take: limit || 10,
      sortBy: 'overallScore',
      sortOrder: 'asc',
    };

    return this.supplierPerformanceService.getSupplierPerformance(queryDto);
  }
}