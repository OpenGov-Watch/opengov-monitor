# Migration Testing Strategies

How to test database migrations before deploying to production.

## Why Test Migrations

**Migrations are risky:**
- They modify production data
- They can't be easily rolled back
- Errors can cause downtime
- Failed migrations can block deployments

**Testing catches:**
- SQL syntax errors
- Constraint violations
- Data type mismatches
- Performance issues
- Edge cases in production data

**Golden rule:** Test every migration thoroughly before deploying.

---

## Strategy 1: Test on Existing Database

**When to use:** Testing migrations on your development database with real data

**Advantages:**
- Fastest approach
- Uses your current data
- Catches issues with existing records

**Disadvantages:**
- Won't catch issues with fresh database setup
- May miss edge cases not in your dev data

**How to do it:**

```bash
# 1. Backup your database first (IMPORTANT!)
cp data/local/polkadot.db data/local/polkadot.db.backup

# 2. Run migrations
pnpm migrate

# 3. Verify the changes
sqlite3 data/local/polkadot.db ".schema TableName"

# 4. Test the application
pnpm dev
# Navigate to affected features, check for errors

# 5. Verify data integrity
sqlite3 data/local/polkadot.db "SELECT COUNT(*) FROM TableName"
# Compare counts before/after if applicable

# 6. If something goes wrong, restore backup
cp data/local/polkadot.db.backup data/local/polkadot.db
```

**What to check:**
- Migration completes without errors
- Schema matches expectations (`.schema`)
- Application starts successfully
- Affected features work correctly
- No data was lost (check counts)

---

## Strategy 2: Test from Scratch

**When to use:** Verifying migrations work on a fresh database

**Advantages:**
- Ensures migrations work from empty state
- Tests the full migration sequence
- Validates baseline setup

**Disadvantages:**
- Doesn't test against production data patterns
- May miss issues with existing records

**How to do it:**

```bash
# 1. Backup current database (optional)
cp data/local/polkadot.db data/local/polkadot.db.backup

# 2. Start with empty database
rm data/local/polkadot.db

# 3. Run all migrations (creates tables)
pnpm migrate

# 4. Verify schema created correctly
sqlite3 data/local/polkadot.db ".tables"
sqlite3 data/local/polkadot.db ".schema"

# 5. Test application startup
pnpm dev

# 6. Run data sync to populate
pnpm sync  # Or however you populate data

# 7. Verify data loaded correctly
sqlite3 data/local/polkadot.db "SELECT COUNT(*) FROM Referenda"

# 8. Restore original database
cp data/local/polkadot.db.backup data/local/polkadot.db
```

**What to check:**
- All migrations run in order
- No version conflicts
- Tables and indexes created
- Application can connect to DB
- Data sync works correctly

**Best for:**
- New migration system setup
- Testing complete migration sequence
- CI/CD pipeline testing

---

## Strategy 3: Test on Production Data Copy

**When to use:** Before deploying to production, especially for complex migrations

**Advantages:**
- Tests against real production data volumes
- Catches edge cases and data issues
- Most realistic testing scenario
- Can measure performance impact

**Disadvantages:**
- Requires access to production database
- Takes more time to set up
- Need to handle sensitive data carefully

**How to do it:**

### Step 1: Download Production Database

```bash
# Option A: Using gcloud (if on GCP)
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker cp opengov-monitor:/data/polkadot.db /tmp/polkadot-prod.db"

gcloud compute scp web-server:/tmp/polkadot-prod.db ./data/local/ \
  --zone=us-central1-a --tunnel-through-iap

# Option B: Using scp directly
scp user@server:/data/polkadot.db ./data/local/polkadot-prod.db

# Option C: Using docker cp (if SSH'd into server)
docker cp opengov-monitor:/data/polkadot.db ./polkadot-prod.db
```

### Step 2: Backup Local Database

```bash
# Save your current development database
cp data/local/polkadot.db data/local/polkadot-dev.db
```

### Step 3: Use Production Copy

```bash
# Replace local DB with production copy
cp data/local/polkadot-prod.db data/local/polkadot.db
```

### Step 4: Test Migration

```bash
# Run migrations
pnpm migrate

# Check for errors
echo $?  # Should be 0

# Verify schema
sqlite3 data/local/polkadot.db ".schema TableName"
```

### Step 5: Verify Data Integrity

