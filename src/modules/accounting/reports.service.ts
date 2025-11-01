import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AccountType, TransactionStatus } from './enums/accounting.enum';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateTrialBalance(asOfDate: Date) {
    // Get all active accounts
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get all journal entries up to the specified date
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        transaction: {
          date: { lte: asOfDate },
          status: TransactionStatus.POSTED,
        },
      },
      include: {
        account: true,
      },
    });

    // Calculate balances for each account
    const accountBalances = accounts.map(account => {
      const accountEntries = entries.filter(entry => entry.accountId === account.id);

      let debitBalance = 0;
      let creditBalance = 0;

      accountEntries.forEach(entry => {
        debitBalance += Number(entry.debitAmount);
        creditBalance += Number(entry.creditAmount);
      });

      // For asset and expense accounts, normal balance is debit
      // For liability, equity, and revenue accounts, normal balance is credit
      const isNormalDebitBalance = [AccountType.ASSET, AccountType.EXPENSE].includes(account.type as AccountType);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debitBalance,
        creditBalance,
        normalBalance: isNormalDebitBalance ? debitBalance - creditBalance : creditBalance - debitBalance,
      };
    });

    // Calculate totals
    const totalDebits = accountBalances.reduce((sum, account) => sum + account.debitBalance, 0);
    const totalCredits = accountBalances.reduce((sum, account) => sum + account.creditBalance, 0);

    return {
      asOfDate,
      accounts: accountBalances,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
    };
  }

  async generateIncomeStatement(startDate: Date, endDate: Date) {
    // Get revenue accounts
    const revenues = await this.prisma.$queryRaw<Array<{ accountId: string; name: string; amount: number }>>`
      SELECT
        ca.id as accountId,
        ca.name,
        COALESCE(SUM(je.creditAmount - je.debitAmount), 0) as amount
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'REVENUE'
        AND ca.isActive = true
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.status = 'POSTED'
      GROUP BY ca.id, ca.name
      HAVING COALESCE(SUM(je.creditAmount - je.debitAmount), 0) != 0
      ORDER BY ca.code
    `;

    // Get expense accounts
    const expenses = await this.prisma.$queryRaw<Array<{ accountId: string; name: string; amount: number }>>`
      SELECT
        ca.id as accountId,
        ca.name,
        COALESCE(SUM(je.debitAmount - je.creditAmount), 0) as amount
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'EXPENSE'
        AND ca.isActive = true
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.status = 'POSTED'
      GROUP BY ca.id, ca.name
      HAVING COALESCE(SUM(je.debitAmount - je.creditAmount), 0) != 0
      ORDER BY ca.code
    `;

    const totalRevenue = revenues.reduce((sum, rev) => sum + Number(rev.amount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      period: { startDate, endDate },
      revenues,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome,
    };
  }

  async generateBalanceSheet(asOfDate: Date) {
    // Get asset accounts
    const assets = await this.prisma.$queryRaw<Array<{ code: string; name: string; balance: number }>>`
      SELECT
        ca.code,
        ca.name,
        COALESCE(SUM(je.debitAmount - je.creditAmount), 0) as balance
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'ASSET'
        AND ca.isActive = true
        AND t.date <= ${asOfDate}
        AND t.status = 'POSTED'
      GROUP BY ca.id, ca.code, ca.name
      HAVING COALESCE(SUM(je.debitAmount - je.creditAmount), 0) != 0
      ORDER BY ca.code
    `;

    // Get liability accounts
    const liabilities = await this.prisma.$queryRaw<Array<{ code: string; name: string; balance: number }>>`
      SELECT
        ca.code,
        ca.name,
        COALESCE(SUM(je.creditAmount - je.debitAmount), 0) as balance
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'LIABILITY'
        AND ca.isActive = true
        AND t.date <= ${asOfDate}
        AND t.status = 'POSTED'
      GROUP BY ca.id, ca.code, ca.name
      HAVING COALESCE(SUM(je.creditAmount - je.debitAmount), 0) != 0
      ORDER BY ca.code
    `;

    // Get equity accounts
    const equity = await this.prisma.$queryRaw<Array<{ code: string; name: string; balance: number }>>`
      SELECT
        ca.code,
        ca.name,
        COALESCE(SUM(je.creditAmount - je.debitAmount), 0) as balance
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'EQUITY'
        AND ca.isActive = true
        AND t.date <= ${asOfDate}
        AND t.status = 'POSTED'
      GROUP BY ca.id, ca.code, ca.name
      HAVING COALESCE(SUM(je.creditAmount - je.debitAmount), 0) != 0
      ORDER BY ca.code
    `;

    // Calculate retained earnings (revenue - expenses for all periods up to asOfDate)
    const retainedEarnings = await this.prisma.$queryRaw<Array<{ retainedEarnings: number }>>`
      SELECT
        COALESCE(SUM(CASE
          WHEN ca.type = 'REVENUE' THEN je.creditAmount - je.debitAmount
          WHEN ca.type = 'EXPENSE' THEN je.debitAmount - je.creditAmount
          ELSE 0
        END), 0) as retainedEarnings
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type IN ('REVENUE', 'EXPENSE')
        AND ca.isActive = true
        AND t.date <= ${asOfDate}
        AND t.status = 'POSTED'
    `;

    const totalAssets = assets.reduce((sum, asset) => sum + Number(asset.balance), 0);
    const totalLiabilities = liabilities.reduce((sum, liability) => sum + Number(liability.balance), 0);
    const totalEquity = equity.reduce((sum, eq) => sum + Number(eq.balance), 0) +
                       (retainedEarnings[0]?.retainedEarnings || 0);
    const liabilitiesPlusEquity = totalLiabilities + totalEquity;

    return {
      asOfDate,
      assets,
      liabilities,
      equity: [
        ...equity,
        { code: 'RE', name: 'Retained Earnings', balance: retainedEarnings[0]?.retainedEarnings || 0 },
      ],
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      isBalanced: Math.abs(totalAssets - liabilitiesPlusEquity) < 0.01, // Allow for rounding
    };
  }

  async generateCashFlowStatement(startDate: Date, endDate: Date) {
    // Operating activities (changes in current assets and current liabilities)
    const operatingActivities = await this.prisma.$queryRaw<Array<{ cashFlow: number }>>`
      SELECT COALESCE(SUM(
        CASE
          WHEN ca.type = 'ASSET' AND ca.category = 'Current Assets' THEN je.debitAmount - je.creditAmount
          WHEN ca.type = 'LIABILITY' AND ca.category = 'Current Liabilities' THEN je.creditAmount - je.debitAmount
          WHEN ca.type = 'REVENUE' THEN je.creditAmount - je.debitAmount
          WHEN ca.type = 'EXPENSE' THEN je.debitAmount - je.creditAmount
          ELSE 0
        END
      ), 0) as cashFlow
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE (ca.type IN ('REVENUE', 'EXPENSE') OR
             (ca.type = 'ASSET' AND ca.category = 'Current Assets') OR
             (ca.type = 'LIABILITY' AND ca.category = 'Current Liabilities'))
        AND ca.isActive = true
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.status = 'POSTED'
    `;

    // Investing activities (changes in non-current assets)
    const investingActivities = await this.prisma.$queryRaw<Array<{ cashFlow: number }>>`
      SELECT COALESCE(SUM(je.creditAmount - je.debitAmount), 0) as cashFlow
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE ca.type = 'ASSET'
        AND ca.category != 'Current Assets'
        AND ca.isActive = true
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.status = 'POSTED'
    `;

    // Financing activities (changes in non-current liabilities and equity)
    const financingActivities = await this.prisma.$queryRaw<Array<{ cashFlow: number }>>`
      SELECT COALESCE(SUM(je.creditAmount - je.debitAmount), 0) as cashFlow
      FROM ChartOfAccounts ca
      LEFT JOIN JournalEntry je ON ca.id = je.accountId
      LEFT JOIN Transaction t ON je.transactionId = t.id
      WHERE (ca.type = 'LIABILITY' AND ca.category != 'Current Liabilities')
         OR ca.type = 'EQUITY'
        AND ca.isActive = true
        AND t.date >= ${startDate}
        AND t.date <= ${endDate}
        AND t.status = 'POSTED'
    `;

    const operatingCashFlow = operatingActivities[0]?.cashFlow || 0;
    const investingCashFlow = investingActivities[0]?.cashFlow || 0;
    const financingCashFlow = financingActivities[0]?.cashFlow || 0;
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    return {
      period: { startDate, endDate },
      operatingActivities: operatingCashFlow,
      investingActivities: investingCashFlow,
      financingActivities: financingCashFlow,
      netCashFlow,
    };
  }

  async getGeneralLedger(accountId: string, startDate: Date, endDate: Date) {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        accountId,
        transaction: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: TransactionStatus.POSTED,
        },
      },
      include: {
        transaction: true,
      },
      orderBy: {
        transaction: {
          date: 'asc',
        },
      },
    });

    return {
      accountId,
      startDate,
      endDate,
      entries: entries.map(entry => ({
        date: entry.transaction.date,
        reference: entry.transaction.reference,
        description: entry.description || entry.transaction.description,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        balance: entry.balance,
      })),
    };
  }
}