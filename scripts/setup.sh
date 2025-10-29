#!/bin/bash

# ERP System Development Setup Script
# Enterprise-grade development environment setup

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 20+ first."
    fi

    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log "Installing pnpm..."
        npm install -g pnpm
    fi

    log "Prerequisites check completed."
}

# Setup environment variables
setup_environment() {
    log "Setting up environment variables..."

    if [ ! -f .env ]; then
        cp .env.example .env
        log "Created .env file from template."
        warn "Please update .env file with your configuration before proceeding."
    else
        log ".env file already exists."
    fi
}

# Setup directories
setup_directories() {
    log "Creating necessary directories..."

    mkdir -p data/{postgres,redis,pgadmin}
    mkdir -p logs
    mkdir -p uploads
    mkdir -p test-results
    mkdir -p coverage

    # Set proper permissions
    chmod 755 data logs uploads test-results coverage

    log "Directories created successfully."
}

# Install dependencies
install_dependencies() {
    log "Installing project dependencies..."

    if [ -f package.json ]; then
        pnpm install
        log "Dependencies installed successfully."
    else
        error "package.json not found. Are you in the project root?"
    fi
}

# Setup git hooks
setup_git_hooks() {
    log "Setting up git hooks..."

    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for enterprise-grade code quality

set -e

echo "Running pre-commit checks..."

# Run linting
echo "Running ESLint..."
pnpm run lint

# Run tests
echo "Running tests..."
pnpm run test

# Security audit
echo "Running security audit..."
pnpm run security:check

echo "Pre-commit checks passed."
EOF

    # Create pre-push hook
    cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Pre-push hook for enterprise-grade code quality

set -e

echo "Running pre-push checks..."

# Run test coverage
echo "Running test coverage..."
pnpm run test:cov

# Run E2E tests
echo "Running E2E tests..."
pnpm run test:e2e

# Build check
echo "Running build check..."
pnpm run build

echo "Pre-push checks passed."
EOF

    # Make hooks executable
    chmod +x .git/hooks/pre-commit
    chmod +x .git/hooks/pre-push

    log "Git hooks setup completed."
}

# Database setup
setup_database() {
    log "Setting up database..."

    # Start database services
    docker-compose up -d postgres redis

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    sleep 10

    # Run database migrations
    if command -v pnpm &> /dev/null && [ -f prisma/schema.prisma ]; then
        pnpm run prisma:generate
        pnpm run prisma:migrate
        log "Database setup completed."
    fi
}

# Development server startup
start_development() {
    log "Starting development environment..."

    # Start all services
    docker-compose up -d

    log "Development environment started!"
    log "API: http://localhost:3000/api/v1"
    log "Documentation: http://localhost:3000/api/v1/docs"
    log "PgAdmin: http://localhost:5050"
    log "Database: localhost:5432"
    log "Redis: localhost:6379"
}

# Health check
health_check() {
    log "Performing health check..."

    # Check if API is responding
    if curl -f http://localhost:3000/health &> /dev/null; then
        log "API health check passed."
    else
        warn "API health check failed. API might still be starting..."
    fi

    # Check database connection
    if docker-compose exec -T postgres pg_isready -U erp_user -d erp_db &> /dev/null; then
        log "Database health check passed."
    else
        warn "Database health check failed."
    fi

    # Check Redis connection
    if docker-compose exec -T redis redis-cli ping &> /dev/null; then
        log "Redis health check passed."
    else
        warn "Redis health check failed."
    fi
}

# Main setup function
main() {
    log "Starting ERP system development setup..."
    log "Enterprise-grade development environment initialization"

    check_prerequisites
    setup_environment
    setup_directories
    install_dependencies
    setup_git_hooks
    setup_database
    start_development

    # Wait a bit for services to start
    sleep 15
    health_check

    log "Setup completed successfully!"
    log ""
    log "Next steps:"
    log "1. Update .env file with your configuration"
    log "2. Review CLAUDE.md for development guidelines"
    log "3. Start developing with TDD methodology"
    log "4. Follow enterprise-grade coding standards"
    log ""
    log "Useful commands:"
    log "- Start development: docker-compose up -d"
    log "- View logs: docker-compose logs -f"
    log "- Stop services: docker-compose down"
    log "- Run tests: pnpm run test"
    log "- Check security: pnpm run security:audit"
}

# Run main function
main "$@"