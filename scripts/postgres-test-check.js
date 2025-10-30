#!/usr/bin/env node

/**
 * PostgreSQL Test Database Check
 * Verifies that PostgreSQL configuration is working correctly
 */

const { PrismaClient } = require('@prisma/client');

async function testPostgresConnection() {
  console.log('🔍 Testing PostgreSQL configuration...');

  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'postgresql://erp_test_user:test_password_change_me@localhost:5433/erp_test_db'
        }
      },
      log: ['error', 'warn']
    });

    // Test database connection
    console.log('📡 Attempting to connect to PostgreSQL...');
    await prisma.$connect();
    console.log('✅ PostgreSQL connection successful!');

    // Test database query (will fail if schema not applied, but connection is good)
    console.log('🔎 Testing database schema...');
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database query successful!');

      // Test if User table exists
      try {
        const userCount = await prisma.user.count();
        console.log(`✅ User table accessible! Current count: ${userCount}`);
      } catch (tableError) {
        console.log('⚠️  User table not found - run "npm run test:db:setup" to create schema');
      }

    } catch (queryError) {
      console.log('⚠️  Database connection works but schema not applied');
      console.log('   Run "npm run test:db:setup" to create database and schema');
    }

    await prisma.$disconnect();
    console.log('✅ PostgreSQL test completed successfully!');
    return true;

  } catch (error) {
    console.log('❌ PostgreSQL connection failed:');

    if (error.code === 'P1000') {
      console.log('   - Authentication failed: Invalid username/password');
      console.log('   - Ensure PostgreSQL user "erp_test_user" exists with correct password');
    } else if (error.code === 'P1001') {
      console.log('   - Connection failed: Database server not reachable');
      console.log('   - Ensure PostgreSQL is running on localhost:5432');
    } else if (error.code === 'P1002') {
      console.log('   - Database not found: "erp_test_db" does not exist');
      console.log('   - Run "npm run test:db:setup" to create the database');
    } else {
      console.log(`   - Error code: ${error.code}`);
      console.log(`   - Message: ${error.message}`);
    }

    console.log('\n🔧 Setup steps:');
    console.log('1. Install PostgreSQL: sudo apt install postgresql postgresql-contrib');
    console.log('2. Start PostgreSQL: sudo systemctl start postgresql');
    console.log('3. Run setup script: npm run test:db:setup');

    return false;
  }
}

// Run the test if called directly
if (require.main === module) {
  testPostgresConnection()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testPostgresConnection };