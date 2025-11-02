import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuditService } from '../../../shared/audit/services/audit.service';
import { Order as PrismaOrder } from '@prisma/client';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { UpdateOrderStatusDto } from '../dto/update-order-status.dto';
import { AddOrderItemDto } from '../dto/add-order-item.dto';
import { UpdateOrderItemDto } from '../dto/update-order-item.dto';
import { OrderQueryDto } from '../dto/order-query.dto';
import { OrderStatus } from '../enums/sales.enum';
import { SecurityService } from '../../../shared/security/security.service';
import { CustomerService } from './customer.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly customerService: CustomerService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new sales order
   */
  async create(createOrderDto: CreateOrderDto, userId?: string): Promise<PrismaOrder> {
    this.logger.log(`Creating order for customer: ${createOrderDto.customerId}`);

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(createOrderDto);

    // Validate customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: sanitizedData.customerId, isActive: true },
    });

    if (!customer) {
      throw new NotFoundException(`Active customer with ID ${sanitizedData.customerId} not found`);
    }

    // Validate products exist and are active
    const productIds = sanitizedData.items.map((item: any) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are not available');
    }

    // Calculate order totals
    const orderItems: any[] = sanitizedData.items.map((item: any) => {
      const discount = item.discount || 0;
      const totalPrice = (item.quantity * item.unitPrice) - discount;

      return {
        productId: item.productId,
        description: `Product ${item.productId}`, // Will be updated with actual product name
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subtotal * (sanitizedData.taxRate || 0);
    const shippingCost = sanitizedData.shippingCost || 0;
    const totalAmount = subtotal + taxAmount + shippingCost;

    // Check customer credit limit
    const hasSufficientCredit = await this.customerService.checkCreditLimit(
      sanitizedData.customerId,
      totalAmount,
    );

    if (!hasSufficientCredit) {
      throw new BadRequestException('Order total exceeds customer credit limit');
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    try {
      // Basic validation
      if (totalAmount <= 0) {
        throw new BadRequestException('Order total must be positive');
      }

      // Create order and order items in a transaction
      const order = await this.prisma.$transaction(async (tx: any) => {
        const createdOrder = await tx.order.create({
          data: {
            orderNumber,
            customerId: sanitizedData.customerId,
            description: sanitizedData.description || 'Sales Order',
            subtotal,
            taxAmount,
            totalAmount,
            currency: sanitizedData.currency || 'USD',
            status: OrderStatus.DRAFT,
            notes: sanitizedData.notes,
            dueDate: sanitizedData.expectedDeliveryDate ?
              new Date(sanitizedData.expectedDeliveryDate) : undefined,
          },
        });

        // Create order items
        await tx.orderItem.createMany({
          data: orderItems.map((item, index) => ({
            orderId: createdOrder.id,
            productId: item.productId,
            description: products[index]?.name || `Product ${item.productId}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: sanitizedData.items[index]?.discount || 0,
            totalPrice: item.totalPrice,
          })),
        });

        return createdOrder;
      });

      // Update inventory (reduce stock)
      await this.updateInventoryForOrder(orderItems, false);

      // Log audit event for successful order creation
      await this.auditService.logCreate(
        'ORDER',
        order.id,
        {
          orderNumber,
          customerId: sanitizedData.customerId,
          totalAmount,
          status: OrderStatus.DRAFT,
          itemCount: orderItems.length,
        },
        userId,
        {
          action: 'CREATE_ORDER',
          orderNumber,
          customerCreditChecked: true,
          inventoryUpdated: true,
        },
      );

      this.logger.log(`Order created successfully with ID: ${order.id}`);
      return order;
    } catch (error) {
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
      const errorStack = error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined;

      // Log audit event for failed order creation
      if (userId) {
        await this.auditService.logBusinessEvent(
          'ORDER_CREATE_FAILED',
          'ORDER',
          'unknown',
          'CREATE',
          userId,
          {
            error: errorMessage,
            orderData: this.securityService.sanitizeInput(sanitizedData),
            customerId: sanitizedData.customerId,
          },
          'HIGH',
        );
      }

      this.logger.error(`Error creating order: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Get all orders with pagination and filtering
   */
  async findAll(query: OrderQueryDto): Promise<{ data: PrismaOrder[]; total: number; pagination: any }> {
    this.logger.log(`Finding orders with query: ${JSON.stringify(query)}`);

    const { page = 1, limit = 10, customerId, status, sortBy = 'orderDate', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.order.count({ where }),
    ]);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    this.logger.log(`Found ${orders.length} orders out of ${total} total`);
    return { data: orders, total, pagination };
  }

  /**
   * Get order by ID
   */
  async findOne(id: string): Promise<PrismaOrder> {
    this.logger.log(`Finding order with ID: ${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        orderItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Update order
   */
  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<PrismaOrder> {
    this.logger.log(`Updating order with ID: ${id}`);

    const order = await this.findOne(id);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Only draft orders can be updated');
    }

    // Sanitize input data
    const sanitizedData = this.securityService.sanitizeInput(updateOrderDto);

    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          ...sanitizedData,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      this.logger.log(`Order updated successfully with ID: ${id}`);
      return updatedOrder;
    } catch (error) {
      this.logger.error(`Error updating order: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto, userId?: string): Promise<PrismaOrder> {
    this.logger.log(`Updating order status for ID: ${id} to ${updateStatusDto.status}`);

    const order = await this.findOne(id);

    // Validate status transitions
    this.validateStatusTransition(order.status, updateStatusDto.status);

    const updateData: any = {
      status: updateStatusDto.status,
      updatedAt: new Date(),
    };

    // Add status-specific fields
    switch (updateStatusDto.status) {
      case OrderStatus.CONFIRMED:
        updateData.confirmedAt = new Date();
        break;
      case OrderStatus.SHIPPED:
        updateData.shippedAt = new Date();
        if (updateStatusDto.trackingNumber) {
          updateData.reference = updateStatusDto.trackingNumber;
        }
        break;
      case OrderStatus.DELIVERED:
        updateData.deliveredAt = new Date();
        break;
      case OrderStatus.CANCELLED:
        updateData.isActive = false;
        updateData.cancelledAt = new Date();
        if (updateStatusDto.cancellationReason) {
          updateData.notes = updateStatusDto.cancellationReason;
        }
        // Restore inventory for cancelled orders
        await this.restoreInventoryForOrder(id);
        break;
    }

    if (updateStatusDto.notes) {
      updateData.notes = updateStatusDto.notes;
    }

    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      // Log audit event for order status change
      await this.auditService.logBusinessEvent(
        'ORDER_STATUS_CHANGED',
        'ORDER',
        id,
        'UPDATE_STATUS',
        userId,
        {
          action: 'UPDATE_ORDER_STATUS',
          oldStatus: order.status,
          newStatus: updateStatusDto.status,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          trackingNumber: updateStatusDto.trackingNumber,
          cancellationReason: updateStatusDto.cancellationReason,
          notes: updateStatusDto.notes,
          inventoryRestored: updateStatusDto.status === OrderStatus.CANCELLED,
        },
        updateStatusDto.status === OrderStatus.CANCELLED ? 'HIGH' : 'MEDIUM',
      );

      this.logger.log(`Order status updated successfully for ID: ${id}`);
      return updatedOrder;
    } catch (error) {
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
      const errorStack = error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined;

      // Log audit event for failed status update
      if (userId) {
        await this.auditService.logBusinessEvent(
          'ORDER_STATUS_UPDATE_FAILED',
          'ORDER',
          id,
          'UPDATE_STATUS',
          userId,
          {
            error: errorMessage,
            oldStatus: order.status,
            newStatus: updateStatusDto.status,
            orderNumber: order.orderNumber,
          },
          'HIGH',
        );
      }

      this.logger.error(`Error updating order status: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  /**
   * Add item to existing order
   */
  async addItem(orderId: string, addItemDto: AddOrderItemDto): Promise<any> {
    this.logger.log(`Adding item to order ID: ${orderId}`);

    const order = await this.findOne(orderId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Items can only be added to draft orders');
    }

    // Validate product exists
    const product = await this.prisma.product.findUnique({
      where: { id: addItemDto.productId, isActive: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${addItemDto.productId} not found`);
    }

    const discount = addItemDto.discount || 0;
    const totalPrice = (addItemDto.quantity * addItemDto.unitPrice) - discount;

    try {
      const orderItem = await this.prisma.orderItem.create({
        data: {
          orderId,
          productId: addItemDto.productId,
          description: product.name,
          quantity: addItemDto.quantity,
          unitPrice: addItemDto.unitPrice,
          discount,
          totalPrice,
        },
        include: {
          product: true,
        },
      });

      // Recalculate order totals
      await this.recalculateOrderTotals(orderId);

      // Update inventory
      await this.updateInventoryForProduct(addItemDto.productId, addItemDto.quantity, false);

      this.logger.log(`Item added successfully to order ID: ${orderId}`);
      return orderItem;
    } catch (error) {
      this.logger.error(`Error adding item to order: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      throw error;
    }
  }

  /**
   * Update order item
   */
  async updateItem(orderId: string, itemId: string, updateItemDto: UpdateOrderItemDto): Promise<any> {
    this.logger.log(`Updating item ${itemId} in order ${orderId}`);

    const order = await this.findOne(orderId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Items can only be updated in draft orders');
    }

    // Get current order item
    const currentItem = await this.prisma.orderItem.findUnique({
      where: { id: itemId, orderId },
    });

    if (!currentItem) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    const updateData: any = {};

    if (updateItemDto.quantity !== undefined) {
      updateData.quantity = updateItemDto.quantity;
    }

    if (updateItemDto.unitPrice !== undefined) {
      updateData.unitPrice = updateItemDto.unitPrice;
    }

    if (updateItemDto.discount !== undefined) {
      updateData.discount = updateItemDto.discount;
    }

    // Recalculate total price
    const quantity = updateData.quantity || currentItem.quantity;
    const unitPrice = updateData.unitPrice || currentItem.unitPrice;
    const discount = updateData.discount || currentItem.discount;
    updateData.totalPrice = (quantity * unitPrice) - discount;

    try {
      const updatedItem = await this.prisma.orderItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          product: true,
        },
      });

      // Update inventory based on quantity change
      const quantityDifference = quantity - currentItem.quantity;
      if (quantityDifference !== 0) {
        await this.updateInventoryForProduct(currentItem.productId, Math.abs(quantityDifference), quantityDifference < 0);
      }

      // Recalculate order totals
      await this.recalculateOrderTotals(orderId);

      this.logger.log(`Order item updated successfully: ${itemId}`);
      return updatedItem;
    } catch (error) {
      this.logger.error(`Error updating order item: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      throw error;
    }
  }

  /**
   * Remove item from order
   */
  async removeItem(orderId: string, itemId: string): Promise<void> {
    this.logger.log(`Removing item ${itemId} from order ${orderId}`);

    const order = await this.findOne(orderId);

    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('Items can only be removed from draft orders');
    }

    // Get current order item
    const currentItem = await this.prisma.orderItem.findUnique({
      where: { id: itemId, orderId },
    });

    if (!currentItem) {
      throw new NotFoundException(`Order item with ID ${itemId} not found`);
    }

    try {
      await this.prisma.orderItem.delete({
        where: { id: itemId },
      });

      // Restore inventory
      await this.updateInventoryForProduct(currentItem.productId, currentItem.quantity, true);

      // Recalculate order totals
      await this.recalculateOrderTotals(orderId);

      this.logger.log(`Order item removed successfully: ${itemId}`);
    } catch (error) {
      this.logger.error(`Error removing order item: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`, error instanceof Error ? error instanceof Error ? error.stack : undefined : undefined);
      throw error;
    }
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}`;

    // Find the last order number for this year
    const lastOrder = await this.prisma.order.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        orderNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    return `${prefix}-${sequence.toString().padStart(3, '0')}`;
  }

  /**
   * Validate order status transitions
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.DRAFT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Recalculate order totals
   */
  private async recalculateOrderTotals(orderId: string): Promise<void> {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    const subtotal = orderItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice), 0);
    const taxAmount = subtotal * 0; // taxRate not in schema, use 0 for now
    const totalAmount = subtotal + taxAmount;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        taxAmount,
        totalAmount,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update inventory for order items
   */
  private async updateInventoryForOrder(orderItems: any[], restore: boolean): Promise<void> {
    for (const item of orderItems) {
      await this.updateInventoryForProduct(item.productId, item.quantity, restore);
    }
  }

  /**
   * Update inventory for a single product
   */
  private async updateInventoryForProduct(productId: string, quantity: number, restore: boolean): Promise<void> {
    const adjustment = restore ? quantity : -quantity;

    await this.prisma.stockMovement.create({
      data: {
        productId,
        type: restore ? 'IN' : 'OUT',
        quantity: adjustment,
        reason: restore ? 'Order cancelled' : 'Order created',
      },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: {
          increment: adjustment,
        },
      },
    });
  }

  /**
   * Restore inventory for cancelled order
   */
  private async restoreInventoryForOrder(orderId: string): Promise<void> {
    const orderItems = await this.prisma.orderItem.findMany({
      where: { orderId },
    });

    for (const item of orderItems) {
      await this.updateInventoryForProduct(item.productId, item.quantity, true);
    }
  }
}