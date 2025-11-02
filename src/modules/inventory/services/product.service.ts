import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
// import { CacheService } from '../../../shared/cache/cache.service'; // TODO: Enable in Phase 4
import { Audit } from '../../../shared/audit/decorators/audit.decorator';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponse,
  ProductsQueryResponse,
  ProductStatus,
} from '../dto/inventory.dto';
import { Product } from '@prisma/client';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
    // private readonly cacheService: CacheService, // TODO: Enable in Phase 4
  ) {}

  /**
   * Create a new product with comprehensive validation and audit logging
   * Follows SOLID principles with single responsibility for product creation
   */
  @Audit({
    eventType: 'PRODUCT_CREATED',
    resourceType: 'PRODUCT',
    action: 'CREATE',
    getResourceId: (_args, result) => result?.id,
    getNewValues: (_args, result) => result,
    severity: 'MEDIUM',
  })
  async create(createProductDto: CreateProductDto, userId?: string): Promise<Product> {
    this.logger.log(`Creating product: ${createProductDto.name} (SKU: ${createProductDto.sku})`);

    try {
      // Sanitize input data for security
      const sanitizedData = this.securityService.sanitizeInput(createProductDto);

      // Validate product category exists and is active
      const category = await this.prismaService.productCategory.findUnique({
        where: { id: sanitizedData.categoryId, isActive: true },
      });

      if (!category) {
        throw new NotFoundException(`Product category with ID ${sanitizedData.categoryId} not found or inactive`);
      }

      // Check if SKU already exists (business rule: unique SKUs)
      const existingProduct = await this.prismaService.product.findUnique({
        where: { sku: sanitizedData.sku },
      });

      if (existingProduct) {
        throw new ConflictException(`Product with SKU ${sanitizedData.sku} already exists`);
      }

      // Create product in transaction for data consistency
      const result = await this.prismaService.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: sanitizedData.name,
            sku: sanitizedData.sku,
            description: sanitizedData.description,
            price: sanitizedData.price,
            categoryId: sanitizedData.categoryId,
            status: sanitizedData.status || ProductStatus.ACTIVE,
            stockQuantity: sanitizedData.initialStock || 0,
            lowStockThreshold: sanitizedData.lowStockThreshold || 10,
            isActive: true,
          },
          include: {
            category: true,
          },
        });

        // Create initial stock movement if initial stock is provided
        if (sanitizedData.initialStock && sanitizedData.initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'IN',
              quantity: sanitizedData.initialStock,
              reason: 'Initial stock setup',
              createdById: userId,
            },
          });
        }

        return product;
      });

      // Invalidate product cache - TODO: Enable in Phase 4
      // await this.invalidateProductCache();

      this.logger.log(`Successfully created product: ${result.name} (ID: ${result.id})`);
      return result;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create product: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  /**
   * Find all products with comprehensive filtering and pagination
   * Follows KISS principle with straightforward query logic
   */
  async findAll(query: ProductQueryDto): Promise<ProductsQueryResponse> {
    this.logger.log(`Finding products with query: ${JSON.stringify(query)}`);

    try {
      // Sanitize query parameters
      const sanitizedQuery = this.securityService.sanitizeInput(query);

      // Generate cache key - TODO: Enable in Phase 4
      // const cacheKey = `products:list:${JSON.stringify(sanitizedQuery)}`;

      // Try to get from cache first - TODO: Enable in Phase 4
      // const cached = await this.cacheService.get<ProductsQueryResponse>(cacheKey, { ttl: 300 }); // 5 minutes cache

      // if (cached) {
      //   this.logger.log(`Cache hit for products list: ${cached.products.length} products`);
      //   return cached;
      // }

      // Build where clause for filtering
      const where: any = {};

      // Basic filters
      if (sanitizedQuery.categoryId) {
        where.categoryId = sanitizedQuery.categoryId;
      }

      if (sanitizedQuery.status) {
        where.status = sanitizedQuery.status;
      }

      if (sanitizedQuery.lowStock) {
        where.stockQuantity = { lte: this.prismaService.product.fields.lowStockThreshold };
      }

      // Search across multiple fields
      if (sanitizedQuery.search) {
        where.OR = [
          { name: { contains: sanitizedQuery.search, mode: 'insensitive' } },
          { sku: { contains: sanitizedQuery.search, mode: 'insensitive' } },
          { description: { contains: sanitizedQuery.search, mode: 'insensitive' } },
        ];
      }

      // Default to active products only
      if (where.isActive === undefined) {
        where.isActive = true;
      }

      // Pagination setup
      const page = sanitizedQuery.page || 1;
      const limit = Math.min(sanitizedQuery.limit || 20, 100); // Limit max page size
      const skip = (page - 1) * limit;

      // Sorting setup
      const sortBy = sanitizedQuery.sortBy || 'createdAt';
      const sortOrder = sanitizedQuery.sortOrder || 'desc';
      const orderBy = { [sortBy]: sortOrder };

      // Execute optimized queries in parallel for performance
      const [products, total] = await Promise.all([
        this.prismaService.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            sku: true,
            description: true,
            price: true,
            categoryId: true,
            status: true,
            stockQuantity: true,
            lowStockThreshold: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prismaService.product.count({ where }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      // Transform to response format
      const productResponses: ProductResponse[] = products.map((product) => this.mapToProductResponse(product));

      const result = {
        products: productResponses,
        total,
        page,
        limit,
        totalPages,
      };

      // Cache the result - TODO: Enable in Phase 4
      // await this.cacheService.set(cacheKey, result, { ttl: 300 });

      this.logger.log(`Found ${products.length} products (total: ${total})`);

      return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find products: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to retrieve products');
    }
  }

  /**
   * Find product by ID with comprehensive error handling
   */
  async findById(id: string): Promise<ProductResponse> {
    this.logger.log(`Finding product by ID: ${id}`);

    try {
      const product = await this.prismaService.product.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      return this.mapToProductResponse(product);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find product by ID: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to retrieve product');
    }
  }

  /**
   * Find product by SKU with comprehensive error handling
   */
  async findBySku(sku: string): Promise<ProductResponse> {
    this.logger.log(`Finding product by SKU: ${sku}`);

    try {
      const product = await this.prismaService.product.findUnique({
        where: { sku },
        include: {
          category: true,
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with SKU ${sku} not found`);
      }

      return this.mapToProductResponse(product);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to find product by SKU: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to retrieve product');
    }
  }

  /**
   * Update product with comprehensive validation and audit logging
   * Follows SOLID principles with clear separation of concerns
   */
  @Audit({
    eventType: 'PRODUCT_UPDATED',
    resourceType: 'PRODUCT',
    action: 'UPDATE',
    getResourceId: (_args) => _args[0],
    getOldValues: async (args: any[]) => {
      const productId = args[0];
      const prisma = args[3]; // Get prisma service from context
      return await prisma.product.findUnique({ where: { id: productId } });
    },
    getNewValues: (_args, result) => result,
    severity: 'MEDIUM',
  })
  async update(id: string, updateProductDto: UpdateProductDto, _userId?: string): Promise<ProductResponse> {
    this.logger.log(`Updating product: ${id}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(updateProductDto);

      // Validate product exists
      const existingProduct = await this.prismaService.product.findUnique({
        where: { id },
      });

      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      // Validate category exists if being updated
      if (sanitizedData.categoryId) {
        const category = await this.prismaService.productCategory.findUnique({
          where: { id: sanitizedData.categoryId, isActive: true },
        });

        if (!category) {
          throw new NotFoundException(`Product category with ID ${sanitizedData.categoryId} not found or inactive`);
        }
      }

      // Business rule: Cannot set status to ACTIVE if product is inactive
      if (sanitizedData.status === ProductStatus.ACTIVE && !existingProduct.isActive) {
        sanitizedData.isActive = true;
      }

      // Update product in transaction
      const updatedProduct = await this.prismaService.$transaction(async (tx) => {
        return await tx.product.update({
          where: { id },
          data: {
            ...sanitizedData,
            updatedAt: new Date(),
          },
          include: {
            category: true,
          },
        });
      });

      this.logger.log(`Successfully updated product: ${updatedProduct.name} (ID: ${updatedProduct.id})`);
      return this.mapToProductResponse(updatedProduct);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update product: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  /**
   * Soft delete product with audit logging
   * Follows enterprise patterns for data retention
   */
  @Audit({
    eventType: 'PRODUCT_DELETED',
    resourceType: 'PRODUCT',
    action: 'DELETE',
    getResourceId: (_args) => _args[0],
    getOldValues: async (args: any[]) => {
      const productId = args[0];
      const prisma = args[3];
      return await prisma.product.findUnique({ where: { id: productId } });
    },
    severity: 'HIGH',
  })
  async remove(id: string, _userId?: string): Promise<ProductResponse> {
    this.logger.log(`Removing product: ${id}`);

    try {
      // Validate product exists
      const existingProduct = await this.prismaService.product.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      // Soft delete product (don't hard delete for audit trail)
      const deletedProduct = await this.prismaService.$transaction(async (tx) => {
        return await tx.product.update({
          where: { id },
          data: {
            isActive: false,
            status: ProductStatus.INACTIVE,
            updatedAt: new Date(),
          },
          include: {
            category: true,
          },
        });
      });

      this.logger.log(`Successfully removed product: ${deletedProduct.name} (ID: ${deletedProduct.id})`);
      return this.mapToProductResponse(deletedProduct);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to remove product: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to remove product');
    }
  }

  /**
   * Update product stock quantity with comprehensive validation
   * Follows KISS principle with clear, focused implementation
   */
  @Audit({
    eventType: 'PRODUCT_STOCK_UPDATED',
    resourceType: 'PRODUCT',
    action: 'UPDATE_STOCK',
    getResourceId: (_args) => _args[0],
    getOldValues: async (args: any[]) => {
      const productId = args[0];
      const prisma = args[3];
      return await prisma.product.findUnique({ where: { id: productId } });
    },
    getNewValues: (_args: any[], result) => ({ stockQuantity: result.stockQuantity }),
    severity: 'MEDIUM',
  })
  async updateStock(id: string, quantityChange: number, reason: string, userId?: string): Promise<ProductResponse> {
    this.logger.log(`Updating stock for product: ${id} by ${quantityChange}`);

    try {
      // Validate product exists
      const existingProduct = await this.prismaService.product.findUnique({
        where: { id },
        include: {
          category: true,
        },
      });

      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      // Business rule: Stock cannot be negative
      const newStockQuantity = existingProduct.stockQuantity + quantityChange;
      if (newStockQuantity < 0) {
        throw new BadRequestException(`Stock quantity cannot be negative. Current: ${existingProduct.stockQuantity}, Change: ${quantityChange}`);
      }

      // Update stock in transaction
      const updatedProduct = await this.prismaService.$transaction(async (tx) => {
        // Update product stock
        const product = await tx.product.update({
          where: { id },
          data: {
            stockQuantity: newStockQuantity,
            updatedAt: new Date(),
          },
          include: {
            category: true,
          },
        });

        // Create stock movement record for audit trail
        await tx.stockMovement.create({
          data: {
            productId: id,
            type: quantityChange >= 0 ? 'IN' : 'OUT',
            quantity: Math.abs(quantityChange),
            reason: reason || 'Stock adjustment',
            createdById: userId,
          },
        });

        return product;
      });

      this.logger.log(`Successfully updated stock for product: ${updatedProduct.name} (New stock: ${updatedProduct.stockQuantity})`);
      return this.mapToProductResponse(updatedProduct);

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to update product stock: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to update product stock');
    }
  }

  /**
   * Check for products with low stock levels
   * Essential for inventory management and reorder notifications
   */
  async checkLowStock(): Promise<ProductResponse[]> {
    this.logger.log('Checking for products with low stock');

    try {
      const lowStockProducts = await this.prismaService.product.findMany({
        where: {
          isActive: true,
          stockQuantity: {
            lte: this.prismaService.product.fields.lowStockThreshold,
          },
        },
        include: {
          category: true,
        },
        orderBy: {
          stockQuantity: 'asc',
        },
      });

      const productResponses = lowStockProducts.map(product => ({
        ...this.mapToProductResponse(product),
        isLowStock: true,
      }));

      this.logger.log(`Found ${productResponses.length} products with low stock`);
      return productResponses;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to check low stock: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to check low stock levels');
    }
  }

  /**
   * Get product statistics for reporting and analytics
   * Supports business intelligence and decision making
   */
  async getStatistics(): Promise<any> {
    this.logger.log('Getting product statistics');

    try {
      const [
        totalProducts,
        activeProducts,
        inactiveProducts,
        lowStockProducts,
        totalStockValue,
        categoryStats,
      ] = await Promise.all([
        this.prismaService.product.count(),
        this.prismaService.product.count({ where: { isActive: true } }),
        this.prismaService.product.count({ where: { isActive: false } }),
        this.prismaService.product.count({
          where: {
            isActive: true,
            stockQuantity: { lte: this.prismaService.product.fields.lowStockThreshold },
          },
        }),
        this.prismaService.product.aggregate({
          where: { isActive: true },
          _sum: { stockQuantity: true },
        }),
        this.prismaService.productCategory.findMany({
          where: { isActive: true },
          include: {
            _count: {
              select: { products: { where: { isActive: true } } },
            },
          },
        }),
      ]);

      const statistics = {
        totalProducts,
        activeProducts,
        inactiveProducts,
        lowStockProducts,
        totalStockItems: totalStockValue._sum.stockQuantity || 0,
        categoryBreakdown: categoryStats.map(category => ({
          id: category.id,
          name: category.name,
          productCount: category._count.products,
        })),
      };

      this.logger.log('Successfully retrieved product statistics');
      return statistics;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to get product statistics: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException('Failed to retrieve product statistics');
    }
  }

  /**
   * Helper method to map Product entity to ProductResponse
   * Follows DRY principle with consistent data transformation
   */
  private mapToProductResponse(product: any): ProductResponse {
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: Number(product.price),
      categoryId: product.categoryId,
      categoryName: product.category?.name,
      status: product.status as ProductStatus,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      isLowStock: product.stockQuantity <= product.lowStockThreshold,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Invalidate all product-related cache entries
   */
  // private async invalidateProductCache(): Promise<void> {
  //   // TODO: Enable in Phase 4
  //   // await this.cacheService.delPattern('products:list:*');
  //   // await this.cacheService.delPattern('product:*');
  // }

  /**
   * Invalidate cache for a specific product - TODO: Implement in Phase 4
   */
  // private async invalidateSingleProductCache(productId: string): Promise<void> {
  //   const cacheKeys = [
  //     `product:${productId}`,
  //   ];

  //   for (const key of cacheKeys) {
  //     await this.cacheService.del(key);
  //   }

  //   // Also invalidate product list cache
  //   await this.invalidateProductCache();
  // }
}