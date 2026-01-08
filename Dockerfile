# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/

RUN pnpm install --frozen-lockfile

COPY frontend/ ./frontend/
RUN pnpm --filter opengov-monitor-frontend build

# Stage 2: Build API
FROM node:20-alpine AS api-build

WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/

RUN pnpm install --frozen-lockfile

COPY api/ ./api/
RUN pnpm --filter api build

# Stage 3: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    nodejs \
    npm \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    cron \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy built frontend to nginx
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy built API (pnpm hoists node_modules to root)
COPY --from=api-build /app/api/dist ./api/dist
COPY --from=api-build /app/api/package.json ./api/
COPY --from=api-build /app/node_modules ./node_modules

# Copy Python backend
COPY backend/ ./backend/

# Install Python dependencies
RUN python3 -m venv /app/backend/.venv \
    && /app/backend/.venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy configuration files
COPY deploy/nginx-container.conf /etc/nginx/sites-available/default
COPY deploy/supervisord.conf /etc/supervisor/conf.d/opengov.conf
COPY deploy/sync-cron /etc/cron.d/opengov-sync

# Setup cron
RUN chmod 0644 /etc/cron.d/opengov-sync \
    && crontab /etc/cron.d/opengov-sync

# Create data directory
RUN mkdir -p /data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/polkadot.db

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start supervisord
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
