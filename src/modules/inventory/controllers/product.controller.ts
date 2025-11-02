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
import { ProductService } from '../services/product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponse,
  ProductsQueryResponse,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../../authentication/guards/roles.guard';
import { Roles } from '../../authentication/decorators/roles.decorator';
import { UserRole } from '../../users/dto/user.dto';

@ApiTags('Products')
@Controller('api/v1/inventory/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Product created successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Product with SKU already exists' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product category not found' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(@Body() createProductDto: CreateProductDto, @Request() req: any): Promise<ProductResponse> {
    return this.productService.create(createProductDto, req.user?.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.SALES, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all products with pagination and filtering' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Products retrieved successfully', type: ProductsQueryResponse })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name, SKU, or description' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by product status' })
  @ApiQuery({ name: 'lowStock', required: false, description: 'Filter products with low stock' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order (asc/desc)' })
  async findAll(@Query() query: ProductQueryDto): Promise<ProductsQueryResponse> {
    return this.productService.findAll(query);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Get product statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product statistics retrieved successfully' })
  async getStatistics() {
    return this.productService.getStatistics();
  }

  @Get('low-stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Get products with low stock' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Low stock products retrieved successfully', type: [ProductResponse] })
  async checkLowStock(): Promise<ProductResponse[]> {
    return this.productService.checkLowStock();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.SALES, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product retrieved successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async findById(@Param('id') id: string): Promise<ProductResponse> {
    return this.productService.findById(id);
  }

  @Get('sku/:sku')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER, UserRole.SALES, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get product by SKU' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product retrieved successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'sku', description: 'Product SKU' })
  async findBySku(@Param('sku') sku: string): Promise<ProductResponse> {
    return this.productService.findBySku(sku);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product updated successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: any,
  ): Promise<ProductResponse> {
    return this.productService.update(id, updateProductDto, req.user?.id);
  }

  @Patch(':id/stock')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Update product stock quantity' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product stock updated successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid stock quantity' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: { quantity: number; reason: string },
    @Request() req: any,
  ): Promise<ProductResponse> {
    return this.productService.updateStock(id, updateStockDto.quantity, updateStockDto.reason, req.user?.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.INVENTORY_MANAGER)
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product deleted successfully', type: ProductResponse })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Product not found' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async remove(@Param('id') id: string, @Request() req: any): Promise<ProductResponse> {
    return this.productService.remove(id, req.user?.id);
  }
}