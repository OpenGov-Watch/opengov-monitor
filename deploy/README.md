# Deployment Configuration

This directory contains configuration files for deploying OpenGov Monitor as a single Docker container.

## Infrastructure

| Field | Value |
|-------|-------|
| **Image** | `ghcr.io/opengov-watch/opengov-monitor:prod` |
| **Port** | `80` |
| **Domain** | `polkadot-treasury-monitor.cypherpunk.agency` |
| **Secrets** | None |
| **Storage** | `/data` (SQLite database) |

## Files

| File | Purpose |
|------|---------|
| `supervisord.conf` | Process manager (nginx + node + cron) |
| `nginx-container.conf` | nginx config for single container |
| `sync-cron` | Cron job for hourly data sync |
| `nginx.conf` | (Legacy) Non-containerized nginx config |
| `opengov-sync.cron` | (Legacy) Non-containerized cron job |
| `ecosystem.config.js` | (Legacy) PM2 configuration |
| `setup.sh` | (Legacy) Non-containerized setup script |

## Architecture

Single container running all services via supervisord:

```
┌─────────────────────────────────────────────────────────────┐
│              Single Docker Container (:80)                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    supervisord                           ││
│  │                                                          ││
│  │   ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  ││
│  │   │   nginx     │  │  node API   │  │   cron         │  ││
│  │   │  :80        │──│  :3001      │  │  (hourly sync) │  ││
│  │   │  (frontend  │  │             │  │                │  ││
│  │   │  + proxy)   │  │             │  │                │  ││
│  │   └─────────────┘  └─────────────┘  └────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                    ┌─────────▼─────────┐                     │
│                    │  /data volume     │                     │
│                    │  polkadot.db      │                     │
│                    └───────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Local Development

```bash
# Build and run locally
docker compose up -d --build

# Initial data sync (first time only)
docker compose exec opengov-monitor /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py --db /data/polkadot.db

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Deployment

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`):

1. Push to `main` or `production` branch
2. Docker image is built and pushed to `ghcr.io`
3. Image is deployed to the server via `gcloud compute ssh`

### Manual deployment

```bash
# On the server
cd /mnt/pd/stack
docker compose pull opengov-monitor
docker compose up -d opengov-monitor
```

## Health Check

The container includes a health check at `/api/health`:

```bash
curl http://localhost/api/health
```
