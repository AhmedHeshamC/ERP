import { Module } from '@nestjs/common';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { TransactionController } from './transaction.controller';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { TransactionService } from './transaction.service';
import { ReportsService } from './reports.service';
import { AuditModule } from '../../shared/audit/audit.module';
import { SecurityService } from '../../shared/security/security.service';
import { CacheModule } from '../../shared/cache/cache.module';

@Module({
  imports: [AuditModule, CacheModule],
  controllers: [ChartOfAccountsController, TransactionController],
  providers: [ChartOfAccountsService, TransactionService, ReportsService, SecurityService],
  exports: [ChartOfAccountsService, TransactionService, ReportsService],
})
export class AccountingModule {}