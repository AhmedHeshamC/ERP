import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { CacheService } from '../../../shared/cache/cache.service';
// import { Employee, Department, User } from '@prisma/client';
import {
  // EmployeeResponse,
  EmployeeFilters,
  EmployeeWithDepartment,
  CreateEmployeeData,
  UpdateEmployeeData,
  EmployeeListResponse,
  EmployeeSummary,
} from '../interfaces/employee.interface';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createEmployeeData: CreateEmployeeData, createdBy: string): Promise<EmployeeWithDepartment> {
    // Input validation and security
    const sanitizedData = this.securityService.sanitizeInput(createEmployeeData) as CreateEmployeeData;

    // Validate required entities exist
    const user = await this.prismaService.user.findUnique({
      where: { id: sanitizedData.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const department = await this.prismaService.department.findUnique({
      where: { id: sanitizedData.departmentId },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Check if employee already exists for this user
    const existingEmployee = await this.prismaService.employee.findFirst({
      where: { userId: sanitizedData.userId },
    });
    if (existingEmployee) {
      throw new ConflictException('Employee already exists for this user');
    }

    // Validate employment type
    const validEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
    if (!validEmploymentTypes.includes(sanitizedData.employmentType)) {
      throw new BadRequestException('Invalid employment type');
    }

    // Validate personal information
    if (!this.securityService.validatePersonalInfo(sanitizedData)) {
      throw new BadRequestException('Invalid personal information');
    }

    // Generate employee ID
    const employeeId = this.securityService.generateEmployeeId();

    // Create employee
    const employee = await this.prismaService.employee.create({
      data: {
        ...sanitizedData,
        employeeId,
        dateOfBirth: new Date(sanitizedData.dateOfBirth),
        hireDate: new Date(),
        isActive: true,
        status: 'ACTIVE',
        annualLeaveBalance: 20,
        sickLeaveBalance: 10,
        personalLeaveBalance: 5,
        createdBy,
        // Handle JSON fields properly
        workSchedule: sanitizedData.workSchedule as Prisma.InputJsonValue | undefined,
        emergencyContact: sanitizedData.emergencyContact as Prisma.InputJsonValue | undefined,
        bankAccount: sanitizedData.bankAccount as Prisma.InputJsonValue | undefined,
      },
      include: {
        department: true,
      },
    });

    return employee as EmployeeWithDepartment;
  }

  async findById(id: string): Promise<EmployeeWithDepartment> {
    // Try cache first
    const cacheKey = `employee:${id}`;
    const cachedEmployee = await this.cacheService.get<EmployeeWithDepartment>(cacheKey);

    if (cachedEmployee) {
      this.logger.debug(`Cache HIT for employee: ${id}`);
      return cachedEmployee;
    }

    const employee = await this.prismaService.employee.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Cache the result for 15 minutes
    await this.cacheService.set(cacheKey, employee, { ttl: 900 });
    this.logger.debug(`Cached employee: ${id}`);

    return employee as EmployeeWithDepartment;
  }

  async findByEmployeeId(employeeId: string): Promise<EmployeeWithDepartment> {
    const employee = await this.prismaService.employee.findUnique({
      where: { employeeId },
      include: {
        department: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee as EmployeeWithDepartment;
  }

  async findAll(filters: EmployeeFilters = {}): Promise<EmployeeListResponse> {
    // Create cache key based on filters
    const cacheKey = `employees:list:${JSON.stringify(filters)}`;

    // Try cache first for non-search queries (search results are too dynamic)
    if (!filters.search) {
      const cachedResult = await this.cacheService.get<EmployeeListResponse>(cacheKey);
      if (cachedResult) {
        this.logger.debug(`Cache HIT for employee list with filters`);
        return cachedResult;
      }
    }

    // Validate department if provided
    if (filters.departmentId) {
      const department = await this.prismaService.department.findUnique({
        where: { id: filters.departmentId },
        select: { id: true, name: true }, // Only select needed fields
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    // Validate date range if provided
    if (filters.hireDateFrom && filters.hireDateTo) {
      const fromDate = new Date(filters.hireDateFrom);
      const toDate = new Date(filters.hireDateTo);
      if (fromDate > toDate) {
        throw new BadRequestException('Invalid date range: Start date must be before end date');
      }
    }

    // Validate employment type if provided
    if (filters.employmentType) {
      const validTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
      if (!validTypes.includes(filters.employmentType)) {
        throw new BadRequestException('Invalid employment type');
      }
    }

    const skip = filters.skip || 0;
    const take = Math.min(filters.take || 10, 100); // Max 100 records
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    // Build where clause
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { employeeId: { contains: filters.search, mode: 'insensitive' } },
        { position: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.employmentType) {
      where.employmentType = filters.employmentType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.hireDateFrom || filters.hireDateTo) {
      where.hireDate = {};
      if (filters.hireDateFrom) {
        where.hireDate.gte = new Date(filters.hireDateFrom);
      }
      if (filters.hireDateTo) {
        where.hireDate.lte = new Date(filters.hireDateTo);
      }
    }

    if (filters.salaryFrom || filters.salaryTo) {
      where.salary = {};
      if (filters.salaryFrom) {
        where.salary.gte = filters.salaryFrom;
      }
      if (filters.salaryTo) {
        where.salary.lte = filters.salaryTo;
      }
    }

    // Execute optimized query with parallel execution
    const [employees, total] = await Promise.all([
      this.prismaService.employee.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          position: true,
          departmentId: true,
          salary: true,
          employmentType: true,
          status: true,
          isActive: true,
          hireDate: true,
          dateOfBirth: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prismaService.employee.count({ where }),
    ]);

    const result = {
      employees,
      total,
      skip,
      take,
    };

    // Cache the result for non-search queries (5 minutes)
    if (!filters.search) {
      await this.cacheService.set(cacheKey, result, { ttl: 300 });
      this.logger.debug(`Cached employee list with filters`);
    }

    return result as EmployeeListResponse;
  }

  async update(id: string, updateEmployeeData: UpdateEmployeeData, updatedBy: string): Promise<EmployeeWithDepartment> {
    // Check if employee exists
    const existingEmployee = await this.prismaService.employee.findUnique({
      where: { id },
    });
    if (!existingEmployee) {
      throw new NotFoundException('Employee not found');
    }

    // Input validation and security
    const sanitizedData = this.securityService.sanitizeInput(updateEmployeeData) as UpdateEmployeeData;

    // Validate department if provided
    if (sanitizedData.departmentId) {
      const department = await this.prismaService.department.findUnique({
        where: { id: sanitizedData.departmentId },
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    // Validate employment type if provided
    if (sanitizedData.employmentType) {
      const validTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
      if (!validTypes.includes(sanitizedData.employmentType)) {
        throw new BadRequestException('Invalid employment type');
      }
    }

    // Validate salary if provided
    if (sanitizedData.salary !== undefined && sanitizedData.salary < 0) {
      throw new BadRequestException('Salary must be positive');
    }

    // Update employee
    const updatedEmployee = await this.prismaService.employee.update({
      where: { id },
      data: {
        ...sanitizedData,
        updatedBy,
        updatedAt: new Date(),
        // Handle JSON fields properly
        workSchedule: sanitizedData.workSchedule !== undefined
          ? sanitizedData.workSchedule as Prisma.InputJsonValue | undefined
          : undefined,
        emergencyContact: sanitizedData.emergencyContact !== undefined
          ? sanitizedData.emergencyContact as Prisma.InputJsonValue | undefined
          : undefined,
        bankAccount: sanitizedData.bankAccount !== undefined
          ? sanitizedData.bankAccount as Prisma.InputJsonValue | undefined
          : undefined,
        // Handle termination
        ...(sanitizedData.status === 'TERMINATED' && {
          terminatedAt: new Date(),
          terminationReason: sanitizedData.terminationReason || 'Not specified',
          isActive: false,
        }),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateEmployeeCache(id);

    return updatedEmployee as EmployeeWithDepartment;
  }

  async softDelete(id: string, deletedBy: string): Promise<EmployeeWithDepartment> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.status === 'TERMINATED') {
      throw new BadRequestException('Employee is already terminated');
    }

    return this.prismaService.employee.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'Deleted by administrator',
        updatedBy: deletedBy,
        updatedAt: new Date(),
      },
      include: {
        department: true,
      },
    });
  }

  async activate(id: string, activatedBy: string): Promise<EmployeeWithDepartment> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.isActive) {
      throw new BadRequestException('Employee is already active');
    }

    return this.prismaService.employee.update({
      where: { id },
      data: {
        isActive: true,
        updatedBy: activatedBy,
        updatedAt: new Date(),
      },
      include: {
        department: true,
      },
    });
  }

  async deactivate(id: string, deactivatedBy: string): Promise<EmployeeWithDepartment> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive) {
      throw new BadRequestException('Employee is already inactive');
    }

    return this.prismaService.employee.update({
      where: { id },
      data: {
        isActive: false,
        status: 'ON_LEAVE',
        updatedBy: deactivatedBy,
        updatedAt: new Date(),
      },
      include: {
        department: true,
      },
    });
  }

  async getEmployeeSummary(): Promise<EmployeeSummary> {
    const [total, active, inactive, byStatus, byDepartment] = await Promise.all([
      this.prismaService.employee.count(),
      this.prismaService.employee.count({ where: { isActive: true } }),
      this.prismaService.employee.count({ where: { isActive: false } }),
      this.prismaService.employee.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prismaService.employee.groupBy({
        by: ['departmentId'],
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      inactive,
      statusBreakdown: byStatus,
      departmentBreakdown: byDepartment,
    };
  }

  /**
   * Invalidate employee-related cache entries
   */
  private async invalidateEmployeeCache(employeeId: string): Promise<void> {
    try {
      // Invalidate specific employee cache
      await this.cacheService.del(`employee:${employeeId}`);

      // Invalidate employee list caches (all variations)
      await this.cacheService.delPattern('employees:list:*');

      this.logger.debug(`Invalidated cache for employee: ${employeeId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error invalidating employee cache: ${errorMessage}`);
    }
  }
}