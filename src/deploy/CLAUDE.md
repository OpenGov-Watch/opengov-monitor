# Deploy

Single Docker container with nginx, Node.js API, and Python sync via supervisord.

## Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `../Dockerfile` | Container build | Adding dependencies |
| `supervisord.conf` | Process manager | Changing services |
| `nginx-container.conf` | Reverse proxy | Changing routes |
| `sync-cron` | Hourly data sync | Changing schedule |
| `../.github/workflows/deploy.yml` | CI/CD | Deploy triggers |

**Legacy (don't use):** `nginx.conf`, `ecosystem.config.js`, `setup.sh`

## Quick Commands

### Local Testing
```bash
docker compose up --build
curl http://localhost/api/health
docker compose exec opengov-monitor supervisorctl status
```

### Production Access
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

## Pre-Deployment

**ALWAYS verify** before deploying (see README.md for detailed checklist):
1. Test Docker build locally (`docker compose up --build`)
2. Verify supervisord.conf file references exist in Dockerfile
3. Test container health (`curl http://localhost/api/health`)
4. Verify supervisor processes running (nginx, api, cron)
5. Run tests (`pnpm test && pnpm run build`)

## Deployment Flow

1. Complete pre-deployment checklist
2. Push to `production` branch
3. GitHub Actions builds → GHCR
4. Server pulls and restarts
5. Verify deployment (health + supervisor status)

## References

- [README.md](./README.md) - Full deployment guide, checklists, debugging, common issues
- [Root CLAUDE.md](../../CLAUDE.md) - Pre-deployment rules
