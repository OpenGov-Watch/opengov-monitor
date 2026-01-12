# Deploy

Single Docker container with nginx, Node.js API, and Python sync via supervisord.

## Infrastructure

| Field | Value |
|-------|-------|
| Image | `ghcr.io/opengov-watch/opengov-monitor:prod` |
| Port | `80` |
| Domain | `polkadot-treasury-monitor.cypherpunk.agency` |
| Storage | `/data` (SQLite) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Single Docker Container (:80)                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    supervisord                           ││
│  │   ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  ││
│  │   │   nginx     │  │  node API   │  │   cron         │  ││
│  │   │  :80        │──│  :3001      │  │  (hourly sync) │  ││
│  │   └─────────────┘  └─────────────┘  └────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                    ┌─────────────────┐                       │
│                    │  /data volume   │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `../Dockerfile` | Container build | Adding dependencies |
| `supervisord.conf` | Process manager | Changing services |
| `nginx-container.conf` | Reverse proxy | Changing routes |
| `sync-cron` | Hourly data sync | Changing schedule |
| `../.github/workflows/deploy.yml` | CI/CD | Deploy triggers |

**Legacy (don't use):** `nginx.conf`, `ecosystem.config.js`, `setup.sh`

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `SESSION_SECRET` | Production | - |
| `DATABASE_PATH` | No | `/data/polkadot.db` |
| `PORT` | No | `3001` |

## GCP Prerequisites

OS Login enabled for faster deploys (no SSH key generation):
- Instance metadata: `enable-oslogin=TRUE`
- Service account: `roles/compute.osAdminLogin`

## Deployment Flow

1. Push to `production` branch
2. GitHub Actions builds image → `ghcr.io`
3. `deploy-service` pulls and restarts on server

## Debugging

```bash
# Status
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status opengov-monitor"

# Logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs opengov-monitor 50"

# Shell
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell opengov-monitor"
```

## CI/CD Debugging

```bash
gh run list --limit 5
gh run view <run-id> --log-failed
```

## Local Docker

```bash
docker compose up -d --build
docker compose exec opengov-monitor /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py --db /data/polkadot.db
```

Health check: `curl http://localhost/api/health`
