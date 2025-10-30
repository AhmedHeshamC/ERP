import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { ScheduledReportsService } from './scheduled-reports.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { SecurityService } from '../../../shared/security/security.service';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
  ScheduledReportQueryDto,
  ScheduleType,
  ExecutionStatus,
  DeliveryStatus,
  ReportFormat,
  CreateDistributionListDto,
  SubscriptionType,
  DeliveryMethod,
  ManualReportTriggerDto,
} from './dto/scheduled-reports.dto';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

describe('ScheduledReportsService', () => {
  let service: ScheduledReportsService;
  let prismaService: PrismaService;
  let securityService: SecurityService;
  let prismaStub: any;
  let securityStub: any;

  beforeEach(() => {
    prismaService = {
      scheduledReport: {
        create: stub(),
        findUnique: stub(),
        findMany: stub(),
        update: stub(),
        count: stub(),
        delete: stub(),
      },
      reportDefinition: {
        findUnique: stub(),
        findMany: stub(),
      },
      user: {
        findUnique: stub(),
        findMany: stub(),
      },
      scheduledReportExecution: {
        create: stub(),
        findMany: stub(),
        findUnique: stub(),
        update: stub(),
        count: stub(),
      },
      scheduledReportDistributionList: {
        create: stub(),
        findMany: stub(),
        update: stub(),
        delete: stub(),
      },
      reportSubscription: {
        create: stub(),
        findMany: stub(),
        update: stub(),
        delete: stub(),
      },
      generatedReport: {
        create: stub(),
        findUnique: stub(),
        update: stub(),
      },
      $transaction: stub(),
    } as any;

    securityService = {
      validateInput: stub(),
      sanitizeInput: stub(),
    } as any;

    service = new ScheduledReportsService(prismaService, securityService);

    // Create references for easier access to stubs
    prismaStub = prismaService;
    securityStub = securityService;
  });

  afterEach(() => {
    // Restore stubs - Sinon stubs have restore method
    (prismaService.scheduledReport.create as any).restore?.();
    (prismaService.scheduledReport.findUnique as any).restore?.();
    (prismaService.scheduledReport.findMany as any).restore?.();
    (prismaService.scheduledReport.update as any).restore?.();
    (prismaService.scheduledReport.count as any).restore?.();
    (prismaService.reportDefinition.findUnique as any).restore?.();
    (prismaService.user.findUnique as any).restore?.();
    (prismaService.scheduledReportExecution.create as any).restore?.();
    (prismaService.scheduledReportExecution.findMany as any).restore?.();
    (prismaService.scheduledReportExecution.count as any).restore?.();
    (prismaService.scheduledReportDistributionList.create as any).restore?.();
    (prismaService.scheduledReportDistributionList.findMany as any).restore?.();
    (prismaService.reportSubscription.create as any).restore?.();
    (prismaService.reportSubscription.findMany as any).restore?.();
    (prismaService.generatedReport.create as any).restore?.();
    (securityService.validateInput as any).restore?.();
    (securityService.sanitizeInput as any).restore?.();
  });

  describe('createScheduledReport', () => {
    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidDto = { reportDefinitionId: '', name: '', schedule: '' } as CreateScheduledReportDto;
      securityStub.validateInput.returns(false);

      // Act & Assert
      try {
        await service.createScheduledReport(invalidDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.equal('Invalid scheduled report data');
      }
    });

    it('should throw error if report definition does not exist', async () => {
      // Arrange
      const validDto: CreateScheduledReportDto = {
        reportDefinitionId: 'non-existent-report',
        name: 'Test Scheduled Report',
        schedule: '0 9 * * 1',
        scheduleType: ScheduleType.WEEKLY,
      };
      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.reportDefinition.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.createScheduledReport(validDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Report definition not found');
      }
    });

    it('should throw error if report definition is inactive', async () => {
      // Arrange
      const validDto: CreateScheduledReportDto = {
        reportDefinitionId: 'inactive-report',
        name: 'Test Scheduled Report',
        schedule: '0 9 * * 1',
        scheduleType: ScheduleType.WEEKLY,
      };
      const inactiveReport = { id: 'inactive-report', name: 'Inactive Report', isActive: false };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.reportDefinition.findUnique.resolves(inactiveReport);

      // Act & Assert
      try {
        await service.createScheduledReport(validDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Report definition is inactive');
      }
    });

    it('should create scheduled report successfully', async () => {
      // Arrange
      const validDto: CreateScheduledReportDto = {
        reportDefinitionId: 'report-123',
        name: 'Weekly Sales Report',
        description: 'Automated weekly sales report',
        schedule: '0 9 * * 1',
        scheduleType: ScheduleType.WEEKLY,
        isActive: true,
        format: ReportFormat.PDF,
        sendEmail: true,
        emailRecipients: ['test@example.com', 'manager@example.com'],
        emailSubject: 'Weekly Sales Report',
        maxRetries: 3,
      };

      const reportDefinition = {
        id: 'report-123',
        name: 'Sales Report',
        type: 'SALES',
        category: 'ANALYTICS',
        isActive: true,
      };

      const creator = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
      };

      const createdScheduledReport = {
        id: 'scheduled-123',
        reportDefinitionId: 'report-123',
        name: 'Weekly Sales Report',
        description: 'Automated weekly sales report',
        schedule: '0 9 * * 1',
        scheduleType: 'WEEKLY',
        isActive: true,
        nextRunAt: new Date(),
        lastRunAt: null,
        parameters: null,
        format: 'PDF',
        timezone: 'UTC',
        sendEmail: true,
        emailRecipients: ['test@example.com', 'manager@example.com'],
        emailSubject: 'Weekly Sales Report',
        emailBody: null,
        maxRetries: 3,
        archiveAfter: null,
        deleteAfter: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-123',
        updatedBy: null,
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(validDto);
      prismaStub.reportDefinition.findUnique.resolves(reportDefinition);
      prismaStub.user.findUnique.resolves(creator);
      prismaStub.scheduledReport.create.resolves(createdScheduledReport);

      // Act
      const result = await service.createScheduledReport(validDto);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal('scheduled-123');
      expect(result.reportDefinitionId).to.equal('report-123');
      expect(result.name).to.equal('Weekly Sales Report');
      expect(result.scheduleType).to.equal(ScheduleType.WEEKLY);
      expect(result.format).to.equal(ReportFormat.PDF);
      expect(result.sendEmail).to.be.true;
      expect(result.emailRecipients).to.have.length(2);
      expect(result.maxRetries).to.equal(3);

      // Verify method calls
      expect(securityStub.validateInput.calledOnce).to.be.true;
      expect(prismaStub.reportDefinition.findUnique.calledOnce).to.be.true;
      expect(prismaStub.scheduledReport.create.calledOnce).to.be.true;
    });

    it('should validate cron expression format', async () => {
      // Arrange
      const invalidDto: CreateScheduledReportDto = {
        reportDefinitionId: 'report-123',
        name: 'Invalid Cron Report',
        schedule: 'invalid-cron-expression',
        scheduleType: ScheduleType.CUSTOM,
      };

      const reportDefinition = { id: 'report-123', name: 'Test Report', isActive: true };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(invalidDto);
      prismaStub.reportDefinition.findUnique.resolves(reportDefinition);

      // Act & Assert
      try {
        await service.createScheduledReport(invalidDto);
        expect.fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).to.be.instanceOf(BadRequestException);
        expect(error.message).to.include('Invalid cron expression');
      }
    });
  });

  describe('getScheduledReports', () => {
    it('should return paginated scheduled reports', async () => {
      // Arrange
      const queryDto: ScheduledReportQueryDto = {
        scheduleType: ScheduleType.WEEKLY,
        isActive: true,
        skip: 0,
        take: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const mockScheduledReports = [
        {
          id: 'scheduled-1',
          reportDefinitionId: 'report-1',
          name: 'Weekly Report 1',
          scheduleType: 'WEEKLY',
          isActive: true,
          createdAt: new Date(),
          reportDefinition: {
            id: 'report-1',
            name: 'Report 1',
            type: 'SALES',
            category: 'ANALYTICS',
          },
        },
        {
          id: 'scheduled-2',
          reportDefinitionId: 'report-2',
          name: 'Weekly Report 2',
          scheduleType: 'WEEKLY',
          isActive: true,
          createdAt: new Date(),
          reportDefinition: {
            id: 'report-2',
            name: 'Report 2',
            type: 'FINANCIAL',
            category: 'SUMMARY',
          },
        },
      ];

      prismaStub.scheduledReport.findMany.resolves(mockScheduledReports);
      prismaStub.scheduledReport.count.resolves(2);

      // Act
      const result = await service.getScheduledReports(queryDto);

      // Assert
      expect(result.scheduledReports).to.have.length(2);
      expect(result.total).to.equal(2);
      expect(result.skip).to.equal(0);
      expect(result.take).to.equal(10);
      expect(result.scheduledReports[0].scheduleType).to.equal('WEEKLY');
      expect(result.scheduledReports[0].isActive).to.be.true;
    });

    it('should filter by report definition correctly', async () => {
      // Arrange
      const queryDto: ScheduledReportQueryDto = {
        reportDefinitionId: 'report-123',
      };

      const mockScheduledReport = {
        id: 'scheduled-123',
        reportDefinitionId: 'report-123',
        name: 'Test Report',
        scheduleType: ScheduleType.DAILY,
        isActive: true,
        reportDefinition: {
          id: 'report-123',
          name: 'Test Definition',
          type: 'SALES',
          category: 'ANALYTICS',
        },
      };

      prismaStub.scheduledReport.findMany.resolves([mockScheduledReport]);
      prismaStub.scheduledReport.count.resolves(1);

      // Act
      const result = await service.getScheduledReports(queryDto);

      // Assert
      expect(result.scheduledReports).to.have.length(1);
      expect(result.scheduledReports[0].reportDefinitionId).to.equal('report-123');
    });
  });

  describe('getScheduledReportById', () => {
    it('should return scheduled report by ID', async () => {
      // Arrange
      const reportId = 'scheduled-123';
      const mockScheduledReport = {
        id: reportId,
        reportDefinitionId: 'report-123',
        name: 'Test Scheduled Report',
        scheduleType: ScheduleType.WEEKLY,
        isActive: true,
        reportDefinition: {
          id: 'report-123',
          name: 'Test Definition',
          type: 'SALES',
          category: 'ANALYTICS',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaStub.scheduledReport.findUnique.resolves(mockScheduledReport);

      // Act
      const result = await service.getScheduledReportById(reportId);

      // Assert
      expect(result).to.not.be.null;
      expect(result.id).to.equal(reportId);
      expect(result.reportDefinitionId).to.equal('report-123');
      expect(result.reportDefinition.name).to.equal('Test Definition');
    });

    it('should return null for non-existent scheduled report ID', async () => {
      // Arrange
      const nonExistentId = 'scheduled-non-existent';
      prismaStub.scheduledReport.findUnique.resolves(null);

      // Act
      const result = await service.getScheduledReportById(nonExistentId);

      // Assert
      expect(result).to.be.null;
    });
  });

  describe('updateScheduledReport', () => {
    it('should throw error if scheduled report does not exist', async () => {
      // Arrange
      const reportId = 'scheduled-non-existent';
      const updateDto: UpdateScheduledReportDto = {
        name: 'Updated Name',
      };

      prismaStub.scheduledReport.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.updateScheduledReport(reportId, updateDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Scheduled report not found');
      }
    });

    it('should update scheduled report successfully', async () => {
      // Arrange
      const reportId = 'scheduled-123';
      const updateDto: UpdateScheduledReportDto = {
        name: 'Updated Report Name',
        isActive: false,
        maxRetries: 5,
      };

      const existingReport = {
        id: reportId,
        reportDefinitionId: 'report-123',
        name: 'Original Name',
        scheduleType: ScheduleType.WEEKLY,
        isActive: true,
        maxRetries: 3,
      };

      const updatedReport = {
        ...existingReport,
        name: 'Updated Report Name',
        isActive: false,
        maxRetries: 5,
        updatedAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(updateDto);
      prismaStub.scheduledReport.findUnique.resolves(existingReport);
      prismaStub.scheduledReport.update.resolves(updatedReport);

      // Act
      const result = await service.updateScheduledReport(reportId, updateDto);

      // Assert
      expect(result.name).to.equal('Updated Report Name');
      expect(result.isActive).to.be.false;
      expect(result.maxRetries).to.equal(5);
    });
  });

  describe('triggerScheduledReport', () => {
    it('should trigger manual execution successfully', async () => {
      // Arrange
      const reportId = 'scheduled-123';
      const triggerDto: ManualReportTriggerDto = {
        parameters: { startDate: '2024-01-01', endDate: '2024-01-31' },
        format: ReportFormat.EXCEL,
        sendEmail: true,
        emailRecipients: ['custom@example.com'],
        emailSubject: 'Custom Report Subject',
      };

      const existingReport = {
        id: reportId,
        reportDefinitionId: 'report-123',
        name: 'Test Report',
        parameters: {},
        format: 'PDF',
      };

      const reportDefinition = {
        id: 'report-123',
        name: 'Test Definition',
        type: 'SALES',
        category: 'ANALYTICS',
      };

      const createdExecution = {
        id: 'execution-123',
        scheduledReportId: reportId,
        scheduledAt: new Date(),
        startedAt: new Date(),
        status: ExecutionStatus.RUNNING,
        retryCount: 0,
        deliveryStatus: DeliveryStatus.PENDING,
        deliveryAttempts: 0,
        createdAt: new Date(),
      };

      const createdGeneratedReport = {
        id: 'generated-123',
        name: 'Manual Report',
        status: 'COMPLETED',
        fileUrl: 'https://example.com/report.xlsx',
        createdAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(triggerDto);
      prismaStub.scheduledReport.findUnique.resolves(existingReport);
      prismaStub.reportDefinition.findUnique.resolves(reportDefinition);
      prismaStub.scheduledReportExecution.create.resolves(createdExecution);
      prismaStub.generatedReport.create.resolves(createdGeneratedReport);
      prismaStub.scheduledReportExecution.findUnique.resolves({
        ...createdExecution,
        generatedReportId: 'generated-123',
        generatedReport: createdGeneratedReport,
      });
      prismaStub.$transaction.resolves([createdExecution, createdGeneratedReport]);

      // Act
      const result = await service.triggerScheduledReport(reportId, triggerDto);

      // Assert
      expect(result.status).to.equal(ExecutionStatus.RUNNING);
      expect(result.scheduledReportId).to.equal(reportId);
      expect(result.generatedReportId).to.equal('generated-123');
    });

    it('should throw error if scheduled report does not exist', async () => {
      // Arrange
      const reportId = 'scheduled-non-existent';
      const triggerDto: ManualReportTriggerDto = {};

      prismaStub.scheduledReport.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.triggerScheduledReport(reportId, triggerDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Scheduled report not found');
      }
    });
  });

  describe('getScheduledReportExecutions', () => {
    it('should return execution history for a scheduled report', async () => {
      // Arrange
      const reportId = 'scheduled-123';
      const mockExecutions = [
        {
          id: 'execution-1',
          scheduledReportId: reportId,
          scheduledAt: new Date(),
          startedAt: new Date(),
          completedAt: new Date(),
          status: ExecutionStatus.COMPLETED,
          retryCount: 0,
          deliveryStatus: DeliveryStatus.DELIVERED,
          deliveryAttempts: 1,
          executionTimeMs: 5000,
          createdAt: new Date(),
        },
        {
          id: 'execution-2',
          scheduledReportId: reportId,
          scheduledAt: new Date(),
          startedAt: new Date(),
          completedAt: null,
          status: ExecutionStatus.FAILED,
          retryCount: 2,
          deliveryStatus: DeliveryStatus.PENDING,
          deliveryAttempts: 0,
          errorMessage: 'Report generation failed',
          executionTimeMs: 3000,
          createdAt: new Date(),
        },
      ];

      prismaStub.scheduledReportExecution.findMany.resolves(mockExecutions);
      prismaStub.scheduledReportExecution.count.resolves(2);

      // Act
      const result = await service.getScheduledReportExecutions(reportId);

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].status).to.equal(ExecutionStatus.COMPLETED);
      expect(result[0].deliveryStatus).to.equal(DeliveryStatus.DELIVERED);
      expect(result[1].status).to.equal(ExecutionStatus.FAILED);
      expect(result[1].errorMessage).to.equal('Report generation failed');
    });
  });

  describe('createDistributionList', () => {
    it('should add user to distribution list successfully', async () => {
      // Arrange
      const distributionDto: CreateDistributionListDto = {
        scheduledReportId: 'scheduled-123',
        userId: 'user-123',
        email: 'user@example.com',
        isActive: true,
        deliveryMethod: DeliveryMethod.EMAIL,
        preferredFormat: ReportFormat.PDF,
      };

      const existingReport = {
        id: 'scheduled-123',
        name: 'Test Report',
      };

      const existingUser = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'user@example.com',
      };

      const createdDistribution = {
        id: 'distribution-123',
        ...distributionDto,
        subscribedAt: new Date(),
        createdAt: new Date(),
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(distributionDto);
      prismaStub.scheduledReport.findUnique.resolves(existingReport);
      prismaStub.user.findUnique.resolves(existingUser);
      prismaStub.scheduledReportDistributionList.create.resolves(createdDistribution);

      // Act
      const result = await service.createDistributionList(distributionDto);

      // Assert
      expect(result.id).to.equal('distribution-123');
      expect(result.scheduledReportId).to.equal('scheduled-123');
      expect(result.userId).to.equal('user-123');
      expect(result.deliveryMethod).to.equal(DeliveryMethod.EMAIL);
    });

    it('should throw error if scheduled report does not exist', async () => {
      // Arrange
      const distributionDto: CreateDistributionListDto = {
        scheduledReportId: 'scheduled-non-existent',
        userId: 'user-123',
        email: 'user@example.com',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(distributionDto);
      prismaStub.scheduledReport.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.createDistributionList(distributionDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('Scheduled report not found');
      }
    });

    it('should throw error if user does not exist', async () => {
      // Arrange
      const distributionDto: CreateDistributionListDto = {
        scheduledReportId: 'scheduled-123',
        userId: 'user-non-existent',
        email: 'user@example.com',
      };

      const existingReport = {
        id: 'scheduled-123',
        name: 'Test Report',
      };

      securityStub.validateInput.returns(true);
      securityStub.sanitizeInput.returns(distributionDto);
      prismaStub.scheduledReport.findUnique.resolves(existingReport);
      prismaStub.user.findUnique.resolves(null);

      // Act & Assert
      try {
        await service.createDistributionList(distributionDto);
        expect.fail('Should have thrown NotFoundException');
      } catch (error) {
        expect(error).to.be.instanceOf(NotFoundException);
        expect(error.message).to.include('User not found');
      }
    });
  });

  
  describe('calculateNextRunTime', () => {
    it('should calculate next run time for daily schedule', () => {
      // Arrange
      const now = new Date('2024-01-15T10:00:00.000Z');
      const schedule = '0 9 * * *'; // 9 AM daily

      // Act
      const nextRun = service['calculateNextRunTime'](schedule, now);

      // Assert
      expect(nextRun).to.be.instanceOf(Date);
      expect(nextRun.getDate()).to.equal(16); // Next day
      expect(nextRun.getUTCHours()).to.equal(9); // 9 AM UTC
    });

    it('should calculate next run time for weekly schedule', () => {
      // Arrange
      const now = new Date('2024-01-15T10:00:00.000Z'); // Monday
      const schedule = '0 9 * * 1'; // 9 AM every Monday

      // Act
      const nextRun = service['calculateNextRunTime'](schedule, now);

      // Assert
      expect(nextRun).to.be.instanceOf(Date);
      expect(nextRun.getDate()).to.equal(22); // Next Monday (7 days later)
      expect(nextRun.getUTCHours()).to.equal(9); // 9 AM UTC
    });
  });

  describe('validateCronExpression', () => {
    it('should validate correct cron expressions', () => {
      const validExpressions = [
        '0 9 * * *', // Daily at 9 AM
        '0 9 * * 1', // Weekly on Monday at 9 AM
        '0 9 1 * *', // Monthly on 1st at 9 AM
        '0 9 1 1 *', // Yearly on January 1st at 9 AM
        '*/15 * * * *', // Every 15 minutes
      ];

      validExpressions.forEach(expression => {
        const isValid = service['validateCronExpression'](expression);
        expect(isValid).to.be.true;
      });
    });

    it('should reject invalid cron expressions', () => {
      const invalidExpressions = [
        '', // Empty
        'invalid', // Invalid format
        '60 9 * * *', // Invalid minute
        '0 25 * * *', // Invalid hour
        '0 9 32 * *', // Invalid day
        'abc', // Non-numeric
        '0 9 * * 8', // Invalid day of week
      ];

      invalidExpressions.forEach(expression => {
        const isValid = service['validateCronExpression'](expression);
        expect(isValid).to.be.false;
      });
    });
  });
});