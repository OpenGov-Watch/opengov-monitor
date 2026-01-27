# Post-Deployment Verification

Steps to verify deployment success immediately after deploying.

## Environments

| Environment | Service Name | Domain |
|-------------|--------------|--------|
| Staging | `opengov-monitor-staging` | `polkadot-treasury-monitor.cypherpunk.agency` |
| Production | `opengov-monitor-prod` | `monitor.opengov.watch` |

Replace `SERVICE_NAME` and `DOMAIN` in commands below with the appropriate values.

**Run these commands immediately after deployment:**

## 1. Check Container Status

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status SERVICE_NAME"
```

**Expected:** Container should be "healthy"

**What to check:**
- Status shows "Up" with uptime
- Health status is "healthy" (not "unhealthy" or "starting")
- Container is running latest image version

**If unhealthy:** Container health check is failing. Check supervisor logs.

---

## 2. Verify Supervisor Processes

```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME supervisorctl status"
```

**Expected output:**
```
api     RUNNING   pid X, uptime X:XX:XX
cron    RUNNING   pid X, uptime X:XX:XX
nginx   RUNNING   pid X, uptime X:XX:XX
```

**What to check:**
- All three processes show RUNNING status
- No processes showing FATAL, EXITED, or STOPPED
- Uptime is recent (minutes, not hours from previous deployment)
- PIDs are fresh (low numbers)

**If any process FATAL:**
- API: Check migrations-error.log and api-error.log
- nginx: Check nginx-error.log
- cron: Check sync-cron.log

---

## 3. Test Health Endpoint

```bash
curl -f https://DOMAIN/api/health
```

**Expected:** HTTP 200 with `{"status":"ok"}`

**What to check:**
- Returns HTTP 200 (not 502, 503, or 404)
- Response body is valid JSON
- Response time is reasonable (< 1 second)

**If fails:**
- HTTP 502: nginx can't reach API (check if API is RUNNING)
- HTTP 503: Container unhealthy (check supervisor processes)
- HTTP 404: Route configuration issue (check nginx config)

---

## 4. Test Data Endpoint

```bash
curl -f https://DOMAIN/api/categories
```

**Expected:** HTTP 200 with JSON array of categories

**What to check:**
- Returns HTTP 200
- Response is valid JSON array
- Data looks reasonable (not empty, not corrupted)
- Response time is reasonable (< 2 seconds)

**If fails:**
- HTTP 500: API error (check api-error.log)
- Empty array: Database might be empty or migrations failed
- Invalid JSON: API serialization issue

---

## Troubleshooting Failed Verification

If any check fails, investigate immediately:

### Container unhealthy
```bash
# Check supervisor logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME supervisorctl status"

# Check recent logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-logs SERVICE_NAME 50"
```

### API not RUNNING
```bash
# Check api-error.log
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/api-error.log"

# Check migrations-error.log
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/migrations-error.log"
```

### Health endpoint fails
```bash
# Test from inside container
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME curl -f http://localhost/api/health"

# Check if API is listening
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME netstat -tlnp | grep 3001"

# Check nginx logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec SERVICE_NAME cat /var/log/supervisor/nginx-error.log"
```

---

## Verification Checklist

After every deployment:

- [ ] Container status is "healthy"
- [ ] All supervisor processes RUNNING (nginx, api, cron)
- [ ] Health endpoint returns 200 with `{"status":"ok"}`
- [ ] Data endpoint returns 200 with valid JSON
- [ ] No errors in supervisor logs
- [ ] Response times are reasonable

**If all checks pass:** Deployment successful ✅

**If any check fails:** Investigate immediately and consider rollback

---

## See Also

- [Pre-Deployment Checklist](./pre-deployment-checklist.md) - Steps before deployment
- [Debugging](./debugging.md) - Troubleshooting commands
- [Common Issues](./common-issues.md) - Frequent deployment problems
