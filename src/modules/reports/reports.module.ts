import { Module } from '@nestjs/common';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './reports.controller';
import { ScheduledReportsService } from './scheduled/scheduled-reports.service';
import { ScheduledReportsController } from './scheduled/scheduled-reports.controller';
import { SecurityModule } from '../../shared/security/security.module';
import { CommonModule } from '../../shared/common/common.module';

@Module({
  imports: [SecurityModule, CommonModule],
  controllers: [ReportsController, ScheduledReportsController],
  providers: [ReportsService, ScheduledReportsService],
  exports: [ReportsService, ScheduledReportsService],
})
export class ReportsModule {}