import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LowStockAlertService } from '../services/low-stock-alert.service';
import {
  LowStockAlertDto,
  AlertSeverity,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

@ApiTags('Low Stock Alerts')
@Controller('api/v1/inventory/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LowStockAlertController {
  constructor(private readonly lowStockAlertService: LowStockAlertService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a low stock alert' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Low stock alert created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or product stock not low' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Active alert already exists for product' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createAlert(
    @Body() lowStockAlertDto: LowStockAlertDto,
    @Request() req: any,
  ): Promise<any> {
    return this.lowStockAlertService.createAlert(lowStockAlertDto, req.user?.id);
  }

  @Post('check')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Check all products and create alerts for low stock' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Low stock check completed successfully' })
  async checkAndCreateAlerts(@Request() req: any): Promise<any[]> {
    return this.lowStockAlertService.checkAndCreateAlerts(req.user?.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get active low stock alerts' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Low stock alerts retrieved successfully' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by alert severity', enum: AlertSeverity })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'acknowledged', required: false, description: 'Filter by acknowledgment status' })
  async getActiveAlerts(
    @Query('severity') severity?: AlertSeverity,
    @Query('productId') productId?: string,
    @Query('acknowledged') acknowledged?: boolean,
  ): Promise<any[]> {
    return this.lowStockAlertService.getActiveAlerts(severity, productId, acknowledged);
  }

  @Patch(':id/acknowledge')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Acknowledge a low stock alert' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Alert acknowledged successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Alert not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Alert already acknowledged' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  async acknowledgeAlert(@Param('id') id: string, @Request() req: any): Promise<any> {
    return this.lowStockAlertService.acknowledgeAlert(id, req.user?.id);
  }

  @Patch(':id/dismiss')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Dismiss a low stock alert' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Alert dismissed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Alert not found' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  async dismissAlert(@Param('id') id: string, @Request() req: any): Promise<any> {
    return this.lowStockAlertService.dismissAlert(id, req.user?.id);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get comprehensive alert statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Alert statistics retrieved successfully' })
  async getAlertStatistics(): Promise<any> {
    return this.lowStockAlertService.getAlertStatistics();
  }

  @Get('reorder-suggestions')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.PURCHASING)
  @ApiOperation({ summary: 'Get reorder suggestions for low stock products' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Reorder suggestions retrieved successfully' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by alert severity', enum: AlertSeverity })
  async getReorderSuggestions(@Query('severity') severity?: AlertSeverity): Promise<any[]> {
    return this.lowStockAlertService.getReorderSuggestions(severity);
  }

  @Get('severity/options')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get available alert severity options' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Alert severity options retrieved successfully' })
  async getSeverityOptions(): Promise<{ severities: AlertSeverity[]; descriptions: Record<string, string> }> {
    return {
      severities: Object.values(AlertSeverity),
      descriptions: {
        [AlertSeverity.LOW]: 'Stock is slightly below threshold (76-100% of threshold)',
        [AlertSeverity.MEDIUM]: 'Stock is moderately below threshold (51-75% of threshold)',
        [AlertSeverity.HIGH]: 'Stock is significantly below threshold (26-50% of threshold)',
        [AlertSeverity.CRITICAL]: 'Stock is critically low (0-25% of threshold)',
      },
    };
  }

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get alert dashboard data' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Dashboard data retrieved successfully' })
  async getDashboardData(): Promise<any> {
    const [statistics, activeAlerts, reorderSuggestions] = await Promise.all([
      this.lowStockAlertService.getAlertStatistics(),
      this.lowStockAlertService.getActiveAlerts(),
      this.lowStockAlertService.getReorderSuggestions(),
    ]);

    return {
      statistics,
      activeAlerts: activeAlerts.slice(0, 10), // Limit to 10 most recent
      topReorderSuggestions: reorderSuggestions.slice(0, 5), // Top 5 priority items
      urgencyBreakdown: {
        critical: activeAlerts.filter(alert => alert.severity === AlertSeverity.CRITICAL).length,
        high: activeAlerts.filter(alert => alert.severity === AlertSeverity.HIGH).length,
        medium: activeAlerts.filter(alert => alert.severity === AlertSeverity.MEDIUM).length,
        low: activeAlerts.filter(alert => alert.severity === AlertSeverity.LOW).length,
      },
    };
  }
}