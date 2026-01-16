# Migration Troubleshooting

Common migration issues and their solutions.

## Migration Failed Mid-Execution

**Symptom:** Migration fails with an error, database appears unchanged

**Why this happens:** Migrations run in transactions. If any part fails, the entire transaction is rolled back.

**What to do:**

1. **Check the error message** - It will tell you what went wrong (syntax error, constraint violation, etc.)

2. **No data was changed** - The rollback ensures your database is in the same state as before

3. **Fix the migration file:**
   ```bash
   # Edit the migration file
   vim backend/migrations/versions/004_add_field.sql
   ```

4. **Re-run migrations:**
   ```bash
   pnpm migrate
   ```

**Example errors:**

**SQL syntax error:**
```
Error: near "COLUMN": syntax error
```
→ Check SQL syntax, missing commas, typos

**Constraint violation:**
```
Error: UNIQUE constraint failed: TableName.field
```
→ Duplicate values exist, clean data first or use unique index

**Column already exists:**
```
Error: duplicate column name: field_name
```
→ Migration was partially applied before, or column exists from previous migration

---

## Applied Migration Was Modified

**Symptom:**
```
Error: Checksum mismatch for migration 004_add_field.sql
Expected: abc123...
Got: def456...
```

**Why this happens:** The migration system stores a checksum (hash) of each migration when it's applied. If you modify the file later, the checksum won't match.

**Why this matters:** Migrations that have already run must not be changed, as other databases may have applied the original version.

**Solutions:**

### If not deployed to production:
```bash
# Option 1: Reset your local migration history
rm data/local/polkadot.db
pnpm migrate  # Starts fresh

# Option 2: Manually update the checksum (advanced)
sqlite3 data/local/polkadot.db
UPDATE schema_migrations SET checksum = '<new_checksum>' WHERE version = 4;
```

### If deployed to production:
**DO NOT modify the migration.** Instead:

1. **Create a new migration** to make additional changes:
   ```bash
   pnpm migrate:create --name fix_add_field --type sql
   ```

2. **Add the correction** in the new migration:
   ```sql
   -- Migration: Fix field added in 004
   -- Version: 005

   ALTER TABLE "TableName" DROP COLUMN "wrong_field";
   ALTER TABLE "TableName" ADD COLUMN "correct_field" TEXT;
   ```

**Golden rule:** Once a migration is deployed, it's immutable. Always create a new migration for fixes.

---

## Gap in Version Numbers

**Symptom:**
```
Error: Missing migration version 003
Found: 001, 002, 004, 005
```

**Why this happens:** Version numbers must be sequential. If you delete a migration file or rename it incorrectly, you'll create a gap.

**Solutions:**

### If migrations not deployed:
**Option 1: Restore the deleted file**
```bash
git checkout HEAD -- backend/migrations/versions/003_*.sql
```

**Option 2: Renumber migrations** (risky, only if not deployed)
```bash
# Move version 004 to 003
mv backend/migrations/versions/004_add_field.sql \
   backend/migrations/versions/003_add_field.sql

# Update version number inside the file
sed -i 's/Version: 004/Version: 003/' backend/migrations/versions/003_*.sql

# Repeat for all subsequent migrations
```

### If migrations deployed:
**DO NOT renumber.** The gap is permanent. Either:
- Restore the missing migration
- Or leave the gap and document why it exists

---

## Docker Container Won't Start

**Symptom:** Container starts but immediately exits, or shows unhealthy status

**Cause:** Migrations run automatically on container startup. If they fail, the API won't start.

**How to diagnose:**

1. **Check container logs:**
   ```bash
   docker logs <container-id>
   ```

2. **Check supervisor logs in running container:**
   ```bash
   docker exec opengov-monitor cat /var/log/supervisor/migrations-error.log
   ```

3. **Look for migration errors:**
   ```
   Error applying migration 004_add_field.sql: ...
   ```

**How to fix:**

1. **Identify the failing migration** from error logs

2. **Fix the migration file** locally

3. **Test locally:**
   ```bash
   docker compose up --build
   ```

4. **Redeploy** when confirmed working

**Prevention:** Always test migrations locally with Docker before deploying:
```bash
docker compose up --build
docker compose exec opengov-monitor supervisorctl status
```

---

## Checksum Mismatch on Unchanged Migrations

**Symptom:**
```
Error: Checksum mismatch for migration 002_add_categories.sql
But I didn't modify this file!
```

**Cause:** Line ending differences between Windows (CRLF) and Linux (LF)

**Why this happens:**
- You edited the file on Windows (CRLF line endings)
- Production runs on Linux (expects LF line endings)
- Same content, different checksums

**Prevention:** The `.gitattributes` file at repository root forces LF endings for all migration files:
```
*.sql text eol=lf
*.py text eol=lf
```

**Fix if you encounter this:**

1. **Convert migration files to LF:**
   ```bash
   # Using dos2unix (install if needed)
   dos2unix backend/migrations/versions/*.sql
   dos2unix backend/migrations/versions/*.py
   ```

2. **Or using git:**
   ```bash
   # Remove files from git cache
   git rm --cached backend/migrations/versions/*.sql
   git rm --cached backend/migrations/versions/*.py

   # Re-add (will use .gitattributes rules)
   git add backend/migrations/versions/
   ```

3. **Commit the line ending fix:**
   ```bash
   git commit -m "fix: normalize line endings in migrations"
   ```

4. **Future commits** will maintain LF endings automatically (thanks to `.gitattributes`)

---

## Database Locked

**Symptom:**
```
Error: database is locked
```

**Cause:** Another process has the database open with a write lock

**Common scenarios:**
- SQLite browser tool is open
- Another migration process is running
- Application is running and has database open

**Fix:**

1. **Close all database connections:**
   - Close SQLite browser/viewer
   - Stop pnpm dev server
   - Stop any running migrations

2. **Check for hanging processes:**
   ```bash
   # On Linux/Mac
   lsof data/local/polkadot.db

   # On Windows
   handle data\local\polkadot.db
   ```

3. **Kill hanging processes** if found

4. **Try migration again:**
   ```bash
   pnpm migrate
   ```

---

## Migration Runs But Changes Not Visible

**Symptom:** Migration completes successfully, but database appears unchanged

**Possible causes:**

**1. Looking at wrong database:**
```bash
# Check which database you're using
echo $DATABASE_PATH  # Or check your .env
```

**2. Application cached old schema:**
```bash
# Restart application
pnpm dev
```

**3. Need to commit transaction (Python migrations):**
```python
def up(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE...")
    conn.commit()  # Don't forget this!
```

**Verify changes:**
```bash
sqlite3 data/local/polkadot.db ".schema TableName"
```

---

## Quick Diagnostic Checklist

When migrations fail:

1. [ ] Read the error message carefully
2. [ ] Check migration file syntax
3. [ ] Verify database not locked
4. [ ] Test migration on empty database
5. [ ] Check for line ending issues (Windows)
6. [ ] Look for constraint violations
7. [ ] Verify previous migrations all succeeded
8. [ ] Check Docker logs if in container
9. [ ] Test locally before deploying

---

## See Also

- [Migration Patterns](./patterns.md) - Common migration patterns
- [Testing Strategies](./testing-strategies.md) - How to test migrations
- [Advanced Examples](./advanced-examples.md) - Complex scenarios