```bash
# Check migration tracking
sqlite3 data/local/polkadot.db \
  "SELECT * FROM schema_migrations ORDER BY version"

# Verify row counts
sqlite3 data/local/polkadot.db \
  "SELECT
    (SELECT COUNT(*) FROM Referenda) as referenda_count,
    (SELECT COUNT(*) FROM Categories) as categories_count"

# Check specific data affected by migration
sqlite3 data/local/polkadot.db \
  "SELECT * FROM TableName WHERE new_field IS NULL LIMIT 10"
```

### Step 6: Test Application

```bash
# Start application with production data copy
pnpm dev

# Test affected features thoroughly:
# - Navigate to impacted pages
# - Check for errors in console
# - Verify data displays correctly
# - Test any new features from migration
```

### Step 7: Performance Check

```bash
# Time the migration (for production estimate)
time pnpm migrate

# Check query performance on migrated data
sqlite3 data/local/polkadot.db
EXPLAIN QUERY PLAN SELECT * FROM TableName WHERE new_field = 'value';
.exit
```

### Step 8: Restore Development Database

```bash
# Restore your original dev database
cp data/local/polkadot-dev.db data/local/polkadot.db

# Clean up production copy
rm data/local/polkadot-prod.db
```

**What to check:**
- Migration completes successfully
- No data corruption or loss
- Performance is acceptable
- Edge cases in production data handled
- Indexes working as expected
- Application handles migrated data correctly

**Best for:**
- Complex migrations
- Migrations on large tables
- Migrations with data transformations
- High-risk deployments
- Before major releases

---

## Strategy 4: Test in Docker (Production Environment)

**When to use:** Before deploying, to verify migrations work in production environment

**Advantages:**
- Matches production setup exactly
- Tests migration runner in container
- Catches environment-specific issues

**How to do it:**

```bash
# 1. Build and start container
docker compose up --build

# 2. Wait for startup (migrations run automatically)
sleep 10

# 3. Check if migrations succeeded
docker compose logs opengov-monitor | grep -i migration

# 4. Verify supervisor status
docker compose exec opengov-monitor supervisorctl status
# Should show: api RUNNING (not FATAL)

# 5. Check health endpoint
curl -f http://localhost/api/health

# 6. Check migration log for errors
docker compose exec opengov-monitor \
  cat /var/log/supervisor/migrations-error.log

# 7. Verify schema in container
docker compose exec opengov-monitor \
  sqlite3 /data/polkadot.db ".schema TableName"

# 8. Stop container
docker compose down
```

**What to check:**
- Container builds successfully
- Migrations run on startup
- API starts (no FATAL status)
- No errors in migration log
- Health endpoint returns 200

**Best for:**
- Pre-deployment testing
- Verifying Docker configuration
- Testing migration wrapper script
- CI/CD pipeline validation

---

## Combined Testing Workflow

**Recommended approach for important migrations:**

1. **Quick test** - Test on existing dev database (Strategy 1)
   - Catches basic errors fast
   - Verifies SQL syntax

2. **Fresh test** - Test from scratch (Strategy 2)
   - Ensures full migration sequence works
   - Validates baseline

3. **Production test** - Test on production copy (Strategy 3)
   - Catches edge cases
   - Verifies performance
   - Tests real data volumes

4. **Docker test** - Test in Docker (Strategy 4)
   - Verifies deployment setup
   - Final check before deploying

**Time investment:**
- Simple migrations: Strategies 1 + 4 (15 minutes)
- Complex migrations: All strategies (1-2 hours)
- Critical migrations: All strategies + extended testing (half day)

---

## Testing Checklist

Before deploying a migration:

- [ ] SQL syntax is valid
- [ ] Migration tested on existing database
- [ ] Migration tested from scratch
- [ ] Migration tested on production data copy
- [ ] Migration tested in Docker
- [ ] No errors in migration logs
- [ ] Schema matches expectations
- [ ] Data integrity verified (counts, samples)
- [ ] Application starts and works
- [ ] Affected features tested manually
- [ ] Performance is acceptable
- [ ] Rollback plan documented
- [ ] Team notified of deployment

---

## See Also

- [Migration Patterns](./patterns.md) - Common migration patterns
- [Troubleshooting](./troubleshooting.md) - Common issues and fixes
- [Advanced Examples](./advanced-examples.md) - Complex migration scenarios
