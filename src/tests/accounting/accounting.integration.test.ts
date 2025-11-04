import { expect } from 'chai';
import * as request from 'supertest';
import { BaseIntegrationTest } from '../../shared/testing/integration-setup';
import { AccountingDataFactory } from '../../shared/testing/integration/test-data-factories/accounting-data-factory';
import { AccountType, TransactionType, TransactionStatus } from '../../modules/accounting/enums/accounting.enum';
import { IntegrationTestHelpers } from '../../shared/testing/integration-setup';

describe('Accounting Module Integration Tests', () => {
  let testSetup: BaseIntegrationTest;
  let accountingFactory: AccountingDataFactory;

  // Test data
  let testAccounts: any[] = [];
  let testTransactions: any[] = [];
  let adminToken: string;
  let accountantToken: string;
  let userToken: string;

  before(async () => {
    testSetup = new BaseIntegrationTest();
    await testSetup.setupIntegrationTest();

    accountingFactory = new AccountingDataFactory(testSetup.prisma);
    await accountingFactory.createBaseData();

    // Get test tokens
    adminToken = testSetup.getTestToken('admin');
    accountantToken = testSetup.getTestToken('accountant');
    userToken = testSetup.getTestToken('user');

    // Get test accounts
    testAccounts = await accountingFactory.getChartOfAccounts();
  });

  after(async () => {
    await testSetup.cleanupIntegrationTest();
  });

  beforeEach(async () => {
    // Create fresh test transactions
    testTransactions = [];
    for (let i = 0; i < 3; i++) {
      const transaction = await accountingFactory.createTransactionWithEntries();
      testTransactions.push(transaction);
    }
  });

  afterEach(async () => {
    // Clean up test transactions
    await testSetup.databaseCleanup.cleanupAllTestData();
  });

  describe('Chart of Accounts Management', () => {
    describe('POST /accounting/chart-of-accounts', () => {
      it('should create a new chart of accounts entry as admin', async () => {
        const newAccount = {
          accountCode: '6000',
          accountName: 'Test Revenue Account',
          accountType: AccountType.REVENUE,
          openingBalance: 1000.00,
          description: 'Test revenue account for integration testing'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(newAccount)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.accountCode).to.equal(newAccount.accountCode);
        expect(response.body.data.accountName).to.equal(newAccount.accountName);
        expect(response.body.data.accountType).to.equal(newAccount.accountType);
        expect(response.body.data.openingBalance).to.equal(newAccount.openingBalance);
        expect(response.body).to.have.property('correlationId');
      });

      it('should create chart of accounts entry as accountant', async () => {
        const newAccount = {
          accountCode: '6001',
          accountName: 'Test Expense Account',
          accountType: AccountType.EXPENSE,
          openingBalance: 500.00,
          description: 'Test expense account for integration testing'
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${accountantToken}`)
          .send(newAccount)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.accountName).to.equal(newAccount.accountName);
      });

      it('should reject chart of accounts creation as regular user', async () => {
        const newAccount = {
          accountCode: '6002',
          accountName: 'Unauthorized Account',
          accountType: AccountType.EXPENSE,
          openingBalance: 100.00
        };

        await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${userToken}`)
          .send(newAccount)
          .expect(403);
      });

      it('should validate required fields', async () => {
        const invalidAccount = {
          accountName: 'Invalid Account'
          // Missing required fields
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invalidAccount)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body).to.have.property('message');
      });
    });

    describe('GET /accounting/chart-of-accounts', () => {
      it('should retrieve all chart of accounts entries', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.greaterThan(0);

        // Verify account structure
        const account = response.body.data[0];
        expect(account).to.have.property('id');
        expect(account).to.have.property('accountCode');
        expect(account).to.have.property('accountName');
        expect(account).to.have.property('accountType');
        expect(account).to.have.property('openingBalance');
      });

      it('should filter chart of accounts by type', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/chart-of-accounts')
          .query({ accountType: AccountType.ASSET })
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');

        // All returned accounts should be assets
        response.body.data.forEach((account: any) => {
          expect(account.accountType).to.equal(AccountType.ASSET);
        });
      });

      it('should paginate chart of accounts results', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/chart-of-accounts')
          .query({ page: 1, limit: 5 })
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.lessThanOrEqual(5);
        expect(response.body).to.have.property('pagination');
        expect(response.body.pagination).to.have.property('page', 1);
        expect(response.body.pagination).to.have.property('limit', 5);
      });
    });

    describe('PUT /accounting/chart-of-accounts/:id', () => {
      it('should update chart of accounts entry', async () => {
        const accountToUpdate = testAccounts[0];
        const updateData = {
          accountName: 'Updated Account Name',
          description: 'Updated description for testing'
        };

        const response = await request(testSetup.getHttpServer())
          .put(`/api/v1/accounting/chart-of-accounts/${accountToUpdate.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.accountName).to.equal(updateData.accountName);
        expect(response.body.data.description).to.equal(updateData.description);
      });

      it('should reject update as regular user', async () => {
        const accountToUpdate = testAccounts[0];
        const updateData = {
          accountName: 'Unauthorized Update'
        };

        await request(testSetup.getHttpServer())
          .put(`/api/v1/accounting/chart-of-accounts/${accountToUpdate.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(updateData)
          .expect(403);
      });
    });
  });

  describe('Transaction Management', () => {
    describe('POST /accounting/transactions', () => {
      it('should create a new journal entry transaction', async () => {
        const debitAccount = testAccounts.find(acc => acc.accountType === AccountType.ASSET);
        const creditAccount = testAccounts.find(acc => acc.accountType === AccountType.LIABILITY);

        const transactionData = {
          reference: IntegrationTestHelpers.generateReference('TX'),
          description: 'Test journal entry transaction',
          date: new Date().toISOString(),
          amount: 1500.00,
          type: TransactionType.JOURNAL_ENTRY,
          entries: [
            {
              accountId: debitAccount.id,
              debitAmount: 1500.00,
              creditAmount: 0,
              description: 'Debit entry'
            },
            {
              accountId: creditAccount.id,
              debitAmount: 0,
              creditAmount: 1500.00,
              description: 'Credit entry'
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/transactions')
          .set('Authorization', `Bearer ${accountantToken}`)
          .send(transactionData)
          .expect(201);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id');
        expect(response.body.data.reference).to.equal(transactionData.reference);
        expect(response.body.data.amount).to.equal(transactionData.amount);
        expect(response.body.data.entries).to.be.an('array').with.lengthOf(2);
        expect(response.body).to.have.property('correlationId');
      });

      it('should enforce double-entry bookkeeping', async () => {
        const debitAccount = testAccounts.find(acc => acc.accountType === AccountType.ASSET);

        // Create invalid transaction (unbalanced entries)
        const invalidTransaction = {
          reference: IntegrationTestHelpers.generateReference('TX'),
          description: 'Invalid unbalanced transaction',
          date: new Date().toISOString(),
          amount: 1000.00,
          type: TransactionType.JOURNAL_ENTRY,
          entries: [
            {
              accountId: debitAccount.id,
              debitAmount: 1000.00,
              creditAmount: 0,
              description: 'Debit entry only'
            }
          ]
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/transactions')
          .set('Authorization', `Bearer ${accountantToken}`)
          .send(invalidTransaction)
          .expect(400);

        expect(response.body).to.have.property('success', false);
        expect(response.body.message).to.include('balanced');
      });

      it('should validate transaction amounts', async () => {
        const invalidTransaction = {
          reference: IntegrationTestHelpers.generateReference('TX'),
          description: 'Invalid amount transaction',
          date: new Date().toISOString(),
          amount: -100.00, // Negative amount
          type: TransactionType.JOURNAL_ENTRY,
          entries: []
        };

        const response = await request(testSetup.getHttpServer())
          .post('/api/v1/accounting/transactions')
          .set('Authorization', `Bearer ${accountantToken}`)
          .send(invalidTransaction)
          .expect(400);

        expect(response.body).to.have.property('success', false);
      });
    });

    describe('GET /accounting/transactions', () => {
      it('should retrieve all transactions', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/transactions')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
        expect(response.body.data.length).to.be.greaterThanOrEqual(testTransactions.length);

        // Verify transaction structure
        const transaction = response.body.data[0];
        expect(transaction).to.have.property('id');
        expect(transaction).to.have.property('reference');
        expect(transaction).to.have.property('amount');
        expect(transaction).to.have.property('type');
        expect(transaction).to.have.property('status');
        expect(transaction).to.have.property('entries');
      });

      it('should filter transactions by type', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/transactions')
          .query({ type: TransactionType.JOURNAL_ENTRY })
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');

        // All returned transactions should be journal entries
        response.body.data.forEach((transaction: any) => {
          expect(transaction.type).to.equal(TransactionType.JOURNAL_ENTRY);
        });
      });

      it('should filter transactions by date range', async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/transactions')
          .query({
            startDate: yesterday.toISOString(),
            endDate: today.toISOString()
          })
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.be.an('array');
      });
    });

    describe('GET /accounting/transactions/:id', () => {
      it('should retrieve specific transaction with entries', async () => {
        const transaction = testTransactions[0];

        const response = await request(testSetup.getHttpServer())
          .get(`/api/v1/accounting/transactions/${transaction.id}`)
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('id', transaction.id);
        expect(response.body.data).to.have.property('entries');
        expect(response.body.data.entries).to.be.an('array');
        expect(response.body.data.entries.length).to.be.greaterThan(0);
      });

      it('should return 404 for non-existent transaction', async () => {
        const nonExistentId = 'non-existent-transaction-id';

        await request(testSetup.getHttpServer())
          .get(`/api/v1/accounting/transactions/${nonExistentId}`)
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(404);
      });
    });
  });

  describe('Financial Reporting', () => {
    describe('GET /accounting/reports/trial-balance', () => {
      it('should generate trial balance report', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/reports/trial-balance')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('trialBalance');
        expect(response.body.data.trialBalance).to.be.an('array');
        expect(response.body.data).to.have.property('totalDebits');
        expect(response.body.data).to.have.property('totalCredits');
        expect(response.body.data).to.have.property('isBalanced');

        // Trial balance should be balanced
        expect(response.body.data.isBalanced).to.be.true;
      });
    });

    describe('GET /accounting/reports/balance-sheet', () => {
      it('should generate balance sheet report', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/reports/balance-sheet')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('assets');
        expect(response.body.data).to.have.property('liabilities');
        expect(response.body.data).to.have.property('equity');
        expect(response.body.data).to.have.property('totalAssets');
        expect(response.body.data).to.have.property('totalLiabilities');
        expect(response.body.data).to.have.property('totalEquity');

        // Balance sheet should balance
        const totalAssets = response.body.data.totalAssets;
        const totalLiabilitiesAndEquity = response.body.data.totalLiabilities + response.body.data.totalEquity;
        expect(Math.abs(totalAssets - totalLiabilitiesAndEquity)).to.be.lessThan(0.01);
      });
    });

    describe('GET /accounting/reports/income-statement', () => {
      it('should generate income statement report', async () => {
        const response = await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/reports/income-statement')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('revenue');
        expect(response.body.data).to.have.property('expenses');
        expect(response.body.data).to.have.property('totalRevenue');
        expect(response.body.data).to.have.property('totalExpenses');
        expect(response.body.data).to.have.property('netIncome');
        expect(response.body.data).to.have.property('period');
      });
    });
  });

  describe('Transaction Workflows', () => {
    describe('POST /accounting/transactions/:id/post', () => {
      it('should post a draft transaction', async () => {
        // Create a draft transaction first
        const draftTransaction = await accountingFactory.createTransactionWithEntries({
          status: TransactionStatus.PENDING
        });

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/accounting/transactions/${draftTransaction.id}/post`)
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data.status).to.equal(TransactionStatus.POSTED);
      });

      it('should reject posting as regular user', async () => {
        const draftTransaction = await accountingFactory.createTransactionWithEntries({
          status: TransactionStatus.PENDING
        });

        await request(testSetup.getHttpServer())
          .post(`/api/v1/accounting/transactions/${draftTransaction.id}/post`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });
    });

    describe('POST /accounting/transactions/:id/reverse', () => {
      it('should reverse a posted transaction', async () => {
        const postedTransaction = testTransactions[0];

        const response = await request(testSetup.getHttpServer())
          .post(`/api/v1/accounting/transactions/${postedTransaction.id}/reverse`)
          .set('Authorization', `Bearer ${accountantToken}`)
          .send({ reason: 'Test reversal' })
          .expect(200);

        expect(response.body).to.have.property('success', true);
        expect(response.body.data).to.have.property('reversalTransaction');
        expect(response.body.data.reversalTransaction.reference).to.include('REV');
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(testSetup.getHttpServer())
        .get('/api/v1/accounting/chart-of-accounts')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(testSetup.getHttpServer())
        .get('/api/v1/accounting/chart-of-accounts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should include correlation ID in all responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/accounting/chart-of-accounts')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(200);

      expect(response.headers).to.have.property('x-correlation-id');
      expect(response.body).to.have.property('correlationId');
    });

    it('should sanitize error responses', async () => {
      const response = await request(testSetup.getHttpServer())
        .get('/api/v1/accounting/transactions/invalid-id')
        .set('Authorization', `Bearer ${accountantToken}`)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('message');
      expect(response.body).to.have.property('correlationId');
      // Should not contain stack traces or internal details
      expect(response.body.message).to.not.include('prisma');
      expect(response.body.message).to.not.include('sql');
    });
  });

  describe('Performance Tests', () => {
    it('should respond to chart of accounts requests within acceptable time', async () => {
      const { result, executionTime } = await IntegrationTestHelpers.measureExecutionTime(async () => {
        return await request(testSetup.getHttpServer())
          .get('/api/v1/accounting/chart-of-accounts')
          .set('Authorization', `Bearer ${accountantToken}`)
          .expect(200);
      });

      expect(executionTime).to.be.lessThan(1000); // Less than 1 second
      expect(result.body).to.have.property('success', true);
    });

    it('should handle concurrent transaction creation', async () => {
      const concurrentRequests = Array(5).fill(null).map(() =>
        request(testSetup.getHttpServer())
          .post('/api/v1/accounting/transactions')
          .set('Authorization', `Bearer ${accountantToken}`)
          .send({
            reference: IntegrationTestHelpers.generateReference('CONCURRENT'),
            description: 'Concurrent test transaction',
            date: new Date().toISOString(),
            amount: 1000.00,
            type: TransactionType.JOURNAL_ENTRY,
            entries: [
              {
                accountId: testAccounts[0].id,
                debitAmount: 1000.00,
                creditAmount: 0
              },
              {
                accountId: testAccounts[1].id,
                debitAmount: 0,
                creditAmount: 1000.00
              }
            ]
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(201);
        expect(response.body).to.have.property('success', true);
      });

      // All transactions should have unique references
      const references = responses.map(r => r.body.data.reference);
      const uniqueReferences = new Set(references);
      expect(uniqueReferences.size).to.equal(references.length);
    });
  });
});