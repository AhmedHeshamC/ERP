import { PrismaService } from '../../../database/prisma.service';
import { BaseDataFactory, ITestDataFactory } from './base-data-factory';
import { AccountType, TransactionType, TransactionStatus } from '../../../modules/accounting/dto/accounting.dto';

/**
 * Accounting Module Test Data Factory
 *
 * Creates realistic test data for accounting module including
 * chart of accounts, transactions, journal entries, and financial data
 */
export class AccountingDataFactory extends BaseDataFactory implements ITestDataFactory {
  private accountingTestData: any = {};

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Create comprehensive base accounting test data
   */
  async createBaseData(): Promise<void> {
    this.accountingTestData = {
      chartOfAccounts: await this.createChartOfAccountsStructure(),
      transactions: [],
      journalEntries: []
    };
  }

  /**
   * Clean up all accounting test data
   */
  async cleanupTestData(): Promise<void> {
    const patterns = [
      'test-account', 'test-transaction', 'test-journal', 'test-invoice',
      'test-payment', 'accounting-test', 'finance-test'
    ];

    await this.cleanupTestData(patterns);
  }

  /**
   * Generate complete chart of accounts structure
   */
  async createChartOfAccountsStructure(): Promise<any[]> {
    const accounts = [];

    // Assets
    accounts.push(...await this.createAssetAccounts());

    // Liabilities
    accounts.push(...await this.createLiabilityAccounts());

    // Equity
    accounts.push(...await this.createEquityAccounts());

    // Revenue
    accounts.push(...await this.createRevenueAccounts());

    // Expenses
    accounts.push(...await this.createExpenseAccounts());

    return accounts;
  }

