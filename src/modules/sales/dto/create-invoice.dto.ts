import { IsString, IsOptional, IsDateString, IsNumber, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Order ID to create invoice for', example: 'order-123' })
  @IsUUID()
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Customer ID', example: 'customer-123' })
  @IsUUID()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Invoice due date', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Invoice subtotal', example: 1000.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Subtotal must be a number' })
  @Min(0, { message: 'Subtotal must be non-negative' })
  subtotal?: number;

  @ApiPropertyOptional({ description: 'Tax amount', example: 80.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Tax amount must be a number' })
  @Min(0, { message: 'Tax amount must be non-negative' })
  taxAmount?: number;

  @ApiPropertyOptional({ description: 'Total amount', example: 1080.00 })
  @IsOptional()
  @IsNumber({}, { message: 'Total amount must be a number' })
  @Min(0, { message: 'Total amount must be non-negative' })
  totalAmount?: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Invoice notes', example: 'Payment due within 30 days' })
  @IsOptional()
  @IsString()
  notes?: string;
}