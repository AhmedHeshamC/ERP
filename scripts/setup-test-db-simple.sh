#!/bin/bash

# Enterprise-grade test database setup using PostgreSQL
# Following enterprise architecture standards

set -e

echo "🔧 Setting up test database with PostgreSQL..."

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) not found!"
    echo "Please install PostgreSQL: sudo apt-get install postgresql-client"
    exit 1
fi

# Check PostgreSQL connection
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "❌ PostgreSQL is not running on localhost:5432!"
    echo "Please start PostgreSQL service: sudo systemctl start postgresql"
    exit 1
fi

# Create test database and user if they don't exist
echo "🗄️ Setting up PostgreSQL test database..."
psql -h localhost -U postgres -c "SELECT 1;" &> /dev/null || {
    echo "❌ Cannot connect to PostgreSQL as postgres user!"
    echo "Please ensure PostgreSQL authentication is configured correctly."
    exit 1
}

# Create test user and database
psql -h localhost -U postgres -c "DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'erp_test_user') THEN
        CREATE ROLE erp_test_user WITH LOGIN PASSWORD 'test_password_change_me';
    END IF
END
\$\$;" || echo "Test user already exists or could not be created"

psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS erp_test_db;" 2>/dev/null || true
psql -h localhost -U postgres -c "CREATE DATABASE erp_test_db OWNER erp_test_user;" || {
    echo "❌ Failed to create test database!"
    exit 1
}

# Copy test schema
if [ ! -f "prisma/schema.test.prisma" ]; then
    echo "❌ Test schema not found!"
    exit 1
fi

# Generate Prisma client for test environment
echo "📦 Generating Prisma client for test environment..."
cp prisma/schema.test.prisma prisma/schema.prisma.backup
cp prisma/schema.test.prisma prisma/schema.prisma
NODE_ENV=test npx prisma generate
cp prisma/schema.prisma.backup prisma/schema.prisma
rm prisma/schema.prisma.backup

# Push schema to test database
echo "🗄️ Migrating test database schema..."
NODE_ENV=test npx prisma db push --force-reset

echo "✅ PostgreSQL test database setup complete!"
echo "🔗 Test database: erp_test_db"
echo "👤 Test user: erp_test_user"