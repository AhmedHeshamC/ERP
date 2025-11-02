import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '../enums/sales.enum';

export class UpdateInvoiceStatusDto {
  @ApiPropertyOptional({
    description: 'New invoice status',
    enum: InvoiceStatus,
    example: InvoiceStatus.SENT
  })
  @IsEnum(InvoiceStatus, { message: 'Invalid invoice status' })
  status!: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Status change notes', example: 'Invoice sent via email' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Cancellation reason', example: 'Customer requested cancellation' })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}