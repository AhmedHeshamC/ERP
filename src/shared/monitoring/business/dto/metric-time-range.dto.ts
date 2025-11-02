/**
 * Metric Time Range DTO - Following SOLID Principles
 *
 * Single Responsibility: Only handles time range data transfer
 * Open/Closed: Open for extension with additional validation rules
 * Interface Segregation: Focused DTO for time range parameters
 * Dependency Inversion: No external dependencies
 * Liskov Substitution: Simple, focused implementation
 *
 * KISS Principle: Simple DTO with clear validation rules
 * No unnecessary complexity, focused on data transfer
 */

import { IsString, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetricTimeRangeDto {
  @ApiProperty({
    description: 'Start date for metrics calculation in ISO 8601 format',
    example: '2024-01-01T00:00:00.000Z',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for metrics calculation in ISO 8601 format',
    example: '2024-01-31T23:59:59.999Z',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}