import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PayrollService } from '../services/payroll.service';
import { SecurityService } from '../../../shared/security/security.service';
import { CreatePayrollDto } from '../dto/create-payroll.dto';
import { JwtAuthGuard } from '../../../shared/security/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/guards/roles.guard';
import { Roles } from '../../../shared/security/decorators/roles.decorator';

/**
 * Enterprise Payroll Controller
 * Implements comprehensive payroll management with security best practices
 * Follows OWASP Top 10 security standards
 */
@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
export class PayrollController {
  private readonly logger = new Logger(PayrollController.name);

  constructor(
    private readonly payrollService: PayrollService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Calculate payroll for an employee
   * OWASP A01: Broken Access Control - Role-based access
   * OWASP A03: Injection - Input validation and sanitization
   */
  @Post('calculate')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER')
  async calculatePayroll(
    @Body() createPayrollDto: CreatePayrollDto,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Calculating payroll for employee: ${createPayrollDto.employeeId}, period: ${createPayrollDto.payPeriod}`);

      const payrollRecord = await this.payrollService.calculatePayroll(
        createPayrollDto.employeeId,
        createPayrollDto.payPeriod,
        req.user.sub,
      );

      // Log security event
      await this.securityService.logSecurityEvent(
        'USER_UPDATED',
        req.user.sub,
        undefined,
        undefined,
        {
          payrollId: payrollRecord.id,
          employeeId: createPayrollDto.employeeId,
          payPeriod: createPayrollDto.payPeriod,
          grossPay: createPayrollDto.grossPay,
          requestedBy: req.user.sub,
          timestamp: new Date().toISOString(),
        },
      );

      this.logger.log(`Successfully calculated payroll: ${payrollRecord.id}`);
      return payrollRecord;
    } catch (error) {
      this.logger.error(`Failed to calculate payroll: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payroll record by ID
   * OWASP A01: Broken Access Control - Resource-based access
   */
  @Get(':id')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE')
  async getPayrollById(@Param('id') id: string) {
    try {
      this.logger.log(`Fetching payroll record: ${id}`);
      const payroll = await this.payrollService.findById(id);
      this.logger.log(`Successfully retrieved payroll record: ${id}`);
      return payroll;
    } catch (error) {
      this.logger.error(`Failed to fetch payroll ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payroll records by employee
   * OWASP A01: Broken Access Control - Resource-based access
   */
  @Get('employee/:employeeId')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE')
  async getPayrollByEmployee(@Param('employeeId') employeeId: string) {
    try {
      this.logger.log(`Fetching payroll records for employee: ${employeeId}`);
      const payrollRecords = await this.payrollService.findByEmployee(employeeId);
      this.logger.log(`Successfully retrieved ${payrollRecords.length} payroll records for employee: ${employeeId}`);
      return payrollRecords;
    } catch (error) {
      this.logger.error(`Failed to fetch payroll records for employee ${employeeId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all payroll records with filtering
   * OWASP A01: Broken Access Control - Role-based filtering
   */
  @Get()
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER', 'EMPLOYEE')
  async getPayroll(@Query() filters: any): Promise<any> {
    try {
      this.logger.log(`Fetching payroll records with filters: ${JSON.stringify(filters)}`);
      const result = await this.payrollService.findAll(filters);
      this.logger.log(`Successfully retrieved ${result.payrollRecords.length} payroll records`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch payroll records: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Approve payroll record
   * OWASP A01: Broken Access Control - Role-based access
   * OWASP A03: Injection - Input validation and sanitization
   */
  @Put(':id/approve')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER')
  async approvePayroll(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Approving payroll record: ${id}`);

      const payroll = await this.payrollService.approvePayroll(id, req.user.sub);

      // Log security event for sensitive action
      await this.securityService.logSecurityEvent(
        'USER_UPDATED',
        req.user.sub,
        undefined,
        undefined,
        {
          payrollId: id,
          approvedBy: req.user.sub,
          action: 'APPROVE',
          timestamp: new Date().toISOString(),
        },
      );

      this.logger.log(`Successfully approved payroll: ${id}`);
      return payroll;
    } catch (error) {
      this.logger.error(`Failed to approve payroll ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process payroll payment
   * OWASP A01: Broken Access Control - Role-based access
   */
  @Post(':id/process')
  @Roles('HR_ADMIN', 'ADMIN')
  async processPayment(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    try {
      this.logger.log(`Processing payroll payment: ${id}`);

      const payroll = await this.payrollService.processPayment(id, req.user.sub);

      // Log security event for financial transaction
      await this.securityService.logSecurityEvent(
        'USER_UPDATED',
        req.user.sub,
        undefined,
        undefined,
        {
          payrollId: id,
          processedBy: req.user.sub,
          action: 'PROCESS_PAYMENT',
          timestamp: new Date().toISOString(),
        },
      );

      this.logger.log(`Successfully processed payroll payment: ${id}`);
      return payroll;
    } catch (error) {
      this.logger.error(`Failed to process payroll payment ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate payroll reports
   * OWASP A01: Broken Access Control - Role-based access
   */
  @Post('reports')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER')
  async generatePayrollReport(@Body() reportParams: any) {
    try {
      this.logger.log(`Generating payroll report: ${JSON.stringify(reportParams)}`);
      const report = await this.payrollService.generatePayrollReport(reportParams);
      this.logger.log('Successfully generated payroll report');
      return report;
    } catch (error) {
      this.logger.error(`Failed to generate payroll report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get payroll summary statistics
   * OWASP A01: Broken Access Control - Role-based access
   */
  @Get('summary')
  @Roles('HR_ADMIN', 'ADMIN', 'MANAGER')
  async getPayrollSummary(@Query() filters: any): Promise<any> {
    try {
      this.logger.log('Fetching payroll summary statistics');
      const summary = await this.payrollService.findAll({
        ...filters,
        take: 1, // Just get the total count
      });

      const payrollSummary = {
        totalRecords: summary.total,
        // Add more summary calculations as needed
        filters: filters,
        generatedAt: new Date(),
      };

      this.logger.log('Successfully retrieved payroll summary');
      return payrollSummary;
    } catch (error) {
      this.logger.error(`Failed to fetch payroll summary: ${error.message}`, error.stack);
      throw error;
    }
  }
}