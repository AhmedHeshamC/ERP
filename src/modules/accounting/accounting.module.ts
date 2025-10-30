import { Module } from '@nestjs/common';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { TransactionController } from './transaction.controller';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { TransactionService } from './transaction.service';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ChartOfAccountsController, TransactionController],
  providers: [ChartOfAccountsService, TransactionService, ReportsService],
  exports: [ChartOfAccountsService, TransactionService, ReportsService],
})
export class AccountingModule {}