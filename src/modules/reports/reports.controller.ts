import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReportsService } from './services/reports.service';
import {
  CreateReportDefinitionDto,
  UpdateReportDefinitionDto,
  ReportDefinitionResponse,
  GenerateReportDto,
  FinancialReportParamsDto,
  SalesReportParamsDto,
  FinancialReportResponse,
  SalesAnalyticsResponse,
  InventoryReportResponse,
  PurchasingAnalyticsResponse,
  ExecutiveDashboardResponse,
} from './dto/reports.dto';

/**
 * Reports Controller - RESTful API endpoints
 * Follows KISS principle with simple, focused endpoints
 * Provides comprehensive reporting and analytics across all business modules
 */
@Controller('reports')
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Create a new report definition
   */
  @Post('definitions')
  async createReportDefinition(@Body() createReportDto: CreateReportDefinitionDto): Promise<ReportDefinitionResponse> {
    this.logger.log(`Creating report definition: ${createReportDto.name}`);
    return this.reportsService.createReportDefinition(createReportDto);
  }

  /**
   * Generate financial report (P&L, Balance Sheet data)
   */
  @Post('financial')
  async generateFinancialReport(@Body() params: FinancialReportParamsDto): Promise<FinancialReportResponse> {
    this.logger.log(`Generating financial report for period: ${params.startDate} to ${params.endDate}`);
    return this.reportsService.generateFinancialReport(params);
  }

  /**
   * Generate sales analytics
   */
  @Post('sales-analytics')
  async generateSalesAnalytics(@Body() params: SalesReportParamsDto): Promise<SalesAnalyticsResponse> {
    this.logger.log(`Generating sales analytics for period: ${params.startDate} to ${params.endDate}`);
    return this.reportsService.generateSalesAnalytics(params);
  }

  /**
   * Generate inventory report
   */
  @Get('inventory')
  async generateInventoryReport(): Promise<InventoryReportResponse> {
    this.logger.log('Generating inventory report');
    return this.reportsService.generateInventoryReport();
  }

  /**
   * Generate purchasing analytics
   */
  @Get('purchasing-analytics')
  async generatePurchasingAnalytics(): Promise<PurchasingAnalyticsResponse> {
    this.logger.log('Generating purchasing analytics');
    return this.reportsService.generatePurchasingAnalytics();
  }

  /**
   * Generate executive dashboard
   */
  @Get('executive-dashboard')
  async generateExecutiveDashboard(): Promise<ExecutiveDashboardResponse> {
    this.logger.log('Generating executive dashboard');
    return this.reportsService.generateExecutiveDashboard();
  }

  /**
   * Generate custom report from definition
   */
  @Post('custom')
  async generateCustomReport(@Body() generateReportDto: GenerateReportDto): Promise<any> {
    this.logger.log(`Generating custom report: ${generateReportDto.reportDefinitionId}`);
    return this.reportsService.generateCustomReport(generateReportDto);
  }

  /**
   * Get predefined report types available
   */
  @Get('types')
  async getReportTypes(): Promise<{ type: string; description: string; parameters: string[] }[]> {
    this.logger.log('Fetching available report types');

    return [
      {
        type: 'FINANCIAL',
        description: 'Financial reports including P&L, balance sheet data, and cash flow analysis',
        parameters: ['startDate', 'endDate', 'currency', 'includeComparisons'],
      },
      {
        type: 'SALES',
        description: 'Sales analytics including top customers, products, and conversion metrics',
        parameters: ['startDate', 'endDate', 'customerGrouping', 'productGrouping', 'includeDetails'],
      },
      {
        type: 'INVENTORY',
        description: 'Inventory reports including stock levels, values, and movement analysis',
        parameters: [],
      },
      {
        type: 'PURCHASING',
        description: 'Purchasing analytics including supplier performance and spend analysis',
        parameters: [],
      },
      {
        type: 'EXECUTIVE',
        description: 'Executive dashboard with KPIs, charts, and alerts',
        parameters: [],
      },
    ];
  }

  /**
   * Get sample report parameters
   */
  @Get('parameters/:type')
  async getReportParameters(@Param('type') reportType: string): Promise<any> {
    this.logger.log(`Fetching parameters for report type: ${reportType}`);

    switch (reportType.toUpperCase()) {
      case 'FINANCIAL':
        return {
          startDate: { type: 'date', required: true, description: 'Report start date' },
          endDate: { type: 'date', required: true, description: 'Report end date' },
          currency: { type: 'string', required: false, default: 'USD', description: 'Currency code' },
          includeComparisons: { type: 'boolean', required: false, default: false, description: 'Include period comparisons' },
        };

      case 'SALES':
        return {
          startDate: { type: 'date', required: true, description: 'Report start date' },
          endDate: { type: 'date', required: true, description: 'Report end date' },
          customerGrouping: { type: 'string', required: false, description: 'Customer grouping field' },
          productGrouping: { type: 'string', required: false, description: 'Product grouping field' },
          includeDetails: { type: 'boolean', required: false, default: false, description: 'Include detailed breakdown' },
        };

      default:
        throw new NotFoundException(`Unknown report type: ${reportType}`);
    }
  }
}