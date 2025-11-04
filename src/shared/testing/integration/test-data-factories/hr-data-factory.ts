import { PrismaService } from '../../../database/prisma.service';
import { BaseDataFactory, ITestDataFactory, TEST_DATA_CONSTANTS } from './base-data-factory';
import { EmploymentType, EmployeeStatus } from '../../../modules/hr/dto/create-employee.dto';
import { LeaveType, LeaveStatus } from '../../../modules/hr/dto/leave-request.dto';
import { PaymentMethod, PaymentStatus } from '../../../modules/hr/dto/create-payroll.dto';

/**
 * HR Data Factory
 *
 * Generates realistic test data for HR module integration tests
 * following SOLID Single Responsibility principle and KISS methodology
 */
export class HRDataFactory extends BaseDataFactory implements ITestDataFactory {
  private testEmployees: any[] = [];
  private testDepartments: any[] = [];
  private testUsers: any[] = [];
  private testLeaveRequests: any[] = [];
  private testPayrollRecords: any[] = [];

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Create base test data required for HR tests
   */
  async createBaseData(): Promise<void> {
    await this.createTestDepartments();
    await this.createTestUsers();
    await this.createTestEmployees();
  }

  /**
   * Clean up all test data
   */
  async cleanupTestData(): Promise<void> {
    const patterns = ['hr-test', 'employee-test', 'leave-test', 'payroll-test'];
    await this.cleanupTestData(patterns);
  }

  /**
   * Create test departments for employee assignments
   */
  private async createTestDepartments(): Promise<void> {
    const departments = [
      { name: 'Engineering', description: 'Software development and technology' },
      { name: 'Sales', description: 'Sales and customer relations' },
      { name: 'Human Resources', description: 'HR and people operations' },
      { name: 'Finance', description: 'Financial planning and accounting' },
      { name: 'Marketing', description: 'Marketing and communications' },
      { name: 'Operations', description: 'Operations and logistics' }
    ];

    for (const dept of departments) {
      try {
        const departmentData = {
          name: dept.name,
          description: dept.description,
          isActive: true
        };

        const department = await this.executeWithRetry(() =>
          this.prisma.department.create({ data: departmentData })
        );

        this.testDepartments.push(department);
      } catch (error) {
        // Department might already exist, try to find it
        const existingDepartment = await this.prisma.department.findFirst({
          where: { name: dept.name }
        });
        if (existingDepartment) {
          this.testDepartments.push(existingDepartment);
        }
      }
    }
  }

  /**
   * Create test users for employee records
   */
  private async createTestUsers(): Promise<void> {
    const roles = ['ADMIN', 'MANAGER', 'HR', 'USER'];

    for (const role of roles) {
      for (let i = 1; i <= 3; i++) {
        const user = await this.createTestUser(`${role.toLowerCase()}-hr-${i}`, {
          firstName: `${role} HR ${i}`,
          lastName: 'Test User',
          role: role
        });
        this.testUsers.push(user);
      }
    }
  }

  /**
   * Create test employees
   */
  private async createTestEmployees(): Promise<void> {
    const positions = [
      { position: 'Software Engineer', jobTitle: 'Senior Software Engineer', employmentType: EmploymentType.FULL_TIME, salary: 95000 },
      { position: 'Sales Manager', jobTitle: 'Sales Manager', employmentType: EmploymentType.FULL_TIME, salary: 85000 },
      { position: 'HR Specialist', jobTitle: 'HR Specialist', employmentType: EmploymentType.FULL_TIME, salary: 65000 },
      { position: 'Accountant', jobTitle: 'Senior Accountant', employmentType: EmploymentType.FULL_TIME, salary: 70000 },
      { position: 'Marketing Coordinator', jobTitle: 'Marketing Coordinator', employmentType: EmploymentType.PART_TIME, salary: 45000 },
      { position: 'Operations Manager', jobTitle: 'Operations Manager', employmentType: EmploymentType.FULL_TIME, salary: 80000 },
      { position: 'Junior Developer', jobTitle: 'Junior Software Developer', employmentType: EmploymentType.CONTRACT, salary: 60000 },
      { position: 'Intern', jobTitle: 'HR Intern', employmentType: EmploymentType.INTERN, salary: 35000 }
    ];

    for (const pos of positions) {
      const user = this.selectRandom(this.testUsers);
      const department = this.selectRandom(this.testDepartments);

      const employeeData = {
        employeeId: this.generateUniqueId('EMP'),
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: this.generatePhoneNumber(),
        address: this.generateAddress().street,
        city: this.generateAddress().city,
        state: this.generateAddress().state,
        postalCode: this.generateAddress().zipCode,
        country: this.generateAddress().country,
        dateOfBirth: this.generatePastDate(22 * 365), // 22 years ago
        departmentId: department.id,
        position: pos.position,
        jobTitle: pos.jobTitle,
        employmentType: pos.employmentType,
        salary: pos.salary,
        currency: 'USD',
        status: EmployeeStatus.ACTIVE,
        hireDate: this.generatePastDate(365), // 1 year ago
        socialSecurity: `SSN-${this.generateRandomString(6)}`,
        taxId: `TAX-${this.generateRandomString(8)}`,
        bankAccount: {
          bankName: 'Test Bank',
          accountNumber: `ACC-${this.generateRandomString(10)}`,
          routingNumber: `RT-${this.generateRandomString(9)}`
        },
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: this.generatePhoneNumber()
        },
        workSchedule: {
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '17:00' },
          friday: { start: '09:00', end: '17:00' }
        }
      };

