import { IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddOrderItemDto {
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

  @ApiProperty({ description: 'Discount amount', example: 10.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Discount must be a number' })
  @Min(0, { message: 'Discount must be non-negative' })
  discount?: number;
}