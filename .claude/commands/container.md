# Container Management

## Environments

| Environment | Service Name | Branch | URL |
|-------------|--------------|--------|-----|
| Staging | `opengov-monitor-staging` | `main` | `https://polkadot-treasury-monitor.cypherpunk.agency` |
| Production | `opengov-monitor-prod` | `production` | `https://monitor.opengov.watch` |

Replace `SERVICE_NAME` in commands below with the appropriate service name.

## Quick Debug Flow

```
1. service-status → healthy/unhealthy?
       ↓ unhealthy
2. service-logs → supervisord output (WHAT failed)
       ↓ shows "spawnerr" or "exited"
3. api-error.log → Node.js error (WHY it failed)
       ↓ tells you the real issue
4. Test directly → node -e, curl, ls
```

## Commands

### 1. Check Status
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"
```

### 2. View Supervisor Logs
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 50"
```

### 3. Check API Error Log
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/api-error.log"
```

### 4. Direct Testing
```bash
# Node version
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME node --version"

# Node binary location
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME which node"

# Test better-sqlite3 module loads
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/api SERVICE_NAME node -e \"import('better-sqlite3').then(() => console.log('ok')).catch(e => console.error(e.message))\""

# Test API endpoint directly
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME curl -s http://127.0.0.1:3001/api/health"

# Check database file exists
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME ls -la /data/"
```

### 5. Shell Access
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell SERVICE_NAME"
```

## Python Backfills

The container has a Python venv at `/app/src/backend/.venv` for running data sync scripts.

### Run Full Sync
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/src/backend SERVICE_NAME .venv/bin/python scripts/run_sqlite.py --db /data/polkadot.db"
```

### Run Specific Tables
```bash
# Fellowship salary data (cycles, claimants, payments)
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/src/backend SERVICE_NAME .venv/bin/python scripts/run_sqlite.py --db /data/polkadot.db --tables fellowship_salary_cycles"

# Referenda only
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/src/backend SERVICE_NAME .venv/bin/python scripts/run_sqlite.py --db /data/polkadot.db --tables referenda"

# Treasury spends only
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/src/backend SERVICE_NAME .venv/bin/python scripts/run_sqlite.py --db /data/polkadot.db --tables treasury"
```

### Check Sync Logs
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME tail -100 /var/log/opengov-sync.log"
```

## Trigger Redeploy

- Push to `main` branch to trigger staging deployment
- Push to `production` branch to trigger production deployment

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find package 'express'` | Missing node_modules | Add `COPY --from=api-build /app/api/node_modules ./api/node_modules` |
| `Cannot find module './db/index'` | ESM needs .js extensions | Use `tsup` bundler instead of `tsc` |
| `was compiled against a different Node.js version` | Node version mismatch between build/runtime | Use same base image (node:20-slim) for both |
| `can't find command '/usr/bin/node'` | Wrong node path | node:20-slim uses `/usr/local/bin/node` |
| `Database not accessible` | better-sqlite3 native module issue | Check all above first |

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Container build (check base images match) |
| `deploy/supervisord.conf` | Process management - check node path |
| `deploy/nginx-container.conf` | Nginx config |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `api/package.json` | Build script (tsup vs tsc) |
