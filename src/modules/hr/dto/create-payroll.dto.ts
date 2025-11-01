import { IsString, IsNumber, IsOptional, IsEnum, IsDecimal } from 'class-validator';

export enum PaymentMethod {
  DIRECT_DEPOSIT = 'DIRECT_DEPOSIT',
  CHECK = 'CHECK',
  CASH = 'CASH',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreatePayrollDto {
  @IsString()
  employeeId!: string;

  @IsString()
  payPeriod!: string;

  @IsNumber()
  @IsDecimal()
  grossPay!: number;

  @IsNumber()
  @IsDecimal()
  netPay!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  federalTax?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  stateTax?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  socialSecurityTax?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  medicareTax?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  otherDeductions?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  healthInsurance?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  dentalInsurance?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  retirement401k?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  regularHours?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  overtimeHours?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  hourlyRate?: number;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  overtimeRate?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  transactionId?: string;
}