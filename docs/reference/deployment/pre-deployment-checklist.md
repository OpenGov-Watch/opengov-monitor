# Pre-Deployment Checklist

Comprehensive checklist for verifying readiness before deploying to production.

**ALWAYS verify these steps before deploying to production:**

## 1. Test Docker Build Locally

```bash
docker compose up --build
```

**Why:** Catches build errors, missing dependencies, and configuration issues before they reach production.

**What to check:**
- Container builds without errors
- All dependencies install successfully
- Build completes in reasonable time
- No warnings about missing files

**Expected result:** Container builds and starts successfully

---

## 2. Verify supervisord.conf File References

```bash
# Check all command references in supervisord config
grep "command=" src/deploy/supervisord.conf

# Verify each file/script exists and is copied in Dockerfile
# Example: if supervisord.conf has "command=/app/deploy/script.sh"
# Then Dockerfile MUST have "COPY deploy/script.sh /app/deploy/script.sh"
```

**Why:** Missing files cause exit code 127 and service failures.

**What to check:**
- Every file referenced in supervisord.conf has a corresponding COPY in Dockerfile
- Script files have execute permissions (`RUN chmod +x`)
- File paths match exactly (case-sensitive)

**Expected result:** All referenced files exist in container

---

## 3. Test Container Health Locally

```bash
# Wait for startup
sleep 10

# Health check should return 200
curl -f http://localhost/api/health

# Check supervisor status
docker compose exec opengov-monitor supervisorctl status
```

**Why:** Verifies all services start and communicate correctly.

**Expected output:**
- ✅ nginx: RUNNING
- ✅ api: RUNNING (not FATAL)
- ✅ cron: RUNNING

**What to check:**
- Health endpoint returns HTTP 200 with `{"status":"ok"}`
- All supervisor processes show RUNNING status
- No FATAL or EXITED processes
- Logs show no errors

---

## 4. Run Tests

```bash
pnpm test
pnpm run build
```

**Why:** Ensures code quality and catches TypeScript errors before deployment.

**What to check:**
- All tests pass
- No test failures or errors
- Build completes without TypeScript errors
- No new warnings introduced

**Expected result:** Both commands exit with code 0

---

## 5. Review Changes

**Code review:**
- Check git diff to understand what's being deployed
- Review commit messages for breaking changes
- Verify no debug code or console.logs committed

**Database:**
- Verify migration files are correct (if database schema changed)
- Test migrations on local database
- Check migration rollback plans

**Environment:**
- Ensure required environment variables are set on production server
- Verify secrets are not hardcoded
- Check configuration matches production requirements

**Expected result:** All changes reviewed and understood

---

## Quick Checklist

Before every deployment:

- [ ] Test Docker build locally (`docker compose up --build`)
- [ ] Verify supervisord.conf file references exist in Dockerfile
- [ ] Check container health locally (`curl http://localhost/api/health`)
- [ ] Verify all supervisor processes running (`supervisorctl status`)
- [ ] Run tests (`pnpm test && pnpm run build`)
- [ ] Review git diff and commit messages
- [ ] Check database migrations (if applicable)
- [ ] Verify environment variables set on server

**Golden Rule:** If you wouldn't deploy it locally, don't deploy it to production

---

## See Also

- [Post-Deployment Verification](./post-deployment-verification.md) - Steps after deployment
- [Common Issues](./common-issues.md) - Frequent deployment problems
- [Debugging](./debugging.md) - Troubleshooting commands
