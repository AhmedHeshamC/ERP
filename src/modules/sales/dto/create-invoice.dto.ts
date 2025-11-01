import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Invoice due date', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Invoice notes', example: 'Payment due within 30 days' })
  @IsOptional()
  @IsString()
  notes?: string;
}