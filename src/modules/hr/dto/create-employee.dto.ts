import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsDateString, Min, Max } from 'class-validator';

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
  RETIRED = 'RETIRED',
}

export class CreateEmployeeDto {
  @IsString()
  userId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  departmentId: string;

  @IsString()
  position: string;

  @IsString()
  jobTitle: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsNumber()
  @Min(0)
  salary: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  workSchedule?: any;

  @IsOptional()
  emergencyContact?: any;

  @IsOptional()
  @IsString()
  socialSecurity?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  bankAccount?: any;
}