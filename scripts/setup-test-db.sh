#!/bin/bash

# Setup test database for E2E testing
# Following KISS principle - simple and effective

set -e

echo "🔧 Setting up test database..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Create test database user if it doesn't exist
echo "👤 Creating test database user..."
psql -h localhost -U postgres -c "CREATE USER erp_test_user WITH PASSWORD 'secure_test_password_change_me';" 2>/dev/null || echo "User already exists"

# Create test database
echo "📊 Creating test database..."
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS erp_test_db;" 2>/dev/null || true
psql -h localhost -U postgres -c "CREATE DATABASE erp_test_db OWNER erp_test_user;" || echo "Database already exists"

# Grant permissions
echo "🔐 Granting permissions..."
psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE erp_test_db TO erp_test_user;" || true

echo "✅ Test database setup complete!"