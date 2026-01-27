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

### Remote Access

Replace `SERVICE_NAME` with `opengov-monitor-staging` or `opengov-monitor-prod`.

```bash
# Status
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"

# Logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 50"

# Shell
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell SERVICE_NAME"
```

## Pre-Deployment

**ALWAYS verify** before deploying (see README.md for detailed checklist):
1. Test Docker build locally (`docker compose up --build`)
2. Verify supervisord.conf file references exist in Dockerfile
3. Test container health (`curl http://localhost/api/health`)
4. Verify supervisor processes running (nginx, api, cron)
5. Run tests (`pnpm test && pnpm run build`)

## Deployment Flow

**Staging:** Push to `main` → builds `staging` tag → deploys `opengov-monitor-staging`

**Production:** Push to `production` → builds `prod` tag → deploys `opengov-monitor-prod`

## References

- [README.md](./README.md) - Full deployment guide, checklists, debugging, common issues
- [Root CLAUDE.md](../../CLAUDE.md) - Pre-deployment rules
