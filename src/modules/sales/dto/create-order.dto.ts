import { IsString, IsArray, IsNumber, IsOptional, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod_123' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Item quantity', example: 2 })
  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;

  @ApiProperty({ description: 'Unit price', example: 100.00 })
  @IsNumber({}, { message: 'Unit price must be a number' })
  @Min(0, { message: 'Unit price must be non-negative' })
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Discount amount', example: 10.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Discount must be a number' })
  @Min(0, { message: 'Discount must be non-negative' })
  discount?: number;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Customer ID', example: 'cust_123' })
  @IsString()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Order description', example: 'Standard sales order' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Order currency', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Order items', type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ description: 'Tax rate', example: 0.08 })
  @IsOptional()
  @IsNumber({}, { message: 'Tax rate must be a number' })
  @Min(0, { message: 'Tax rate must be non-negative' })
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Shipping cost', example: 15.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Shipping cost must be a number' })
  @Min(0, { message: 'Shipping cost must be non-negative' })
  shippingCost?: number;

  @ApiPropertyOptional({ description: 'Order notes', example: 'Handle with care' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Expected delivery date', example: '2024-12-31' })
  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;
}