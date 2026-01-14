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

## Pre-Deployment Checklist

**ALWAYS verify these before deploying to production:**

1. **Test Docker build locally**
   ```bash
   docker compose up --build
   ```

2. **Verify all files referenced in supervisord.conf exist**
   ```bash
   # Check supervisord config
   grep "command=" deploy/supervisord.conf

   # Verify each file/script exists and is copied in Dockerfile
   # Example: if supervisord.conf has "command=/app/deploy/script.sh"
   # Then Dockerfile MUST have "COPY deploy/script.sh /app/deploy/script.sh"
   ```

3. **Test container health locally**
   ```bash
   # Wait 10 seconds for startup
   sleep 10

   # Health check should return 200
   curl -f http://localhost/api/health

   # Check supervisor status
   docker compose exec opengov-monitor supervisorctl status
   ```

4. **Verify all processes are running**
   - ✅ nginx: RUNNING
   - ✅ api: RUNNING (not FATAL)
   - ✅ cron: RUNNING

5. **Run tests**
   ```bash
   pnpm test
   pnpm run build
   ```

## Deployment Flow

1. **Complete pre-deployment checklist** (see above)
2. Push to `production` branch
3. GitHub Actions builds image → `ghcr.io`
4. `deploy-service` pulls and restarts on server
5. **Verify deployment** (see Post-Deployment Verification below)

## Post-Deployment Verification

**Run these immediately after deployment:**

```bash
# 1. Check container status (should be "healthy")
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status opengov-monitor"

# 2. Verify all supervisor processes running
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor supervisorctl status"

# Expected output:
# api     RUNNING   pid X, uptime X:XX:XX
# cron    RUNNING   pid X, uptime X:XX:XX
# nginx   RUNNING   pid X, uptime X:XX:XX

# 3. Test health endpoint
curl -f https://polkadot-treasury-monitor.cypherpunk.agency/api/health

# 4. Test a data endpoint
curl -f https://polkadot-treasury-monitor.cypherpunk.agency/api/categories
```

**If any check fails, investigate immediately:**
- Container unhealthy → Check supervisor logs
- API not RUNNING → Check api-error.log
- Health endpoint fails → Check nginx and API logs

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

## Common Pitfalls

### 1. Missing Files in Container (Exit Code 127)

**Symptom:** Supervisor logs show `exit status 127` or error log shows `No such file or directory`

**Cause:** supervisord.conf references a script/file that wasn't copied to the container

**Fix:**
1. Check what files supervisord.conf references:
   ```bash
   grep "command=" deploy/supervisord.conf
   ```
2. Ensure Dockerfile has `COPY` for each file
3. For scripts, ensure they're executable:
   ```dockerfile
   COPY deploy/script.sh /app/deploy/script.sh
   RUN chmod +x /app/deploy/script.sh
   ```

**Example (2026-01-14):** Missing `deploy/run-migrations-then-api.sh` caused all API requests to return 502

**Prevention:** Always test Docker build locally before deploying

### 2. API Not Starting Due to Migration Failure

**Symptom:** API shows FATAL in supervisor status, migrations-error.log shows errors

**Cause:** Database migration failed, blocking API startup

**Debug:**
```bash
# Check migration error log
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /var/log/supervisor/migrations-error.log"

# Check if database is accessible
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor ls -la /data/"
```

**Fix:** Fix the migration issue, then restart container

### 3. Container Builds But Health Check Fails

**Symptom:** Container status shows "unhealthy", but no obvious errors

**Cause:** Health check expects `/api/health` to return 200, but API isn't listening

**Debug:**
```bash
# Test health endpoint inside container
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor curl -f http://localhost/api/health"

# Check if API is listening on port 3001
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor netstat -tlnp | grep 3001"
```

### 4. Forgot to Test Locally with Docker

**Issue:** Changes work with `pnpm run dev` locally but fail in production

**Why:** Local dev doesn't use Docker, supervisord, or nginx - different environment

**Solution:** ALWAYS test with Docker before deploying:
```bash
# Stop local dev server first
pnpm run dev  # ❌ Not representative of production

# Test with Docker instead
docker compose up --build  # ✅ Matches production environment
curl http://localhost/api/health
```

### 5. Deployment Checklist Not Followed

**Issue:** Skipping pre-deployment checks leads to broken deployments

**Prevention:** Use this checklist EVERY time:
- [ ] Test Docker build locally
- [ ] Verify supervisord.conf references
- [ ] Check container health locally
- [ ] Run tests (`pnpm test`)
- [ ] After deploy: verify health endpoint
- [ ] After deploy: check supervisor status

**Golden Rule:** If you wouldn't deploy it locally, don't deploy it to production
