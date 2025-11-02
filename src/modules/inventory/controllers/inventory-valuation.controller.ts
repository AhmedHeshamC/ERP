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
import { InventoryValuationService } from '../services/inventory-valuation.service';
import {
  InventoryValuationDto,
  InventoryValuationMethod,
  InventoryValueResponse,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

interface CostLayerDto {
  productId: string;
  batchNumber?: string;
  quantity: number;
  unitCost: number;
  acquisitionDate: Date;
  expiryDate?: Date;
  supplierId?: string;
  purchaseOrderId?: string;
  location?: string;
}

interface ConsumeCostLayerDto {
  productId: string;
  quantity: number;
  method: InventoryValuationMethod;
}

@ApiTags('Inventory Valuation')
@Controller('api/v1/inventory/valuation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryValuationController {
  constructor(private readonly inventoryValuationService: InventoryValuationService) {}

  @Post('calculate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.FINANCE)
  @ApiOperation({ summary: 'Calculate inventory value using specified method' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inventory value calculated successfully', type: InventoryValueResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async calculateInventoryValue(
    @Body() inventoryValuationDto: InventoryValuationDto,
    @Request() req: any,
  ): Promise<InventoryValueResponse> {
    return this.inventoryValuationService.calculateInventoryValue(inventoryValuationDto, req.user?.id);
  }

  @Get('report')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.FINANCE, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get comprehensive inventory valuation report' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Valuation report generated successfully', type: InventoryValueResponse })
  @ApiQuery({ name: 'method', required: false, description: 'Valuation method (FIFO, LIFO, WEIGHTED_AVERAGE)', enum: InventoryValuationMethod })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'valuationDate', required: false, description: 'Valuation date' })
  async getInventoryValuationReport(
    @Query('method') method: InventoryValuationMethod = InventoryValuationMethod.WEIGHTED_AVERAGE,
    @Query('categoryId') categoryId?: string,
    @Query('valuationDate') valuationDate?: Date,
  ): Promise<InventoryValueResponse> {
    return this.inventoryValuationService.getInventoryValuationReport(method, categoryId, valuationDate);
  }

  @Get('products/:productId/history')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.FINANCE, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get inventory valuation history for a product' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Valuation history retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  async getInventoryValuationHistory(@Param('productId') productId: string): Promise<any[]> {
    return this.inventoryValuationService.getInventoryValuationHistory(productId);
  }

  @Post('cost-layers')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Add cost layer for inventory valuation' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Cost layer added successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async addCostLayer(
    @Body() costLayerDto: CostLayerDto,
    @Request() req: any,
  ): Promise<any> {
    return this.inventoryValuationService.addCostLayer(costLayerDto, req.user?.id);
  }

  @Post('cost-layers/consume')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Consume from cost layers based on valuation method' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cost layers consumed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data or insufficient stock' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async consumeCostLayer(
    @Body() consumeDto: ConsumeCostLayerDto,
    @Request() req: any,
  ): Promise<any[]> {
    return this.inventoryValuationService.consumeCostLayer(consumeDto, req.user?.id);
  }

  @Get('products/:productId/cogs')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.FINANCE, UserRole.VIEWER)
  @ApiOperation({ summary: 'Calculate cost of goods sold for a product' })
  @ApiResponse({ status: HttpStatus.OK, description: 'COGS calculated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date for COGS calculation' })
  @ApiQuery({ name: 'endDate', required: true, description: 'End date for COGS calculation' })
  @ApiQuery({ name: 'method', required: false, description: 'Valuation method', enum: InventoryValuationMethod })
  async getCostOfGoodsSold(
    @Param('productId') productId: string,
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('method') method: InventoryValuationMethod = InventoryValuationMethod.FIFO,
  ): Promise<any> {
    return this.inventoryValuationService.getCostOfGoodsSold(productId, new Date(startDate), new Date(endDate), method);
  }

  @Get('methods')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.FINANCE, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get available inventory valuation methods' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Valuation methods retrieved successfully' })
  async getValuationMethods(): Promise<{ methods: InventoryValuationMethod[]; descriptions: Record<string, string> }> {
    return {
      methods: Object.values(InventoryValuationMethod),
      descriptions: {
        [InventoryValuationMethod.FIFO]: 'First In, First Out - Oldest inventory items are sold first',
        [InventoryValuationMethod.LIFO]: 'Last In, First Out - Newest inventory items are sold first',
        [InventoryValuationMethod.WEIGHTED_AVERAGE]: 'Weighted Average - Average cost of all inventory items',
      },
    };
  }
}