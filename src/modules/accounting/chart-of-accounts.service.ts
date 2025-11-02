import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditService } from '../../shared/audit/services/audit.service';
import { SecurityService } from '../../shared/security/security.service';
import { TransactionService } from './transaction.service';
import { CreateChartOfAccountsDto } from './dto/create-chart-of-accounts.dto';
import { UpdateChartOfAccountsDto } from './dto/update-chart-of-accounts.dto';
import { ChartOfAccountsQueryDto } from './dto/chart-of-accounts-query.dto';
import { AccountType as _AccountType, TransactionType } from './enums/accounting.enum';

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
    private readonly transactionService: TransactionService,
  ) {}

  async create(createChartOfAccountsDto: CreateChartOfAccountsDto, createdBy: string) {
    this.logger.log(`Creating chart of accounts: ${createChartOfAccountsDto.code} - ${createChartOfAccountsDto.name}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(createChartOfAccountsDto);

      // Check if account code already exists
      const existingAccount = await this.prisma.chartOfAccounts.findUnique({
        where: { code: sanitizedData.code },
      });

      if (existingAccount) {
        throw new ConflictException(`Account with code ${sanitizedData.code} already exists`);
      }

      // Business rule: Validate parent account exists and is active
      let level = 0;
      if (sanitizedData.parentId) {
        const parent = await this.prisma.chartOfAccounts.findUnique({
          where: { id: sanitizedData.parentId, isActive: true },
        });

        if (!parent) {
          throw new NotFoundException(`Parent account with ID ${sanitizedData.parentId} not found or inactive`);
        }

        level = parent.level + 1;

        // Business rule: Validate account hierarchy depth (max 5 levels)
        if (level > 5) {
          throw new BadRequestException('Account hierarchy cannot exceed 5 levels');
        }
      }

      // Business rule: Opening balance would be handled via journal entries
      // This validation can be added if openingBalance field is added to schema

      // Create account with comprehensive validation
      const account = await this.prisma.$transaction(async (tx) => {
        const newAccount = await tx.chartOfAccounts.create({
          data: {
            code: sanitizedData.code,
            name: sanitizedData.name,
            description: sanitizedData.description,
            type: sanitizedData.type,
            category: sanitizedData.category,
            subcategory: sanitizedData.subcategory,
            parentId: sanitizedData.parentId,
            level,
            isActive: true,
            isSystem: false,
            createdBy,
          },
        });

        // Handle opening balance if provided
        if (createChartOfAccountsDto.openingBalance && createChartOfAccountsDto.openingBalance > 0) {
          await this.createOpeningBalanceTransaction(
            newAccount,
            createChartOfAccountsDto.openingBalance,
            createChartOfAccountsDto.openingBalanceCurrency || 'USD',
            createdBy
          );
        }

        this.logger.log(`Account ${newAccount.code} created successfully${createChartOfAccountsDto.openingBalance ? ' with opening balance' : ''}`);

        return newAccount;
      });

      // Log audit event
      await this.auditService.logCreate(
        'CHART_OF_ACCOUNTS',
        account.id,
        account,
        createdBy,
        {
          action: 'CREATE_ACCOUNT',
          accountCode: account.code,
          accountType: account.type,
          level,
        },
      );

      this.logger.log(`Successfully created chart of accounts: ${account.code} (ID: ${account.id})`);
      return account;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed creation
      if (createdBy) {
        await this.auditService.logBusinessEvent(
          'CHART_OF_ACCOUNTS_CREATE_FAILED',
          'CHART_OF_ACCOUNTS',
          'unknown',
          'CREATE',
          createdBy,
          {
            error: errorMessage,
            accountData: this.securityService.sanitizeInput(createChartOfAccountsDto),
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to create chart of accounts: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async findAll(params: ChartOfAccountsQueryDto) {
    const { skip = 0, take = 10, type, search } = params;

    const where: {
      isActive: boolean;
      type?: string;
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
        code?: { contains: string; mode: 'insensitive' };
      }>;
      category?: string;
      subcategory?: string;
      parentId?: string;
    } = { isActive: true };

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      this.prisma.chartOfAccounts.findMany({
        where,
        skip,
        take,
        orderBy: { code: 'asc' },
      }),
      this.prisma.chartOfAccounts.count({ where }),
    ]);

    return {
      accounts,
      total,
    };
  }

  async findOne(id: string) {
    const account = await this.prisma.chartOfAccounts.findUnique({
      where: { id, isActive: true },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async update(id: string, updateChartOfAccountsDto: UpdateChartOfAccountsDto, updatedBy: string) {
    this.logger.log(`Updating chart of accounts: ${id}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(updateChartOfAccountsDto);

      // Validate account exists
      const existingAccount = await this.prisma.chartOfAccounts.findUnique({
        where: { id },
      });

      if (!existingAccount) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }

      if (existingAccount.isSystem) {
        throw new ForbiddenException('System accounts cannot be modified');
      }

      // Business rule: Cannot change parent if account has children
      if (sanitizedData.parentId && sanitizedData.parentId !== existingAccount.parentId) {
        const childAccounts = await this.prisma.chartOfAccounts.count({
          where: { parentId: id, isActive: true },
        });

        if (childAccounts > 0) {
          throw new BadRequestException('Cannot change parent account for accounts with existing children');
        }
      }

      // Business rule: Validate new parent if changing
      if (sanitizedData.parentId && sanitizedData.parentId !== existingAccount.parentId) {
        const newParent = await this.prisma.chartOfAccounts.findUnique({
          where: { id: sanitizedData.parentId, isActive: true },
        });

        if (!newParent) {
          throw new NotFoundException(`New parent account with ID ${sanitizedData.parentId} not found or inactive`);
        }

        // Business rule: Prevent circular references
        if (await this.wouldCreateCircularReference(id, sanitizedData.parentId)) {
          throw new BadRequestException('Cannot set parent account that would create circular reference');
        }
      }

      // Update account
      const updatedAccount = await this.prisma.$transaction(async (tx) => {
        return await tx.chartOfAccounts.update({
          where: { id },
          data: {
            ...sanitizedData,
            updatedAt: new Date(),
            updatedBy,
          },
        });
      });

      // Log audit event
      await this.auditService.logUpdate(
        'CHART_OF_ACCOUNTS',
        id,
        existingAccount,
        updatedAccount,
        updatedBy,
        {
          action: 'UPDATE_ACCOUNT',
          accountCode: existingAccount.code,
          updatedFields: Object.keys(sanitizedData),
        },
      );

      this.logger.log(`Successfully updated chart of accounts: ${updatedAccount.code} (ID: ${id})`);
      return updatedAccount;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed update
      if (updatedBy) {
        await this.auditService.logBusinessEvent(
          'CHART_OF_ACCOUNTS_UPDATE_FAILED',
          'CHART_OF_ACCOUNTS',
          id,
          'UPDATE',
          updatedBy,
          {
            error: errorMessage,
            accountData: this.securityService.sanitizeInput(updateChartOfAccountsDto),
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to update chart of accounts: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async remove(id: string, deletedBy: string) {
    this.logger.log(`Removing chart of accounts: ${id}`);

    try {
      // Validate account exists
      const existingAccount = await this.prisma.chartOfAccounts.findUnique({
        where: { id },
      });

      if (!existingAccount) {
        throw new NotFoundException(`Account with ID ${id} not found`);
      }

      if (existingAccount.isSystem) {
        throw new ForbiddenException('System accounts cannot be deleted');
      }

      // Business rule: Cannot delete accounts with existing transactions
      const transactionCount = await this.prisma.journalEntry.count({
        where: { accountId: id },
      });

      if (transactionCount > 0) {
        throw new BadRequestException('Cannot delete account with existing transactions. Consider deactivating instead.');
      }

      // Business rule: Cannot delete accounts with children
      const childAccounts = await this.prisma.chartOfAccounts.count({
        where: { parentId: id, isActive: true },
      });

      if (childAccounts > 0) {
        throw new BadRequestException('Cannot delete account with existing child accounts. Delete child accounts first.');
      }

      // Soft delete account
      const deletedAccount = await this.prisma.$transaction(async (tx) => {
        return await tx.chartOfAccounts.update({
          where: { id },
          data: {
            isActive: false,
            updatedAt: new Date(),
            updatedBy: deletedBy,
          },
        });
      });

      // Log audit event
      await this.auditService.logDelete(
        'CHART_OF_ACCOUNTS',
        id,
        existingAccount,
        deletedBy,
        {
          action: 'DELETE_ACCOUNT',
          accountCode: existingAccount.code,
          accountType: existingAccount.type,
        },
      );

      this.logger.log(`Successfully removed chart of accounts: ${deletedAccount.code} (ID: ${id})`);
      return deletedAccount;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed deletion
      if (deletedBy) {
        await this.auditService.logBusinessEvent(
          'CHART_OF_ACCOUNTS_DELETE_FAILED',
          'CHART_OF_ACCOUNTS',
          id,
          'DELETE',
          deletedBy,
          {
            error: errorMessage,
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to remove chart of accounts: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async findByCode(code: string) {
    return this.prisma.chartOfAccounts.findUnique({
      where: { code, isActive: true },
    });
  }

  async findChildren(parentId: string) {
    return this.prisma.chartOfAccounts.findMany({
      where: { parentId, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Helper method to check if setting a parent would create a circular reference
   */
  private async wouldCreateCircularReference(accountId: string, newParentId: string): Promise<boolean> {
    const visited = new Set<string>();
    let currentId: string | null = newParentId;
    const maxDepth = 10;
    let depth = 0;

    while (currentId && depth < maxDepth && !visited.has(currentId)) {
      if (currentId === accountId) {
        return true;
      }

      visited.add(currentId);
      depth++;

      const parent: { parentId?: string | null } | null = await this.prisma.chartOfAccounts.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = parent?.parentId || null;
    }

    return false;
  }

  /**
   * Create opening balance transaction for a new account
   * Follows proper accounting principles with balanced journal entries
   */
  private async createOpeningBalanceTransaction(
    account: any,
    openingBalance: number,
    currency: string,
    createdBy: string
  ): Promise<void> {
    try {
      this.logger.log(`Creating opening balance transaction for account ${account.code}: ${openingBalance} ${currency}`);

      // Determine the appropriate offset account based on account type
      const offsetAccountId = await this.findOffsetAccount(account.type);

      if (!offsetAccountId) {
        this.logger.warn(`Could not find appropriate offset account for opening balance of account ${account.code}`);
        return;
      }

      // Create opening balance journal entry
      const openingBalanceDate = new Date();
      openingBalanceDate.setFullYear(openingBalanceDate.getFullYear() - 1); // Set to previous year for proper opening balance

      const transactionDto = {
        reference: `OB-${account.code}-${Date.now()}`,
        description: `Opening balance for account ${account.code} - ${account.name}`,
        amount: openingBalance,
        type: this.getOpeningBalanceTransactionType(),
        currency,
        date: openingBalanceDate, // Keep as Date object
        entries: [
          {
            accountId: account.id,
            description: `Opening balance - ${account.name}`,
            debitAmount: this.isDebitAccount(account.type) ? openingBalance : 0,
            creditAmount: this.isDebitAccount(account.type) ? 0 : openingBalance,
          },
          {
            accountId: offsetAccountId,
            description: `Offset for opening balance - ${account.name}`,
            debitAmount: this.isDebitAccount(account.type) ? 0 : openingBalance,
            creditAmount: this.isDebitAccount(account.type) ? openingBalance : 0,
          },
        ],
      };

      await this.transactionService.create(transactionDto, createdBy);

      this.logger.log(`Successfully created opening balance transaction for account ${account.code}`);

    } catch (error) {
      this.logger.error(`Failed to create opening balance transaction for account ${account.code}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
      // Don't throw error - opening balance failure shouldn't prevent account creation
      // Log the issue for manual follow-up
    }
  }

  /**
   * Find appropriate offset account for opening balance based on account type
   */
  private async findOffsetAccount(accountType: string): Promise<string | null> {
    try {
      // Define offset account mappings based on accounting principles
      const offsetMappings: Record<string, { type: string; category: string }> = {
        ASSET: { type: 'EQUITY', category: 'Opening Balance Equity' },
        EXPENSE: { type: 'EQUITY', category: 'Opening Balance Equity' },
        LIABILITY: { type: 'EQUITY', category: 'Opening Balance Equity' },
        EQUITY: { type: 'ASSET', category: 'Cash' }, // For equity reductions
        REVENUE: { type: 'EQUITY', category: 'Retained Earnings' },
      };

      const offsetAccountSpec = offsetMappings[accountType];
      if (!offsetAccountSpec) {
        return null;
      }

      // Try to find the offset account
      const offsetAccount = await this.prisma.chartOfAccounts.findFirst({
        where: {
          type: offsetAccountSpec.type,
          category: offsetAccountSpec.category,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' }, // Get the oldest/primary account
      });

      return offsetAccount?.id || null;

    } catch (error) {
      this.logger.error(`Failed to find offset account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Determine transaction type for opening balance
   */
  private getOpeningBalanceTransactionType(): TransactionType {
    // Opening balances are typically journal entries
    return TransactionType.JOURNAL_ENTRY;
  }

  /**
   * Check if account type normally carries a debit balance
   */
  private isDebitAccount(accountType: string): boolean {
    const debitAccountTypes = ['ASSET', 'EXPENSE'];
    return debitAccountTypes.includes(accountType);
  }
}