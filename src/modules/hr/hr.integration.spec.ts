import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { expect } from 'chai';
import * as request from 'supertest';
import { EmployeeService } from './services/employee.service';
import { LeaveRequestService } from './services/leave-request.service';
import { PayrollService } from './services/payroll.service';
import { EmployeeController } from './controllers/employee.controller';
import { LeaveRequestController } from './controllers/leave-request.controller';
import { PayrollController } from './controllers/payroll.controller';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import { JwtStrategy } from '../authentication/jwt.strategy';
import { LocalStrategy } from '../authentication/local.strategy';
import { AuthService } from '../authentication/auth.service';
import { AuthHelpers, UserRole } from '../../shared/testing/auth-helpers';
import {
  CreateEmployeeDto,
  EmploymentType,
  EmployeeStatus,
} from './dto/create-employee.dto';
import {
  CreateLeaveRequestDto,
  LeaveType,
  LeaveStatus,
  } from './dto/leave-request.dto';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * HR Module Integration Tests
 * Tests complete human resources workflows end-to-end
 * These tests validate the entire HR management system including employee lifecycle,
 * leave management, payroll processing, and compliance reporting
 * following enterprise-grade standards and OWASP security principles
 */
describe('HR Module Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
    let adminToken: string;
  let managerToken: string;
  let employeeToken: string;

  // Setup test environment before all tests
  before(async () => {
    // Setup integration test environment
    await setupIntegrationTest();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
              JWT_EXPIRATION: '1h',
              JWT_REFRESH_EXPIRATION: '7d',
              DATABASE_URL: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
              app: {
                database: {
                  url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
                },
              },
              LOG_LEVEL: 'error',
              NODE_ENV: 'test',
            })
          ],
        }),
        PrismaModule,
        SecurityModule,
        JwtModule.register({
          secret: 'test-jwt-secret-key-for-integration-tests',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [EmployeeController, LeaveRequestController, PayrollController],
      providers: [EmployeeService, LeaveRequestService, PayrollService, AuthService, JwtStrategy, LocalStrategy],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a direct PrismaService instance for test cleanup
    const { PrismaService } = await import('../../shared/database/prisma.service');
    const { ConfigService } = await import('@nestjs/config');

    const configService = new ConfigService({
      app: {
        database: {
          url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
        },
      },
    });

    prismaService = new PrismaService(configService);
    await prismaService.$connect();
    
    // Create test users with different roles using direct token generation
    adminToken = AuthHelpers.createTestTokenDirect(UserRole.ADMIN);
    managerToken = AuthHelpers.createTestTokenDirect(UserRole.MANAGER);
    employeeToken = AuthHelpers.createTestTokenDirect(UserRole.USER);
  });

  // Cleanup after all tests
  after(async () => {
    if (prismaService) {
      await prismaService.$disconnect();
    }
    if (app) {
      await app.close();
    }
    await cleanupIntegrationTest();
  });

  // Clean up test data before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('Employee Management', () => {
    it('should create a new employee successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createUserResponse = await createTestUser('EMPLOYEE');
      const userId = createUserResponse.user.id;

      const createEmployeeDto: CreateEmployeeDto = {
        userId,
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe${timestamp}@test.com`,
        phone: '+1234567890',
        address: '123 Employee Street',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'Test Country',
        dateOfBirth: '1990-01-15',
        departmentId: 'dept-001',
        position: 'Software Engineer',
        jobTitle: 'Software Engineer',
        employmentType: EmploymentType.FULL_TIME,
        salary: 75000,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createEmployeeDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.userId).to.equal(createEmployeeDto.userId);
      expect(response.body.firstName).to.equal(createEmployeeDto.firstName);
      expect(response.body.lastName).to.equal(createEmployeeDto.lastName);
      expect(response.body.email).to.equal(createEmployeeDto.email);
      expect(response.body.employmentType).to.equal(EmploymentType.FULL_TIME);
      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should reject employee creation with duplicate user ID', async () => {
      // Arrange - Create employee first
      const createUserResponse = await createTestUser('EMPLOYEE');
      const createEmployeeDto: CreateEmployeeDto = {
        userId: createUserResponse.user.id,
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        dateOfBirth: '1992-05-20',
        departmentId: 'dept-001',
        position: 'Software Engineer',
        jobTitle: 'Software Engineer',
        employmentType: EmploymentType.FULL_TIME,
        salary: 75000,
      };

      await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createEmployeeDto)
        .expect(201);

      // Act - Try to create second employee with same user ID
      const duplicateEmployeeDto = {
        ...createEmployeeDto,
        firstName: 'Duplicate',
        lastName: 'Employee',
        email: 'duplicate@test.com',
      };

      const response = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateEmployeeDto)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('already exists');
    });

    it('should validate employee creation data', async () => {
      // Arrange - Invalid data
      const invalidEmployeeDto = {
        userId: '', // Empty user ID
        firstName: '', // Empty first name
        lastName: '', // Empty last name
        email: 'invalid-email', // Invalid email format
        dateOfBirth: 'invalid-date', // Invalid date
        employmentType: 'INVALID_TYPE', // Invalid employment type
        salary: -1000, // Negative salary
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidEmployeeDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should get employee by ID successfully', async () => {
      // Arrange - Create an employee first
      const createdEmployee = await createTestEmployee();

      // Act
      const response = await request(app.getHttpServer())
        .get(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdEmployee.id);
      expect(response.body.firstName).to.equal(createdEmployee.firstName);
      expect(response.body.lastName).to.equal(createdEmployee.lastName);
      expect(response.body.email).to.equal(createdEmployee.email);
      expect(response.body.employeeId).to.be.a('string');
    });

    it('should return 404 for non-existent employee', async () => {
      // Act & Assert
      const response = await request(app.getHttpServer())
        .get('/employees/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.message).to.include('not found');
    });

    it('should update employee successfully', async () => {
      // Arrange - Create an employee first
      const createdEmployee = await createTestEmployee();

      const updateData = {
        firstName: 'Updated First Name',
        lastName: 'Updated Last Name',
        phone: '+9876543210',
        address: 'Updated Address',
        position: 'Senior Software Engineer',
        salary: 85000,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdEmployee.id);
      expect(response.body.firstName).to.equal(updateData.firstName);
      expect(response.body.lastName).to.equal(updateData.lastName);
      expect(response.body.position).to.equal(updateData.position);
      expect(response.body.salary).to.equal(updateData.salary);
      expect(response.body.updatedAt).to.not.equal(createdEmployee.updatedAt);
    });

    it('should get paginated employee list', async () => {
      // Arrange - Create multiple employees
      await createMultipleTestEmployees();

      // Act
      const response = await request(app.getHttpServer())
        .get('/employees?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(5);
      expect(response.body.pagination.total).to.be.greaterThan(0);
      expect(response.body.data.length).to.be.lessThanOrEqual(5);
    });

    it('should filter employees by employment type', async () => {
      // Arrange - Create employees with different employment types
      await createTestEmployee({ employmentType: EmploymentType.FULL_TIME });
      await createTestEmployee({ employmentType: EmploymentType.PART_TIME });

      // Act
      const response = await request(app.getHttpServer())
        .get('/employees?employmentType=FULL_TIME')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((employee: any) => {
          expect(employee.employmentType).to.equal('FULL_TIME');
        });
      }
    });

    it('should filter employees by department', async () => {
      // Arrange - Create employees in specific department
      await createTestEmployee({ departmentId: 'dept-001' });

      // Act
      const response = await request(app.getHttpServer())
        .get('/employees?departmentId=dept-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((employee: any) => {
          expect(employee.departmentId).to.equal('dept-001');
        });
      }
    });

    it('should update employee employment type successfully', async () => {
      // Arrange - Create an employee first
      const createdEmployee = await createTestEmployee();

      const updateData = {
        employmentType: EmploymentType.PART_TIME,
        salary: 40000,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdEmployee.id);
      expect(response.body.employmentType).to.equal(EmploymentType.PART_TIME);
      expect(response.body.salary).to.equal(updateData.salary);
      expect(response.body.updatedAt).to.not.equal(createdEmployee.updatedAt);
    });
  });

  describe('Leave Request Management', () => {
    let testEmployee: any;

    beforeEach(async () => {
      testEmployee = await createTestEmployee();
    });

    it('should create a new leave request successfully', async () => {
      // Arrange
      const timestamp = Date.now();
      const createLeaveRequestDto: CreateLeaveRequestDto = {
        employeeId: testEmployee.id,
        leaveType: LeaveType.ANNUAL,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        reason: `Annual vacation ${timestamp}`,
        paidLeave: true,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(createLeaveRequestDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.employeeId).to.equal(createLeaveRequestDto.employeeId);
      expect(response.body.leaveType).to.equal(LeaveType.ANNUAL);
      expect(response.body.status).to.equal(LeaveStatus.PENDING);
      expect(new Date(response.body.startDate).getTime()).to.equal(createLeaveRequestDto.startDate.getTime());
      expect(new Date(response.body.endDate).getTime()).to.equal(createLeaveRequestDto.endDate.getTime());
      expect(response.body.reason).to.equal(createLeaveRequestDto.reason);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should validate leave request creation data', async () => {
      // Arrange - Invalid data
      const invalidLeaveRequestDto = {
        employeeId: '', // Empty employee ID
        leaveType: 'INVALID_TYPE', // Invalid leave type
        startDate: 'invalid-date', // Invalid date
        endDate: 'invalid-date', // Invalid date
      };

      // Act & Assert
      const response = await request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(invalidLeaveRequestDto)
        .expect(400);

      expect(response.body.message).to.be.an('array');
      expect(response.body.message.length).to.be.greaterThan(0);
    });

    it('should reject leave request with overlapping dates', async () => {
      // Arrange - Create first leave request
      const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      const firstLeaveRequest: CreateLeaveRequestDto = {
        employeeId: testEmployee.id,
        leaveType: LeaveType.ANNUAL,
        startDate,
        endDate,
        reason: 'First vacation',
        paidLeave: true,
      };

      await request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(firstLeaveRequest)
        .expect(201);

      // Act - Try to create overlapping leave request
      const overlappingLeaveRequest: CreateLeaveRequestDto = {
        employeeId: testEmployee.id,
        leaveType: LeaveType.SICK,
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // Overlaps
        endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        reason: 'Sick leave during vacation',
        paidLeave: true,
      };

      const response = await request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(overlappingLeaveRequest)
        .expect(409);

      // Assert
      expect(response.body.message).to.include('overlapping');
    });

    it('should approve leave request successfully', async () => {
      // Arrange - Create and submit leave request
      const createdLeaveRequest = await createTestLeaveRequest(testEmployee.id);

      const approvalData = {
        action: 'APPROVE',
        comments: 'Leave approved for integration testing',
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/leave-requests/${createdLeaveRequest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(approvalData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdLeaveRequest.id);
      expect(response.body.status).to.equal(LeaveStatus.APPROVED);
      expect(response.body.approvedAt).to.not.be.null;
      expect(response.body.approvedBy).to.not.be.null;
      expect(response.body.comments).to.equal(approvalData.comments);
    });

    it('should reject leave request successfully', async () => {
      // Arrange - Create leave request
      const createdLeaveRequest = await createTestLeaveRequest(testEmployee.id);

      const rejectionData = {
        action: 'REJECT',
        comments: 'Insufficient staffing during requested dates',
        reason: 'BUSINESS_NEEDS',
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/leave-requests/${createdLeaveRequest.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send(rejectionData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdLeaveRequest.id);
      expect(response.body.status).to.equal(LeaveStatus.REJECTED);
      expect(response.body.rejectedAt).to.not.be.null;
      expect(response.body.rejectedBy).to.not.be.null;
      expect(response.body.rejectionReason).to.equal(rejectionData.reason);
    });

    it('should cancel own leave request successfully', async () => {
      // Arrange - Create leave request
      const createdLeaveRequest = await createTestLeaveRequest(testEmployee.id);

      const cancellationData = {
        reason: 'Changed plans, no longer need leave',
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/leave-requests/${createdLeaveRequest.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(cancellationData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdLeaveRequest.id);
      expect(response.body.status).to.equal(LeaveStatus.CANCELLED);
      expect(response.body.cancelledAt).to.not.be.null;
      expect(response.body.cancellationReason).to.equal(cancellationData.reason);
    });

    it('should get paginated leave requests', async () => {
      // Arrange - Create multiple leave requests
      await createMultipleTestLeaveRequests(testEmployee.id);

      // Act
      const response = await request(app.getHttpServer())
        .get('/leave-requests?page=1&limit=5')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('data');
      expect(response.body).to.have.property('pagination');
      expect(response.body.data).to.be.an('array');
      expect(response.body.pagination.page).to.equal(1);
      expect(response.body.pagination.limit).to.equal(5);
      expect(response.body.pagination.total).to.be.greaterThan(0);
      expect(response.body.data.length).to.be.lessThanOrEqual(5);
    });

    it('should filter leave requests by status', async () => {
      // Arrange - Create leave requests with different statuses
      await createTestLeaveRequest(testEmployee.id);
      const approvedLeave = await createTestLeaveRequest(testEmployee.id);

      await request(app.getHttpServer())
        .put(`/leave-requests/${approvedLeave.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ action: 'APPROVE', comments: 'Approved' })
        .expect(200);

      // Act
      const response = await request(app.getHttpServer())
        .get('/leave-requests?status=PENDING')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      // Assert
      expect(response.body.data).to.be.an('array');
      if (response.body.data.length > 0) {
        response.body.data.forEach((leaveRequest: any) => {
          expect(leaveRequest.status).to.equal('PENDING');
        });
      }
    });

    it('should get employee leave balance', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get(`/leave-requests/balance/${testEmployee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('employeeId', testEmployee.id);
      expect(response.body).to.have.property('balances');
      expect(response.body.balances).to.be.an('array');

      if (response.body.balances.length > 0) {
        response.body.balances.forEach((balance: any) => {
          expect(balance).to.have.property('leaveType');
          expect(balance).to.have.property('totalDays');
          expect(balance).to.have.property('usedDays');
          expect(balance).to.have.property('availableDays');
        });
      }
    });
  });

  describe('Payroll Management', () => {
    let testEmployee: any;

    beforeEach(async () => {
      testEmployee = await createTestEmployee();
    });

    it('should create payroll run successfully', async () => {
      // Arrange
            const createPayrollDto: CreatePayrollDto = {
        employeeId: testEmployee.id,
        payPeriod: '2024-01',
        grossPay: 6250, // Monthly salary (75,000 / 12)
        netPay: 5000, // After taxes
        currency: 'USD',
        regularHours: 160,
        overtimeHours: 0,
        hourlyRate: 46.88, // Based on salary
        overtimeRate: 70.31, // 1.5x hourly rate
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/payroll')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayrollDto)
        .expect(201);

      // Assert
      expect(response.body).to.have.property('id');
      expect(response.body.employeeId).to.equal(createPayrollDto.employeeId);
      expect(response.body.payPeriod).to.equal(createPayrollDto.payPeriod);
      expect(response.body.grossPay).to.equal(createPayrollDto.grossPay);
      expect(response.body.netPay).to.equal(createPayrollDto.netPay);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should calculate payroll with overtime correctly', async () => {
      // Arrange
      const createPayrollDto: CreatePayrollDto = {
        employeeId: testEmployee.id,
        payPeriod: '2024-01',
        grossPay: 6562.50, // Base salary + overtime
        netPay: 5250, // After taxes
        regularHours: 160,
        overtimeHours: 10,
        hourlyRate: 37.50, // Based on 6000/month
        overtimeRate: 56.25, // 1.5x hourly rate
        federalTax: 1000,
        stateTax: 312.50,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/payroll')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayrollDto)
        .expect(201);

      // Assert
      expect(response.body.employeeId).to.equal(createPayrollDto.employeeId);
      expect(response.body.overtimeHours).to.equal(10);
      expect(response.body.overtimeRate).to.equal(56.25);

      // Calculate expected overtime pay
      
      expect(response.body.grossPay).to.be.closeTo(6562.50, 0.01);
      expect(response.body.netPay).to.equal(createPayrollDto.netPay);
    });

    it('should update payroll successfully', async () => {
      // Arrange - Create payroll run
      const createdPayroll = await createTestPayroll(testEmployee.id);

      const updateData = {
        netPay: 5200,
        overtimeHours: 5,
      };

      // Act
      const response = await request(app.getHttpServer())
        .put(`/payroll/${createdPayroll.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.id).to.equal(createdPayroll.id);
      expect(response.body.netPay).to.equal(updateData.netPay);
      expect(response.body.overtimeHours).to.equal(updateData.overtimeHours);
      expect(response.body.updatedAt).to.not.equal(createdPayroll.updatedAt);
    });

    it('should get payroll history for employee', async () => {
      // Arrange - Create payroll runs
      await createTestPayroll(testEmployee.id, '2024-01');
      await createTestPayroll(testEmployee.id, '2024-02');
      await createTestPayroll(testEmployee.id, '2024-03');

      // Act
      const response = await request(app.getHttpServer())
        .get(`/payroll/employee/${testEmployee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);

      response.body.forEach((payroll: any) => {
        expect(payroll).to.have.property('id');
        expect(payroll).to.have.property('period');
        expect(payroll).to.have.property('payDate');
        expect(payroll).to.have.property('netPay');
        expect(payroll).to.have.property('status');
      });
    });

    it('should generate payroll reports', async () => {
      // Arrange - Create payroll data
      await createTestPayroll(testEmployee.id, '2024-01');

      // Act
      const response = await request(app.getHttpServer())
        .get('/payroll/reports?period=2024-01')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body).to.have.property('period', '2024-01');
      expect(response.body).to.have.property('summary');
      expect(response.body.summary).to.have.property('totalEmployees');
      expect(response.body.summary).to.have.property('totalPayroll');
      expect(response.body.summary).to.have.property('averageSalary');
      expect(response.body).to.have.property('totalOvertime');
      expect(response.body).to.have.property('generatedAt');
    });
  });

  describe('Cross-Module HR Workflows', () => {
    it('should handle complete employee lifecycle', async () => {
      // 1. Hire new employee
      const hiredEmployee = await createTestEmployee();

      // 2. Create leave request for new employee
      const leaveRequest = await createTestLeaveRequest(hiredEmployee.id);

      // 3. Approve leave request
      await request(app.getHttpServer())
        .put(`/leave-requests/${leaveRequest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ action: 'APPROVE', comments: 'Welcome vacation' })
        .expect(200);

      // 4. Process first payroll
      await createTestPayroll(hiredEmployee.id, '2024-01');

      // 5. Verify employee data integrity
      const employeeResponse = await request(app.getHttpServer())
        .get(`/employees/${hiredEmployee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(employeeResponse.body.id).to.equal(hiredEmployee.id);
      expect(employeeResponse.body.status).to.equal(EmployeeStatus.ACTIVE);

      // 6. Verify leave history
      const leaveHistory = await request(app.getHttpServer())
        .get(`/leave-requests?employeeId=${hiredEmployee.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(leaveHistory.body.data).to.have.length(1);
      expect(leaveHistory.body.data[0].status).to.equal(LeaveStatus.APPROVED);

      // 7. Verify payroll history
      const payrollHistory = await request(app.getHttpServer())
        .get(`/payroll/employee/${hiredEmployee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(payrollHistory.body).to.have.length(1);
    });

    it('should handle employee termination workflow', async () => {
      // 1. Hire employee
      const employee = await createTestEmployee();

      // 2. Process payroll for employee
      await createTestPayroll(employee.id, '2024-01');

      // 3. Terminate employee
      const terminationData = {
        status: EmployeeStatus.TERMINATED,
        terminationDate: new Date().toISOString().split('T')[0],
        terminationReason: 'Resignation',
        notes: 'Employee resigned for better opportunity',
      };

      await request(app.getHttpServer())
        .put(`/employees/${employee.id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(terminationData)
        .expect(200);

      // 4. Verify employee status change
      const terminatedEmployee = await request(app.getHttpServer())
        .get(`/employees/${employee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(terminatedEmployee.body.status).to.equal(EmployeeStatus.TERMINATED);

      // 5. Verify final payroll processing
      const finalPayroll = await request(app.getHttpServer())
        .get(`/payroll/employee/${employee.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalPayroll.body).to.have.length(1);
    });
  });

  describe('Security and Authorization', () => {
    it('should enforce RBAC for employee management', async () => {
      // Arrange - Employee data
      const createUserResponse = await createTestUser('EMPLOYEE');
      const employeeDto = {
        userId: createUserResponse.user.id,
        firstName: 'Test',
        lastName: 'Employee',
        email: 'test.employee@test.com',
        hireDate: '2024-01-15',
        employmentType: EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        departmentId: 'dept-001',
        position: 'Test Position',
        salary: 50000,
      };

      // Act & Assert - Employee should not be able to create employees
      await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(employeeDto)
        .expect(403);

      // Act & Assert - Manager should not be able to create employees (admin only)
      await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${managerToken}`)
        .send(employeeDto)
        .expect(403);

      // Act & Assert - Admin should be able to create employees
      await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(employeeDto)
        .expect(201);
    });

    it('should allow employees to manage their own leave requests', async () => {
      // Arrange - Create employee and leave request
      const employee = await createTestEmployee();
      const leaveRequest = await createTestLeaveRequest(employee.id);

      // Act & Assert - Employee can view their own leave requests
      await request(app.getHttpServer())
        .get(`/leave-requests?employeeId=${employee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // Act & Assert - Employee can cancel their own pending leave request
      await request(app.getHttpServer())
        .put(`/leave-requests/${leaveRequest.id}/cancel`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ reason: 'Changed plans' })
        .expect(200);

      // Act & Assert - Employee cannot approve leave requests
      await request(app.getHttpServer())
        .put(`/leave-requests/${leaveRequest.id}/approve`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ action: 'APPROVE', comments: 'Self approval' })
        .expect(403);
    });

    it('should prevent XSS attacks in employee data', async () => {
      // Arrange - Malicious input with XSS attempt
      const createUserResponse = await createTestUser('EMPLOYEE');
      const maliciousEmployeeDto = {
        userId: createUserResponse.user.id,
        firstName: '<script>alert("xss")</script>Malicious',
        lastName: 'Employee',
        email: 'xss.test@test.com',
        hireDate: '2024-01-15',
        employmentType: EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        departmentId: 'dept-001',
        position: '<img src=x onerror=alert("xss")>Test Position',
        salary: 50000,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousEmployeeDto)
        .expect(201);

      // Assert - XSS should be sanitized
      expect(response.body.firstName).to.not.include('<script>');
      expect(response.body.firstName).to.include('Malicious');
      expect(response.body.position).to.not.include('<img');
      expect(response.body.position).to.include('Test Position');
    });

    it('should protect sensitive payroll information', async () => {
      // Arrange - Create employee and payroll
      const employee = await createTestEmployee();
      await createTestPayroll(employee.id);

      // Act & Assert - Employee can view their own payroll
      await request(app.getHttpServer())
        .get(`/payroll/employee/${employee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      // Act & Assert - Employee cannot view other employees' payroll
      const otherEmployee = await createTestEmployee();
      await request(app.getHttpServer())
        .get(`/payroll/employee/${otherEmployee.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);

      // Act & Assert - Manager can view team payroll
      await request(app.getHttpServer())
        .get(`/payroll/employee/${employee.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent leave approval safely', async () => {
      // Arrange - Create leave request
      const employee = await createTestEmployee();
      const leaveRequest = await createTestLeaveRequest(employee.id);

      const approvalActions = [
        { action: 'APPROVE', comments: 'Approval 1' },
        { action: 'REJECT', comments: 'Rejection 2' },
      ];

      // Act - Process approval actions concurrently
      const approvalPromises = approvalActions.map(action =>
        request(app.getHttpServer())
          .put(`/leave-requests/${leaveRequest.id}/approve`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(action)
      );

      const results = await Promise.allSettled(approvalPromises);

      // Assert - One should succeed, one should fail
      const successfulApprovals = results.filter(r => r.status === 'fulfilled');
      const failedApprovals = results.filter(r => r.status === 'rejected');

      expect(successfulApprovals.length).to.equal(1);
      expect(failedApprovals.length).to.equal(1);

      // Verify final state
      const finalLeaveRequest = await request(app.getHttpServer())
        .get(`/leave-requests/${leaveRequest.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(finalLeaveRequest.body.status).to.be.oneOf([
        LeaveStatus.APPROVED,
        LeaveStatus.REJECTED,
      ]);
    });

    it('should handle concurrent payroll processing safely', async () => {
      // Arrange - Create payroll run
      const employee = await createTestEmployee();
      const payroll = await createTestPayroll(employee.id);

      // Act - Process payroll concurrently
      const processingPromises = [
        request(app.getHttpServer())
          .post(`/payroll/${payroll.id}/process`)
          .set('Authorization', `Bearer ${adminToken}`),
        request(app.getHttpServer())
          .post(`/payroll/${payroll.id}/process`)
          .set('Authorization', `Bearer ${adminToken}`),
      ];

      const results = await Promise.allSettled(processingPromises);

      // Assert - One should succeed, one should fail
      const successfulProcessing = results.filter(r => r.status === 'fulfilled');
      const failedProcessing = results.filter(r => r.status === 'rejected');

      expect(successfulProcessing.length).to.equal(1);
      expect(failedProcessing.length).to.equal(1);

      // Verify final state
      const finalPayroll = await request(app.getHttpServer())
        .get(`/payroll/${payroll.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(finalPayroll.body.status).to.equal('PROCESSED');
    });
  });

  /**
   * Helper Functions
   */

  // NOTE: getTestAuthToken function replaced with AuthHelpers.createTestToken()

  async function createTestUser(role: string): Promise<any> {
    const timestamp = Date.now();
    const userData = {
      email: `employee-${role}-${timestamp}@test.com`,
      password: 'EmployeePassword123!',
      firstName: 'Test',
      lastName: 'Employee',
      username: `emp-${role}-${timestamp}`,
    };

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(userData);

    return response.body;
  }

  async function createTestEmployee(overrides?: Partial<CreateEmployeeDto>): Promise<any> {
    const createUserResponse = await createTestUser('EMPLOYEE');
    const timestamp = Date.now();

    const employeeData: CreateEmployeeDto = {
      userId: createUserResponse.user.id,
      firstName: `Test${timestamp}`,
      lastName: 'Employee',
      email: `employee${timestamp}@test.com`,
      phone: '+1234567890',
      address: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      postalCode: '12345',
      country: 'Test Country',
      dateOfBirth: '1990-01-15',
      departmentId: 'dept-001',
      position: 'Software Engineer',
      jobTitle: 'Software Engineer',
      employmentType: EmploymentType.FULL_TIME,
      salary: 75000,
      ...overrides,
    };

    const response = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(employeeData);

    return response.body;
  }

  async function createTestLeaveRequest(employeeId: string): Promise<any> {
    const timestamp = Date.now();
    const leaveRequestData: CreateLeaveRequestDto = {
      employeeId,
      leaveType: LeaveType.ANNUAL,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      reason: `Test leave request ${timestamp}`,
      paidLeave: true,
    };

    const response = await request(app.getHttpServer())
      .post('/leave-requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send(leaveRequestData);

    return response.body;
  }

  async function createTestPayroll(employeeId: string, period: string = '2024-01'): Promise<any> {
    // First get the employee to get salary
    await request(app.getHttpServer())
      .get(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);


    const payrollData: CreatePayrollDto = {
      employeeId,
      payPeriod: period,
      grossPay: 6250, // Standard monthly salary
      netPay: 5000, // After standard deductions
      currency: 'USD',
      regularHours: 160,
      overtimeHours: 0,
      hourlyRate: 39.06, // Based on annual salary
      overtimeRate: 58.59, // 1.5x hourly rate
    };

    const response = await request(app.getHttpServer())
      .post('/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payrollData);

    return response.body;
  }

  async function createMultipleTestEmployees(): Promise<void> {
    const employeeTypes = [
      { firstName: 'Alice', position: 'Software Engineer', salary: 75000 },
      { firstName: 'Bob', position: 'Product Manager', salary: 85000 },
      { firstName: 'Carol', position: 'UX Designer', salary: 70000 },
    ];

    for (const employeeType of employeeTypes) {
      await createTestEmployee({
        firstName: employeeType.firstName,
        position: employeeType.position,
        salary: employeeType.salary,
      });
    }
  }

  async function createMultipleTestLeaveRequests(employeeId: string): Promise<void> {
    const leaveTypes = [LeaveType.ANNUAL, LeaveType.SICK, LeaveType.PERSONAL];

    for (let i = 0; i < leaveTypes.length; i++) {
      const startDate = new Date(Date.now() + (7 + i * 14) * 24 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + (10 + i * 14) * 24 * 60 * 60 * 1000);

      const leaveRequestData: CreateLeaveRequestDto = {
        employeeId,
        leaveType: leaveTypes[i],
        startDate,
        endDate,
        reason: `Test ${leaveTypes[i]} leave ${i + 1}`,
        paidLeave: true,
      };

      await request(app.getHttpServer())
        .post('/leave-requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send(leaveRequestData);
    }
  }

  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in order of dependencies
      await prismaService.payroll.deleteMany({});
      await prismaService.leaveRequest.deleteMany({});
      await prismaService.employee.deleteMany({});

      // Clean up test users
      await prismaService.user.deleteMany({
        where: {
          OR: [
            { email: { startsWith: 'admin-hr@test.com' } },
            { email: { startsWith: 'manager-hr@test.com' } },
            { email: { startsWith: 'user-hr@test.com' } },
            { email: { startsWith: 'employee-' } },
            { username: { startsWith: 'admin-hr' } },
            { username: { startsWith: 'manager-hr' } },
            { username: { startsWith: 'user-hr' } },
            { username: { startsWith: 'emp-' } },
          ],
        },
      });
    } catch (error) {
      console.log('Cleanup error:', error instanceof Error ? error.message : "Unknown error");
    }
  }
});