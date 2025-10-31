import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { PrismaModule } from '../../shared/database/prisma.module';
import { SecurityModule } from '../../shared/security/security.module';
import { EmployeeService } from './services/employee.service';
import { EmployeeController } from './controllers/employee.controller';
import { PayrollController } from './controllers/payroll.controller';
import { LeaveRequestController } from './controllers/leave-request.controller';
import { PayrollService } from './services/payroll.service';
import { LeaveRequestService } from './services/leave-request.service';

/**
 * HR Module - Human Resources Management
 * Implements comprehensive HR business processes with security-first principles
 * Follows SOLID principles and clean architecture
 */
@Module({
  imports: [
    AuthenticationModule,
    PrismaModule,
    SecurityModule,
  ],
  controllers: [
    EmployeeController,
    PayrollController,
    LeaveRequestController,
  ],
  providers: [
    EmployeeService,
    PayrollService,
    LeaveRequestService,
  ],
  exports: [
    EmployeeService,
    PayrollService,
    LeaveRequestService,
  ],
})
export class HRModule {}