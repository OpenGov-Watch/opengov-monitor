# Deploy with Full Validation

Execute the complete pre-deployment validation workflow.

## Steps

Execute these steps in order, stopping on first failure:

### 1. Build Project
```bash
pnpm run build
```
Report: ✓ Build successful / ✗ Build failed

### 2. Run All Tests
```bash
pnpm test
```
Report: ✓ All tests passed / ✗ Tests failed

### 3. Push to Repository
```bash
git push origin $(git branch --show-current)
```
Report: ✓ Pushed to origin/[branch]

### 4. Check GitHub Actions
Use the `/check-github-action-runs` skill.
- Watch CI workflow until completion
- Report: ✓ CI workflow passed / ✗ CI workflow failed

### 5. Verify Container (if --with-migration in args)
**Check migrations:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec -w /app/api opengov-monitor node -e \"const Database = require('better-sqlite3'); const db = new Database('/data/polkadot.db', { readonly: true }); const migrations = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all(); console.log(JSON.stringify(migrations, null, 2))\""
```

**Check health:**
```bash
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo /usr/local/bin/service-status opengov-monitor"
```

Report: ✓ Migration applied, container healthy

### 6. Browser Test (if --browser-url in args)
- Navigate to provided URL using Chrome DevTools
- Take screenshot
- Take snapshot
- Ask user to verify feature works correctly

Report: ✓ Browser testing complete

## Summary

After all steps complete, display:
```
================================
✓ All validation steps passed!
================================

Deployment Summary:
  Branch: [branch]
  Latest commit: [commit]
  CI Run: [run-id]
  Migration: [Applied and verified / N/A]
  Browser: [Tested at URL / N/A]

🎉 Deployment validated successfully!
```

## Usage Examples

Basic deployment:
```
/deploy-validate
```

With migration check:
```
/deploy-validate --with-migration
```

Full validation with browser test:
```
/deploy-validate --with-migration --browser-url https://polkadot-treasury-monitor.cypherpunk.agency/manage/data-errors
```
