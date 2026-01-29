# Deployment

Deployment guide for the OpenGov Monitor application.

## Infrastructure

| Environment | Branch | Image Tag | Service Name | Domain |
|-------------|--------|-----------|--------------|--------|
| Staging | `main` | `staging` | `opengov-monitor-staging` | `polkadot-treasury-monitor.cypherpunk.agency` |
| Production | `production` | `prod` | `opengov-monitor-prod` | `monitor.opengov.watch` |

**Common Configuration:**
| Field | Value |
|-------|-------|
| Port | `80` |
| Storage | `/data` (SQLite) |
| Platform | GCP Compute Engine |
| Instance | `web-server` (us-central1-a) |

## Database Safety (SQLite WAL)

The database uses SQLite in WAL (Write-Ahead Log) mode. This requires special handling.

**NEVER do this:**
- `cp`, `scp`, `rsync` on a live database — **causes corruption**
- Copy `.db` file without the `.db-wal` and `.db-shm` files
- Docker volume copy while container is running

**Safe backup methods:**
1. **API endpoint:** `GET /api/backup/download` (checkpoints automatically)
2. **sqlite3 backup:** `sqlite3 /data/polkadot.db ".backup /path/to/backup.db"`
3. **Stop-then-copy:** Stop container, copy files, restart

**Why?** WAL mode keeps recent writes in a separate `-wal` file. A regular `cp` captures the main file and WAL at different points in time, creating an inconsistent state that corrupts B-tree indexes.

**If corruption occurs:** Check `/data/polkadot_backup_*.db` for automated backups. Recovery is usually possible if data pages are intact.

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

**Components:**
- **nginx**: Reverse proxy serving static files and proxying API requests
- **Node.js API**: Express REST API on port 3001
- **cron**: Hourly data synchronization via Python backend
- **supervisord**: Process manager keeping all services running

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | No | Auto-generated | Override for session encryption (auto-persists to data dir) |
| `DATABASE_PATH` | No | `/data/polkadot.db` | Path to SQLite database |
| `PORT` | No | `3001` | API server port |

## Quick Start

### Prerequisites

**GCP Access:**
- OS Login enabled (instance metadata: `enable-oslogin=TRUE`)
- Service account: `roles/compute.osAdminLogin`
- gcloud CLI: `gcloud auth login`

**Local Tools:** Docker Compose, Node.js 18+, pnpm, gh CLI

### Local Testing

```bash
docker compose up --build
sleep 10
curl -f http://localhost/api/health
docker compose exec opengov-monitor supervisorctl status
```

Expected: Health returns 200, all processes RUNNING (nginx, api, cron)

### Staging Deployment

1. Complete [Pre-Deployment Checklist](../../docs/03_design/deployment/pre-deployment-checklist.md)
2. Push to `main` branch
3. GitHub Actions builds image with `staging` tag → GHCR
4. Server pulls and restarts `opengov-monitor-staging`
5. Run [Post-Deployment Verification](../../docs/03_design/deployment/post-deployment-verification.md)

### Production Deployment

1. Complete [Pre-Deployment Checklist](../../docs/03_design/deployment/pre-deployment-checklist.md)
2. Push to `production` branch
3. GitHub Actions builds image with `prod` tag → GHCR
4. Server pulls and restarts `opengov-monitor-prod`
5. Run [Post-Deployment Verification](../../docs/03_design/deployment/post-deployment-verification.md)

## Pre-Deployment Checklist

**Before every deployment:**

- [ ] Test Docker build locally (`docker compose up --build`)
- [ ] Verify supervisord.conf file references exist in Dockerfile
- [ ] Test container health (`curl http://localhost/api/health`)
- [ ] Verify all supervisor processes RUNNING
- [ ] Run tests (`pnpm test && pnpm run build`)

**Golden Rule:** If you wouldn't deploy it locally, don't deploy it to production.

See [full checklist](../../docs/03_design/deployment/pre-deployment-checklist.md) for detailed steps.

## Post-Deployment Verification

**After deployment** (replace `SERVICE_NAME` and `DOMAIN` with environment values):

```bash
# 1. Container status
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"

# 2. Supervisor processes
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME supervisorctl status"

# 3. Health endpoint
curl -f https://DOMAIN/api/health

# 4. Data endpoint
curl -f https://DOMAIN/api/categories
```

**Environment values:**
| Environment | SERVICE_NAME | DOMAIN |
|-------------|--------------|--------|
| Staging | `opengov-monitor-staging` | `polkadot-treasury-monitor.cypherpunk.agency` |
| Production | `opengov-monitor-prod` | `monitor.opengov.watch` |

Expected: Container healthy, all processes RUNNING, endpoints return 200.

See [full verification guide](../../docs/03_design/deployment/post-deployment-verification.md) for details.

## Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `../Dockerfile` | Container build | Adding dependencies |
| `supervisord.conf` | Process manager | Changing services |
| `nginx-container.conf` | Reverse proxy | Changing routes |
| `sync-cron` | Hourly data sync | Changing schedule |
| `../.github/workflows/deploy.yml` | CI/CD | Deploy triggers |

**Legacy (don't use):** `nginx.conf`, `ecosystem.config.js`, `setup.sh`

## Learn More

**Deployment:**
- [Pre-Deployment Checklist](../../docs/03_design/deployment/pre-deployment-checklist.md) - Detailed pre-deploy steps
- [Post-Deployment Verification](../../docs/03_design/deployment/post-deployment-verification.md) - Post-deploy checks
- [Debugging](../../docs/03_design/deployment/debugging.md) - Troubleshooting commands
- [Common Issues](../../docs/03_design/deployment/common-issues.md) - Frequent problems and solutions
- [Local Docker Development](../../docs/03_design/deployment/local-docker-development.md) - Local development with Docker

**General:**
- [CLAUDE.md](./CLAUDE.md) - Agent navigation
- [Root CLAUDE.md](../../CLAUDE.md) - Pre-deployment rules
- [Root README.md](../../README.md) - Project overview
