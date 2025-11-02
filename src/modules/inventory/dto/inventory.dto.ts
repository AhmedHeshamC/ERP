import { IsString, IsOptional, IsNumber, IsDecimal, IsEnum, IsBoolean, Min, Max, IsArray, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

export enum InventoryValuationMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
}

export enum WarehouseStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Product DTOs
export class CreateProductDto {
  @ApiProperty({ description: 'Product name', example: 'Laptop Computer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Unique SKU', example: 'LAPTOP-001' })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ description: 'Product description', example: 'High-performance laptop computer', required: false })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: 'Selling price', example: '999.99', type: 'decimal' })
  @IsDecimal({ decimal_digits: '2' })
  @Type(() => Number)
  price!: number;

  @ApiProperty({ description: 'Product category ID', example: 'cat-123' })
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @ApiProperty({ description: 'Cost price', example: '750.00', type: 'decimal', required: false })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => Number)
  costPrice?: number;

  @ApiProperty({ description: 'Initial stock quantity', example: 100, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  initialStock?: number;

  @ApiProperty({ description: 'Low stock threshold', example: 10, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number;

  @ApiProperty({ description: 'Product status', enum: ProductStatus, required: false })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({ description: 'Product attributes as key-value pairs', required: false })
  @IsOptional()
  attributes?: Record<string, any>;

  @ApiProperty({ description: 'Product specifications', required: false })
  @IsOptional()
  specifications?: Record<string, any>;

  @ApiProperty({ description: 'Product tags', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'Weight in kg', example: 1.5, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @ApiProperty({ description: 'Dimensions (L x W x H)', example: '35x25x2', required: false })
  @IsString()
  @IsOptional()
  dimensions?: string;
}

export class UpdateProductDto {
  @ApiProperty({ description: 'Product name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Product description', required: false })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: 'Selling price', type: 'decimal', required: false })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @ApiProperty({ description: 'Cost price', type: 'decimal', required: false })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => Number)
  costPrice?: number;

  @ApiProperty({ description: 'Product category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Product status', enum: ProductStatus, required: false })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({ description: 'Low stock threshold', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  lowStockThreshold?: number;

  @ApiProperty({ description: 'Product attributes', required: false })
  @IsOptional()
  attributes?: Record<string, any>;

  @ApiProperty({ description: 'Product specifications', required: false })
  @IsOptional()
  specifications?: Record<string, any>;

  @ApiProperty({ description: 'Product tags', type: [String], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'Weight in kg', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  weight?: number;

  @ApiProperty({ description: 'Dimensions', required: false })
  @IsString()
  @IsOptional()
  dimensions?: string;

  @ApiProperty({ description: 'Is product active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ProductQueryDto {
  @ApiProperty({ description: 'Search term', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Category ID filter', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Status filter', enum: ProductStatus, required: false })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiProperty({ description: 'Low stock filter', required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  lowStock?: boolean;

  @ApiProperty({ description: 'Page number', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false })
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ description: 'Sort field', required: false })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: 'Sort direction', required: false })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Stock Movement DTOs
export class StockMovementDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Movement type', enum: StockMovementType })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({ description: 'Quantity', example: 10 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Reason for movement', example: 'Purchase order receipt' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ description: 'Reference document number', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Source location', required: false })
  @IsString()
  @IsOptional()
  sourceLocation?: string;

  @ApiProperty({ description: 'Destination location', required: false })
  @IsString()
  @IsOptional()
  destinationLocation?: string;

  @ApiProperty({ description: 'Cost per unit', type: 'decimal', required: false })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => Number)
  unitCost?: number;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class StockAdjustmentDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Adjustment quantity (can be positive or negative)', example: -5 })
  @IsNumber()
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Reason for adjustment', example: 'Damaged items found' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ description: 'Reference document', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Adjustment cost', type: 'decimal', required: false })
  @IsDecimal({ decimal_digits: '2' })
  @IsOptional()
  @Type(() => Number)
  adjustmentCost?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class WarehouseTransferDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Source warehouse/location' })
  @IsString()
  @IsNotEmpty()
  sourceLocation!: string;

  @ApiProperty({ description: 'Destination warehouse/location' })
  @IsString()
  @IsNotEmpty()
  destinationLocation!: string;

  @ApiProperty({ description: 'Transfer quantity', example: 50 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Transfer reason', example: 'Stock redistribution' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ description: 'Transfer reference', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Expected delivery date', required: false })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  deliveryDate?: Date;

  @ApiProperty({ description: 'Transfer notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Inventory Valuation DTOs
export class InventoryValuationDto {
  @ApiProperty({ description: 'Product ID', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Valuation method', enum: InventoryValuationMethod })
  @IsEnum(InventoryValuationMethod)
  method!: InventoryValuationMethod;

  @ApiProperty({ description: 'Valuation date', required: false })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : new Date())
  valuationDate?: Date;

  @ApiProperty({ description: 'Include inactive products', required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeInactive?: boolean;
}

export class InventoryValueResponse {
  @ApiProperty({ description: 'Total inventory value', type: 'decimal' })
  totalValue!: number;

  @ApiProperty({ description: 'Total quantity' })
  totalQuantity!: number;

  @ApiProperty({ description: 'Number of products valued' })
  productCount!: number;

  @ApiProperty({ description: 'Valuation method' })
  method!: InventoryValuationMethod;

  @ApiProperty({ description: 'Valuation date' })
  valuationDate!: Date;

  @ApiProperty({ description: 'Detailed product valuations' })
  productValuations!: ProductValuationDetail[];
}

export class ProductValuationDetail {
  @ApiProperty({ description: 'Product ID' })
  productId!: string;

  @ApiProperty({ description: 'Product name' })
  productName!: string;

  @ApiProperty({ description: 'Current stock' })
  currentStock!: number;

  @ApiProperty({ description: 'Unit cost', type: 'decimal' })
  unitCost!: number;

  @ApiProperty({ description: 'Total value', type: 'decimal' })
  totalValue!: number;

  @ApiProperty({ description: 'Valuation method' })
  method!: InventoryValuationMethod;

  @ApiProperty({ description: 'Last cost update', required: false })
  lastCostUpdate?: Date;
}

// Warehouse Management DTOs
export class CreateWarehouseDto {
  @ApiProperty({ description: 'Warehouse name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Warehouse code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'State/Province', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ description: 'Postal code', required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ description: 'Contact person', required: false })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiProperty({ description: 'Contact phone', required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ description: 'Contact email', required: false })
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({ description: 'Maximum capacity', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxCapacity?: number;

  @ApiProperty({ description: 'Current utilization', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  currentUtilization?: number;

  @ApiProperty({ description: 'Operating hours', required: false })
  @IsString()
  @IsOptional()
  operatingHours?: string;

  @ApiProperty({ description: 'Warehouse status', enum: WarehouseStatus, required: false })
  @IsEnum(WarehouseStatus)
  @IsOptional()
  status?: WarehouseStatus;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateWarehouseDto {
  @ApiProperty({ description: 'Warehouse name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ description: 'State/Province', required: false })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiProperty({ description: 'Country', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ description: 'Postal code', required: false })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiProperty({ description: 'Contact person', required: false })
  @IsString()
  @IsOptional()
  contactPerson?: string;

  @ApiProperty({ description: 'Contact phone', required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ description: 'Contact email', required: false })
  @IsString()
  @IsOptional()
  contactEmail?: string;

  @ApiProperty({ description: 'Maximum capacity', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxCapacity?: number;

  @ApiProperty({ description: 'Operating hours', required: false })
  @IsString()
  @IsOptional()
  operatingHours?: string;

  @ApiProperty({ description: 'Warehouse status', enum: WarehouseStatus, required: false })
  @IsEnum(WarehouseStatus)
  @IsOptional()
  status?: WarehouseStatus;

  @ApiProperty({ description: 'Additional notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Low Stock Alert DTOs
export class LowStockAlertDto {
  @ApiProperty({ description: 'Product ID', required: false })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiProperty({ description: 'Category ID', required: false })
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ description: 'Alert severity', enum: AlertSeverity, required: false })
  @IsEnum(AlertSeverity)
  @IsOptional()
  severity?: AlertSeverity;

  @ApiProperty({ description: 'Minimum stock percentage', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  minStockPercentage?: number;

  @ApiProperty({ description: 'Include inactive products', required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  includeInactive?: boolean;
}

export class LowStockAlertResponse {
  @ApiProperty({ description: 'Alert ID' })
  id!: string;

  @ApiProperty({ description: 'Product ID' })
  productId!: string;

  @ApiProperty({ description: 'Product name' })
  productName!: string;

  @ApiProperty({ description: 'Product SKU' })
  productSku!: string;

  @ApiProperty({ description: 'Current stock' })
  currentStock!: number;

  @ApiProperty({ description: 'Low stock threshold' })
  lowStockThreshold!: number;

  @ApiProperty({ description: 'Stock deficit' })
  stockDeficit!: number;

  @ApiProperty({ description: 'Alert severity', enum: AlertSeverity })
  severity!: AlertSeverity;

  @ApiProperty({ description: 'Alert created at' })
  createdAt!: Date;

  @ApiProperty({ description: 'Alert acknowledged at', required: false })
  acknowledgedAt?: Date;

  @ApiProperty({ description: 'Reorder suggested quantity', required: false })
  reorderQuantity?: number;
}

// Response DTOs
export class ProductResponse {
  id!: string;
  name!: string;
  sku!: string;
  description?: string | null;
  price!: number | any; // Accept Decimal from Prisma
  costPrice?: number | any;
  categoryId!: string;
  categoryName?: string;
  status!: ProductStatus | string; // Accept string from database
  stockQuantity!: number;
  lowStockThreshold!: number;
  isLowStock?: boolean;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  attributes?: Record<string, any>;
  specifications?: Record<string, any>;
  tags?: string[];
  weight?: number;
  dimensions?: string;
}

export class StockMovementResponse {
  id!: string;
  productId!: string;
  productName?: string;
  productSku?: string;
  type!: StockMovementType;
  quantity!: number;
  reason!: string;
  reference?: string;
  sourceLocation?: string;
  destinationLocation?: string;
  unitCost?: number;
  totalCost?: number;
  createdById?: string;
  createdBy?: string;
  createdAt!: Date;
  metadata?: Record<string, any>;
}

export class ProductsQueryResponse {
  products!: ProductResponse[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class StockMovementsQueryResponse {
  movements!: StockMovementResponse[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

// Category DTOs
export class CreateProductCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: 'Parent category ID', required: false })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ description: 'Category level', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  level?: number;
}

export class UpdateProductCategoryDto {
  @ApiProperty({ description: 'Category name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiProperty({ description: 'Parent category ID', required: false })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({ description: 'Is category active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ProductCategoryResponse {
  id!: string;
  name!: string;
  description?: string | null;
  parentId?: string;
  parentName?: string;
  level!: number;
  isActive!: boolean;
  productCount?: number;
  createdAt!: Date;
  updatedAt!: Date;
  children?: ProductCategoryResponse[];
}