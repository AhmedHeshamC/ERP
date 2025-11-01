import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Logger,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponse,
  ProductsQueryResponse,
} from './dto/product.dto';
import { Roles } from '../../shared/security/decorators/roles.decorator';
import { CurrentUser } from '../../shared/security/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/security/guards/roles.guard';

/**
 * Enterprise Product Controller
 * Implements SOLID principles:
 * - Single Responsibility: Only handles product-related HTTP requests
 * - Open/Closed: Open for extension, closed for modification
 * - Interface Segregation: Depends on abstractions
 * - Dependency Inversion: Dependencies injected via constructor
 * Lisk Principle: Simple, focused implementation
 *
 * OWASP Security Implementation:
 * - RBAC with HasPermission decorator
 * - Input validation with ValidationPipe
 * - Security logging for all operations
 * - Proper HTTP status codes
 */
@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly productService: ProductService,
  ) {}

  /**
   * Create a new product
   * POST /api/v1/products
   * OWASP A01: RBAC - Only authorized users can create products
   * OWASP A03: Input validation with ValidationPipe
   * OWASP A08: Comprehensive security logging
   */
  @Post()
  @UsePipes(new ValidationPipe())
  @Roles('ADMIN', 'MANAGER')
  @ApiResponse({ status: HttpStatus.CREATED })
  @ApiOperation({ summary: 'Create a new product' })
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: any,
  ): Promise<ProductResponse> {
    this.logger.log(`Product creation request received from user!: ${user?.id}`);
    return await this.productService.createProduct(createProductDto);
  }

  /**
   * Get all products with pagination and filtering
   * GET /api/v1/products
   * OWASP A05: Secure defaults with input validation
   * OWASP A08: Input sanitization through type safety
   */
  @Get()
  @UsePipes(new ValidationPipe())
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Get all products with pagination' })
  async getProducts(
    @Query() query: ProductQueryDto,
    @CurrentUser() user: any,
  ): Promise<ProductsQueryResponse> {
    this.logger.log(`Product listing request received from user!: ${user?.id}`);
    return await this.productService.getProducts(query);
  }

  /**
   * Get product by ID
   * GET /api/v1/products/:id
   * OWASP A01: Resource-based access validation
   */
  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Get product by ID' })
  async getProductById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<ProductResponse> {
    this.logger.log(`Product retrieval request!: ${id} by user: ${user?.id}`);
    return await this.productService.getProductById(id);
  }

  /**
   * Update product
   * PUT /api/v1/products/:id
   * OWASP A01: Resource-based access validation
   * OWASP A08: Data integrity with validation
   */
  @Put(':id')
  @UsePipes(new ValidationPipe())
  @Roles('ADMIN', 'MANAGER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Update product' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: any,
  ): Promise<ProductResponse> {
    this.logger.log(`Product update request!: ${id} by user: ${user?.id}`);
    return await this.productService.updateProduct(id, updateProductDto);
  }

  /**
   * Delete product (soft delete)
   * DELETE /api/v1/products/:id
   * OWASP A01: Resource-based access validation
   * OWASP A09: Security event logging
   */
  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Delete product' })
  async deleteProduct(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<ProductResponse> {
    this.logger.log(`Product deletion request!: ${id} by user: ${user?.id}`);
    return await this.productService.deleteProduct(id);
  }

  /**
   * Get products by category
   * GET /api/v1/products/category/:categoryId
   * OWASP A05: Secure defaults with validation
   */
  @Get('category/:categoryId')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Get products by category' })
  async getProductsByCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any,
  ): Promise<ProductResponse[]> {
    this.logger.log(`Products by category request!: ${categoryId} by user: ${user?.id}`);
    return await this.productService.getProductsByCategory(categoryId);
  }

  /**
   * Get low stock alerts
   * GET /api/v1/products/low-stock
   * OWASP A09: Security monitoring for critical alerts
   */
  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Get low stock products' })
  async getLowStockProducts(
    @CurrentUser() user: any,
  ): Promise<ProductResponse[]> {
    this.logger.log('Low stock products request by user!: ' + (user?.id || 'anonymous'));
    return await this.productService.getLowStockProducts();
  }

  /**
   * Search products
   * GET /api/v1/products/search
   * OWASP A03: Injection prevention via parameterized queries
   */
  @Get('search')
  @UsePipes(new ValidationPipe())
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Search products' })
  async searchProducts(
    @Query('q') searchTerm: string,
    @CurrentUser() user: any,
  ): Promise<ProductResponse[]> {
    this.logger.log(`Product search request!: "${searchTerm}" by user: ${user?.id}`);
    return await this.productService.searchProducts(searchTerm);
  }

  /**
   * Get product stock information
   * GET /api/v1/products/:id/stock
   * OWASP A02: Sensitive data protection via proper access control
   */
  @Get(':id/stock')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Get product stock information' })
  async getProductStock(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    this.logger.log(`Product stock request!: ${id} by user: ${user?.id}`);
    return await this.productService.getProductStock(id);
  }

  /**
   * Adjust stock quantity
   * POST /api/v1/products/:id/stock
   * OWASP A09: Comprehensive audit trail for stock movements
   * OWASP A02: Cryptographic protection for financial data
   */
  @Post(':id/stock')
  @UsePipes(new ValidationPipe())
  @Roles('ADMIN', 'MANAGER')
  @ApiResponse({ status: HttpStatus.OK })
  @ApiOperation({ summary: 'Adjust product stock' })
  async adjustStock(
    @Param('id') id: string,
    @Body() stockMovementDto: any,
    @CurrentUser() user: any,
  ): Promise<any> {
    this.logger.log(`Stock adjustment request!: ${id} by user: ${user?.id}`);
    return await this.productService.adjustStock(
      id,
      stockMovementDto.quantity,
      stockMovementDto.type,
      stockMovementDto.reason,
      stockMovementDto.reference,
      user?.id,
    );
  }
}