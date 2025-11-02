import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { Audit } from '../../../shared/audit/decorators/audit.decorator';
import {
  StockMovementDto,
  StockAdjustmentDto,
  WarehouseTransferDto,
  StockMovementResponse,
  StockMovementsQueryResponse,
  StockMovementType,
} from '../dto/inventory.dto';
import { Product, StockMovement } from '@prisma/client';

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

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new stock movement with comprehensive validation and audit logging
   * Follows SOLID principles with single responsibility for stock movements
   */
  @Audit({
    eventType: 'STOCK_MOVEMENT_CREATED',
    resourceType: 'STOCK_MOVEMENT',
    action: 'CREATE',
    getResourceId: (_args: any[], result) => result?.id,
    getNewValues: (_args: any[], result) => result,
    severity: 'MEDIUM',
  })
  async createMovement(stockMovementDto: StockMovementDto, userId?: string): Promise<StockMovementResponse> {
    this.logger.log(`Creating stock movement: ${stockMovementDto.type} for product: ${stockMovementDto.productId}`);

    try {
      // Sanitize input data for security
      const sanitizedData = this.securityService.sanitizeInput(stockMovementDto);

      // Validate product exists and is active
      const product = await this.prismaService.product.findUnique({
        where: { id: sanitizedData.productId, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${sanitizedData.productId} not found or inactive`);
      }

      // Business rule: Validate stock availability for OUT movements
      if (sanitizedData.type === StockMovementType.OUT) {
        if (product.stockQuantity < sanitizedData.quantity) {
          throw new BadRequestException(
            `Insufficient stock. Available: ${product.stockQuantity}, Requested: ${sanitizedData.quantity}`
          );
        }
      }

      // Create stock movement in transaction for data consistency
      const result = await this.prismaService.$transaction(async (tx) => {
        let newStockQuantity = product.stockQuantity;

        // Update product stock based on movement type
        switch (sanitizedData.type) {
          case StockMovementType.IN:
            newStockQuantity += sanitizedData.quantity;
            break;
          case StockMovementType.OUT:
            newStockQuantity -= sanitizedData.quantity;
            break;
          case StockMovementType.ADJUSTMENT:
            newStockQuantity += sanitizedData.quantity; // Can be positive or negative
            break;
          case StockMovementType.TRANSFER:
            // Transfers don't change total stock, just location
            break;
        }

        // Business rule: Stock cannot be negative
        if (newStockQuantity < 0) {
          throw new BadRequestException(`Stock quantity cannot be negative. Resulting quantity would be: ${newStockQuantity}`);
        }

        // Update product stock if not a transfer
        if (sanitizedData.type !== StockMovementType.TRANSFER) {
          await tx.product.update({
            where: { id: sanitizedData.productId },
            data: {
              stockQuantity: newStockQuantity,
            },
          });
        }

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productId: sanitizedData.productId,
            type: sanitizedData.type,
            quantity: sanitizedData.quantity,
            reason: sanitizedData.reason,
            reference: sanitizedData.reference,
            createdById: userId,
          },
          include: {
            product: true,
          },
        });

        return movement;
      });

      this.logger.log(`Successfully created stock movement: ${result.id} (Type: ${result.type}, Quantity: ${result.quantity})`);
      return this.mapToStockMovementResponse(result);

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create stock movement: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create stock movement');
    }
  }

  /**
   * Create stock adjustment with comprehensive validation
   * Follows KISS principle with clear, focused implementation
   */
  @Audit({
    eventType: 'STOCK_ADJUSTMENT_CREATED',
    resourceType: 'STOCK_MOVEMENT',
    action: 'ADJUST',
    getResourceId: (_args: any[], result) => result?.id,
    getNewValues: (_args: any[], result) => result,
    severity: 'HIGH',
  })
  async createAdjustment(stockAdjustmentDto: StockAdjustmentDto, userId?: string): Promise<StockMovementResponse> {
    this.logger.log(`Creating stock adjustment for product: ${stockAdjustmentDto.productId}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(stockAdjustmentDto);

      // Validate product exists
      const product = await this.prismaService.product.findUnique({
        where: { id: sanitizedData.productId, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${sanitizedData.productId} not found or inactive`);
      }

      // Business rule: Stock cannot be negative after adjustment
      const newStockQuantity = product.stockQuantity + sanitizedData.quantity;
      if (newStockQuantity < 0) {
        throw new BadRequestException(
          `Stock adjustment would result in negative stock. Current: ${product.stockQuantity}, Adjustment: ${sanitizedData.quantity}`
        );
      }

      // Create adjustment in transaction
      const result = await this.prismaService.$transaction(async (tx) => {
        // Update product stock
        await tx.product.update({
          where: { id: sanitizedData.productId },
          data: {
            stockQuantity: newStockQuantity,
          },
        });

        // Create stock movement record
        const movement = await tx.stockMovement.create({
          data: {
            productId: sanitizedData.productId,
            type: StockMovementType.ADJUSTMENT,
            quantity: Math.abs(sanitizedData.quantity),
            reason: sanitizedData.reason,
            reference: sanitizedData.reference,
            createdById: userId,
          },
          include: {
            product: true,
          },
        });

        return movement;
      });

      this.logger.log(`Successfully created stock adjustment: ${result.id} (Quantity: ${sanitizedData.quantity})`);
      return this.mapToStockMovementResponse(result);

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create stock adjustment: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create stock adjustment');
    }
  }

  /**
   * Create warehouse transfer with comprehensive validation
   * Follows SOLID principles with clear separation of concerns
   */
  @Audit({
    eventType: 'WAREHOUSE_TRANSFER_CREATED',
    resourceType: 'STOCK_MOVEMENT',
    action: 'TRANSFER',
    getResourceId: (_args: any[], result) => result?.id,
    getNewValues: (_args: any[], result) => result,
    severity: 'MEDIUM',
  })
  async createTransfer(warehouseTransferDto: WarehouseTransferDto, userId?: string): Promise<StockMovementResponse> {
    this.logger.log(`Creating warehouse transfer for product: ${warehouseTransferDto.productId}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(warehouseTransferDto);

      // Validate product exists
      const product = await this.prismaService.product.findUnique({
        where: { id: sanitizedData.productId, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${sanitizedData.productId} not found or inactive`);
      }

      // Business rule: Validate stock availability for transfer
      if (product.stockQuantity < sanitizedData.quantity) {
        throw new BadRequestException(
          `Insufficient stock for transfer. Available: ${product.stockQuantity}, Requested: ${sanitizedData.quantity}`
        );
      }

      // Create transfer record
      const result = await this.prismaService.stockMovement.create({
        data: {
          productId: sanitizedData.productId,
          type: StockMovementType.TRANSFER,
          quantity: sanitizedData.quantity,
          reason: sanitizedData.reason,
          reference: sanitizedData.reference,
          createdById: userId,
        },
        include: {
          product: true,
        },
      });

      this.logger.log(`Successfully created warehouse transfer: ${result.id} (Quantity: ${sanitizedData.quantity})`);
      return this.mapToStockMovementResponse(result);

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to create warehouse transfer: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to create warehouse transfer');
    }
  }

  /**
   * Get stock movements with comprehensive filtering and pagination
   * Follows KISS principle with straightforward query logic
   */
  async getMovements(query: StockMovementQuery): Promise<StockMovementsQueryResponse> {
    this.logger.log(`Getting stock movements with query: ${JSON.stringify(query)}`);

    try {
      // Build where clause for filtering
      const where: any = {};

      if (query.productId) {
        where.productId = query.productId;
      }

      if (query.type) {
        where.type = query.type;
      }

      if (query.reference) {
        where.reference = { contains: query.reference, mode: 'insensitive' };
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = query.startDate;
        }
        if (query.endDate) {
          where.createdAt.lte = query.endDate;
        }
      }

      // Pagination setup
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Sorting setup
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      const orderBy = { [sortBy]: sortOrder };

      // Execute queries in parallel for performance
      const [movements, total] = await Promise.all([
        this.prismaService.stockMovement.findMany({
          where,
          include: {
            product: true,
          },
          orderBy,
          skip,
          take: limit,
        }),
        this.prismaService.stockMovement.count({ where }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);

      // Transform to response format
      const movementResponses: StockMovementResponse[] = movements.map(this.mapToStockMovementResponse);

      this.logger.log(`Found ${movements.length} stock movements (total: ${total})`);

      return {
        movements: movementResponses,
        total,
        page,
        limit,
        totalPages,
      };

    } catch (error) {
      this.logger.error(`Failed to get stock movements: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve stock movements');
    }
  }

  /**
   * Get stock movement by ID with comprehensive error handling
   */
  async getMovementById(id: string): Promise<StockMovementResponse> {
    this.logger.log(`Getting stock movement by ID: ${id}`);

    try {
      const movement = await this.prismaService.stockMovement.findUnique({
        where: { id },
        include: {
          product: true,
        },
      });

      if (!movement) {
        throw new NotFoundException(`Stock movement with ID ${id} not found`);
      }

      return this.mapToStockMovementResponse(movement);

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get stock movement by ID: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve stock movement');
    }
  }

  /**
   * Get stock history for a specific product
   * Essential for product tracking and audit trails
   */
  async getProductStockHistory(productId: string, limit?: number): Promise<StockMovementResponse[]> {
    this.logger.log(`Getting stock history for product: ${productId}`);

    try {
      // Validate product exists
      const product = await this.prismaService.product.findUnique({
        where: { id: productId, isActive: true },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found or inactive`);
      }

      // Get stock movements for the product
      const movements = await this.prismaService.stockMovement.findMany({
        where: { productId },
        include: {
          product: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit || 100,
      });

      const movementResponses = movements.map(this.mapToStockMovementResponse);

      this.logger.log(`Found ${movementResponses.length} stock movements for product: ${productId}`);
      return movementResponses;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get product stock history: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve product stock history');
    }
  }

  /**
   * Get comprehensive stock summary for all products
   * Supports business intelligence and reporting
   */
  async getStockSummary(): Promise<any[]> {
    this.logger.log('Getting stock summary for all products');

    try {
      // Get all active products
      const products = await this.prismaService.product.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      // Get latest movement for each product
      const latestMovements = await Promise.all(
        products.map(async (product) => {
          const latestMovement = await this.prismaService.stockMovement.findFirst({
            where: { productId: product.id },
            orderBy: { createdAt: 'desc' },
          });

          return {
            productId: product.id,
            lastMovementDate: latestMovement?.createdAt || null,
          };
        })
      );

      // Get movement summaries by product and type
      const movementSummaries = await this.prismaService.stockMovement.groupBy({
        by: ['productId', 'type'],
        _sum: { quantity: true },
        _count: { id: true },
      });

      // Combine data into comprehensive summary
      const stockSummary = products.map(product => {
        const productMovements = movementSummaries.filter(m => m.productId === product.id);
        const latestMovement = latestMovements.find(m => m.productId === product.id);

        const inMovements = productMovements.find(m => m.type === StockMovementType.IN);
        const outMovements = productMovements.find(m => m.type === StockMovementType.OUT);

        return {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          currentStock: product.stockQuantity,
          lowStockThreshold: product.lowStockThreshold,
          isLowStock: product.stockQuantity <= product.lowStockThreshold,
          totalMovementsIn: inMovements?._sum.quantity || 0,
          totalMovementsOut: outMovements?._sum.quantity || 0,
          totalMovementCount: productMovements.reduce((sum, m) => sum + m._count.id, 0),
          lastMovementDate: latestMovement?.lastMovementDate,
        };
      });

      this.logger.log(`Generated stock summary for ${stockSummary.length} products`);
      return stockSummary;

    } catch (error) {
      this.logger.error(`Failed to get stock summary: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve stock summary');
    }
  }

  /**
   * Get low stock alerts for products below threshold
   * Essential for inventory management and reorder notifications
   */
  async getLowStockAlerts(): Promise<any[]> {
    this.logger.log('Getting low stock alerts');

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

      const alerts = lowStockProducts.map(product => {
        const stockDeficit = product.lowStockThreshold - product.stockQuantity;
        const stockPercentage = (product.stockQuantity / product.lowStockThreshold) * 100;

        // Determine alert severity based on stock level
        let severity = 'LOW';
        if (stockPercentage <= 25) severity = 'CRITICAL';
        else if (stockPercentage <= 50) severity = 'HIGH';
        else if (stockPercentage <= 75) severity = 'MEDIUM';

        return {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          categoryName: product.category?.name,
          currentStock: product.stockQuantity,
          lowStockThreshold: product.lowStockThreshold,
          stockDeficit,
          stockPercentage: Math.round(stockPercentage),
          severity,
          suggestedReorderQuantity: Math.max(product.lowStockThreshold * 2 - product.stockQuantity, product.lowStockThreshold),
          lastUpdated: product.updatedAt,
        };
      });

      this.logger.log(`Generated ${alerts.length} low stock alerts`);
      return alerts;

    } catch (error) {
      this.logger.error(`Failed to get low stock alerts: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw new InternalServerErrorException('Failed to retrieve low stock alerts');
    }
  }

  /**
   * Helper method to map StockMovement entity to StockMovementResponse
   * Follows DRY principle with consistent data transformation
   */
  private mapToStockMovementResponse(movement: StockMovement & { product?: Product }): StockMovementResponse {
    const totalCost = movement.quantity * (movement as any).unitCost || 0;

    return {
      id: movement.id,
      productId: movement.productId,
      productName: movement.product?.name,
      productSku: movement.product?.sku,
      type: movement.type as StockMovementType,
      quantity: movement.quantity,
      reason: movement.reason,
      reference: movement.reference || undefined,
      sourceLocation: undefined,
      destinationLocation: undefined,
      unitCost: (movement as any).unitCost,
      totalCost,
      createdById: movement.createdById || undefined,
      createdBy: movement.createdById || undefined,
      createdAt: movement.createdAt,
      metadata: (movement as any).metadata,
    };
  }
}