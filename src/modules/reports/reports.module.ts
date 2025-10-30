import { Module } from '@nestjs/common';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './reports.controller';
import { ScheduledReportsService } from './scheduled/scheduled-reports.service';
import { ScheduledReportsController } from './scheduled/scheduled-reports.controller';

@Module({
  controllers: [ReportsController, ScheduledReportsController],
  providers: [ReportsService, ScheduledReportsService],
  exports: [ReportsService, ScheduledReportsService],
})
export class ReportsModule {}