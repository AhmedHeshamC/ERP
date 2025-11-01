import { IsString, IsNumber, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/sales.enum';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 1000.00 })
  @IsNumber({}, { message: 'Payment amount must be a number' })
  @Min(0, { message: 'Payment amount must be non-negative' })
  amount: w

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD
  })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment date', example: '2024-11-01' })
  @IsOptional()
  @IsDateString()
  paymentDate?: w

  @ApiPropertyOptional({ description: 'Payment reference', example: 'PAY-12345' })
  @IsOptional()
  @IsString()
  reference?: w

  @ApiPropertyOptional({ description: 'Payment notes', example: 'Payment via credit card' })
  @IsOptional()
  @IsString()
  notes?: w
}