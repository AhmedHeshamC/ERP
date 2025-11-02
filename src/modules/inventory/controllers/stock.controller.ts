import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StockService } from '../services/stock.service';
import {
  StockMovementDto,
  StockAdjustmentDto,
  WarehouseTransferDto,
  StockMovementResponse,
  StockMovementsQueryResponse,
  StockMovementType,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

interface StockMovementQuery {
  page?: number;
  limit?: number;
  productId?: string;
  type?: StockMovementType;
  startDate?: Date;
  endDate?: Date;
  reference?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@ApiTags('Stock Management')
@Controller('api/v1/inventory/stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a stock movement' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Stock movement created successfully', type: StockMovementResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createMovement(
    @Body() stockMovementDto: StockMovementDto,
    @Request() req: any,
  ): Promise<StockMovementResponse> {
    return this.stockService.createMovement(stockMovementDto, req.user?.id);
  }

  @Post('adjustments')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a stock adjustment' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Stock adjustment created successfully', type: StockMovementResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createAdjustment(
    @Body() stockAdjustmentDto: StockAdjustmentDto,
    @Request() req: any,
  ): Promise<StockMovementResponse> {
    return this.stockService.createAdjustment(stockAdjustmentDto, req.user?.id);
  }

  @Post('transfers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a warehouse transfer' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Warehouse transfer created successfully', type: StockMovementResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async createTransfer(
    @Body() warehouseTransferDto: WarehouseTransferDto,
    @Request() req: any,
  ): Promise<StockMovementResponse> {
    return this.stockService.createTransfer(warehouseTransferDto, req.user?.id);
  }

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get stock movements with pagination and filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Stock movements retrieved successfully', type: StockMovementsQueryResponse })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by movement type' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filter by start date' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filter by end date' })
  @ApiQuery({ name: 'reference', required: false, description: 'Filter by reference' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  async getMovements(@Query() query: StockMovementQuery): Promise<StockMovementsQueryResponse> {
    return this.stockService.getMovements(query);
  }

  @Get('movements/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get stock movement by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Stock movement retrieved successfully', type: StockMovementResponse })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Stock movement not found' })
  @ApiParam({ name: 'id', description: 'Stock movement ID' })
  async getMovementById(@Param('id') id: string): Promise<StockMovementResponse> {
    return this.stockService.getMovementById(id);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get comprehensive stock summary' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Stock summary retrieved successfully' })
  async getStockSummary(): Promise<any[]> {
    return this.stockService.getStockSummary();
  }

  @Get('products/:productId/history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get stock history for a specific product' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product stock history retrieved successfully', type: [StockMovementResponse] })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of records' })
  async getProductStockHistory(
    @Param('productId') productId: string,
    @Query('limit') limit?: number,
  ): Promise<StockMovementResponse[]> {
    return this.stockService.getProductStockHistory(productId, limit);
  }

  @Get('alerts/low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Get low stock alerts' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Low stock alerts retrieved successfully' })
  async getLowStockAlerts(): Promise<any[]> {
    return this.stockService.getLowStockAlerts();
  }
}