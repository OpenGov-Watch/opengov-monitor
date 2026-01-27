# Deployment Debugging

Commands and techniques for troubleshooting deployment issues.

## Environments

| Environment | Service Name | Domain |
|-------------|--------------|--------|
| Staging | `opengov-monitor-staging` | `polkadot-treasury-monitor.cypherpunk.agency` |
| Production | `opengov-monitor-prod` | `monitor.opengov.watch` |

Replace `SERVICE_NAME` in commands below with the appropriate service name.

## Status Commands

### Container Status

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"
```

**Shows:** Container running status, health status, uptime, image version

**Use when:** Checking if container is running and healthy

---

### Supervisor Process Status

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME supervisorctl status"
```

**Shows:** Status of all supervised processes (nginx, api, cron)

**Use when:** Checking if individual services are running

**Process states:**
- RUNNING: Process is running normally
- FATAL: Process couldn't start (check error logs)
- EXITED: Process terminated (check exit code)
- STOPPED: Process was manually stopped

---

## Log Commands

### Recent Logs (Last N Lines)

```bash
# Last 50 lines (default)
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 50"

# Last 100 lines
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 100"
```

**Shows:** Combined logs from all processes

**Use when:** Quick overview of recent activity

---

### Specific Log Files

**API error log:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/api-error.log"
```

**Migrations error log:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/migrations-error.log"
```

**nginx error log:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/nginx-error.log"
```

**Cron/sync log:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/sync-cron.log"
```

**Use when:** Investigating specific service failures

---

## Interactive Shell

### Get Shell Inside Container

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-shell SERVICE_NAME"
```

**Once inside container:**
```bash
# Navigate to app directory
cd /app

# List files
ls -la

# Check logs
cat /var/log/supervisor/api-error.log

# Test API locally
curl -f http://localhost:3001/api/health

# Check database
ls -la /data/

# Test supervisor control
supervisorctl status
supervisorctl restart api
```

**Use when:** Need to inspect files, test commands, or manipulate services manually

---

## Network Debugging

### Check if API is Listening on Port 3001

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME netstat -tlnp | grep 3001"
```

**Expected output:** Shows process listening on port 3001

**Use when:** API should be running but health check fails

---

### Test Health Endpoint from Inside Container

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME curl -f http://localhost/api/health"
```

**Expected:** HTTP 200 with `{"status":"ok"}`

**Use when:** External health check fails but you need to verify if API is responding internally

---

### Test API Direct (Bypass nginx)

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME curl -f http://localhost:3001/api/health"
```

**Use when:** Determining if issue is with nginx or API

---

## CI/CD Debugging

### List Recent Workflow Runs

```bash
gh run list --limit 5
```

**Shows:** Recent GitHub Actions workflow runs with status

**Use when:** Checking if CI/CD pipeline succeeded

---

### View Failed Run Logs

```bash
gh run view <run-id> --log-failed
```

**Shows:** Logs from failed workflow steps only

**Use when:** Investigating why build or deployment failed

---

### View Specific Job

```bash
gh run view <run-id> --job <job-id>
```

**Shows:** Detailed logs for specific job

**Use when:** Need detailed logs from a particular workflow step

---

## Common Debugging Workflows

### API Not Starting

1. Check supervisor status (is it FATAL?)
2. Read api-error.log
3. Read migrations-error.log (migrations might be blocking startup)
4. Check if database is accessible (`ls -la /data/`)
5. Test API port (`netstat -tlnp | grep 3001`)

### Health Check Failing

1. Test health endpoint from inside container
2. Check if API is listening on port 3001
3. Check nginx error log
4. Check API error log
5. Test API direct (bypass nginx)

### Container Unhealthy

1. Check supervisor process status
2. Read recent logs (last 100 lines)
3. Identify which process is failing
4. Read specific error log for that process
5. Get interactive shell to investigate

### Deployment Failed in CI/CD

1. List recent workflow runs
2. View failed run logs
3. Identify which step failed (build, test, deploy)
4. Check if it's a test failure, build error, or deployment issue
5. Review recent code changes that might have caused it

---

## See Also

- [Common Issues](./common-issues.md) - Frequent problems and solutions
- [Post-Deployment Verification](./post-deployment-verification.md) - What to check after deploy
- [Pre-Deployment Checklist](./pre-deployment-checklist.md) - What to check before deploy
