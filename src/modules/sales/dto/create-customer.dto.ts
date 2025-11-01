import { IsString, IsOptional, IsEmail, IsNumber, IsBoolean, Min, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ description: 'Unique customer code', example: 'CUST001' })
  @IsString()
  @MinLength(3, { message: 'Customer code must be at least 3 characters' })
  @MaxLength(20, { message: 'Customer code must not exceed 20 characters' })
  code!: string;

  @ApiProperty({ description: 'Customer name', example: 'Acme Corporation' })
  @IsString()
  @MinLength(1, { message: 'Customer name is required' })
  @MaxLength(200, { message: 'Customer name must not exceed 200 characters' })
  name!: string;

  @ApiProperty({ description: 'Customer email', example: 'contact@acme.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @ApiProperty({ description: 'Customer phone number', example: '+1234567890' })
  @IsString()
  @MinLength(5, { message: 'Phone number must be at least 5 characters' })
  phone!: string;

  @ApiProperty({ description: 'Customer address', example: '123 Main St' })
  @IsString()
  @MinLength(1, { message: 'Address is required' })
  address!: string;

  @ApiProperty({ description: 'Customer city', example: 'New York' })
  @IsString()
  @MinLength(1, { message: 'City is required' })
  city!: string;

  @ApiPropertyOptional({ description: 'Customer state', example: 'NY' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Customer postal code', example: '10001' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({ description: 'Customer country', example: 'USA' })
  @IsString()
  @MinLength(1, { message: 'Country is required' })
  country!: string;

  @ApiPropertyOptional({ description: 'Customer website', example: 'https://acme.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Customer tax ID', example: 'TAX123456' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ description: 'Customer credit limit', example: 10000.00 })
  @IsNumber({}, { message: 'Credit limit must be a number' })
  @Min(0, { message: 'Credit limit must be non-negative' })
  creditLimit!: number;

  @ApiPropertyOptional({ description: 'Payment terms', example: 'NET30' })
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Customer notes', example: 'Important customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Is customer active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}