/**
 * Integration Test Configuration
 * Sets up the test environment for integration tests
 */

import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../src/shared/database/prisma.service';

// Test environment configuration
export const integrationTestConfig = {
  DATABASE_URL: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db',
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-key-for-integration-tests',
  JWT_EXPIRATION: '1h',
  JWT_REFRESH_EXPIRATION: '7d',
  LOG_LEVEL: 'error', // Minimal logging during tests
};

// Integration test setup helper
export async function setupIntegrationTest() {
  // Set environment variables for testing
  Object.entries(integrationTestConfig).forEach(([key, value]) => {
    process.env[key] = value;
  });

  console.log('Integration test environment configured');
}

// Integration test cleanup helper
export async function cleanupIntegrationTest() {
  // Clean up environment variables
  Object.keys(integrationTestConfig).forEach(key => {
    delete process.env[key];
  });

  console.log('Integration test environment cleaned up');
}

// Database cleanup helper
export async function cleanupDatabase(prismaService: PrismaService) {
  const tableNames = await prismaService.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;

  // Clean up all tables in the correct order to avoid foreign key constraints
  const tablesToClean = [
    'userSessions',
    'userRoles',
    'users',
    // Add other tables as needed
  ];

  for (const tableName of tablesToClean) {
    try {
      await prismaService.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
    } catch (error) {
      // Ignore table not found errors
      if (!error.message.includes('does not exist')) {
        console.warn(`Warning: Could not clean table ${tableName}:`, error.message);
      }
    }
  }
}