# Reset Local Database to Baseline

Resets local database to fresh v0 state from schema.py, then baselines and applies migrations.

## Use Case

When the database is in an inconsistent state after manual modifications or failed migrations, this resets it to a clean state with proper migration tracking.

## Prerequisites

**IMPORTANT:** Stop the dev server first! The database must not be locked.

```bash
# Press Ctrl+C in the terminal running pnpm run dev
```

## Workflow

1. **Backup current database**
   ```bash
   # Create timestamped backup
   cp data/local/polkadot.db "data/backup/polkadot-backup-$(date +%Y%m%d-%H%M%S).db"
   ```
   Confirm backup created.

2. **Remove current database**
   ```bash
   rm data/local/polkadot.db
   ```

3. **Create fresh v0 database from schema.py**
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe scripts\run_sqlite.py --db ..\data\local\polkadot.db --network polkadot

   # Unix
   cd backend && .venv/bin/python scripts/run_sqlite.py --db ../data/local/polkadot.db --network polkadot
   ```

   This will:
   - Create all tables from `schema.py`
   - Attempt to fetch data (interrupt with Ctrl+C once tables are created)

   **Note:** You only need tables created, not data fetched. Interrupt after seeing "Manual tables created/verified".

4. **Check latest migration version**
   ```bash
   ls backend/migrations/versions/ | tail -1
   ```

   Extract version number from filename (e.g., `003_remove_treasury_netflows_unique_constraint.sql` → version 3)

   Display to user: "Latest migration version: N"

5. **Baseline to latest version**
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe migrations\baseline.py --db ..\data\local\polkadot.db --version N

   # Unix
   cd backend && .venv/bin/python migrations/baseline.py --db ../data/local/polkadot.db --version N
   ```

   This marks migrations 1 through N as applied (with execution_time_ms = 0).

6. **Verify migration status**
   ```bash
   sqlite3 data/local/polkadot.db "SELECT version, name, execution_time_ms FROM schema_migrations ORDER BY version"
   ```

   Display table showing all baselined migrations.

7. **Verify key table schemas**
   ```bash
   # Check Treasury Netflows schema
   sqlite3 data/local/polkadot.db ".schema 'Treasury Netflows'"
   ```

   Confirm schema matches expected state after all migrations.

8. **Check for pending migrations**
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe migrations\migration_runner.py --db ..\data\local\polkadot.db

   # Unix
   cd backend && .venv/bin/python migrations/migration_runner.py --db ../data/local/polkadot.db
   ```

   Should show: "Already applied: N migrations" and "Pending migrations: 0"

## Summary

Display summary:
```
✅ Database reset complete!

Final state:
- Database: data/local/polkadot.db (fresh from schema.py)
- Version: N
- Migrations: 1-N baselined (execution_time_ms = 0)
- Backup: data/backup/polkadot-backup-YYYYMMDD-HHMMSS.db

You can now:
1. Start dev server: pnpm run dev
2. Run data sync: cd backend && .venv/Scripts/python.exe scripts/run_sqlite.py --db ../data/local/polkadot.db
```

## When to Use

- **After manual database modifications** that broke migration tracking
- **After failed migrations** that left database in inconsistent state
- **When migration checksums mismatch** (file modified after application)
- **To test fresh schema.py changes** before creating a new migration

## What This Does

1. Creates fresh database with current `schema.py` (v0 state)
2. Marks all existing migrations as "already applied" via baseline
3. This allows future migrations to run normally
4. Assumes `schema.py` already reflects all migration changes

## Important Notes

- **Data loss:** This deletes all existing data (only structure is preserved)
- **schema.py must be correct:** Must reflect the final state after all migrations
- **Baseline = skip execution:** Migrations are marked applied but not actually run
- **Use baseline when:** Schema.py already has the changes that migrations would make
- **Don't use baseline when:** Schema.py doesn't match migration end state

## Alternative: Test Migration on Copy

If you want to test migrations without losing data, use `/db-test-local-migration` instead.
