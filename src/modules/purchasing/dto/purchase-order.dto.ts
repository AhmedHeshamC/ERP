import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, IsDate, Min, Max, MaxLength, ValidateNested, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Purchase Order Status Enum
 * Follows enterprise procurement workflow best practices
 */
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',                    // Initial creation state
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Submitted for approval
  APPROVED = 'APPROVED',              // Approved for procurement
  REJECTED = 'REJECTED',              // Rejected by approver
  SENT = 'SENT',                      // Sent to supplier
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', // Partial goods received
  COMPLETED = 'COMPLETED',            // Fully received and processed
  CANCELLED = 'CANCELLED',            // Cancelled before completion
}

/**
 * Approval Action Enum
 * Defines possible approval workflow actions
 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_CHANGES = 'REQUEST_CHANGES',
}

/**
 * Purchase Order Item DTO
 * Represents individual line items in a purchase order
 */
export class PurchaseOrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Quantity ordered' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: 'Unit price per item' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'Item description or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date for this item' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;
}

/**
 * Create Purchase Order DTO
 * Used for creating new purchase orders
 */
export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ description: 'Order date' })
  @IsDate()
  @Type(() => Date)
  orderDate: Date;

  @ApiPropertyOptional({ description: 'Expected delivery date for entire order' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;

  @ApiProperty({ description: 'Purchase order items', type: [PurchaseOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];

  @ApiPropertyOptional({ description: 'Order notes for supplier' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes (not visible to supplier)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @ApiProperty({ description: 'User ID who requested the order' })
  @IsUUID()
  requestedBy: string;

  @ApiPropertyOptional({ description: 'Delivery address if different from supplier address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingMethod?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentTerms?: string;
}

/**
 * Update Purchase Order DTO
 * Used for updating existing purchase orders (only DRAFT status)
 */
export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ description: 'Purchase order items', type: [PurchaseOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];

  @ApiPropertyOptional({ description: 'Order notes for supplier' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;

  @ApiPropertyOptional({ description: 'Delivery address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Shipping method' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingMethod?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentTerms?: string;
}

/**
 * Approval Action DTO
 * Used for processing purchase order approvals
 */
export class ApprovalActionDto {
  @ApiProperty({ description: 'Approval action', enum: ApprovalAction })
  @IsEnum(ApprovalAction)
  action: ApprovalAction;

  @ApiPropertyOptional({ description: 'Approval comments or rejection reason' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;

  @ApiProperty({ description: 'User ID who is approving/rejecting' })
  @IsUUID()
  approvedBy: string;
}

/**
 * Purchase Order Query DTO
 * Used for filtering and pagination
 */
export class PurchaseOrderQueryDto {
  @ApiPropertyOptional({ description: 'Search by order number or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional({ description: 'Filter by requesting user ID' })
  @IsOptional()
  @IsUUID()
  requestedBy?: string;

  @ApiPropertyOptional({ description: 'Filter by approver ID' })
  @IsOptional()
  @IsUUID()
  approvedBy?: string;

  @ApiPropertyOptional({ description: 'Filter by order date from' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDateFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter by order date to' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  orderDateTo?: Date;

  @ApiPropertyOptional({ description: 'Filter by expected delivery date from' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDateFrom?: Date;

  @ApiPropertyOptional({ description: 'Filter by expected delivery date to' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDateTo?: Date;

  @ApiPropertyOptional({ description: 'Minimum total amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  minTotalAmount?: number;

  @ApiPropertyOptional({ description: 'Maximum total amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  maxTotalAmount?: number;

  @ApiPropertyOptional({ description: 'Number of records to skip', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Number of records to return', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  take?: number = 10;

  @ApiPropertyOptional({ description: 'Field to sort by', default: 'orderDate' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sortBy?: string = 'orderDate';

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsOptional()
  @IsString()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * Purchase Order Item Response DTO
 * Represents item data in API responses
 */
export class PurchaseOrderItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  description?: string;
  expectedDeliveryDate?: Date;
  receivedQuantity?: number;
  remainingQuantity?: number;
}

/**
 * Purchase Order Response DTO
 * Represents purchase order data in API responses
 */
export class PurchaseOrderResponse {
  id: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    email: string;
    code: string;
  };
  orderDate: Date;
  expectedDeliveryDate?: Date;
  totalAmount: number;
  items: PurchaseOrderItemResponse[];
  notes?: string;
  internalNotes?: string;
  requestedBy: string;
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: string;
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: Date;
  approvalComments?: string;
  deliveryAddress?: string;
  shippingMethod?: string;
  paymentTerms?: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}

/**
 * Purchase Orders Query Response DTO
 * Represents paginated response for purchase orders list
 */
export class PurchaseOrdersQueryResponse {
  orders: PurchaseOrderResponse[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Purchase Order Summary DTO
 * Used for dashboard and reporting
 */
export class PurchaseOrderSummaryDto {
  totalOrders: number;
  draftOrders: number;
  pendingApprovalOrders: number;
  approvedOrders: number;
  rejectedOrders: number;
  sentOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalValue: number;
  pendingValue: number;
  averageOrderValue: number;
}

/**
 * Purchase Order Analytics DTO
 * Used for detailed analytics and reporting
 */
export class PurchaseOrderAnalyticsDto {
  period: string;
  totalOrders: number;
  totalValue: number;
  averageOrderValue: number;
  ordersByStatus: Record<PurchaseOrderStatus, number>;
  ordersBySupplier: Array<{
    supplierId: string;
    supplierName: string;
    orderCount: number;
    totalValue: number;
  }>;
  ordersByRequester: Array<{
    requesterId: string;
    requesterName: string;
    orderCount: number;
    totalValue: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    orderCount: number;
    totalValue: number;
  }>;
  approvalMetrics: {
    averageApprovalTime: number; // in hours
    approvalRate: number; // percentage
    rejectionRate: number; // percentage
  };
}