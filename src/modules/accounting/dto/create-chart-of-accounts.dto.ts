import { IsString, IsOptional, IsEnum, IsBoolean, IsDecimal, MaxLength } from 'class-validator';
import { IsPositiveDecimal } from '../../../shared/common/decorators/is-positive-decimal.decorator';
import { AccountType } from '../enums/accounting.enum';

export class CreateChartOfAccountsDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsString()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  subcategory?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDecimal()
  @IsPositiveDecimal()
  openingBalance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  openingBalanceCurrency?: string;
}