# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/frontend/package.json ./src/frontend/

RUN pnpm install --frozen-lockfile

COPY src/frontend/ ./src/frontend/
RUN pnpm --filter opengov-monitor-frontend build

# Stage 2: Build API (use debian-based image for glibc compatibility with runtime)
FROM node:20-slim AS api-build

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/api/package.json ./src/api/

RUN pnpm install --frozen-lockfile

COPY src/api/ ./src/api/
RUN pnpm --filter api build

# Stage 3: Runtime (use node:20-slim to match build stage Node version)
FROM node:20-slim

# Install runtime dependencies (Node already included in base image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    cron \
    curl \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy built frontend to nginx
COPY --from=frontend-build /app/src/frontend/dist /var/www/html

# Copy built API (pnpm hoists node_modules to root, but symlinks are in api/node_modules)
COPY --from=api-build /app/src/api/dist ./src/api/dist
COPY --from=api-build /app/src/api/package.json ./src/api/
COPY --from=api-build /app/src/api/scripts ./src/api/scripts
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/src/api/node_modules ./src/api/node_modules

# Copy Python backend
COPY src/backend/ ./src/backend/

# Install Python dependencies
RUN python3 -m venv /app/src/backend/.venv \
    && /app/src/backend/.venv/bin/pip install --no-cache-dir -r /app/src/backend/requirements.txt

# Copy configuration files
COPY src/deploy/nginx-container.conf /etc/nginx/sites-available/default
COPY src/deploy/supervisord.conf /etc/supervisor/conf.d/opengov.conf
COPY src/deploy/sync-cron /etc/cron.d/opengov-sync
COPY src/deploy/run-migrations-then-api.sh /app/src/deploy/run-migrations-then-api.sh

# Setup cron and make migration script executable
RUN chmod 0644 /etc/cron.d/opengov-sync \
    && crontab /etc/cron.d/opengov-sync \
    && chmod +x /app/src/deploy/run-migrations-then-api.sh

# Create non-root user for running services
# Using UID/GID 1000 which is commonly available
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m -s /bin/bash appuser

# Create data directory with proper permissions
RUN mkdir -p /data && chown appuser:appuser /data

# Copy default CSV files for sync functionality
COPY data/defaults/ ./data/defaults/

# Set ownership of app directory to non-root user
RUN chown -R appuser:appuser /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/polkadot.db
ENV SESSIONS_DATABASE_PATH=/data/sessions.db

# Note: We cannot use USER directive here because:
# 1. nginx requires root to bind to port 80
# 2. cron requires root to run
# 3. supervisord needs root to manage processes
# Instead, we run individual processes as appuser via supervisord configuration
# This provides defense-in-depth while maintaining functionality

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start supervisord
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
