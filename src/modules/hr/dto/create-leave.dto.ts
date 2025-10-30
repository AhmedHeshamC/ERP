import { IsString, IsEnum, IsDateString, IsOptional, IsNumber, IsDecimal } from 'class-validator';

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  UNPAID = 'UNPAID',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export class CreateLeaveDto {
  @IsString()
  employeeId: string;

  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  daysRequested?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  paidLeave?: boolean;

  @IsOptional()
  @IsNumber()
  @IsDecimal()
  payRate?: number;
}