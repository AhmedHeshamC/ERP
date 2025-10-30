import { IsString, IsOptional, IsEmail, IsEnum, IsDecimal, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '../enums/sales.enum';

export class CreateCustomerDto {
  @ApiProperty({
    description: 'Customer code for internal reference',
    example: 'CUST001',
    maxLength: 20,
  })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Customer name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Customer email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Customer phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Customer physical address',
    example: '123 Main St, City, State',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({
    description: 'Customer city',
    example: 'New York',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string;

  @ApiPropertyOptional({
    description: 'Customer state/province',
    example: 'NY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({
    description: 'Customer postal code',
    example: '10001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Customer country',
    example: 'USA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  country?: string;

  @ApiPropertyOptional({
    description: 'Customer tax ID for invoicing',
    example: 'TXN123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Customer credit limit',
    example: 10000.00,
  })
  @IsOptional()
  @IsDecimal({ decimal_places: '2' })
  creditLimit?: number;
}