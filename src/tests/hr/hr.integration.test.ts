import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { HRDataFactory } from '../../shared/testing/integration/test-data-factories/hr-data-factory';
import { EmploymentType, EmployeeStatus } from '../../modules/hr/dto/create-employee.dto';
import { LeaveType, LeaveStatus } from '../../modules/hr/dto/leave-request.dto';
import { PaymentMethod, PaymentStatus } from '../../modules/hr/dto/create-payroll.dto';

describe('HR Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;
  let hrFactory: HRDataFactory;

  // Test data
  let testEmployees: any[] = [];
  let testDepartments: any[] = [];
  let testLeaveRequests: any[] = [];
  let testPayrollRecords: any[] = [];
  let testUsers: any[] = [];
  let adminToken: string;
  let hrToken: string;
  let managerToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    hrFactory = new HRDataFactory(testSetup.prisma);
    await hrFactory.createBaseData();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    hrToken = testSetup.getTestToken('hr');
    managerToken = testSetup.getTestToken('manager');
    userToken = testSetup.getTestToken('user');

    // Get test data
    testEmployees = hrFactory.getTestEmployees();
    testDepartments = hrFactory.getTestDepartments();
    testUsers = hrFactory.getTestUsers();
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testLeaveRequests = [];
    testPayrollRecords = [];

    for (let i = 0; i < 3; i++) {
      const leaveRequest = await hrFactory.createTestLeaveRequest();
      testLeaveRequests.push(leaveRequest);
    }

    for (let i = 0; i < 3; i++) {
      const payrollRecord = await hrFactory.createTestPayrollRecord();
      testPayrollRecords.push(payrollRecord);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('Employee Management', () => {
    describe('POST /hr/employees', () => {
      it('should create a new employee as HR admin', async () => {
        const user = testUsers.find(u => u.role === 'USER');
        const department = testDepartments[0];

        const newEmployee = {
          userId: user.id,
          firstName: 'Test',
          lastName: 'Employee',
          email: 'test.employee@company.com',
          phone: '+1-555-0300',
          address: '123 Employee St',
          city: 'Employee City',
          state: 'EC',
          postalCode: '54321',
          country: 'USA',
          dateOfBirth: '1990-01-01',
          departmentId: department.id,
          position: 'Software Engineer',
          jobTitle: 'Senior Software Engineer',
          employmentType: EmploymentType.FULL_TIME,
          salary: 95000,
          currency: 'USD',
          socialSecurity: 'SSN-123456',
          taxId: 'TAX-789012',
          bankAccount: {
            bankName: 'Test Bank',
            accountNumber: 'ACC-1234567890',
            routingNumber: 'RT-123456789'
          },
          emergencyContact: {
            name: 'Emergency Contact',
            relationship: 'Spouse',
            phone: '+1-555-0301'
          }
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(newEmployee)
          .expect(201);

        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('employeeId');
        expect(response.body.firstName).to.equal(newEmployee.firstName);
        expect(response.body.lastName).to.equal(newEmployee.lastName);
        expect(response.body.email).to.equal(newEmployee.email);
        expect(response.body.status).to.equal(EmployeeStatus.ACTIVE);
        expect(response.body.createdAt).to.not.be.null;
      });

      it('should reject employee creation as regular user', async () => {
        const user = testUsers.find(u => u.role === 'USER');
        const newEmployee = {
          userId: user.id,
          firstName: 'Unauthorized',
          lastName: 'Employee',
          email: 'unauthorized@company.com',
          dateOfBirth: '1990-01-01',
          departmentId: testDepartments[0].id,
          position: 'Test Position',
          jobTitle: 'Test Job Title',
          employmentType: EmploymentType.FULL_TIME,
          salary: 50000
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newEmployee)
          .expect(403);
      });

      it('should validate required fields for employee creation', async () => {
        const invalidEmployee = {
          firstName: 'Test'
          // Missing required fields: userId, lastName, email, dateOfBirth, departmentId, position, jobTitle, employmentType, salary
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(invalidEmployee)
          .expect(400);
      });

      it('should validate email format for employee creation', async () => {
        const user = testUsers.find(u => u.role === 'USER');
        const invalidEmployee = {
          userId: user.id,
          firstName: 'Test',
          lastName: 'Employee',
          email: 'invalid-email-format',
          dateOfBirth: '1990-01-01',
          departmentId: testDepartments[0].id,
          position: 'Test Position',
          jobTitle: 'Test Job Title',
          employmentType: EmploymentType.FULL_TIME,
          salary: 50000
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(invalidEmployee)
          .expect(400);
      });

      it('should prevent duplicate employee emails', async () => {
        const existingEmployee = testEmployees[0];
        const user = testUsers.find(u => u.role === 'USER');

        const duplicateEmployee = {
          userId: user.id,
          firstName: 'Different',
          lastName: 'Name',
          email: existingEmployee.email, // Duplicate email
          dateOfBirth: '1990-01-01',
          departmentId: testDepartments[0].id,
          position: 'Test Position',
          jobTitle: 'Test Job Title',
          employmentType: EmploymentType.FULL_TIME,
          salary: 50000
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(duplicateEmployee)
          .expect(400);
      });
    });

    describe('GET /hr/employees', () => {
      it('should list employees as HR admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('employees');
        expect(response.body).to.have.property('total');
        expect(response.body.employees).to.be.an('array');
        expect(response.body.employees.length).to.be.greaterThan(0);
      });

      it('should filter employees by department', async () => {
        const department = testDepartments[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees?departmentId=${department.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.employees).to.be.an('array');
        response.body.employees.forEach((employee: any) => {
          expect(employee.departmentId).to.equal(department.id);
        });
      });

      it('should filter employees by employment type', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees?employmentType=${EmploymentType.FULL_TIME}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.employees).to.be.an('array');
        response.body.employees.forEach((employee: any) => {
          expect(employee.employmentType).to.equal(EmploymentType.FULL_TIME);
        });
      });

      it('should filter employees by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees?status=${EmployeeStatus.ACTIVE}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.employees).to.be.an('array');
        response.body.employees.forEach((employee: any) => {
          expect(employee.status).to.equal(EmployeeStatus.ACTIVE);
        });
      });

      it('should search employees by name or email', async () => {
        const searchTerm = testEmployees[0].firstName.substring(0, 3);

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees?search=${searchTerm}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.employees).to.be.an('array');
      });

      it('should paginate employee results', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/employees?skip=0&take=2')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.employees.length).to.be.at.most(2);
        expect(response.body.skip).to.equal(0);
        expect(response.body.take).to.equal(2);
      });

      it('should deny access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /hr/employees/:id', () => {
      it('should get employee by ID as HR admin', async () => {
        const employee = testEmployees[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees/${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.id).to.equal(employee.id);
        expect(response.body.employeeId).to.equal(employee.employeeId);
        expect(response.body.firstName).to.equal(employee.firstName);
        expect(response.body.lastName).to.equal(employee.lastName);
        expect(response.body.email).to.equal(employee.email);
      });

      it('should return 404 for non-existent employee', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/hr/employees/non-existent-id')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(404);
      });

      it('should include department details in employee response', async () => {
        const employee = testEmployees[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/employees/${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('department');
        expect(response.body.department).to.have.property('id');
        expect(response.body.department).to.have.property('name');
      });
    });

    describe('PUT /hr/employees/:id', () => {
      it('should update employee as HR admin', async () => {
        const employee = testEmployees[0];
        const updateData = {
          firstName: 'Updated First Name',
          lastName: 'Updated Last Name',
          phone: '+1-555-9999',
          salary: 100000,
          position: 'Senior Software Engineer'
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/hr/employees/${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.firstName).to.equal(updateData.firstName);
        expect(response.body.lastName).to.equal(updateData.lastName);
        expect(response.body.phone).to.equal(updateData.phone);
        expect(response.body.salary).to.equal(updateData.salary);
        expect(response.body.position).to.equal(updateData.position);
        expect(response.body.updatedAt).to.not.be.null;
      });

      it('should reject employee update as regular user', async () => {
        const employee = testEmployees[0];
        const updateData = { firstName: 'Hacked Name' };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/hr/employees/${employee.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect(403);
      });

      it('should validate salary is positive number', async () => {
        const employee = testEmployees[0];
        const updateData = { salary: -5000 }; // Negative salary

        await request(testSetup.getHttpServer())
          .put(`/api/v1/hr/employees/${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .send(updateData)
          .expect(400);
      });
    });

    describe('POST /hr/employees/:id/terminate', () => {
      it('should terminate employee as HR admin', async () => {
        const employee = await hrFactory.createTestEmployee();
        const terminationData = {
          terminationDate: new Date().toISOString(),
          terminationReason: 'Position eliminated',
          eligibleForRehire: false
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/employees/${employee.id}/terminate`)
          .set('Authorization', `Bearer ${hrToken}`)
          .send(terminationData)
          .expect(200);

        expect(response.body.status).to.equal(EmployeeStatus.TERMINATED);
        expect(response.body.terminationDate).to.not.be.null;
        expect(response.body.terminationReason).to.equal(terminationData.terminationReason);
      });

      it('should reject employee termination as regular user', async () => {
        const employee = testEmployees[0];
        const terminationData = {
          terminationDate: new Date().toISOString(),
          terminationReason: 'Unauthorized termination'
        };

        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/employees/${employee.id}/terminate`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(terminationData)
          .expect(403);
      });
    });
  });

  describe('Leave Management', () => {
    describe('POST /hr/leave-requests', () => {
      it('should create a new leave request as employee', async () => {
        const employee = testEmployees[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 3);

        const newLeaveRequest = {
          employeeId: employee.id,
          leaveType: LeaveType.ANNUAL,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Family vacation',
          paidLeave: true
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newLeaveRequest)
          .expect(201);

        expect(response.body).to.have.property('id');
        expect(response.body.employeeId).to.equal(newLeaveRequest.employeeId);
        expect(response.body.leaveType).to.equal(newLeaveRequest.leaveType);
        expect(response.body.status).to.equal(LeaveStatus.PENDING);
        expect(response.body.daysRequested).to.be.greaterThan(0);
        expect(response.body.createdAt).to.not.be.null;
      });

      it('should validate required fields for leave request creation', async () => {
        const invalidLeaveRequest = {
          leaveType: LeaveType.ANNUAL
          // Missing required fields: employeeId, startDate, endDate
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send(invalidLeaveRequest)
          .expect(400);
      });

      it('should validate end date is after start date', async () => {
        const employee = testEmployees[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() - 3); // End date before start date

        const invalidLeaveRequest = {
          employeeId: employee.id,
          leaveType: LeaveType.ANNUAL,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Invalid date range'
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send(invalidLeaveRequest)
          .expect(400);
      });
    });

    describe('GET /hr/leave-requests', () => {
      it('should list leave requests as HR admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/leave-requests')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('leaveRequests');
        expect(response.body).to.have.property('total');
        expect(response.body.leaveRequests).to.be.an('array');
        expect(response.body.leaveRequests.length).to.be.greaterThan(0);
      });

      it('should filter leave requests by employee', async () => {
        const employee = testEmployees[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/leave-requests?employeeId=${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.leaveRequests).to.be.an('array');
        response.body.leaveRequests.forEach((request: any) => {
          expect(request.employeeId).to.equal(employee.id);
        });
      });

      it('should filter leave requests by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/leave-requests?status=${LeaveStatus.PENDING}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.leaveRequests).to.be.an('array');
        response.body.leaveRequests.forEach((request: any) => {
          expect(request.status).to.equal(LeaveStatus.PENDING);
        });
      });

      it('should filter leave requests by leave type', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/leave-requests?leaveType=${LeaveType.ANNUAL}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.leaveRequests).to.be.an('array');
        response.body.leaveRequests.forEach((request: any) => {
          expect(request.leaveType).to.equal(LeaveType.ANNUAL);
        });
      });

      it('should paginate leave request results', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/leave-requests?skip=0&take=2')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.leaveRequests.length).to.be.at.most(2);
        expect(response.body.skip).to.equal(0);
        expect(response.body.take).to.equal(2);
      });
    });

    describe('POST /hr/leave-requests/:id/approve', () => {
      it('should approve leave request as manager', async () => {
        const leaveRequest = testLeaveRequests.find(lr => lr.status === LeaveStatus.PENDING);
        const manager = testUsers.find(u => u.role === 'MANAGER');

        const approvalData = {
          approverId: manager.id,
          comments: 'Approved for annual leave'
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/approve`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(approvalData)
          .expect(200);

        expect(response.body.status).to.equal(LeaveStatus.APPROVED);
        expect(response.body.approvedBy).to.equal(manager.id);
        expect(response.body.approvedAt).to.not.be.null;
        expect(response.body.approvalComments).to.equal(approvalData.comments);
      });

      it('should reject leave request approval as regular user', async () => {
        const leaveRequest = testLeaveRequests.find(lr => lr.status === LeaveStatus.PENDING);
        const approvalData = {
          approverId: testUsers[0].id,
          comments: 'Trying to approve without permission'
        };

        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/approve`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(approvalData)
          .expect(403);
      });

      it('should prevent approval of already approved leave request', async () => {
        const leaveRequest = testLeaveRequests.find(lr => lr.status === LeaveStatus.PENDING);
        const manager = testUsers.find(u => u.role === 'MANAGER');

        // First approval
        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/approve`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            approverId: manager.id,
            comments: 'First approval'
          });

        // Second approval attempt
        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/approve`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            approverId: manager.id,
            comments: 'Second approval'
          })
          .expect(400);
      });
    });

    describe('POST /hr/leave-requests/:id/reject', () => {
      it('should reject leave request as manager', async () => {
        const leaveRequest = testLeaveRequests.find(lr => lr.status === LeaveStatus.PENDING);
        const manager = testUsers.find(u => u.role === 'MANAGER');

        const rejectionData = {
          rejectedBy: manager.id,
          rejectionReason: 'Insufficient leave balance',
          comments: 'Please check your leave balance and try again'
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/reject`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send(rejectionData)
          .expect(200);

        expect(response.body.status).to.equal(LeaveStatus.REJECTED);
        expect(response.body.rejectedBy).to.equal(manager.id);
        expect(response.body.rejectedAt).to.not.be.null;
        expect(response.body.rejectionReason).to.equal(rejectionData.rejectionReason);
      });
    });

    describe('POST /hr/leave-requests/:id/cancel', () => {
      it('should cancel own leave request as employee', async () => {
        const leaveRequest = testLeaveRequests.find(lr => lr.status === LeaveStatus.PENDING);
        const employee = testEmployees.find(e => e.id === leaveRequest.employeeId);

        const cancelData = {
          cancelledBy: employee.id,
          reason: 'No longer need leave'
        };

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/leave-requests/${leaveRequest.id}/cancel`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(cancelData)
          .expect(200);

        expect(response.body.status).to.equal(LeaveStatus.CANCELLED);
        expect(response.body.cancelledBy).to.equal(employee.id);
        expect(response.body.cancelledAt).to.not.be.null;
      });
    });

    describe('GET /hr/leave-requests/analytics', () => {
      it('should get leave analytics as HR admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/leave-requests/analytics')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('totalLeaveRequests');
        expect(response.body).to.have.property('approvedLeaveRequests');
        expect(response.body).to.have.property('pendingLeaveRequests');
        expect(response.body).to.have.property('rejectedLeaveRequests');
        expect(response.body).to.have.property('totalLeaveDays');
        expect(response.body).to.have.property('byLeaveType');
        expect(response.body).to.have.property('byStatus');
        expect(response.body).to.have.property('monthlyTrends');
      });

      it('should deny analytics access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/hr/leave-requests/analytics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /hr/leave-requests/calendar', () => {
      it('should get leave calendar as HR admin', async () => {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/leave-requests/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('calendarEvents');
        expect(response.body.calendarEvents).to.be.an('array');
      });
    });
  });

  describe('Payroll Processing', () => {
    describe('POST /hr/payroll', () => {
      it('should create a new payroll record as HR admin', async () => {
        const employee = testEmployees[0];
        const grossPay = parseFloat(employee.salary.toString()) / 12;
        const federalTax = grossPay * 0.15;
        const stateTax = grossPay * 0.05;
        const netPay = grossPay - federalTax - stateTax;

        const newPayroll = {
          employeeId: employee.id,
          payPeriod: '2024-01',
          grossPay: grossPay,
          netPay: netPay,
          federalTax: federalTax,
          stateTax: stateTax,
          regularHours: 160,
          overtimeHours: 5,
          hourlyRate: grossPay / 160,
          overtimeRate: (grossPay / 160) * 1.5,
          paymentMethod: PaymentMethod.DIRECT_DEPOSIT
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/hr/payroll')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(newPayroll)
          .expect(201);

        expect(response.body).to.have.property('id');
        expect(response.body.employeeId).to.equal(newPayroll.employeeId);
        expect(response.body.payPeriod).to.equal(newPayroll.payPeriod);
        expect(response.body.grossPay).to.equal(newPayroll.grossPay);
        expect(response.body.netPay).to.equal(newPayroll.netPay);
        expect(response.body.status).to.equal(PaymentStatus.PENDING);
        expect(response.body.createdAt).to.not.be.null;
      });

      it('should reject payroll creation as regular user', async () => {
        const employee = testEmployees[0];
        const newPayroll = {
          employeeId: employee.id,
          payPeriod: '2024-01',
          grossPay: 5000,
          netPay: 4000
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/payroll')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newPayroll)
          .expect(403);
      });

      it('should validate required fields for payroll creation', async () => {
        const invalidPayroll = {
          grossPay: 5000
          // Missing required fields: employeeId, payPeriod, netPay
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/hr/payroll')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(invalidPayroll)
          .expect(400);
      });
    });

    describe('GET /hr/payroll', () => {
      it('should list payroll records as HR admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/payroll')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('payrollRecords');
        expect(response.body).to.have.property('total');
        expect(response.body.payrollRecords).to.be.an('array');
        expect(response.body.payrollRecords.length).to.be.greaterThan(0);
      });

      it('should filter payroll records by employee', async () => {
        const employee = testEmployees[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/payroll?employeeId=${employee.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.payrollRecords).to.be.an('array');
        response.body.payrollRecords.forEach((record: any) => {
          expect(record.employeeId).to.equal(employee.id);
        });
      });

      it('should filter payroll records by status', async () => {
        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/payroll?status=${PaymentStatus.PAID}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.payrollRecords).to.be.an('array');
        response.body.payrollRecords.forEach((record: any) => {
          expect(record.status).to.equal(PaymentStatus.PAID);
        });
      });

      it('should filter payroll records by pay period', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/payroll?payPeriod=2024-01')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.payrollRecords).to.be.an('array');
        response.body.payrollRecords.forEach((record: any) => {
          expect(record.payPeriod).to.equal('2024-01');
        });
      });

      it('should deny access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/hr/payroll')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('GET /hr/payroll/:id', () => {
      it('should get payroll record by ID as HR admin', async () => {
        const payrollRecord = testPayrollRecords[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/payroll/${payrollRecord.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.id).to.equal(payrollRecord.id);
        expect(response.body.employeeId).to.equal(payrollRecord.employeeId);
        expect(response.body.payPeriod).to.equal(payrollRecord.payPeriod);
        expect(response.body.grossPay).to.equal(payrollRecord.grossPay);
        expect(response.body.netPay).to.equal(payrollRecord.netPay);
      });

      it('should include employee details in payroll response', async () => {
        const payrollRecord = testPayrollRecords[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/hr/payroll/${payrollRecord.id}`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('employee');
        expect(response.body.employee).to.have.property('id');
        expect(response.body.employee).to.have.property('firstName');
        expect(response.body.employee).to.have.property('lastName');
      });
    });

    describe('POST /hr/payroll/:id/process', () => {
      it('should process payroll payment as HR admin', async () => {
        const payrollRecord = testPayrollRecords.find(pr => pr.status === PaymentStatus.PENDING);

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/payroll/${payrollRecord.id}/process`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body.status).to.equal(PaymentStatus.PAID);
        expect(response.body.paymentDate).to.not.be.null;
        expect(response.body.transactionId).to.not.be.null;
      });

      it('should reject payroll processing as regular user', async () => {
        const payrollRecord = testPayrollRecords[0];

        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/payroll/${payrollRecord.id}/process`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should prevent processing already paid payroll', async () => {
        const payrollRecord = testPayrollRecords.find(pr => pr.status === PaymentStatus.PAID);

        await request(testSetup.getHttpServer())
          .post(`/api/v1/hr/payroll/${payrollRecord.id}/process`)
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(400);
      });
    });

    describe('POST /hr/payroll/bulk-process', () => {
      it('should bulk process payroll records as HR admin', async () => {
        // Create pending payroll records for bulk processing
        const pendingRecords = [];
        for (let i = 0; i < 3; i++) {
          const record = await hrFactory.createTestPayrollRecord();
          pendingRecords.push(record.id);
        }

        const bulkProcessData = {
          payrollIds: pendingRecords,
          paymentDate: new Date().toISOString(),
          paymentMethod: PaymentMethod.DIRECT_DEPOSIT
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/hr/payroll/bulk-process')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(bulkProcessData)
          .expect(200);

        expect(response.body).to.have.property('processedCount');
        expect(response.body).to.have.property('failedCount');
        expect(response.body.processedCount).to.be.greaterThan(0);
        expect(response.body.failedCount).to.equal(0);
      });
    });

    describe('GET /hr/payroll/analytics', () => {
      it('should get payroll analytics as HR admin', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/hr/payroll/analytics')
          .set('Authorization', `Bearer ${hrToken}`)
          .expect(200);

        expect(response.body).to.have.property('totalPayroll');
        expect(response.body).to.have.property('averageGrossPay');
        expect(response.body).to.have.property('totalTaxes');
        expect(response.body).to.have.property('totalDeductions');
        expect(response.body).to.have.property('byDepartment');
        expect(response.body).to.have.property('byPayPeriod');
        expect(response.body).to.have.property('monthlyTrends');
      });

      it('should deny analytics access to regular users', async () => {
        await request(testSetup.getHttpServer())
          .get('/api/v1/hr/payroll/analytics')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent employee creation', async () => {
      const user = testUsers.find(u => u.role === 'USER');
      const department = testDepartments[0];

      const employeePromises = Array(5).fill(null).map(async (_, index) => {
        const newEmployee = {
          userId: `${user.id}-${index}`, // Make unique
          firstName: `Concurrent ${index}`,
          lastName: 'Employee',
          email: `concurrent${index}@test.com`,
          dateOfBirth: '1990-01-01',
          departmentId: department.id,
          position: 'Test Position',
          jobTitle: 'Test Job Title',
          employmentType: EmploymentType.FULL_TIME,
          salary: 50000
        };

        return request(testSetup.getHttpServer())
          .post('/api/v1/hr/employees')
          .set('Authorization', `Bearer ${hrToken}`)
          .send(newEmployee);
      });

      const responses = await Promise.all(employeePromises);

      responses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('id');
        expect(response.body).to.have.property('employeeId');
      });
    }).timeout(10000);

    it('should maintain response time standards for employee listing', async () => {
      const startTime = Date.now();

      await request(testSetup.getHttpServer())
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).to.be.lessThan(500); // Response should be under 500ms
    });

    it('should handle large datasets in payroll queries', async () => {
      // Create additional test data
      const additionalRecords = [];
      for (let i = 0; i < 10; i++) {
        additionalRecords.push(await hrFactory.createTestPayrollRecord());
      }

      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/hr/payroll?take=20')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body.payrollRecords).to.be.an('array');
      expect(response.body.payrollRecords.length).to.be.greaterThan(10);
    }).timeout(15000);
  });

  describe('Security Testing', () => {
    it('should prevent SQL injection in employee search', async () => {
      const maliciousInput = "'; DROP TABLE employees; --";

      const response = await request(testSetup.getHttpServer())
        .get(`/api/v1/hr/employees?search=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      // Should return empty results, not crash
      expect(response.body.employees).to.be.an('array');
    });

    it('should sanitize HTML in leave request reason', async () => {
      const employee = testEmployees[0];
      const maliciousReason = '<script>alert("xss")</script>Malicious content';

      const newLeaveRequest = {
        employeeId: employee.id,
        leaveType: LeaveType.PERSONAL,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        reason: maliciousReason
      };

      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/hr/leave-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newLeaveRequest)
        .expect(201);

      // Reason should be sanitized
      expect(response.body.reason).to.not.include('<script>');
    });

    it('should validate JWT token authenticity', async () => {
      const fakeToken = 'fake.jwt.token';

      await request(testSetup.getHttpServer())
        .get('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('should enforce rate limiting on leave request creation', async () => {
      const employee = testEmployees[0];

      const newLeaveRequest = {
        employeeId: employee.id,
        leaveType: LeaveType.SICK,
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Rate limit test'
      };

      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/hr/leave-requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newLeaveRequest)
      );

      const responses = await Promise.allSettled(requests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(rateLimitedResponses.length).to.be.greaterThan(0);
    }).timeout(10000);
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Test with invalid ID format that would cause database errors
      await request(testSetup.getHttpServer())
        .get('/api/v1/hr/employees/invalid-uuid-format')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(400);
    });

    it('should return proper error format for validation errors', async () => {
      const invalidEmployee = {
        firstName: '', // Empty name should fail validation
        email: 'invalid-email', // Invalid email format
        salary: -5000 // Negative salary
      };

      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${hrToken}`)
        .send(invalidEmployee)
        .expect(400);

      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('error');
    });

    it('should include correlation ID in error responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/hr/employees/non-existent-id')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(404);

      // Should include correlation ID for tracking
      expect(response.headers).to.have.property('x-correlation-id');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate leave balance calculations', async () => {
      const employee = testEmployees[0];

      // Create multiple approved leave requests to test balance calculations
      const approvedRequests = [];
      for (let i = 0; i < 3; i++) {
        const request = await hrFactory.createTestLeaveRequest({
          employeeId: employee.id,
          leaveType: LeaveType.ANNUAL,
          status: LeaveStatus.APPROVED,
          daysRequested: 2
        });
        approvedRequests.push(request);
      }

      // Check leave balance
      const response = await request(testSetup.getHttpServer())
        .get(`/api/v1/hr/leave-requests/balance/${employee.id}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(response.body).to.have.property('annualLeaveBalance');
      expect(response.body.annualLeaveBalance).to.be.a('number');
    });

    it('should enforce business rules for payroll calculations', async () => {
      const employee = testEmployees[0];

      // Test payroll with overtime calculations
      const overtimePayroll = {
        employeeId: employee.id,
        payPeriod: '2024-OVERTIME-TEST',
        grossPay: 6000,
        netPay: 4500,
        regularHours: 160,
        overtimeHours: 20,
        hourlyRate: 25,
        overtimeRate: 37.5, // Should be 1.5x hourly rate
        paymentMethod: PaymentMethod.DIRECT_DEPOSIT
      };

      const response = await request(testSetup.getHttpServer())
        .post('/api/v1/hr/payroll')
        .set('Authorization', `Bearer ${hrToken}`)
        .send(overtimePayroll)
        .expect(201);

      expect(response.body.overtimeRate).to.equal(overtimePayroll.overtimeRate);
    });

    it('should validate employment status changes', async () => {
      const employee = await hrFactory.createTestEmployee({
        status: EmployeeStatus.ACTIVE
      });

      // Try to terminate with invalid date
      const invalidTermination = {
        terminationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Future date
        terminationReason: 'Test termination'
      };

      await request(testSetup.getHttpServer())
        .post(`/api/v1/hr/employees/${employee.id}/terminate`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send(invalidTermination)
        .expect(400); // Should reject future termination date
    });
  });
});