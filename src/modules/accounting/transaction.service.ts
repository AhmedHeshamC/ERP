import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditService } from '../../shared/audit/services/audit.service';
import { SecurityService } from '../../shared/security/security.service';
import { CreateTransactionDto, JournalEntryDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionStatus } from './enums/accounting.enum';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly securityService: SecurityService,
  ) {}

  async create(createTransactionDto: CreateTransactionDto, createdBy: string) {
    this.logger.log(`Creating transaction: ${createTransactionDto.reference}`);

    try {
      // Sanitize input data
      const sanitizedData = this.securityService.sanitizeInput(createTransactionDto);

      const { reference, description, amount, type, entries, date, currency } = sanitizedData;

      // Business rule: Validate transaction amount
      if (amount <= 0) {
        throw new BadRequestException('Transaction amount must be positive');
      }

      // Business rule: Validate transaction date is not in the future
      const transactionDate = date ? new Date(date) : new Date();
      if (transactionDate > new Date()) {
        throw new BadRequestException('Transaction date cannot be in the future');
      }

      // Business rule: Validate all accounts exist and are active
      const accountIds = entries.map((entry: JournalEntryDto) => entry.accountId);
      const accounts = await this.prisma.chartOfAccounts.findMany({
        where: { id: { in: accountIds }, isActive: true },
      });

      if (accounts.length !== accountIds.length) {
        throw new BadRequestException('One or more accounts not found or inactive');
      }

      // Business rule: Validate double-entry bookkeeping rules
      this.validateDoubleEntryRules(entries);
      await this.validateBusinessRules(entries, type);

      // Create transaction with journal entries in a database transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Check for duplicate reference
        const existingTransaction = await tx.transaction.findUnique({
          where: { reference },
        });

        if (existingTransaction) {
          throw new BadRequestException('Transaction reference already exists');
        }

        // Create transaction
        const transaction = await tx.transaction.create({
          data: {
            reference,
            description,
            amount,
            currency: currency || 'USD',
            type,
            date: transactionDate,
            status: TransactionStatus.POSTED, // Auto-post for now
            createdBy,
            postedBy: createdBy,
            postedAt: new Date(),
          },
        });

        // Create journal entries
        const journalEntries = await Promise.all(
          entries.map((entry: JournalEntryDto) =>
            tx.journalEntry.create({
              data: {
                transactionId: transaction.id,
                accountId: entry.accountId,
                description: entry.description,
                debitAmount: entry.debitAmount,
                creditAmount: entry.creditAmount,
                balance: entry.debitAmount - entry.creditAmount,
              },
            }),
          ),
        );

        return {
          ...transaction,
          entries: journalEntries,
        };
      });

      // Log audit event
      await this.auditService.logCreate(
        'TRANSACTION',
        result.id,
        {
          reference: result.reference,
          amount: result.amount,
          type: result.type,
          currency: result.currency,
          entryCount: result.entries.length,
        },
        createdBy,
        {
          action: 'CREATE_TRANSACTION',
          transactionReference: result.reference,
          transactionType: result.type,
          amount: result.amount,
        },
      );

      this.logger.log(`Successfully created transaction: ${result.reference} (ID: ${result.id})`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed creation
      if (createdBy) {
        await this.auditService.logBusinessEvent(
          'TRANSACTION_CREATE_FAILED',
          'TRANSACTION',
          'unknown',
          'CREATE',
          createdBy,
          {
            error: errorMessage,
            transactionData: this.securityService.sanitizeInput(createTransactionDto),
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to create transaction: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  private validateDoubleEntryRules(entries: JournalEntryDto[]) {
    // Rule 1: At least 2 entries
    if (entries.length < 2) {
      throw new BadRequestException('Transaction must have at least 2 entries');
    }

    // Rule 2: Total debits must equal total credits
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debitAmount, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.creditAmount, 0);

    if (totalDebits !== totalCredits) {
      throw new BadRequestException('Total debits must equal total credits');
    }

    // Rule 3: Each entry must have either debit or credit amount, not both
    for (const entry of entries) {
      const hasDebit = entry.debitAmount > 0;
      const hasCredit = entry.creditAmount > 0;

      if (hasDebit && hasCredit) {
        throw new BadRequestException('Each entry must have either debit or credit amount, not both');
      }

      if (!hasDebit && !hasCredit) {
        throw new BadRequestException('Each entry must have either debit or credit amount');
      }
    }
  }

  /**
   * Validate business rules for transactions
   */
  private async validateBusinessRules(entries: JournalEntryDto[], transactionType: string) {
    // Get account types for validation
    const accountIds = entries.map(entry => entry.accountId);
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, type: true, code: true },
    });

    const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

    // Business rule: Validate account types based on transaction type
    for (const entry of entries) {
      const account = accountMap.get(entry.accountId);
      if (!account) {
        throw new BadRequestException(`Account ${entry.accountId} not found`);
      }

      // Example business rules - adjust based on your accounting requirements
      if (transactionType === 'SALES_INVOICE') {
        // Sales invoices should credit revenue accounts and debit cash/accounts receivable
        if (entry.creditAmount > 0 && !account.type.includes('REVENUE')) {
          this.logger.warn(`Credit entry in sales invoice is not to a revenue account: ${account.code}`);
        }
      }

      if (transactionType === 'PURCHASE_INVOICE') {
        // Purchase invoices should debit expense accounts and credit cash/accounts payable
        if (entry.debitAmount > 0 && !account.type.includes('EXPENSE') && !account.type.includes('ASSET')) {
          this.logger.warn(`Debit entry in purchase invoice is not to an expense or asset account: ${account.code}`);
        }
      }
    }
  }

  async findAll(params: TransactionQueryDto) {
    const { skip = 0, take = 10, status, type, startDate, endDate, search } = params;

    const where: {
      status?: string;
      type?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
      OR?: Array<{
        reference?: { contains: string; mode: 'insensitive' };
        description?: { contains: string; mode: 'insensitive' };
      }>;
      entries?: {
        some: {
          accountId?: string;
        };
      };
    } = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {where.createdAt.gte = new Date(startDate);}
      if (endDate) {where.createdAt.lte = new Date(endDate);}
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        include: {
          entries: {
            include: {
              account: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      total,
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async postTransaction(id: string, postedBy: string) {
    this.logger.log(`Posting transaction: ${id}`);

    try {
      // Validate transaction exists
      const transaction = await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          entries: true,
        },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found`);
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        throw new BadRequestException('Transaction is already posted');
      }

      // Business rule: Validate all journal entries are balanced before posting
      const totalDebits = transaction.entries.reduce((sum, entry) => sum + Number(entry.debitAmount), 0);
      const totalCredits = transaction.entries.reduce((sum, entry) => sum + Number(entry.creditAmount), 0);

      if (totalDebits !== totalCredits) {
        throw new BadRequestException('Cannot post unbalanced transaction');
      }

      // Post transaction
      const postedTransaction = await this.prisma.$transaction(async (tx) => {
        return await tx.transaction.update({
          where: { id },
          data: {
            status: TransactionStatus.POSTED,
            postedBy,
            postedAt: new Date(),
          },
        });
      });

      // Log audit event
      await this.auditService.logUpdate(
        'TRANSACTION',
        id,
        { status: transaction.status },
        { status: postedTransaction.status },
        postedBy,
        {
          action: 'POST_TRANSACTION',
          transactionReference: transaction.reference,
          amount: transaction.amount,
        },
      );

      this.logger.log(`Successfully posted transaction: ${transaction.reference} (ID: ${id})`);
      return postedTransaction;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed posting
      if (postedBy) {
        await this.auditService.logBusinessEvent(
          'TRANSACTION_POST_FAILED',
          'TRANSACTION',
          id,
          'POST',
          postedBy,
          {
            error: errorMessage,
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to post transaction: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async cancelTransaction(id: string, cancelledBy: string) {
    this.logger.log(`Cancelling transaction: ${id}`);

    try {
      // Validate transaction exists
      const transaction = await this.prisma.transaction.findUnique({
        where: { id },
      });

      if (!transaction) {
        throw new NotFoundException(`Transaction with ID ${id} not found`);
      }

      if (transaction.status === TransactionStatus.POSTED) {
        throw new BadRequestException('Cannot cancel posted transaction');
      }

      // Cancel transaction
      const cancelledTransaction = await this.prisma.$transaction(async (tx) => {
        return await tx.transaction.update({
          where: { id },
          data: {
            status: TransactionStatus.CANCELLED,
            updatedAt: new Date(),
            updatedBy: cancelledBy,
          },
        });
      });

      // Log audit event
      await this.auditService.logUpdate(
        'TRANSACTION',
        id,
        { status: transaction.status },
        { status: cancelledTransaction.status },
        cancelledBy,
        {
          action: 'CANCEL_TRANSACTION',
          transactionReference: transaction.reference,
          amount: transaction.amount,
        },
      );

      this.logger.log(`Successfully cancelled transaction: ${transaction.reference} (ID: ${id})`);
      return cancelledTransaction;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Log audit event for failed cancellation
      if (cancelledBy) {
        await this.auditService.logBusinessEvent(
          'TRANSACTION_CANCEL_FAILED',
          'TRANSACTION',
          id,
          'CANCEL',
          cancelledBy,
          {
            error: errorMessage,
          },
          'HIGH',
        );
      }

      this.logger.error(`Failed to cancel transaction: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async findByReference(reference: string) {
    return this.prisma.transaction.findUnique({
      where: { reference },
      include: {
        entries: {
          include: {
            account: true,
          },
        },
      },
    });
  }

  async getAccountBalance(accountId: string, asOfDate?: Date) {
    const where: {
      accountId: string;
      transaction?: {
        createdAt?: {
          lte?: Date;
        };
        status?: string;
      };
    } = { accountId };

    if (asOfDate) {
      where.transaction = {
        createdAt: {
          lte: asOfDate,
        },
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        transaction: true,
      },
    });

    const totalDebits = entries.reduce((sum, entry) => sum + Number(entry.debitAmount), 0);
    const totalCredits = entries.reduce((sum, entry) => sum + Number(entry.creditAmount), 0);

    return {
      accountId,
      totalDebits,
      totalCredits,
      balance: totalDebits - totalCredits,
      asOfDate: asOfDate || new Date(),
    };
  }
}