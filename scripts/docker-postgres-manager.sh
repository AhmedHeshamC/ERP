#!/bin/bash

# Docker PostgreSQL Manager for ERP Testing
# Simple management script for PostgreSQL container

set -e

CONTAINER_NAME="erp-test-postgres"
POSTGRES_IMAGE="postgres:15"
POSTGRES_DB="erp_test_db"
POSTGRES_USER="erp_test_user"
POSTGRES_PASSWORD="test_password_change_me"
POSTGRES_PORT="5433"

show_usage() {
    echo "Docker PostgreSQL Manager for ERP Testing"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start PostgreSQL container"
    echo "  stop      Stop PostgreSQL container"
    echo "  restart   Restart PostgreSQL container"
    echo "  status    Show container status"
    echo "  logs      Show container logs"
    echo "  connect   Connect to PostgreSQL with psql"
    echo "  clean     Remove container and data volume"
    echo ""
}

start_container() {
    echo "🐳 Starting PostgreSQL container..."

    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "✅ Container '${CONTAINER_NAME}' is already running"
        return 0
    fi

    if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "🔄 Starting existing container..."
        docker start "${CONTAINER_NAME}"
    else
        echo "🚀 Creating new container..."
        docker run --name "${CONTAINER_NAME}" \
            -e POSTGRES_DB="${POSTGRES_DB}" \
            -e POSTGRES_USER="${POSTGRES_USER}" \
            -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
            -e POSTGRES_INITDB_ARGS="--encoding=UTF-8 --lc-collate=C --lc-ctype=C" \
            -p "${POSTGRES_PORT}:5432" \
            -v erp_test_data:/var/lib/postgresql/data \
            --restart unless-stopped \
            -d "${POSTGRES_IMAGE}"
    fi

    echo "⏳ Waiting for PostgreSQL to start..."
    sleep 5

    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "✅ PostgreSQL container started successfully!"
        echo ""
        echo "📋 Connection Details:"
        echo "   Host: localhost"
        echo "   Port: ${POSTGRES_PORT}"
        echo "   Database: ${POSTGRES_DB}"
        echo "   Username: ${POSTGRES_USER}"
        echo "   Password: ${POSTGRES_PASSWORD}"
        echo ""
        echo "🔗 Connection URL:"
        echo "   postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
    else
        echo "❌ Failed to start PostgreSQL container"
        echo "📋 Check logs with: $0 logs"
        exit 1
    fi
}

stop_container() {
    echo "🛑 Stopping PostgreSQL container..."
    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker stop "${CONTAINER_NAME}"
        echo "✅ Container stopped"
    else
        echo "ℹ️  Container is not running"
    fi
}

restart_container() {
    echo "🔄 Restarting PostgreSQL container..."
    stop_container
    start_container
}

show_status() {
    echo "📊 PostgreSQL Container Status:"
    echo ""

    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "✅ Container is running"
        echo ""
        docker ps --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    elif docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "⏸️  Container exists but is stopped"
        echo ""
        docker ps -a --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        echo "❌ Container does not exist"
    fi
}

show_logs() {
    echo "📋 PostgreSQL Container Logs:"
    echo ""
    if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker logs --tail 50 "${CONTAINER_NAME}"
    else
        echo "❌ Container not found"
    fi
}

connect_to_db() {
    echo "🔌 Connecting to PostgreSQL..."
    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        docker exec -it "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
    else
        echo "❌ Container is not running"
        echo "Start it with: $0 start"
        exit 1
    fi
}

clean_container() {
    echo "🗑️  Removing PostgreSQL container and data..."

    if docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "Stopping container..."
        docker stop "${CONTAINER_NAME}"
    fi

    if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo "Removing container..."
        docker rm "${CONTAINER_NAME}"
    fi

    if docker volume ls --format "table {{.Name}}" | grep -q "erp_test_data"; then
        echo "Removing data volume..."
        docker volume rm erp_test_data
    fi

    echo "✅ Cleanup complete"
}

# Main script logic
case "${1:-}" in
    start)
        start_container
        ;;
    stop)
        stop_container
        ;;
    restart)
        restart_container
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    connect)
        connect_to_db
        ;;
    clean)
        clean_container
        ;;
    *)
        show_usage
        ;;
esac