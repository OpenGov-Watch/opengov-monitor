# Container Management

Service name: `opengov-monitor`

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
  --command="sudo /usr/local/bin/service-status opengov-monitor"
```

### 2. View Supervisor Logs
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs opengov-monitor 50"
```

### 3. Check API Error Log
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /var/log/supervisor/api-error.log"
```

### 4. Direct Testing
```bash
# Node version
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor node --version"

# Node binary location
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor which node"

# Test better-sqlite3 module loads
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/api opengov-monitor node -e \"import('better-sqlite3').then(() => console.log('ok')).catch(e => console.error(e.message))\""

# Test API endpoint directly
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor curl -s http://127.0.0.1:3001/api/health"

# Check database file exists
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor ls -la /data/"
```

### 5. Shell Access
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell opengov-monitor"
```

## Trigger Redeploy

Push to `production` branch to trigger CI/CD rebuild and deploy.

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
