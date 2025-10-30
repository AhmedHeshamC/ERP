#!/bin/bash

# Docker PostgreSQL Setup for ERP Testing
# This script creates a PostgreSQL container for testing

set -e

echo "🐳 Setting up PostgreSQL with Docker for testing..."

# Container configuration
CONTAINER_NAME="erp-test-postgres"
POSTGRES_IMAGE="postgres:15"
POSTGRES_DB="erp_test_db"
POSTGRES_USER="erp_test_user"
POSTGRES_PASSWORD="test_password_change_me"
POSTGRES_PORT="5432"

# Check if container already exists
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "📦 Container '${CONTAINER_NAME}' already exists"

    # Stop and remove existing container
    echo "🗑️  Removing existing container..."
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

# Pull PostgreSQL image if not exists
echo "📥 Pulling PostgreSQL image..."
docker pull "${POSTGRES_IMAGE}"

# Start new PostgreSQL container
echo "🚀 Starting PostgreSQL container..."
docker run --name "${CONTAINER_NAME}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -e POSTGRES_USER="${POSTGRES_USER}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_INITDB_ARGS="--encoding=UTF-8 --lc-collate=C --lc-ctype=C" \
    -p "${POSTGRES_PORT}:5432" \
    -v erp_test_data:/var/lib/postgresql/data \
    --restart unless-stopped \
    -d "${POSTGRES_IMAGE}"

echo "⏳ Waiting for PostgreSQL to start..."
sleep 10

# Check if container is running
if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ PostgreSQL container started successfully!"
    echo ""
    echo "📋 Connection Details:"
    echo "   Container: ${CONTAINER_NAME}"
    echo "   Database: ${POSTGRES_DB}"
    echo "   Username: ${POSTGRES_USER}"
    echo "   Password: ${POSTGRES_PASSWORD}"
    echo "   Port: ${POSTGRES_PORT}"
    echo "   Host: localhost"
    echo ""
    echo "🔗 Connection URL:"
    echo "   postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    echo ""
    echo "🧪 Test connection with:"
    echo "   npm run test:db:check"
    echo ""
    echo "🛑 Stop container with:"
    echo "   docker stop ${CONTAINER_NAME}"

else
    echo "❌ Failed to start PostgreSQL container"
    echo "📋 Check logs with: docker logs ${CONTAINER_NAME}"
    exit 1
fi