import { Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { SecurityService } from '../../shared/security/security.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  PurchaseOrderStatus,
  ApprovalActionDto,
  PurchaseOrderResponse,
  PurchaseOrderQueryDto,
  PurchaseOrdersQueryResponse,
  PurchaseOrderItemResponse,
  PurchaseOrderSummaryDto,
  PurchaseOrderAnalyticsDto,
} from './dto/purchase-order.dto';

/**
 * Enterprise Purchase Order Service
 * Implements SOLID principles with single responsibility for PO management
 * Follows KISS principle with clean, focused implementation
 * TDD approach with comprehensive business logic validation
 * Complete approval workflow system with security compliance
 */
@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Create a new purchase order with comprehensive validation
   * Follows OWASP security requirements and business rules
   */
  async createPurchaseOrder(createPurchaseOrderDto: CreatePurchaseOrderDto): Promise<PurchaseOrderResponse> {
    try {
      this.logger.log(`Creating purchase order for supplier: ${createPurchaseOrderDto.supplierId}`);

      // Input validation and sanitization (OWASP A03)
      if (!this.securityService.validateInput(createPurchaseOrderDto)) {
        this.logger.warn(`Invalid input data for PO creation: ${createPurchaseOrderDto.supplierId}`);
        throw new BadRequestException('Invalid purchase order data');
      }

      const sanitizedData = this.securityService.sanitizeInput(createPurchaseOrderDto) as CreatePurchaseOrderDto;

      // Validate supplier exists and is active
      const supplier = await this.prismaService.supplier.findUnique({
        where: { id: sanitizedData.supplierId },
      });

      if (!supplier) {
        this.logger.warn(`Supplier not found for PO creation: ${sanitizedData.supplierId}`);
        throw new NotFoundException(`Supplier with ID ${sanitizedData.supplierId} not found`);
      }

      if (!supplier.isActive) {
        this.logger.warn(`Inactive supplier attempted for PO creation: ${sanitizedData.supplierId}`);
        throw new BadRequestException(`Supplier ${supplier.name} is not active`);
      }

      // Validate requesting user exists
      const requester = await this.prismaService.user.findUnique({
        where: { id: sanitizedData.requestedBy },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (!requester) {
        this.logger.warn(`Requesting user not found: ${sanitizedData.requestedBy}`);
        throw new NotFoundException(`User with ID ${sanitizedData.requestedBy} not found`);
      }

      // Validate items and calculate totals
      if (!sanitizedData.items || sanitizedData.items.length === 0) {
        throw new BadRequestException('Purchase order must contain at least one item');
      }

      const totalAmount = this.calculateOrderTotal(sanitizedData.items) as any;

      // Generate unique order number
      const orderNumber = await this.generateOrderNumber();

      // Create purchase order with items in a transaction
      const result = await this.prismaService.$transaction(async (tx) => {
        // Create main purchase order
        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            orderNumber,
            supplierId: sanitizedData.supplierId,
            description: sanitizedData.notes,
            status: PurchaseOrderStatus.DRAFT,
            orderDate: sanitizedData.orderDate,
            expectedDate: sanitizedData.expectedDeliveryDate,
            totalAmount,
            notes: sanitizedData.notes,
            createdBy: sanitizedData.requestedBy,
          },
        });

        // Create purchase order items
        const orderItems = await Promise.all(
          sanitizedData.items.map(async (item) => {
            const itemTotal = item.quantity * item.unitPrice;
            return tx.purchaseOrderItem.create({
              data: {
                orderId: purchaseOrder.id,
                productId: item.productId,
                description: item.description || `Product ${item.productId}`,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: itemTotal,
              },
            });
          }),
        );

        return { purchaseOrder, orderItems };
      });

      // Fetch complete order with relationships for response
      const completeOrder = await this.getPurchaseOrderById(result.purchaseOrder.id);

      this.logger.log(`Successfully created purchase order: ${orderNumber} (ID: ${result.purchaseOrder.id})`);
      return completeOrder!;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to create purchase order: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create purchase order');
    }
  }

  /**
   * Submit purchase order for approval workflow
   * Transitions status from DRAFT to PENDING_APPROVAL
   */
  async submitForApproval(orderId: string): Promise<PurchaseOrderResponse> {
    try {
      this.logger.log(`Submitting purchase order for approval: ${orderId}`);

      const order = await this.prismaService.purchaseOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Purchase order with ID ${orderId} not found`);
      }

      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT orders can be submitted for approval');
      }

      const updatedOrder = await this.prismaService.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: PurchaseOrderStatus.PENDING_APPROVAL,
          updatedAt: new Date(),
        },
      });

      const completeOrder = await this.getPurchaseOrderById(orderId);

      this.logger.log(`Successfully submitted order for approval: ${order.orderNumber}`);
      return completeOrder!;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to submit order for approval ${orderId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to submit order for approval');
    }
  }

  /**
   * Process approval action (APPROVE/REJECT)
   * Handles workflow transitions with proper validation
   */
  async processApproval(orderId: string, approvalDto: ApprovalActionDto): Promise<PurchaseOrderResponse> {
    try {
      this.logger.log(`Processing approval for order ${orderId}: ${approvalDto.action}`);

      const order = await this.prismaService.purchaseOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Purchase order with ID ${orderId} not found`);
      }

      if (order.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Only PENDING_APPROVAL orders can be processed for approval');
      }

      // Validate approver exists
      const approver = await this.prismaService.user.findUnique({
        where: { id: approvalDto.approvedBy },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      });

      if (!approver) {
        throw new NotFoundException(`Approver with ID ${approvalDto.approvedBy} not found`);
      }

      // Determine new status based on action
      let newStatus: PurchaseOrderStatus;
      switch (approvalDto.action) {
        case 'APPROVE':
          newStatus = PurchaseOrderStatus.APPROVED;
          break;
        case 'REJECT':
          newStatus = PurchaseOrderStatus.REJECTED;
          break;
        case 'REQUEST_CHANGES':
          newStatus = PurchaseOrderStatus.DRAFT;
          break;
        default:
          throw new BadRequestException(`Invalid approval action: ${approvalDto.action}`);
      }

      const updatedOrder = await this.prismaService.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          updatedAt: new Date(),
          // Note: In a real implementation, we'd add approval fields to the schema
          // For now, we'll store approval info in the description field
          description: approvalDto.comments ?
            `${order.description || ''}\n\n${approvalDto.action} by ${approver.firstName} ${approver.lastName}: ${approvalDto.comments}` :
            order.description,
        },
      });

      const completeOrder = await this.getPurchaseOrderById(orderId);

      this.logger.log(`Successfully processed approval for order ${order.orderNumber}: ${newStatus}`);
      return completeOrder!;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to process approval for order ${orderId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process approval');
    }
  }

  /**
   * Get purchase orders with pagination, filtering, and search
   * Implements efficient querying with proper indexing
   */
  async getPurchaseOrders(queryDto: PurchaseOrderQueryDto): Promise<PurchaseOrdersQueryResponse> {
    try {
      this.logger.log(`Fetching purchase orders with query: ${JSON.stringify(queryDto)}`);

      const {
        search,
        supplierId,
        status,
        requestedBy,
        approvedBy,
        orderDateFrom,
        orderDateTo,
        expectedDeliveryDateFrom,
        expectedDeliveryDateTo,
        minTotalAmount,
        maxTotalAmount,
        skip,
        take,
        sortBy,
        sortOrder,
      } = queryDto;

      // Build where clause for filtering
      const where: any = {};

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (supplierId) {
        where.supplierId = supplierId;
      }

      if (status) {
        where.status = status;
      }

      if (requestedBy) {
        where.createdBy = requestedBy;
      }

      if (orderDateFrom || orderDateTo) {
        where.orderDate = {};
        if (orderDateFrom) where.orderDate.gte = orderDateFrom;
        if (orderDateTo) where.orderDate.lte = orderDateTo;
      }

      if (expectedDeliveryDateFrom || expectedDeliveryDateTo) {
        where.expectedDate = {};
        if (expectedDeliveryDateFrom) where.expectedDate.gte = expectedDeliveryDateFrom;
        if (expectedDeliveryDateTo) where.expectedDate.lte = expectedDeliveryDateTo;
      }

      if (minTotalAmount || maxTotalAmount) {
        where.totalAmount = {};
        if (minTotalAmount) where.totalAmount.gte = minTotalAmount;
        if (maxTotalAmount) where.totalAmount.lte = maxTotalAmount;
      }

      // Execute queries in parallel for performance
      const [orders, total] = await Promise.all([
        this.prismaService.purchaseOrder.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                email: true,
                code: true,
              },
            },
            orderItems: {
              include: {
                // Note: Product relation would be added when schema is updated
              },
            },
          },
        }),
        this.prismaService.purchaseOrder.count({ where }),
      ]);

      // Transform data to match response DTO
      const transformedOrders = orders.map(order => this.transformOrderToResponse(order));

      this.logger.log(`Retrieved ${orders.length} purchase orders out of ${total} total`);

      return {
        orders: transformedOrders,
        total,
        skip,
        take,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch purchase orders: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch purchase orders');
    }
  }

  /**
   * Get purchase order by ID with complete relationships
   */
  async getPurchaseOrderById(id: string): Promise<PurchaseOrderResponse | null> {
    try {
      this.logger.log(`Fetching purchase order by ID: ${id}`);

      const order = await this.prismaService.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              email: true,
              code: true,
            },
          },
          orderItems: {
            include: {
              // Note: Product relation would be added when schema is updated
            },
          },
        },
      });

      if (!order) {
        this.logger.warn(`Purchase order not found: ${id}`);
        return null;
      }

      // Get requester information
      let requester = null;
      if (order.createdBy) {
        requester = await this.prismaService.user.findUnique({
          where: { id: order.createdBy },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
      }

      const transformedOrder = this.transformOrderToResponse(order, requester);

      this.logger.log(`Successfully retrieved purchase order: ${order.orderNumber} (ID: ${id})`);
      return transformedOrder;

    } catch (error) {
      this.logger.error(`Failed to fetch purchase order by ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch purchase order');
    }
  }

  /**
   * Update purchase order (only allowed for DRAFT status)
   */
  async updatePurchaseOrder(id: string, updatePurchaseOrderDto: UpdatePurchaseOrderDto): Promise<PurchaseOrderResponse> {
    try {
      this.logger.log(`Updating purchase order ${id} with data: ${JSON.stringify(updatePurchaseOrderDto)}`);

      // Check if order exists and is in DRAFT status
      const existingOrder = await this.prismaService.purchaseOrder.findUnique({
        where: { id },
      });

      if (!existingOrder) {
        throw new NotFoundException(`Purchase order with ID ${id} not found`);
      }

      if (existingOrder.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT orders can be updated');
      }

      // Input validation and sanitization
      if (!this.securityService.validateInput(updatePurchaseOrderDto)) {
        throw new BadRequestException('Invalid purchase order data');
      }

      const sanitizedData = this.securityService.sanitizeInput(updatePurchaseOrderDto) as UpdatePurchaseOrderDto;

      let totalAmount = existingOrder.totalAmount;

      // Update items if provided
      if (sanitizedData.items) {
        totalAmount = this.calculateOrderTotal(sanitizedData.items) as any;

        // Update items in a transaction
        await this.prismaService.$transaction(async (tx) => {
          // Delete existing items
          await tx.purchaseOrderItem.deleteMany({
            where: { orderId: id },
          });

          // Create new items
          await Promise.all(
            sanitizedData.items!.map(async (item) => {
              const itemTotal = item.quantity * item.unitPrice;
              return tx.purchaseOrderItem.create({
                data: {
                  orderId: id,
                  productId: item.productId,
                  description: item.description || `Product ${item.productId}`,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: itemTotal,
                },
              });
            }),
          );
        });
      }

      // Update main order
      const updatedOrder = await this.prismaService.purchaseOrder.update({
        where: { id },
        data: {
          ...sanitizedData,
          totalAmount,
          expectedDate: sanitizedData.expectedDeliveryDate,
          description: sanitizedData.notes,
          updatedAt: new Date(),
        },
      });

      const completeOrder = await this.getPurchaseOrderById(id);

      this.logger.log(`Successfully updated purchase order: ${existingOrder.orderNumber} (ID: ${id})`);
      return completeOrder!;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to update purchase order ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update purchase order');
    }
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(id: string): Promise<PurchaseOrderResponse> {
    try {
      this.logger.log(`Cancelling purchase order: ${id}`);

      const order = await this.prismaService.purchaseOrder.findUnique({
        where: { id },
      });

      if (!order) {
        throw new NotFoundException(`Purchase order with ID ${id} not found`);
      }

      if (order.status === PurchaseOrderStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel order in COMPLETED status');
      }

      const updatedOrder = await this.prismaService.purchaseOrder.update({
        where: { id },
        data: {
          status: PurchaseOrderStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      const completeOrder = await this.getPurchaseOrderById(id);

      this.logger.log(`Successfully cancelled purchase order: ${order.orderNumber} (ID: ${id})`);
      return completeOrder!;

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to cancel purchase order ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to cancel purchase order');
    }
  }

  /**
   * Generate unique sequential order number
   * Format: PO-YYYY-NNN (e.g., PO-2024-001)
   */
  async generateOrderNumber(): Promise<string> {
    try {
      const currentYear = new Date().getFullYear();

      // Find existing orders for current year
      const existingOrders = await this.prismaService.purchaseOrder.findMany({
        where: {
          orderNumber: {
            startsWith: `PO-${currentYear}-`,
          },
        },
        orderBy: {
          orderNumber: 'desc',
        },
        take: 1,
      });

      let nextNumber = 1;
      if (existingOrders.length > 0) {
        const lastOrderNumber = existingOrders[0].orderNumber;
        const lastNumber = parseInt(lastOrderNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
      }

      return `PO-${currentYear}-${nextNumber.toString().padStart(3, '0')}`;

    } catch (error) {
      this.logger.error(`Failed to generate order number: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate order number');
    }
  }

  /**
   * Get purchase order summary for dashboard
   */
  async getPurchaseOrderSummary(): Promise<PurchaseOrderSummaryDto> {
    try {
      this.logger.log('Fetching purchase order summary');

      const [
        totalOrders,
        draftOrders,
        pendingApprovalOrders,
        approvedOrders,
        rejectedOrders,
        sentOrders,
        completedOrders,
        cancelledOrders,
        totalValueResult,
        pendingValueResult,
      ] = await Promise.all([
        this.prismaService.purchaseOrder.count(),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.DRAFT } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.PENDING_APPROVAL } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.APPROVED } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.REJECTED } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.SENT } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.COMPLETED } }),
        this.prismaService.purchaseOrder.count({ where: { status: PurchaseOrderStatus.CANCELLED } }),
        this.prismaService.purchaseOrder.aggregate({
          _sum: { totalAmount: true },
        }),
        this.prismaService.purchaseOrder.aggregate({
          _sum: { totalAmount: true },
          where: {
            status: {
              in: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.PENDING_APPROVAL, PurchaseOrderStatus.APPROVED],
            },
          },
        }),
      ]);

      const totalValue = parseFloat(totalValueResult._sum.totalAmount?.toString() || '0');
      const pendingValue = parseFloat(pendingValueResult._sum.totalAmount?.toString() || '0');
      const averageOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

      return {
        totalOrders,
        draftOrders,
        pendingApprovalOrders,
        approvedOrders,
        rejectedOrders,
        sentOrders,
        completedOrders,
        cancelledOrders,
        totalValue,
        pendingValue,
        averageOrderValue,
      };

    } catch (error) {
      this.logger.error(`Failed to fetch purchase order summary: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch purchase order summary');
    }
  }

  /**
   * Transform order database model to response DTO
   * Private helper method for consistent data transformation
   */
  private transformOrderToResponse(
    order: any,
    requester?: any,
  ): PurchaseOrderResponse {
    const transformedItems: PurchaseOrderItemResponse[] = order.orderItems.map((item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice.toString()),
      totalPrice: parseFloat(item.totalPrice.toString()),
      description: item.description,
      receivedQuantity: item.receivedQty,
      remainingQuantity: item.quantity - item.receivedQty,
    }));

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as PurchaseOrderStatus,
      supplierId: order.supplierId,
      supplier: order.supplier,
      orderDate: order.orderDate,
      expectedDeliveryDate: order.expectedDate,
      totalAmount: parseFloat(order.totalAmount.toString()),
      items: transformedItems,
      notes: order.notes,
      internalNotes: order.description, // Using description as internalNotes for now
      requestedBy: order.createdBy || '',
      requester: requester ? {
        id: requester.id,
        firstName: requester.firstName,
        lastName: requester.lastName,
        email: requester.email,
      } : undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Calculate total amount for purchase order items
   * Private helper method for order total calculation
   */
  private calculateOrderTotal(items: any[]): number {
    return items.reduce((total, item) => {
      return total + (item.quantity * item.unitPrice);
    }, 0);
  }
}