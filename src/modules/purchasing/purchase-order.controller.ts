import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  Logger,
  NotFoundException,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ApprovalActionDto,
  PurchaseOrderResponse,
  PurchaseOrdersQueryResponse,
  PurchaseOrderQueryDto,
  PurchaseOrderSummaryDto,
} from './dto/purchase-order.dto';

/**
 * Purchase Order Controller - RESTful API endpoints
 * Follows KISS principle with simple, focused endpoints
 * Implements comprehensive PO management with approval workflows
 * Complete CRUD operations with security validation
 */
@Controller('purchase-orders')
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class PurchaseOrderController {
  private readonly logger = new Logger(PurchaseOrderController.name);

  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  /**
   * Create a new purchase order
   * POST /api/v1/purchase-orders
   */
  @Post()
  async createPurchaseOrder(@Body() createPurchaseOrderDto: CreatePurchaseOrderDto): Promise<PurchaseOrderResponse> {
    this.logger.log(`Creating purchase order for supplier!: ${createPurchaseOrderDto.supplierId}`);
    return this.purchaseOrderService.createPurchaseOrder(createPurchaseOrderDto);
  }

  /**
   * Get all purchase orders with pagination and filtering
   * GET /api/v1/purchase-orders
   */
  @Get()
  async getPurchaseOrders(@Query() queryDto: PurchaseOrderQueryDto): Promise<PurchaseOrdersQueryResponse> {
    this.logger.log(`Fetching purchase orders with query!: ${JSON.stringify(queryDto)}`);
    return this.purchaseOrderService.getPurchaseOrders(queryDto);
  }

  /**
   * Get a specific purchase order by ID
   * GET /api/v1/purchase-orders/:id
   */
  @Get(':id')
  async getPurchaseOrderById(@Param('id', ParseUUIDPipe) id: string): Promise<PurchaseOrderResponse> {
    this.logger.log(`Fetching purchase order by ID!: ${id}`);
    const purchaseOrder = await this.purchaseOrderService.getPurchaseOrderById(id);

    if (!purchaseOrder) {
      this.logger.warn(`Purchase order not found!: ${id}`);
      throw new NotFoundException(`Purchase order with ID ${id} not found`);
    }

    return purchaseOrder;
  }

  /**
   * Update a purchase order (only DRAFT status allowed)
   * PUT /api/v1/purchase-orders/:id
   */
  @Put(':id')
  async updatePurchaseOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePurchaseOrderDto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponse> {
    this.logger.log(`Updating purchase order ${id} with data!: ${JSON.stringify(updatePurchaseOrderDto)}`);
    return this.purchaseOrderService.updatePurchaseOrder(id, updatePurchaseOrderDto);
  }

  /**
   * Submit purchase order for approval
   * POST /api/v1/purchase-orders/:id/submit-for-approval
   */
  @Post(':id/submit-for-approval')
  async submitForApproval(@Param('id', ParseUUIDPipe) id: string): Promise<PurchaseOrderResponse> {
    this.logger.log(`Submitting purchase order for approval!: ${id}`);
    return this.purchaseOrderService.submitForApproval(id);
  }

  /**
   * Process approval action (APPROVE/REJECT/REQUEST_CHANGES)
   * POST /api/v1/purchase-orders/:id/approve
   */
  @Post(':id/approve')
  async processApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approvalDto: ApprovalActionDto,
  ): Promise<PurchaseOrderResponse> {
    this.logger.log(`Processing approval for order ${id}!: ${approvalDto.action}`);
    return this.purchaseOrderService.processApproval(id, approvalDto);
  }

  /**
   * Cancel a purchase order
   * POST /api/v1/purchase-orders/:id/cancel
   */
  @Post(':id/cancel')
  async cancelPurchaseOrder(@Param('id', ParseUUIDPipe) id: string): Promise<PurchaseOrderResponse> {
    this.logger.log(`Cancelling purchase order!: ${id}`);
    return this.purchaseOrderService.cancelPurchaseOrder(id);
  }

  /**
   * Get purchase order summary for dashboard
   * GET /api/v1/purchase-orders/summary
   */
  @Get('summary')
  async getPurchaseOrderSummary(): Promise<PurchaseOrderSummaryDto> {
    this.logger.log('Fetching purchase order summary');
    return this.purchaseOrderService.getPurchaseOrderSummary();
  }

  /**
   * Delete (soft delete) a purchase order
   * DELETE /api/v1/purchase-orders/:id
   * Only allows deletion of draft or pending approval orders
   */
  @Delete(':id')
  async deletePurchaseOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`Soft deleting purchase order: ${id}`);

      // Get user ID from request (assuming authentication middleware sets this)
      const deletedBy = req.user?.id || req.user?.sub || 'anonymous';

      await this.purchaseOrderService.softDeletePurchaseOrder(id, deletedBy);

      this.logger.log(`Successfully soft deleted purchase order: ${id}`);
      return { message: 'Purchase order deleted successfully' };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to delete purchase order ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Failed to delete purchase order');
    }
  }
}