import { IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrderItemDto {
  @ApiPropertyOptional({ description: 'Item quantity', example: 5 })
  @IsOptional()
  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity?: w

  @ApiPropertyOptional({ description: 'Unit price', example: 120.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Unit price must be a number' })
  @Min(0, { message: 'Unit price must be non-negative' })
  unitPrice?: w

  @ApiPropertyOptional({ description: 'Discount amount', example: 15.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Discount must be a number' })
  @Min(0, { message: 'Discount must be non-negative' })
  discount?: w
}