  /**
   * Create asset accounts
   */
  private async createAssetAccounts(): Promise<any[]> {
    const assetAccounts = [
      {
        id: this.generateUniqueId('acc-asset-cash'),
        accountCode: '1000',
        accountName: 'Cash and Cash Equivalents',
        accountType: AccountType.ASSET,
        isActive: true,
        openingBalance: 50000.00,
        description: 'Primary cash account for business operations',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-asset-bank'),
        accountCode: '1010',
        accountName: 'Bank Accounts',
        accountType: AccountType.ASSET,
        isActive: true,
        openingBalance: 125000.00,
        description: 'All bank operating accounts',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-asset-ar'),
        accountCode: '1100',
        accountName: 'Accounts Receivable',
        accountType: AccountType.ASSET,
        isActive: true,
        openingBalance: 75000.00,
        description: 'Trade receivables from customers',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-asset-inventory'),
        accountCode: '1200',
        accountName: 'Inventory',
        accountType: AccountType.ASSET,
        isActive: true,
        openingBalance: 200000.00,
        description: 'Raw materials and finished goods inventory',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-asset-equipment'),
        accountCode: '1500',
        accountName: 'Equipment and Machinery',
        accountType: AccountType.ASSET,
        isActive: true,
        openingBalance: 500000.00,
        description: 'Production equipment and machinery',
        parentId: null,
        level: 1
      }
    ];

    // Create accounts in database
    const createdAccounts = [];
    for (const account of assetAccounts) {
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: {
            ...account,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        createdAccounts.push(created);
      } catch (error) {
        // Account might exist, try to find it
        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { accountCode: account.accountCode }
        });
        if (existing) createdAccounts.push(existing);
      }
    }

    return createdAccounts;
  }

  /**
   * Create liability accounts
   */
  private async createLiabilityAccounts(): Promise<any[]> {
    const liabilityAccounts = [
      {
        id: this.generateUniqueId('acc-liability-ap'),
        accountCode: '2000',
        accountName: 'Accounts Payable',
        accountType: AccountType.LIABILITY,
        isActive: true,
        openingBalance: 45000.00,
        description: 'Trade payables to suppliers',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-liability-tax'),
        accountCode: '2100',
        accountName: 'Taxes Payable',
        accountType: AccountType.LIABILITY,
        isActive: true,
        openingBalance: 15000.00,
        description: 'Various tax obligations',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-liability-shortterm'),
        accountCode: '2200',
        accountName: 'Short-term Loans',
        accountType: AccountType.LIABILITY,
        isActive: true,
        openingBalance: 100000.00,
        description: 'Short-term financing arrangements',
        parentId: null,
        level: 1
      }
    ];

    const createdAccounts = [];
    for (const account of liabilityAccounts) {
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: {
            ...account,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        createdAccounts.push(created);
      } catch (error) {
        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { accountCode: account.accountCode }
        });
        if (existing) createdAccounts.push(existing);
      }
    }

    return createdAccounts;
  }

  /**
   * Create equity accounts
   */
  private async createEquityAccounts(): Promise<any[]> {
    const equityAccounts = [
      {
        id: this.generateUniqueId('acc-equity-capital'),
        accountCode: '3000',
        accountName: 'Share Capital',
        accountType: AccountType.EQUITY,
        isActive: true,
        openingBalance: 1000000.00,
        description: 'Issued share capital',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-equity-retained'),
        accountCode: '3100',
        accountName: 'Retained Earnings',
        accountType: AccountType.EQUITY,
        isActive: true,
        openingBalance: 250000.00,
        description: 'Accumulated retained earnings',
        parentId: null,
        level: 1
      }
    ];

    const createdAccounts = [];
    for (const account of equityAccounts) {
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: {
            ...account,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        createdAccounts.push(created);
      } catch (error) {
        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { accountCode: account.accountCode }
        });
        if (existing) createdAccounts.push(existing);
      }
    }

    return createdAccounts;
  }

  /**
   * Create revenue accounts
   */
  private async createRevenueAccounts(): Promise<any[]> {
    const revenueAccounts = [
      {
        id: this.generateUniqueId('acc-revenue-sales'),
        accountCode: '4000',
        accountName: 'Sales Revenue',
        accountType: AccountType.REVENUE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Primary sales revenue',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-revenue-services'),
        accountCode: '4100',
        accountName: 'Service Revenue',
        accountType: AccountType.REVENUE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Professional service fees',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-revenue-other'),
        accountCode: '4200',
        accountName: 'Other Revenue',
        accountType: AccountType.REVENUE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Miscellaneous revenue sources',
        parentId: null,
        level: 1
      }
    ];

    const createdAccounts = [];
    for (const account of revenueAccounts) {
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: {
            ...account,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        createdAccounts.push(created);
      } catch (error) {
        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { accountCode: account.accountCode }
        });
        if (existing) createdAccounts.push(existing);
      }
    }

    return createdAccounts;
  }

  /**
   * Create expense accounts
   */
  private async createExpenseAccounts(): Promise<any[]> {
    const expenseAccounts = [
      {
        id: this.generateUniqueId('acc-expense-cogs'),
        accountCode: '5000',
        accountName: 'Cost of Goods Sold',
        accountType: AccountType.EXPENSE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Direct cost of goods sold',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-expense-salary'),
        accountCode: '5100',
        accountName: 'Salaries and Wages',
        accountType: AccountType.EXPENSE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Employee compensation',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-expense-rent'),
        accountCode: '5200',
        accountName: 'Rent and Utilities',
        accountType: AccountType.EXPENSE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Facility costs and utilities',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-expense-marketing'),
        accountCode: '5300',
        accountName: 'Marketing and Advertising',
        accountType: AccountType.EXPENSE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Marketing expenses',
        parentId: null,
        level: 1
      },
      {
        id: this.generateUniqueId('acc-expense-depreciation'),
        accountCode: '5400',
        accountName: 'Depreciation Expense',
        accountType: AccountType.EXPENSE,
        isActive: true,
        openingBalance: 0.00,
        description: 'Asset depreciation',
        parentId: null,
        level: 1
      }
    ];

    const createdAccounts = [];
    for (const account of expenseAccounts) {
      try {
        const created = await this.prisma.chartOfAccounts.create({
          data: {
            ...account,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        createdAccounts.push(created);
      } catch (error) {
        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { accountCode: account.accountCode }
        });
        if (existing) createdAccounts.push(existing);
      }
    }

    return createdAccounts;
  }

  /**
   * Create a transaction with journal entries
   */
  async createTransactionWithEntries(overrides?: any): Promise<any> {
    // Get available accounts
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { isActive: true }
    });

    if (accounts.length < 2) {
      throw new Error('Insufficient chart of accounts for transaction creation');
    }

    // Select debit and credit accounts
    const debitAccount = this.selectRandom(accounts.filter(acc =>
      acc.accountType === AccountType.ASSET || acc.accountType === AccountType.EXPENSE
    ));
    const creditAccount = this.selectRandom(accounts.filter(acc =>
      acc.accountType === AccountType.LIABILITY || acc.accountType === AccountType.EQUITY || acc.accountType === AccountType.REVENUE
    ));

    const amount = this.generateAmount(100, 10000);
    const transactionData = {
      reference: this.generateReference('TX'),
      description: this.generateLoremIpsum(5),
      date: new Date(),
      amount: amount,
      type: TransactionType.JOURNAL_ENTRY,
      status: TransactionStatus.POSTED,
      createdBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      const transaction = await this.prisma.transaction.create({
        data: transactionData
      });

      // Create journal entries (double-entry)
      await this.prisma.journalEntry.createMany({
        data: [
          {
            transactionId: transaction.id,
            accountId: debitAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description: `Debit entry for ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            transactionId: transaction.id,
            accountId: creditAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description: `Credit entry for ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });

      // Return transaction with entries
      return await this.prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { entries: true }
      });
    } catch (error) {
      throw new Error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a sales invoice transaction
   */
  async createSalesInvoiceTransaction(customerId?: string, overrides?: any): Promise<any> {
    // Get revenue and receivable accounts
    const revenueAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { accountType: AccountType.REVENUE, isActive: true }
    });

    const receivableAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { accountType: AccountType.ASSET, accountName: { contains: 'Receivable' }, isActive: true }
    });

    if (!revenueAccount || !receivableAccount) {
      throw new Error('Required accounts not found for sales invoice');
    }

    const amount = this.generateAmount(1000, 50000);
    const transactionData = {
      reference: this.generateReference('INV'),
      description: `Sales invoice for customer ${customerId || 'TEST'}`,
      date: new Date(),
      amount: amount,
      type: TransactionType.SALE,
      status: TransactionStatus.POSTED,
      customerId: customerId || this.generateUniqueId('customer'),
      createdBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      const transaction = await this.prisma.transaction.create({
        data: transactionData
      });

      // Create journal entries
      await this.prisma.journalEntry.createMany({
        data: [
          {
            transactionId: transaction.id,
            accountId: receivableAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description: `Accounts receivable for invoice ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            transactionId: transaction.id,
            accountId: revenueAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description: `Revenue for invoice ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });

      return await this.prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { entries: true }
      });
    } catch (error) {
      throw new Error(`Failed to create sales invoice transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a purchase invoice transaction
   */
  async createPurchaseInvoiceTransaction(supplierId?: string, overrides?: any): Promise<any> {
    // Get expense and payable accounts
    const expenseAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { accountType: AccountType.EXPENSE, isActive: true }
    });

    const payableAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { accountType: AccountType.LIABILITY, accountName: { contains: 'Payable' }, isActive: true }
    });

    if (!expenseAccount || !payableAccount) {
      throw new Error('Required accounts not found for purchase invoice');
    }

    const amount = this.generateAmount(500, 25000);
    const transactionData = {
      reference: this.generateReference('PUR'),
      description: `Purchase invoice from supplier ${supplierId || 'TEST'}`,
      date: new Date(),
      amount: amount,
      type: TransactionType.PURCHASE,
      status: TransactionStatus.POSTED,
      supplierId: supplierId || this.generateUniqueId('supplier'),
      createdBy: this.generateUniqueId('user'),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };

    try {
      const transaction = await this.prisma.transaction.create({
        data: transactionData
      });

      // Create journal entries
      await this.prisma.journalEntry.createMany({
        data: [
          {
            transactionId: transaction.id,
            accountId: expenseAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description: `Expense for purchase ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            transactionId: transaction.id,
            accountId: payableAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description: `Accounts payable for purchase ${transaction.reference}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      });

      return await this.prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { entries: true }
      });
    } catch (error) {
      throw new Error(`Failed to create purchase invoice transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate test data for specific scenario
   */
  generateTestData(overrides?: any): any {
    return {
      accountData: {
        accountCode: this.generateReference('ACC'),
        accountName: this.generateLoremIpsum(3),
        accountType: this.selectRandom(Object.values(AccountType)),
        openingBalance: this.generateAmount(0, 100000),
        description: this.generateLoremIpsum(10),
        ...overrides?.account
      },
      transactionData: {
        reference: this.generateReference('TX'),
        description: this.generateLoremIppest(8),
        amount: this.generateAmount(100, 10000),
        type: this.selectRandom(Object.values(TransactionType)),
        ...overrides?.transaction
      }
    };
  }

  /**
   * Get chart of accounts for testing
   */
  async getChartOfAccounts(): Promise<any[]> {
    return await this.prisma.chartOfAccounts.findMany({
      where: { isActive: true },
      orderBy: { accountCode: 'asc' }
    });
  }

  /**
   * Get transactions by type
   */
  async getTransactionsByType(type: TransactionType): Promise<any[]> {
    return await this.prisma.transaction.findMany({
      where: { type },
      include: { entries: true },
      orderBy: { date: 'desc' }
    });
  }

  /**
   * Get financial summary for testing
   */
  async getFinancialSummary(): Promise<any> {
    const accounts = await this.getChartOfAccounts();

    const assets = accounts
      .filter(acc => acc.accountType === AccountType.ASSET)
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);

    const liabilities = accounts
      .filter(acc => acc.accountType === AccountType.LIABILITY)
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);

    const equity = accounts
      .filter(acc => acc.accountType === AccountType.EQUITY)
      .reduce((sum, acc) => sum + (acc.openingBalance || 0), 0);

    return {
      totalAssets: assets,
      totalLiabilities: liabilities,
      totalEquity: equity,
      balance: assets - liabilities - equity
    };
  }
}