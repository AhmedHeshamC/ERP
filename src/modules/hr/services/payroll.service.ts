import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import { PayrollRecord, Employee } from '@prisma/client';

@Injectable()
export class PayrollService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly securityService: SecurityService,
  ) {}

  async calculatePayroll(
    employeeId: string,
    payPeriod: string,
    processedBy: string,
    payrollData?: any
  ): Promise<PayrollRecord> {
    // Validate employee exists and is active
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive || employee.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot calculate payroll for inactive employee');
    }

    // Validate pay period format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(payPeriod)) {
      throw new BadRequestException('Invalid pay period format. Use YYYY-MM');
    }

    // Check if payroll record already exists for this period
    const existingRecord = await this.prismaService.payrollRecord.findFirst({
      where: {
        employeeId,
        payPeriod,
      },
    });
    if (existingRecord) {
      throw new ConflictException('Payroll record already exists for this period');
    }

    // Validate employee's tax and bank information
    if (!this.securityService.validateTaxInfo(employee)) {
      throw new BadRequestException('Invalid tax information');
    }

    if (!this.securityService.validateBankAccount(employee)) {
      throw new BadRequestException('Invalid bank account information');
    }

    // Calculate payroll values
    const grossPay = payrollData?.grossPay || this.calculateGrossPay(employee, payrollData);
    if (grossPay < 0) {
      throw new BadRequestException('Gross pay cannot be negative');
    }

    // Calculate taxes
    const taxes = this.securityService.calculatePayrollTaxes(grossPay, employee);

    // Calculate benefits
    const benefits = this.calculateBenefits(employee);

    // Calculate deductions
    const totalDeductions = Object.values(taxes).reduce((sum: number, tax: number) => sum + tax, 0) +
                           (payrollData?.otherDeductions || 0);

    const totalBenefits = Object.values(benefits).reduce((sum: number, benefit: number) => sum + benefit, 0);

    const netPay = grossPay - totalDeductions;

    // Create payroll record
    const payrollRecord = await this.prismaService.payrollRecord.create({
      data: {
        employeeId,
        payPeriod,
        grossPay,
        netPay,
        currency: employee.currency || 'USD',
        ...taxes,
        totalDeductions,
        ...benefits,
        totalBenefits,
        regularHours: payrollData?.regularHours || 160,
        overtimeHours: payrollData?.overtimeHours || 0,
        hourlyRate: grossPay / (payrollData?.regularHours || 160),
        overtimeRate: (grossPay / (payrollData?.regularHours || 160)) * 1.5,
        paymentMethod: 'DIRECT_DEPOSIT',
        paymentStatus: 'PENDING',
        processedBy,
        otherDeductions: payrollData?.otherDeductions || 0,
      },
    });

    return payrollRecord;
  }

  async approvePayroll(payrollId: string, approvedBy: string): Promise<PayrollRecord> {
    const payrollRecord = await this.prismaService.payrollRecord.findUnique({
      where: { id: payrollId },
    });

    if (!payrollRecord) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payrollRecord.paymentStatus === 'PAID') {
      throw new BadRequestException('Payroll record is already approved/paid');
    }

    // Here you would typically check if the user has proper authorization
    // For now, we'll just update the record
    const approvedRecord = await this.prismaService.payrollRecord.update({
      where: { id: payrollId },
      data: {
        paymentStatus: 'PAID',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return approvedRecord;
  }

  async processPayment(payrollId: string, processedBy: string): Promise<PayrollRecord> {
    const payrollRecord = await this.prismaService.payrollRecord.findUnique({
      where: { id: payrollId },
    });

    if (!payrollRecord) {
      throw new NotFoundException('Payroll record not found');
    }

    if (payrollRecord.paymentStatus !== 'PAID') {
      throw new BadRequestException('Payroll record must be approved before processing');
    }

    if (payrollRecord.transactionId) {
      throw new BadRequestException('Payroll record has already been processed');
    }

    // Simulate payment processing
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    const processedRecord = await this.prismaService.payrollRecord.update({
      where: { id: payrollId },
      data: {
        paymentStatus: 'PAID',
        transactionId,
        paymentDate: new Date(),
      },
    });

    return processedRecord;
  }

  async findById(id: string): Promise<PayrollRecord> {
    const payrollRecord = await this.prismaService.payrollRecord.findUnique({
      where: { id },
    });

    if (!payrollRecord) {
      throw new NotFoundException('Payroll record not found');
    }

    return payrollRecord;
  }

  async findByEmployee(employeeId: string): Promise<PayrollRecord[]> {
    const employee = await this.prismaService.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.prismaService.payrollRecord.findMany({
      where: { employeeId },
      orderBy: { payPeriod: 'desc' },
    });
  }

  async findAll(filters: any = {}): Promise<{ payrollRecords: PayrollRecord[]; total: number }> {
    // Validate pay period format if provided
    if (filters.payPeriod && !/^\d{4}-\d{2}$/.test(filters.payPeriod)) {
      throw new BadRequestException('Invalid pay period format. Use YYYY-MM');
    }

    // Validate date range if provided
    if (filters.paymentDateFrom && filters.paymentDateTo) {
      const fromDate = new Date(filters.paymentDateFrom);
      const toDate = new Date(filters.paymentDateTo);
      if (fromDate > toDate) {
        throw new BadRequestException('Invalid date range: Start date must be before end date');
      }
    }

    const skip = filters.skip || 0;
    const take = Math.min(filters.take || 10, 100);
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    // Build where clause
    const where: any = {};

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.payPeriod) {
      where.payPeriod = filters.payPeriod;
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    if (filters.paymentDateFrom || filters.paymentDateTo) {
      where.paymentDate = {};
      if (filters.paymentDateFrom) {
        where.paymentDate.gte = new Date(filters.paymentDateFrom);
      }
      if (filters.paymentDateTo) {
        where.paymentDate.lte = new Date(filters.paymentDateTo);
      }
    }

    const [payrollRecords, total] = await Promise.all([
      this.prismaService.payrollRecord.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prismaService.payrollRecord.count({ where }),
    ]);

    return {
      payrollRecords,
      total,
    };
  }

  async generatePayrollReport(reportParams: any): Promise<any> {
    // Validate date range
    if (reportParams.startDate && reportParams.endDate) {
      const fromDate = new Date(reportParams.startDate);
      const toDate = new Date(reportParams.endDate);
      if (fromDate > toDate) {
        throw new BadRequestException('Invalid date range: Start date must be before end date');
      }
    }

    // Validate employees if department filter provided
    let employeeFilter: any = {};
    if (reportParams.departmentIds && reportParams.departmentIds.length > 0) {
      const employees = await this.prismaService.employee.findMany({
        where: {
          departmentId: { in: reportParams.departmentIds },
          isActive: true,
        },
      });

      if (employees.length === 0) {
        throw new NotFoundException('No employees found in specified departments');
      }

      employeeFilter.employeeId = { in: employees.map(e => e.id) };
    }

    // Build date filter
    const dateFilter: any = {};
    if (reportParams.startDate || reportParams.endDate) {
      dateFilter.payPeriod = {};
      if (reportParams.startDate) {
        dateFilter.payPeriod.gte = reportParams.startDate.replace(/-/g, '').substring(0, 6);
      }
      if (reportParams.endDate) {
        dateFilter.payPeriod.lte = reportParams.endDate.replace(/-/g, '').substring(0, 6);
      }
    }

    // Get payroll records
    const payrollRecords = await this.prismaService.payrollRecord.findMany({
      where: {
        ...employeeFilter,
        ...dateFilter,
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { payPeriod: 'asc' },
    });

    // Generate report data
    const summary = {
      totalEmployees: new Set(payrollRecords.map(r => r.employeeId)).size,
      totalPayroll: payrollRecords.reduce((sum, r) => sum + Number(r.grossPay), 0),
      totalNetPay: payrollRecords.reduce((sum, r) => sum + Number(r.netPay), 0),
      totalTaxes: payrollRecords.reduce((sum, r) => sum + Number(r.totalDeductions), 0),
      totalBenefits: payrollRecords.reduce((sum, r) => sum + Number(r.totalBenefits), 0),
      recordCount: payrollRecords.length,
    };

    return {
      summary,
      records: payrollRecords,
      period: {
        start: reportParams.startDate,
        end: reportParams.endDate,
      },
      generatedAt: new Date(),
    };
  }

  private calculateGrossPay(employee: Employee, payrollData?: any): number {
    const salary = Number(employee.salary);
    const regularHours = payrollData?.regularHours || 160;
    const overtimeHours = payrollData?.overtimeHours || 0;

    // Validate hours
    if (regularHours < 0 || overtimeHours < 0) {
      throw new BadRequestException('Hours cannot be negative');
    }

    if (overtimeHours > 60) { // Maximum reasonable overtime
      throw new BadRequestException('Overtime hours exceed maximum allowed');
    }

    const hourlyRate = salary / (52 * 40); // Annual salary to hourly rate
    const overtimeRate = hourlyRate * 1.5;

    const regularPay = hourlyRate * regularHours;
    const overtimePay = overtimeRate * overtimeHours;

    return regularPay + overtimePay;
  }

  private calculateBenefits(employee: Employee): any {
    // Simple benefit calculation based on employment type and salary
    const salary = Number(employee.salary);
    const healthInsurance = employee.employmentType === 'FULL_TIME' ? 300 : 0;
    const dentalInsurance = employee.employmentType === 'FULL_TIME' ? 50 : 0;
    const retirement401k = employee.employmentType === 'FULL_TIME' ? salary * 0.05 : 0;

    return {
      healthInsurance,
      dentalInsurance,
      retirement401k,
      otherBenefits: 0,
    };
  }
}