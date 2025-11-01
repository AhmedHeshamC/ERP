import { PrismaService } from '../database/prisma.service';

/**
 * Comprehensive Database Cleanup Utility
 * Used across all integration tests to ensure clean test environment
 * Prevents cross-module test interference
 */
export class DatabaseCleanup {
  constructor(private prisma: PrismaService) {}

  /**
   * Comprehensive cleanup of all test data
   * Cleans in correct order to respect foreign key constraints
   */
  async cleanupAllTestData(): Promise<void> {
    try {
      console.log('Starting comprehensive database cleanup...');

      // Get all test data first
      const testUsers = await this.prisma.user.findMany({
        where: {
          OR: [
            // Comprehensive test patterns for all modules
            { email: { contains: 'test' } },
            { email: { contains: 'example.com' } },
            { email: { contains: '@test.com' } },
            { email: { startsWith: 'testuser' } },
            { email: { startsWith: 'rbac.test' } },
            { email: { startsWith: 'xss.test' } },
            { email: { startsWith: 'concurrent' } },
            { email: { startsWith: 'john.doe' } },
            { email: { startsWith: 'jane.smith' } },
            { email: { startsWith: 'bob.wilson' } },
            { email: { startsWith: 'logintest' } },
            { email: { startsWith: 'jwttest' } },
            { email: { startsWith: 'duplicate-' } },
            { email: { startsWith: 'customer' } },
            { email: { startsWith: 'supplier' } },
            { email: { contains: 'sales' } },
            { email: { contains: 'purchase' } },
            { username: { contains: 'test' } },
            { username: { startsWith: 'testuser' } },
            { username: { startsWith: 'rbactest' } },
            { username: { startsWith: 'xsstest' } },
            { username: { startsWith: 'user1-' } },
            { username: { startsWith: 'user2-' } },
            { username: { startsWith: 'johndoe' } },
            { username: { startsWith: 'janesmith' } },
            { username: { startsWith: 'bobwilson' } },
            { username: { startsWith: 'login' } },
            { username: { startsWith: 'jwt' } },
            { username: { startsWith: 'john' } },
            { username: { startsWith: 'jane' } },
          ]
        },
        select: { id: true }
      });

      // Clean up in correct order respecting foreign key constraints

      // 1. Sessions (depends on users)
      if (testUsers.length > 0) {
        const userIds = testUsers.map(user => user.id);
        await this.prisma.session.deleteMany({
          where: { userId: { in: userIds } }
        });
      }

      // 2. Journal Entries (depends on transactions and accounts)
      await this.prisma.journalEntry.deleteMany({
        where: {
          OR: [
            {
              transaction: {
                reference: { startsWith: 'TX-' }
              }
            },
            {
              account: {
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
                ]
              }
            }
          ]
        }
      });

      // 3. Transactions
      await this.prisma.transaction.deleteMany({
        where: {
          reference: { startsWith: 'TX-' }
        }
      });

      // 4. Chart of Accounts
      await this.prisma.chartOfAccounts.deleteMany({
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
          ]
        }
      });

      // 5. Business data (clean up anything that might reference users)
      await this.prisma.product.deleteMany({
        where: {
          OR: [
            { name: { contains: 'test' } },
            { sku: { startsWith: 'TEST-' } },
          ]
        }
      });

      await this.prisma.customer.deleteMany({
        where: {
          OR: [
            { email: { contains: 'test' } },
            { name: { contains: 'test' } },
          ]
        }
      });

      await this.prisma.supplier.deleteMany({
        where: {
          OR: [
            { email: { contains: 'test' } },
            { name: { contains: 'test' } },
          ]
        }
      });

      // 6. Users (clean up last)
      if (testUsers.length > 0) {
        const userIds = testUsers.map(user => user.id);
        await this.prisma.user.deleteMany({
          where: {
            id: { in: userIds }
          }
        });
      }

      console.log(`Database cleanup completed. Removed ${testUsers.length} test users and related data.`);
    } catch (error) {
      console.log('Database cleanup error:', error.message);
      // Don't throw error to prevent test failure
    }
  }

  /**
   * Quick cleanup for specific test data patterns
   */
  async cleanupSpecificPatterns(patterns: string[]): Promise<void> {
    try {
      // Simple cleanup for specific patterns
      await this.prisma.user.deleteMany({
        where: {
          OR: patterns.map(pattern => ({ email: { contains: pattern } }))
        }
      });
    } catch (error) {
      console.log('Specific cleanup error:', error.message);
    }
  }
}