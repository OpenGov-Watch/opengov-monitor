# Common Deployment Issues

Frequent deployment problems, their causes, and solutions.

## 1. Missing Files in Container (Exit Code 127)

**Symptom:** Supervisor logs show `exit status 127` or error log shows `No such file or directory`

**Cause:** supervisord.conf references a script/file that wasn't copied to the container

**How to identify:**
- Supervisor process shows FATAL status
- Error log shows "No such file or directory"
- Exit code 127 in supervisor logs

**Fix:**

1. Check what files supervisord.conf references:
   ```bash
   grep "command=" src/deploy/supervisord.conf
   ```

2. Ensure Dockerfile has `COPY` for each file:
   ```dockerfile
   COPY src/deploy/script.sh /app/deploy/script.sh
   ```

3. For scripts, ensure they're executable:
   ```dockerfile
   COPY src/deploy/script.sh /app/deploy/script.sh
   RUN chmod +x /app/deploy/script.sh
   ```

**Example (2026-01-14):** Missing `deploy/run-migrations-then-api.sh` caused all API requests to return 502

**Prevention:** Always test Docker build locally before deploying:
```bash
docker compose up --build
docker compose exec opengov-monitor supervisorctl status
```

**Root cause:** Disconnect between supervisord.conf configuration and Dockerfile build steps

---

## 2. API Not Starting Due to Migration Failure

**Symptom:** API shows FATAL in supervisor status, migrations-error.log shows errors

**Cause:** Database migration failed, blocking API startup (migrations run before API)

**How to identify:**
- API process status is FATAL
- migrations-error.log contains error messages
- api-error.log might be empty (API never started)

**Debug:**
```bash
# Check migration error log
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /var/log/supervisor/migrations-error.log"

# Check if database is accessible
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor ls -la /data/"
```

**Common causes:**
- SQL syntax error in migration file
- Missing column/table referenced in migration
- Permission issues with /data volume
- Database locked by another process
- Migration version conflict

**Fix:**
1. Review migration error message carefully
2. Fix SQL syntax or migration logic
3. Test migration locally first:
   ```bash
   docker compose up --build
   # Check migrations ran successfully
   docker compose logs opengov-monitor | grep migration
   ```
4. Redeploy with fixed migration

**Prevention:**
- Always test migrations locally before deploying
- Review migration SQL carefully
- Test against production database copy

---

## 3. Container Builds But Health Check Fails

**Symptom:** Container status shows "unhealthy", but no obvious errors in logs

**Cause:** Health check expects `/api/health` to return 200, but API isn't responding

**How to identify:**
- Container status is "unhealthy"
- Supervisor processes might show RUNNING
- External health endpoint fails (502/503)

**Debug:**
```bash
# Test health endpoint inside container
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor curl -f http://localhost/api/health"

# Check if API is listening on port 3001
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor netstat -tlnp | grep 3001"

# Check API logs
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /var/log/supervisor/api-error.log"
```

**Common causes:**
- API crashed on startup (check api-error.log)
- Port 3001 not listening (API failed to start server)
- nginx misconfiguration (can't proxy to API)
- Database connection failed
- Health endpoint route not defined

**Fix:**
1. Identify root cause from error logs
2. Fix the underlying issue (API startup, nginx config, etc.)
3. Test locally to verify fix:
   ```bash
   docker compose up --build
   sleep 10
   curl -f http://localhost/api/health
   ```

**Prevention:**
- Always test health endpoint locally before deploying
- Verify all supervisor processes RUNNING

---

## 4. Forgot to Test Locally with Docker

**Issue:** Changes work with `pnpm run dev` locally but fail in production

**Why:** Local dev doesn't use Docker, supervisord, or nginx - different environment

**What's Different:**

| Environment | Setup |
|-------------|-------|
| **Local dev** | Direct Node.js process, Vite dev server, no nginx, no supervisor |
| **Production** | Docker container, nginx → Node.js API, supervisord managing processes |

**Example failures:**
- Environment variables not set in Dockerfile
- Static files not copied to container
- nginx routes not configured
- supervisor startup order issues
- Database path differences

**Solution:** ALWAYS test with Docker before deploying:
```bash
# Stop local dev server first
# ❌ pnpm run dev  # Not representative of production

# ✅ Test with Docker instead
docker compose up --build  # Matches production environment
curl http://localhost/api/health
docker compose exec opengov-monitor supervisorctl status
```

**Prevention:**
- Use Docker for all deployment testing
- Never trust "it works on my machine" (without Docker)
- Make Docker testing part of pre-deployment checklist

---

## 5. Deployment Checklist Not Followed

**Issue:** Skipping pre-deployment checks leads to broken deployments and rollbacks

**Why it happens:**
- In a rush to deploy
- "Small change, should be fine"
- Forgot one step
- Assumed tests would catch issues

**Consequences:**
- Production downtime
- Time wasted on rollbacks
- User-facing errors
- Need for emergency fixes
- Loss of confidence in deployment process

**Prevention:** Use this checklist EVERY time before deploying:
- [ ] Test Docker build locally (`docker compose up --build`)
- [ ] Verify supervisord.conf file references exist in Dockerfile
- [ ] Check container health locally (`curl http://localhost/api/health`)
- [ ] Verify all supervisor processes running
- [ ] Run tests (`pnpm test && pnpm run build`)
- [ ] After deploy: verify health endpoint
- [ ] After deploy: check supervisor status

**Golden Rule:** If you wouldn't deploy it locally, don't deploy it to production

**No exceptions:** Even "trivial" changes need testing. Missing a single file can break production.

---

## Quick Reference: Diagnosing Issues

| Symptom | Likely Cause | First Check |
|---------|-------------|-------------|
| Exit code 127 | Missing file | supervisord.conf vs Dockerfile |
| API FATAL | Migration failed | migrations-error.log |
| Container unhealthy | Health check failing | curl inside container |
| 502 errors | nginx can't reach API | Is API listening on 3001? |
| Works locally, fails prod | Environment difference | Did you test with Docker? |

---

## See Also

- [Pre-Deployment Checklist](./pre-deployment-checklist.md) - Prevent issues before deploy
- [Post-Deployment Verification](./post-deployment-verification.md) - Catch issues early
- [Debugging](./debugging.md) - Troubleshooting commands
