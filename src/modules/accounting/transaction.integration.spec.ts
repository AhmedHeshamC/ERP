import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { expect } from 'chai';
import * as request from 'supertest';
import { TransactionService } from './transaction.service';
import { TransactionType } from './enums/accounting.enum';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PrismaModule } from '../../shared/database/prisma.module';
import { setupIntegrationTest, cleanupIntegrationTest, cleanupDatabase } from '../../../test/integration-setup';
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
        reference: `TX-${Date.now()}`,
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
        reference: `INVALID-TX-${Date.now()}`,
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
        expect(error.message).to.include('not found');
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
        reference: `CONSISTENCY-TX-${Date.now()}`,
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
      journalEntries.forEach(entry => {
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

  /**
   * Helper function to clean up test data
   */
  async function cleanupTestData(): Promise<void> {
    try {
      // Clean up in reverse order to respect foreign key constraints
      await prismaService.journalEntry.deleteMany({});
      await prismaService.transaction.deleteMany({});
      await prismaService.chartOfAccounts.deleteMany({
        where: {
          id: {
            startsWith: 'test-account-',
          },
        },
      });
    } catch (error) {
      // Ignore cleanup errors
      console.log('Cleanup error:', error.message);
    }
  }
});