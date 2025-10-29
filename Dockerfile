# Multi-stage build for development and production
FROM node:20-alpine AS base

# Install only necessary dependencies for native module compilation
# Remove build tools after installation to reduce attack surface
RUN apk add --no-cache --virtual .build-deps python3 make g++ libc6-compat && \
    npm install -g pnpm && \
    apk del .build-deps

# Set working directory with proper permissions
WORKDIR /app

# Copy package files with proper checksum for better caching
COPY package*.json pnpm-lock.yaml* ./

# Install dependencies based on environment
# Use --frozen-lockfile for reproducible builds

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
# Use --prefer-frozen-lockfile for CI environments
RUN pnpm install --frozen-lockfile

# Copy source code with proper .dockerignore optimization
COPY . .

# Create non-root user for development (optional, but good practice)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose ports with documentation
EXPOSE 3000 9229

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Development command with proper signal handling
CMD ["pnpm", "run", "start:dev"]

# Build stage
FROM base AS build

# Install all dependencies with frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with proper optimizations
# Generate Prisma client before building
RUN pnpm run prisma:generate && \
    pnpm run build

# Clean up dev dependencies to reduce image size
RUN pnpm prune --prod

# Production stage
FROM node:20-alpine AS production

# Install curl for health checks and remove it later to reduce attack surface
RUN apk add --no-cache curl && \
    # Create non-root user with proper UID/GID
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    # Create necessary directories with proper permissions
    mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app

# Set working directory
WORKDIR /app

# Copy package files for production dependencies only
COPY package*.json pnpm-lock.yaml* ./

# Install pnpm and production dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod && \
    # Clean up npm cache and pnpm store to reduce image size
    npm cache clean --force && \
    pnpm store prune

# Copy built application and necessary files from build stage
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy additional production files if needed
COPY --chown=nodejs:nodejs ./public ./public

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use exec form for proper signal handling
ENTRYPOINT ["node", "dist/main.js"]