import { IsString, IsOptional, IsDecimal, IsEnum, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsPositiveDecimal } from '../../../shared/common/decorators/is-positive-decimal.decorator';
import { TransactionType } from '../enums/accounting.enum';

export class JournalEntryDto {
  @IsString()
  accountId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsPositiveDecimal()
  @IsDecimal()
  debitAmount: number;

  @IsPositiveDecimal()
  @IsDecimal()
  creditAmount: number;
}

export class CreateTransactionDto {
  @IsString()
  @MaxLength(50)
  reference: string;

  @IsString()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @Type(() => Date)
  date?: Date;

  @IsPositiveDecimal()
  @IsDecimal()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalEntryDto)
  entries: JournalEntryDto[];
}