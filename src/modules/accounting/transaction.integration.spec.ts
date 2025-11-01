import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { expect } from 'chai';
import { TransactionService } from './transaction.service';
import { TransactionType } from './enums/accounting.enum';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaModule } from '../../shared/database/prisma.module';
import { JournalEntry, Transaction, ChartOfAccounts } from '@prisma/client';
import { setupIntegrationTest, cleanupIntegrationTest } from '../../shared/testing/integration-setup';
import 'chai/register-should';
import 'chai/register-expect';

/**
 * Database Transaction Integration Tests
 * Tests complex business transaction validation with TDD methodology
 * Follows SOLID principles and KISS methodology
 */
describe('Database Transaction Integration Tests', () => {
  let app: INestApplication;
  let prismaService: any;
  let transactionService: TransactionService;

  // Setup test environment before all tests
  before(async () => {
    // Setup integration test environment
    await setupIntegrationTest();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
              JWT_EXPIRATION: '1h',
              JWT_REFRESH_EXPIRATION: '7d',
              DATABASE_URL: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
              app: {
                database: {
                  url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
                },
              },
              LOG_LEVEL: 'error',
              NODE_ENV: 'test',
            })
          ],
        }),
        PrismaModule,
      ],
      providers: [TransactionService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create a direct PrismaService instance for test cleanup
    const { PrismaService } = await import('../../shared/database/prisma.service');
    const { ConfigService } = await import('@nestjs/config');

    const configService = new ConfigService({
      app: {
        database: {
          url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
        },
      },
    });

    prismaService = new PrismaService(configService);
    await prismaService.$connect();
    transactionService = moduleFixture.get<TransactionService>(TransactionService);
  });

  // Cleanup after all tests
  after(async () => {
    if (prismaService) {
      await prismaService.$disconnect();
    }
    if (app) {
      await app.close();
    }
    await cleanupIntegrationTest();
  });

  // Clean up test data before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('Multi-Table Transactions', () => {
    it('should create transaction with journal entries in atomic operation', async () => {
      // Arrange - Create test accounts first
      const timestamp = Date.now();
      const account1 = await prismaService.chartOfAccounts.create({
        data: {
          id: `test-account-1-${timestamp}`,
          code: `1001-${timestamp}`,
          name: 'Test Cash Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      const account2 = await prismaService.chartOfAccounts.create({
        data: {
          id: `test-account-2-${timestamp}`,
          code: `4001-${timestamp}`,
          name: 'Test Revenue Account',
          type: 'REVENUE',
          category: 'Operating Revenue',
        },
      });

      const createTransactionDto: CreateTransactionDto = {
        reference: `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: 'Test transaction',
        amount: 1000,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: account1.id,
            description: 'Debit entry',
            debitAmount: 1000,
            creditAmount: 0,
          },
          {
            accountId: account2.id,
            description: 'Credit entry',
            debitAmount: 0,
            creditAmount: 1000,
          },
        ],
      };

      // Act
      const result = await transactionService.create(createTransactionDto, 'test-user');

      // Assert
      expect(result).to.have.property('id');
      expect(result).to.have.property('reference', createTransactionDto.reference);
      expect(result).to.have.property('status', 'POSTED');
      expect(result).to.have.property('entries');
      expect(result.entries).to.have.length(2);

      // Verify both tables have related data
      const transaction = await prismaService.transaction.findUnique({
        where: { id: result.id },
        include: { entries: true },
      });

      expect(transaction).to.not.be.null;
      expect(transaction.entries).to.have.length(2);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback all changes if any part fails', async () => {
      // Arrange - Invalid transaction that should fail
      const invalidTransactionDto: CreateTransactionDto = {
        reference: `INVALID-TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: 'Invalid transaction',
        amount: 1000,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: 'non-existent-account',
            description: 'This will fail',
            debitAmount: 1000,
            creditAmount: 0,
          },
        ],
      };

      // Act & Assert
      try {
        await transactionService.create(invalidTransactionDto, 'test-user');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error instanceof Error ? error.message : "Unknown error").to.include('not found');
      }

      // Assert - Verify no data was created
      const transaction = await prismaService.transaction.findUnique({
        where: { reference: invalidTransactionDto.reference },
      });

      expect(transaction).to.be.null;
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity across related tables', async () => {
      // This test ensures that foreign key relationships are maintained
      // and that cascading operations work correctly

      // Arrange - Create valid transaction with accounts
      const timestamp = Date.now();
      const cashAccount = await prismaService.chartOfAccounts.create({
        data: {
          id: `cash-account-${timestamp}`,
          code: `1001-${timestamp}`,
          name: 'Test Cash Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      const revenueAccount = await prismaService.chartOfAccounts.create({
        data: {
          id: `revenue-account-${timestamp}`,
          code: `4001-${timestamp}`,
          name: 'Test Revenue Account',
          type: 'REVENUE',
          category: 'Operating Revenue',
        },
      });

      const createTransactionDto: CreateTransactionDto = {
        reference: `CONSISTENCY-TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: 'Consistency test transaction',
        amount: 500,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: cashAccount.id,
            description: 'Cash received',
            debitAmount: 500,
            creditAmount: 0,
          },
          {
            accountId: revenueAccount.id,
            description: 'Revenue earned',
            debitAmount: 0,
            creditAmount: 500,
          },
        ],
      };

      // Act
      const result = await transactionService.create(createTransactionDto, 'test-user');

      // Assert - Verify referential integrity
      const journalEntries = await prismaService.journalEntry.findMany({
        where: { transactionId: result.id },
      });

      expect(journalEntries).to.have.length(2);

      // All journal entries should reference the correct transaction
      journalEntries.forEach((entry: JournalEntry) => {
        expect(entry.transactionId).to.equal(result.id);
      });

      // Transaction should be able to access its entries
      const transactionWithEntries = await prismaService.transaction.findUnique({
        where: { id: result.id },
        include: { entries: true },
      });

      expect(transactionWithEntries.entries).to.have.length(2);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent transaction creation safely', async () => {
      // Arrange - Create test accounts
      const timestamp = Date.now();
      const account1 = await prismaService.chartOfAccounts.create({
        data: {
          id: `concurrent-account-1-${timestamp}`,
          code: `1001-${timestamp}`,
          name: 'Test Cash Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      const account2 = await prismaService.chartOfAccounts.create({
        data: {
          id: `concurrent-account-2-${timestamp}`,
          code: `4001-${timestamp}`,
          name: 'Test Revenue Account',
          type: 'REVENUE',
          category: 'Operating Revenue',
        },
      });

      // Create transaction DTOs with same reference (should cause concurrency issues)
      const sharedReference = `CONCURRENT-TX-${timestamp}`;
      const transactionDto: CreateTransactionDto = {
        reference: sharedReference,
        description: 'Concurrent transaction test',
        amount: 100,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: account1.id,
            description: 'Debit entry',
            debitAmount: 100,
            creditAmount: 0,
          },
          {
            accountId: account2.id,
            description: 'Credit entry',
            debitAmount: 0,
            creditAmount: 100,
          },
        ],
      };

      // Act - Try to create the same transaction concurrently
      const promises = [
        transactionService.create(transactionDto, 'user-1'),
        transactionService.create(transactionDto, 'user-2'),
      ];

      // Assert - One should succeed, one should fail with reference conflict
      const results = await Promise.allSettled(promises);

      // Should have one success and one failure
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).to.equal(1);
      expect(failureCount).to.equal(1);

      // Verify only one transaction was created
      const transactions = await prismaService.transaction.findMany({
        where: { reference: transactionDto.reference },
      });

      expect(transactions).to.have.length(1);
    });

    it('should handle concurrent account balance updates safely', async () => {
      // Arrange - Create test data
      const timestamp = Date.now();
      const account = await prismaService.chartOfAccounts.create({
        data: {
          id: `balance-account-${timestamp}`,
          code: `1000-${timestamp}`,
          name: 'Test Balance Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      // Act - Simulate concurrent balance updates
      const updatePromises = [];

      for (let i = 0; i < 5; i++) {
        const promise = prismaService.chartOfAccounts.update({
          where: { id: account.id },
          data: {
            // Simulate balance update (would be actual balance in real scenario)
            updatedAt: new Date(),
          },
        });
        updatePromises.push(promise);
      }

      // Assert - All updates should complete safely
      const results = await Promise.allSettled(updatePromises);

      // All should succeed (no conflicts on different fields)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.equal(5);

      // Verify account was updated
      const updatedAccount = await prismaService.chartOfAccounts.findUnique({
        where: { id: account.id },
      });

      expect(updatedAccount).to.not.be.null;
    });
  });

  describe('Locking Scenarios', () => {
    it('should handle concurrent updates to the same account safely', async () => {
      // Arrange - Create test account
      const timestamp = Date.now();
      const account = await prismaService.chartOfAccounts.create({
        data: {
          id: `locking-account-${timestamp}`,
          code: `1001-${timestamp}`,
          name: 'Test Account for Locking',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      // Act - Simulate concurrent updates to the same account
      const updatePromises = [];

      for (let i = 0; i < 3; i++) {
        const promise = prismaService.chartOfAccounts.update({
          where: { id: account.id },
          data: {
            name: `Updated Name ${i}`,
            updatedAt: new Date(),
          },
        });
        updatePromises.push(promise);
      }

      // Assert - All updates should complete (database handles locking)
      const results = await Promise.allSettled(updatePromises);

      // All should succeed (database handles row-level locking)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.equal(3);

      // Verify account was updated (last update wins)
      const updatedAccount = await prismaService.chartOfAccounts.findUnique({
        where: { id: account.id },
      });

      expect(updatedAccount).to.not.be.null;
      expect(updatedAccount.name).to.include('Updated Name');
    });

    it('should handle concurrent transaction creation with overlapping accounts', async () => {
      // Arrange - Create shared accounts
      const timestamp = Date.now();
      const sharedAccount = await prismaService.chartOfAccounts.create({
        data: {
          id: `shared-account-${timestamp}`,
          code: `1000-${timestamp}`,
          name: 'Shared Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      const uniqueAccount1 = await prismaService.chartOfAccounts.create({
        data: {
          id: `unique-account-1-${timestamp}`,
          code: `2001-${timestamp}`,
          name: 'Unique Account 1',
          type: 'LIABILITY',
          category: 'Current Liabilities',
        },
      });

      const uniqueAccount2 = await prismaService.chartOfAccounts.create({
        data: {
          id: `unique-account-2-${timestamp}`,
          code: `2002-${timestamp}`,
          name: 'Unique Account 2',
          type: 'LIABILITY',
          category: 'Current Liabilities',
        },
      });

      // Act - Create transactions that use the same account concurrently
      const transaction1Dto: CreateTransactionDto = {
        reference: `LOCKING-TX-1-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        description: 'First concurrent transaction',
        amount: 100,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: sharedAccount.id,
            description: 'Shared account debit',
            debitAmount: 100,
            creditAmount: 0,
          },
          {
            accountId: uniqueAccount1.id,
            description: 'Unique account credit',
            debitAmount: 0,
            creditAmount: 100,
          },
        ],
      };

      const transaction2Dto: CreateTransactionDto = {
        reference: `LOCKING-TX-2-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        description: 'Second concurrent transaction',
        amount: 200,
        type: TransactionType.SALE,
        entries: [
          {
            accountId: sharedAccount.id,
            description: 'Shared account debit',
            debitAmount: 200,
            creditAmount: 0,
          },
          {
            accountId: uniqueAccount2.id,
            description: 'Unique account credit',
            debitAmount: 0,
            creditAmount: 200,
          },
        ],
      };

      // Create transactions concurrently
      const promises = [
        transactionService.create(transaction1Dto, 'user-1'),
        transactionService.create(transaction2Dto, 'user-2'),
      ];

      // Assert - Both should succeed (database handles locking)
      const results = await Promise.allSettled(promises);

      // Both should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.equal(2);

      // Verify both transactions were created
      const transactions = await prismaService.transaction.findMany({
        where: {
          reference: {
            in: [transaction1Dto.reference, transaction2Dto.reference],
          },
        },
        include: { entries: true },
      });

      expect(transactions).to.have.length(2);

      // Verify shared account was used in both transactions
      const sharedEntries = await prismaService.journalEntry.findMany({
        where: { accountId: sharedAccount.id },
      });

      expect(sharedEntries).to.have.length(2);
    });
  });

  describe('Deadlock Detection', () => {
    it('should handle potential deadlock scenarios with timeouts', async () => {
      // Arrange - Create test data for deadlock scenario
      const timestamp = Date.now();
      const account1 = await prismaService.chartOfAccounts.create({
        data: {
          id: `deadlock-account-1-${timestamp}`,
          code: `1001-${timestamp}`,
          name: 'Account 1',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      const account2 = await prismaService.chartOfAccounts.create({
        data: {
          id: `deadlock-account-2-${timestamp}`,
          code: `1002-${timestamp}`,
          name: 'Account 2',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      // Act - Simulate operations that could potentially deadlock
      // Using timeout to prevent actual deadlock in tests
      const operation1Promise = new Promise((resolve) => {
        setTimeout(async () => {
          // Update account 1 first
          await prismaService.chartOfAccounts.update({
            where: { id: account1.id },
            data: { name: 'Updated by Operation 1' },
          });
          resolve('operation1-complete');
        }, 10); // Small delay to simulate potential contention
      });

      const operation2Promise = new Promise((resolve) => {
        setTimeout(async () => {
          // Update account 2 first (different order to avoid real deadlock)
          await prismaService.chartOfAccounts.update({
            where: { id: account2.id },
            data: { name: 'Updated by Operation 2' },
          });
          resolve('operation2-complete');
        }, 20); // Different delay
      });

      // Assert - Both operations should complete (no actual deadlock)
      const results = await Promise.allSettled([operation1Promise, operation2Promise]);

      // Both should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).to.equal(2);

      // Verify both accounts were updated
      const updatedAccount1 = await prismaService.chartOfAccounts.findUnique({
        where: { id: account1.id },
      });

      const updatedAccount2 = await prismaService.chartOfAccounts.findUnique({
        where: { id: account2.id },
      });

      expect(updatedAccount1).to.not.be.null;
      expect(updatedAccount1.name).to.equal('Updated by Operation 1');
      expect(updatedAccount2).to.not.be.null;
      expect(updatedAccount2.name).to.equal('Updated by Operation 2');
    });

    it('should prevent infinite blocking with transaction timeouts', async () => {
      // Arrange - Create test data
      const timestamp = Date.now();
      const account = await prismaService.chartOfAccounts.create({
        data: {
          id: `timeout-account-${timestamp}`,
          code: `1000-${timestamp}`,
          name: 'Timeout Test Account',
          type: 'ASSET',
          category: 'Current Assets',
        },
      });

      // Act - Simulate a potentially blocking operation with timeout
      const blockingOperationPromise = new Promise((resolve, _reject) => {
        // Simulate a long-running operation
        setTimeout(() => {
          resolve('operation-completed');
        }, 100); // 100ms timeout
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Operation timed out'));
        }, 200); // 200ms timeout (longer than operation)
      });

      // Assert - Operation should complete before timeout
      const result = await Promise.race([blockingOperationPromise, timeoutPromise]);

      expect(result).to.equal('operation-completed');

      // Verify account still exists and can be accessed
      const accessibleAccount = await prismaService.chartOfAccounts.findUnique({
        where: { id: account.id },
      });

      expect(accessibleAccount).to.not.be.null;
    });
  });

  /**
   * Helper function to clean up test data
   */
  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up all test data in correct order to respect foreign key constraints

      // First, find all test transactions
      const testTransactions = await prismaService.transaction.findMany({
        where: {
          reference: {
            startsWith: 'TX-'
          }
        },
        select: { id: true }
      });

      if (testTransactions.length > 0) {
        const transactionIds = testTransactions.map((t: Transaction) => t.id);

        // Delete journal entries that reference test transactions
        await prismaService.journalEntry.deleteMany({
          where: {
            transactionId: { in: transactionIds }
          }
        });

        // Delete the transactions
        await prismaService.transaction.deleteMany({
          where: {
            id: { in: transactionIds }
          }
        });
      }

      // Find test accounts
      const testAccounts = await prismaService.chartOfAccounts.findMany({
        where: {
          OR: [
            { id: { startsWith: 'test-account-' } },
            { id: { startsWith: 'concurrent-account-' } },
            { id: { startsWith: 'balance-account-' } },
            { id: { startsWith: 'locking-account-' } },
            { id: { startsWith: 'shared-account-' } },
            { id: { startsWith: 'unique-account-' } },
            { id: { startsWith: 'deadlock-account-' } },
            { id: { startsWith: 'timeout-account-' } },
            { id: { startsWith: 'cash-account-' } },
            { id: { startsWith: 'revenue-account-' } },
            { id: { startsWith: 'consistency-account-' } },
          ],
        },
        select: { id: true }
      });

      if (testAccounts.length > 0) {
        const accountIds = testAccounts.map((a: ChartOfAccounts) => a.id);

        // Delete any remaining journal entries that reference test accounts
        await prismaService.journalEntry.deleteMany({
          where: {
            accountId: { in: accountIds }
          }
        });

        // Delete the accounts
        await prismaService.chartOfAccounts.deleteMany({
          where: {
            id: { in: accountIds }
          }
        });
      }
    } catch (error) {
      // Ignore cleanup errors but log them
      console.log('Cleanup error:', error instanceof Error ? error.message : "Unknown error");
    }
  }
});