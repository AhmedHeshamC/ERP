import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsInt,
  Min,
  IsPositive
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Product Status Enumeration
 */
export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED',
}

/**
 * Product Response Interface
 */
export interface ProductResponse {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price: number;
  categoryId: string;
  status: ProductStatus;
  isActive: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create Product DTO
 */
export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Mouse',
    minLength: 1,
    maxLength: 200,
  })
  @IsString({ message: 'Product name must be a string' })
  @MinLength(1, { message: 'Product name is required' })
  @MaxLength(200, { message: 'Product name must not exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,]+$/, {
    message: 'Product name can only contain letters, numbers, spaces, hyphens, underscores, dots, and commas',
  })
  name!: string;

  @ApiProperty({
    description: 'Stock Keeping Unit - unique identifier',
    example: 'WM-001',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'SKU must be a string' })
  @MinLength(2, { message: 'SKU must be at least 2 characters long' })
  @MaxLength(50, { message: 'SKU must not exceed 50 characters' })
  @Matches(/^[A-Z0-9\-]+$/, {
    message: 'SKU must contain only uppercase letters, numbers, and hyphens',
  })
  sku!: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Ergonomic wireless mouse with precision tracking',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiProperty({
    description: 'Product price',
    example: 29.99,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a number with max 2 decimal places' })
  @IsPositive({ message: 'Price must be greater than 0' })
  @Min(0, { message: 'Price cannot be negative' })
  price!: number;

  @ApiProperty({
    description: 'Product category ID',
    example: 'cat-electronics',
  })
  @IsString({ message: 'Category ID must be a string' })
  @MinLength(1, { message: 'Category ID is required' })
  categoryId!: string;

  @ApiProperty({
    description: 'Product status',
    enum: ProductStatus,
    example: ProductStatus.ACTIVE,
  })
  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Low stock threshold for alerts',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Low stock threshold must be an integer' })
  @Min(0, { message: 'Low stock threshold cannot be negative' })
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    description: 'Initial stock quantity',
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'Initial stock must be an integer' })
  @Min(0, { message: 'Initial stock cannot be negative' })
  initialStock?: number;
}

/**
 * Update Product DTO
 */
export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Updated Product Name',
    maxLength: 200,
  })
  @IsOptional()
  @IsString({ message: 'Product name must be a string' })
  @MaxLength(200, { message: 'Product name must not exceed 200 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.,]+$/, {
    message: 'Product name can only contain letters, numbers, spaces, hyphens, underscores, dots, and commas',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Updated product description',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Product price',
    example: 39.99,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a number with max 2 decimal places' })
  @IsPositive({ message: 'Price must be greater than 0' })
  @Min(0, { message: 'Price cannot be negative' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Product status',
    enum: ProductStatus,
    example: ProductStatus.DISCONTINUED,
  })
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Invalid product status' })
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Low stock threshold for alerts',
    example: 5,
  })
  @IsOptional()
  @IsInt({ message: 'Low stock threshold must be an integer' })
  @Min(0, { message: 'Low stock threshold cannot be negative' })
  lowStockThreshold?: number;
}

/**
 * Product Query DTO for filtering and pagination
 */
export class ProductQueryDto {
  @ApiPropertyOptional({
    description: 'Number of items to skip for pagination',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsString({ message: 'Skip must be a number string' })
  skip?: string;

  @ApiPropertyOptional({
    description: 'Number of items to take',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsString({ message: 'Take must be a number string' })
  take?: string;

  @ApiPropertyOptional({
    description: 'Search term for product name or SKU',
    example: 'wireless',
  })
  @IsOptional()
  @IsString({ message: 'Search term must be a string' })
  @MinLength(1, { message: 'Search term must be at least 1 character long' })
  @MaxLength(100, { message: 'Search term must not exceed 100 characters' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by product category',
    example: 'cat-electronics',
  })
  @IsOptional()
  @IsString({ message: 'Category ID must be a string' })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by product status',
    enum: ProductStatus,
  })
  @IsOptional()
  @IsEnum(ProductStatus, { message: 'Invalid product status filter' })
  status?: ProductStatus;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Active status must be a boolean' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by low stock',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'Low stock filter must be a boolean' })
  lowStock?: boolean;
}

/**
 * Products Query Response
 */
export interface ProductsQueryResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  take: number;
  skip: number;
}

/**
 * Stock Movement Type Enumeration
 */
export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

/**
 * Stock Movement DTO
 */
export class StockMovementDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'prod-123',
  })
  @IsString({ message: 'Product ID must be a string' })
  productId!: string;

  @ApiProperty({
    description: 'Movement type',
    enum: StockMovementType,
    example: StockMovementType.IN,
  })
  @IsEnum(StockMovementType, { message: 'Invalid movement type' })
  type!: StockMovementType;

  @ApiProperty({
    description: 'Quantity moved',
    example: 50,
  })
  @IsInt({ message: 'Quantity must be an integer' })
  quantity!: number;

  @ApiProperty({
    description: 'Reason for movement',
    example: 'New stock received from supplier',
  })
  @IsString({ message: 'Reason must be a string' })
  @MinLength(1, { message: 'Reason is required' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Reference number',
    example: 'PO-2024-001',
  })
  @IsOptional()
  @IsString({ message: 'Reference must be a string' })
  @MaxLength(100, { message: 'Reference must not exceed 100 characters' })
  reference?: string;
}