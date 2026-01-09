# Deploy CLAUDE.md

This file provides guidance for working with deployment configuration.

## Overview

OpenGov Monitor runs as a single Docker container with nginx, Node.js API, and Python sync managed by supervisord. See [README.md](README.md) for architecture diagram and infrastructure values.

## Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `../Dockerfile` | Container build | Adding dependencies, changing base images |
| `supervisord.conf` | Process manager | Changing node path, adding services |
| `nginx-container.conf` | Reverse proxy | Changing routes, adding headers |
| `sync-cron` | Hourly data sync | Changing sync schedule or command |
| `../.github/workflows/deploy.yml` | CI/CD pipeline | Changing deploy triggers or steps |

## Configuration

### Environment Variables

Set in the container or CI/CD:

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Production | 32+ char secret for session encryption |
| `DATABASE_PATH` | No | Defaults to `/data/polkadot.db` |
| `PORT` | No | API port, defaults to 3001 |

### Infrastructure Values

Defined in [README.md](README.md):
- Image: `ghcr.io/opengov-watch/opengov-monitor:prod`
- Port: `80`
- Domain: `polkadot-treasury-monitor.cypherpunk.agency`
- Storage: `/data` volume for SQLite database

## Common Tasks

### Add a new environment variable

1. Update `Dockerfile` to pass it through (if build-time)
2. Update `deploy/supervisord.conf` if the API needs it
3. Update `.github/workflows/deploy.yml` to set it during deploy
4. Document in this file and `docs/spec/index.md`

### Change the sync schedule

Edit `deploy/sync-cron`:
```
# Current: hourly at minute 0
0 * * * * /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py --db /data/polkadot.db
```

### Update nginx routing

Edit `deploy/nginx-container.conf`. Key sections:
- `/api/` → proxy to Node.js on port 3001
- `/` → serve static frontend from `/app/frontend/dist`

### Debug a running container

Use the `/container` skill or these commands:

```bash
# Check status
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status opengov-monitor"

# View logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs opengov-monitor 50"

# Shell access
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell opengov-monitor"
```

## Deployment Flow

1. Push to `production` branch
2. GitHub Actions builds Docker image
3. Image pushed to `ghcr.io` with `:prod` tag
4. `deploy-service` command pulls and restarts container on server

## Check CI/CD Status

**Always use `gh` CLI** - WebFetch gives unreliable results for GitHub Actions pages.

```bash
# List recent runs
gh run list --limit 5

# View failed run logs
gh run view <run-id> --log-failed

# Search for specific errors
gh run view <run-id> --log-failed 2>&1 | grep -i "error\|failed"

# Watch a run in progress
gh run watch <run-id>
```

Common build failures:
- **Missing TypeScript types**: Install `@types/package` or upgrade to version with built-in types
- **Native module issues**: Check node version matches between build and runtime stages in Dockerfile

## Legacy Files (Do Not Use)

These are from the pre-containerized setup:
- `nginx.conf` - use `nginx-container.conf` instead
- `ecosystem.config.js` - PM2 config, replaced by supervisord
- `setup.sh` - manual setup script, replaced by Dockerfile

## References

- [README.md](README.md) - Infrastructure values, architecture, local Docker usage
- [docs/spec/index.md](../docs/spec/index.md) - Full system specification
- [.claude/commands/container.md](../.claude/commands/container.md) - Debug commands skill