      try {
        const employee = await this.executeWithRetry(() =>
          this.prisma.employee.create({ data: employeeData })
        );

        this.testEmployees.push(employee);
      } catch (error) {
        // Employee might already exist, try to find it
        const existingEmployee = await this.prisma.employee.findFirst({
          where: { userId: user.id }
        });
        if (existingEmployee) {
          this.testEmployees.push(existingEmployee);
        }
      }
    }
  }

  /**
   * Create a test employee with optional overrides
   */
  async createTestEmployee(overrides?: any): Promise<any> {
    const user = this.selectRandom(this.testUsers);
    const department = this.selectRandom(this.testDepartments);

    const employeeData = {
      employeeId: this.generateUniqueId('EMP'),
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      dateOfBirth: this.generatePastDate(25 * 365),
      departmentId: department.id,
      position: 'Test Position',
      jobTitle: 'Test Job Title',
      employmentType: EmploymentType.FULL_TIME,
      salary: this.generateAmount(40000, 120000),
      currency: 'USD',
      status: EmployeeStatus.ACTIVE,
      hireDate: this.generatePastDate(180),
      socialSecurity: `SSN-${this.generateRandomString(6)}`,
      taxId: `TAX-${this.generateRandomString(8)}`,
      bankAccount: {
        bankName: 'Test Bank',
        accountNumber: `ACC-${this.generateRandomString(10)}`,
        routingNumber: `RT-${this.generateRandomString(9)}`
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: this.generatePhoneNumber()
      },
      ...overrides
    };

    return await this.executeWithRetry(() =>
      this.prisma.employee.create({ data: employeeData })
    );
  }

  /**
   * Create a test leave request
   */
  async createTestLeaveRequest(overrides?: any): Promise<any> {
    if (this.testEmployees.length === 0) {
      await this.createBaseData();
    }

    const employee = this.selectRandom(this.testEmployees);
    const leaveType = this.selectRandom(Object.values(LeaveType));
    const startDate = this.generateFutureDate(7);
    const endDate = new Date(startDate.getTime() + (this.generateAmount(1, 5) * 24 * 60 * 60 * 1000));

    const leaveRequestData = {
      employeeId: employee.id,
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate,
      daysRequested: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      reason: `Test leave request for ${leaveType}`,
      status: LeaveStatus.PENDING,
      paidLeave: leaveType !== LeaveType.UNPAID,
      payRate: leaveType !== LeaveType.UNPAID ? this.generateAmount(100, 500) : undefined
    };

    const leaveRequest = await this.executeWithRetry(() =>
      this.prisma.leaveRequest.create({ data: leaveRequestData })
    );

    this.testLeaveRequests.push(leaveRequest);
    return leaveRequest;
  }

  /**
   * Create test leave requests with different statuses
   */
  async createTestLeaveRequestsWithStatuses(): Promise<any[]> {
    const statuses = Object.values(LeaveStatus);
    const requests = [];

    for (const status of statuses) {
      const request = await this.createTestLeaveRequest();

      // Update the request status
      const updateData: any = { status };

      if (status === LeaveStatus.APPROVED) {
        updateData.approvedBy = this.selectRandom(this.testUsers.filter(u => u.role === 'MANAGER')).id;
        updateData.approvedAt = new Date();
      } else if (status === LeaveStatus.REJECTED) {
        updateData.rejectedBy = this.selectRandom(this.testUsers.filter(u => u.role === 'MANAGER')).id;
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = 'Rejected for testing purposes';
      } else if (status === LeaveStatus.CANCELLED) {
        updateData.cancelledBy = request.employeeId;
        updateData.cancelledAt = new Date();
      }

      await this.prisma.leaveRequest.update({
        where: { id: request.id },
        data: updateData
      });

      requests.push({ ...request, ...updateData });
    }

    return requests;
  }

  /**
   * Create a test payroll record
   */
  async createTestPayrollRecord(overrides?: any): Promise<any> {
    if (this.testEmployees.length === 0) {
      await this.createBaseData();
    }

    const employee = this.selectRandom(this.testEmployees);
    const grossPay = parseFloat(employee.salary.toString()) / 12; // Monthly salary
    const federalTax = grossPay * 0.15;
    const stateTax = grossPay * 0.05;
    const socialSecurityTax = grossPay * 0.062;
    const medicareTax = grossPay * 0.0145;
    const healthInsurance = this.generateAmount(200, 500);
    const dentalInsurance = this.generateAmount(50, 150);
    const retirement401k = grossPay * 0.05;

    const totalDeductions = federalTax + stateTax + socialSecurityTax + medicareTax + healthInsurance + dentalInsurance + retirement401k;
    const netPay = grossPay - totalDeductions;

    const payrollData = {
      employeeId: employee.id,
      payPeriod: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`,
      grossPay: grossPay,
      netPay: netPay,
      currency: 'USD',
      federalTax: federalTax,
      stateTax: stateTax,
      socialSecurityTax: socialSecurityTax,
      medicareTax: medicareTax,
      healthInsurance: healthInsurance,
      dentalInsurance: dentalInsurance,
      retirement401k: retirement401k,
      regularHours: 160,
      overtimeHours: this.generateAmount(0, 20),
      hourlyRate: grossPay / 160,
      overtimeRate: (grossPay / 160) * 1.5,
      paymentMethod: PaymentMethod.DIRECT_DEPOSIT,
      status: PaymentStatus.PAID,
      paymentDate: new Date(),
      transactionId: `TXN-${this.generateRandomString(12)}`
    };

    const payrollRecord = await this.executeWithRetry(() =>
      this.prisma.payrollRecord.create({ data: payrollData })
    );

    this.testPayrollRecords.push(payrollRecord);
    return payrollRecord;
  }

  /**
   * Create test payroll records with different statuses
   */
  async createTestPayrollRecordsWithStatuses(): Promise<any[]> {
    const statuses = [PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED];
    const records = [];

    for (const status of statuses) {
      const record = await this.createTestPayrollRecord();

      await this.prisma.payrollRecord.update({
        where: { id: record.id },
        data: {
          status,
          paymentDate: status === PaymentStatus.PAID ? new Date() : null
        }
      });

      records.push({ ...record, status });
    }

    return records;
  }

  /**
   * Create test performance review data
   */
  async createTestPerformanceReview(overrides?: any): Promise<any> {
    if (this.testEmployees.length === 0) {
      await this.createBaseData();
    }

    const employee = this.selectRandom(this.testEmployees);
    const reviewer = this.selectRandom(this.testUsers.filter(u => u.role === 'MANAGER'));

    const reviewData = {
      employeeId: employee.id,
      reviewerId: reviewer.id,
      reviewPeriod: `2024-Q${Math.floor(Math.random() * 4) + 1}`,
      reviewType: 'QUARTERLY',
      overallRating: this.selectRandom(['EXCELLENT', 'GOOD', 'SATISFACTORY', 'NEEDS_IMPROVEMENT']),
      strengths: [
        'Strong technical skills',
        'Good team collaboration',
        'Meets deadlines consistently'
      ],
      weaknesses: [
        'Could improve communication',
        'Needs more leadership experience'
      ],
      recommendations: [
        'Take on more leadership roles',
        'Attend communication workshop'
      ],
      goals: [
        'Complete advanced certification',
        'Mentor junior team members'
      ],
      employeeComments: 'Happy with the feedback and will work on improvements',
      reviewerComments: 'Good performance overall with room for growth',
      status: 'COMPLETED',
      reviewDate: new Date(),
      nextReviewDate: this.generateFutureDate(90)
    };

    return await this.executeWithRetry(() =>
      this.prisma.performanceReview.create({ data: reviewData })
    );
  }

  /**
   * Get test employees
   */
  getTestEmployees(): any[] {
    return this.testEmployees;
  }

  /**
   * Get test departments
   */
  getTestDepartments(): any[] {
    return this.testDepartments;
  }

  /**
   * Get test users
   */
  getTestUsers(): any[] {
    return this.testUsers;
  }

  /**
   * Get test leave requests
   */
  getTestLeaveRequests(): any[] {
    return this.testLeaveRequests;
  }

  /**
   * Get test payroll records
   */
  getTestPayrollRecords(): any[] {
    return this.testPayrollRecords;
  }

  /**
   * Generate test data for specific scenarios
   */
  generateTestData(overrides?: any): any {
    return {
      employee: {
        firstName: 'John',
        lastName: 'Doe',
        email: this.generateTestEmail('employee'),
        phone: this.generatePhoneNumber(),
        position: 'Software Engineer',
        jobTitle: 'Senior Software Engineer',
        employmentType: EmploymentType.FULL_TIME,
        salary: 95000,
        departmentId: this.testDepartments[0]?.id,
        ...overrides?.employee
      },
      leaveRequest: {
        leaveType: LeaveType.ANNUAL,
        startDate: this.generateFutureDate(14),
        endDate: this.generateFutureDate(18),
        reason: 'Family vacation',
        paidLeave: true,
        ...overrides?.leaveRequest
      },
      payroll: {
        payPeriod: '2024-01',
        grossPay: 7916.67,
        netPay: 6000.00,
        paymentMethod: PaymentMethod.DIRECT_DEPOSIT,
        ...overrides?.payroll
      },
      ...overrides
    };
  }

  /**
   * Create test data for performance testing
   */
  async createPerformanceTestData(count: number = 100): Promise<any[]> {
    const records = [];

    for (let i = 0; i < count; i++) {
      const record = await this.createTestPayrollRecord();
      records.push(record);
    }

    return records;
  }

  /**
   * Create test data for analytics testing
   */
  async createAnalyticsTestData(): Promise<any> {
    const employee = await this.createTestEmployee();

    // Create multiple leave requests for analytics
    const leaveRequests = [];
    for (let i = 0; i < 5; i++) {
      const request = await this.createTestLeaveRequest({
        employeeId: employee.id,
        status: this.selectRandom([LeaveStatus.APPROVED, LeaveStatus.COMPLETED])
      });
      leaveRequests.push(request);
    }

    // Create multiple payroll records for analytics
    const payrollRecords = [];
    for (let i = 0; i < 6; i++) {
      const record = await this.createTestPayrollRecord({
        employeeId: employee.id,
        payPeriod: `2024-${String(i + 1).padStart(2, '0')}`
      });
      payrollRecords.push(record);
    }

    // Create performance review
    const performanceReview = await this.createTestPerformanceReview({
      employeeId: employee.id
    });

    return {
      employee,
      leaveRequests,
      payrollRecords,
      performanceReview
    };
  }

  /**
   * Create test data for bulk operations testing
   */
  async createBulkTestData(): Promise<any> {
    const employees = [];
    const leaveRequests = [];
    const payrollRecords = [];

    // Create multiple employees
    for (let i = 0; i < 5; i++) {
      const employee = await this.createTestEmployee();
      employees.push(employee);

      // Create leave requests for each employee
      for (let j = 0; j < 2; j++) {
        const request = await this.createTestLeaveRequest({
          employeeId: employee.id
        });
        leaveRequests.push(request);
      }

      // Create payroll records for each employee
      for (let k = 0; k < 3; k++) {
        const record = await this.createTestPayrollRecord({
          employeeId: employee.id,
          payPeriod: `2024-${String(k + 1).padStart(2, '0')}`
        });
        payrollRecords.push(record);
      }
    }

    return {
      employees,
      leaveRequests,
      payrollRecords
    };
  }
}