import { IsString, IsNumber, IsArray, IsDate, IsEnum, IsOptional, ValidateNested, IsNotEmpty, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { O2CProcessStatus } from '../types/o2c.types';

export class CreateO2COrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discount!: number;
}

export class CreateO2COrderDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  orderNumber!: string;

  @IsDate()
  @Type(() => Date)
  orderDate!: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateO2COrderItemDto)
  items!: CreateO2COrderItemDto[];

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsEnum(O2CProcessStatus)
  status?: O2CProcessStatus = O2CProcessStatus.PENDING;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateO2COrderDto {
  @IsOptional()
  @IsEnum(O2CProcessStatus)
  status?: O2CProcessStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateO2COrderItemDto)
  items?: CreateO2COrderItemDto[];

  @IsOptional()
  metadata?: Record<string, any>;
}