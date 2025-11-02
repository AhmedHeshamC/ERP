import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { WarehouseService } from '../services/warehouse.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseStatus,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

interface WarehouseQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: WarehouseStatus;
  city?: string;
  state?: string;
  country?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@ApiTags('Warehouse Management')
@Controller('api/v1/inventory/warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a new warehouse' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Warehouse created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Warehouse with code already exists' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createWarehouseDto: CreateWarehouseDto, @Request() req: any): Promise<any> {
    return this.warehouseService.create(createWarehouseDto, req.user?.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all warehouses with pagination and filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouses retrieved successfully' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name, code, or address' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by warehouse status', enum: WarehouseStatus })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'country', required: false, description: 'Filter by country' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  async findAll(@Query() query: WarehouseQuery): Promise<any> {
    return this.warehouseService.findAll(query);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Get comprehensive warehouse statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse statistics retrieved successfully' })
  async getStatistics(): Promise<any> {
    return this.warehouseService.getWarehouseStatistics();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get warehouse by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  async findById(@Param('id') id: string): Promise<any> {
    return this.warehouseService.findById(id);
  }

  @Get('code/:code')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get warehouse by code' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'code', description: 'Warehouse code' })
  async findByCode(@Param('code') code: string): Promise<any> {
    return this.warehouseService.findByCode(code);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Update warehouse' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
    @Request() req: any,
  ): Promise<any> {
    return this.warehouseService.update(id, updateWarehouseDto, req.user?.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Delete warehouse (soft delete)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Cannot delete warehouse with current utilization' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  async remove(@Param('id') id: string, @Request() req: any): Promise<any> {
    return this.warehouseService.remove(id, req.user?.id);
  }

  @Get(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get stock summary for warehouse' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse stock retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  async getWarehouseStock(@Param('id') id: string): Promise<any> {
    return this.warehouseService.getWarehouseStock(id);
  }

  @Patch(':id/utilization')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Update warehouse utilization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse utilization updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid utilization value' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  async updateUtilization(
    @Param('id') id: string,
    @Body() utilizationDto: { utilization: number },
    @Request() req: any,
  ): Promise<any> {
    return this.warehouseService.updateUtilization(id, utilizationDto.utilization, req.user?.id);
  }

  @Get(':id/capacity')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get warehouse capacity information' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse capacity retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Warehouse not found' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  async getWarehouseCapacity(@Param('id') id: string): Promise<any> {
    return this.warehouseService.getWarehouseCapacity(id);
  }

  @Get('status/options')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get available warehouse status options' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Warehouse status options retrieved successfully' })
  async getWarehouseStatusOptions(): Promise<{ statuses: WarehouseStatus[]; descriptions: Record<string, string> }> {
    return {
      statuses: Object.values(WarehouseStatus),
      descriptions: {
        [WarehouseStatus.ACTIVE]: 'Warehouse is operational and available',
        [WarehouseStatus.INACTIVE]: 'Warehouse is not operational',
        [WarehouseStatus.MAINTENANCE]: 'Warehouse is under maintenance',
      },
    };
  }
}