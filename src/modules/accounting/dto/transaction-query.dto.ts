import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { TransactionStatus, TransactionType } from '../enums/accounting.enum';

/**
 * Transaction Query DTO
 * Provides comprehensive filtering and pagination options for transactions
 */
export class TransactionQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  accountId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  maxAmount?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  reference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value, 10))
  skip?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  take?: number = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  sortOrder?: 'asc' | 'desc' = 'desc';
}