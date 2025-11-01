import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '../enums/sales.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED
  })
  @IsEnum(OrderStatus, { message: 'Invalid order status' })
  status!: OrderStatus;

  @ApiPropertyOptional({ description: 'Cancellation reason (required for CANCELLED status)', example: 'Customer requested cancellation' })
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional({ description: 'Tracking number (for SHIPPED status)', example: 'TRACK123456' })
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Additional notes for status change', example: 'Shipped via UPS' })
  @IsOptional()
  @IsString()
  notes?: string;
}