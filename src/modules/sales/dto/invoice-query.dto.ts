import { IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { InvoiceStatus } from '../enums/sales.enum';

export class InvoiceQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Customer ID to filter by', example: 'customer-123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Order ID to filter by', example: 'order-123' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({
    description: 'Invoice status to filter by',
    enum: InvoiceStatus,
    example: InvoiceStatus.SENT
  })
  @IsOptional()
  @IsEnum(InvoiceStatus, { message: 'Invalid invoice status' })
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'issueDate', default: 'issueDate' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'issueDate';

  @ApiPropertyOptional({ description: 'Sort order', example: 'desc', default: 'desc' })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Search by invoice number', example: 'INV-2024-001' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date (from)', example: '2024-01-01' })
  @IsOptional()
  @IsString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date (to)', example: '2024-12-31' })
  @IsOptional()
  @IsString()
  issueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by due date (from)', example: '2024-01-01' })
  @IsOptional()
  @IsString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by due date (to)', example: '2024-12-31' })
  @IsOptional()
  @IsString()
  dueDateTo?: string;
}