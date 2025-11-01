import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateTransactionDto, JournalEntryDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionStatus } from './enums/accounting.enum';

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTransactionDto: CreateTransactionDto, createdBy: string) {
    const { reference, description, amount, type, entries, date, currency } = createTransactionDto;

    // Validate accounts exist
    const accountIds = entries.map(entry => entry.accountId);
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: accountIds } },
    });

    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more accounts not found');
    }

    // Validate double-entry bookkeeping rules
    this.validateDoubleEntryRules(entries);

    // Create transaction with journal entries in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          reference,
          description,
          amount,
          currency: currency || 'USD',
          type,
          date: date || new Date(),
          status: TransactionStatus.POSTED, // Auto-post for now
          createdBy,
          postedBy: createdBy,
          postedAt: new Date(),
        },
      });

      // Create journal entries
      const journalEntries = await Promise.all(
        entries.map(entry =>
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
    }).catch((error) => {
      // Handle unique constraint violation
      if (error.code === 'P2002' && error.meta?.target?.includes('reference')) {
        throw new BadRequestException('Transaction reference already exists');
      }
      throw error;
    });

    return result;
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
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is already posted');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.POSTED,
        postedBy,
        postedAt: new Date(),
      },
    });
  }

  async cancelTransaction(id: string, cancelledBy: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.status === TransactionStatus.POSTED) {
      throw new BadRequestException('Cannot cancel posted transaction');
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.CANCELLED,
        updatedBy: cancelledBy,
      },
    });
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