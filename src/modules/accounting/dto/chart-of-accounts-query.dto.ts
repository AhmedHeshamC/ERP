import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { AccountType } from '../enums/accounting.enum';

/**
 * Chart of Accounts Query DTO
 * Provides comprehensive filtering and pagination options
 */
export class ChartOfAccountsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  subcategory?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') {return true;}
    if (value === 'false') {return false;}
    return value;
  })
  isActive?: boolean;

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
  sortBy?: string = 'code';

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  sortOrder?: 'asc' | 'desc' = 'asc';
}