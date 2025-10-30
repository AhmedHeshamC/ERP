import { Employee, Department } from '@prisma/client';

export interface EmployeeResponse extends Employee {
  department: Department;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: string;
  employmentType?: string;
  isActive?: boolean;
  hireDateFrom?: string;
  hireDateTo?: string;
  salaryFrom?: number;
  salaryTo?: number;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EmployeeWithDepartment extends Employee {
  department: Department;
}

export interface CreateEmployeeData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth: Date | string;
  departmentId: string;
  position: string;
  jobTitle: string;
  employmentType: string;
  salary: number;
  currency?: string;
  workSchedule?: any;
  emergencyContact?: any;
  socialSecurity?: string;
  taxId?: string;
  bankAccount?: any;
}

export interface UpdateEmployeeData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  departmentId?: string;
  position?: string;
  jobTitle?: string;
  employmentType?: string;
  salary?: number;
  currency?: string;
  status?: string;
  workSchedule?: any;
  emergencyContact?: any;
  socialSecurity?: string;
  taxId?: string;
  bankAccount?: any;
  terminationReason?: string;
}

export interface EmployeeListResponse {
  employees: EmployeeWithDepartment[];
  total: number;
  skip: number;
  take: number;
}