# Test Migration Against Local Database

Test migrations against a copy of the local development database (without touching the original).

## Local DB Location

- Path: `data/polkadot.db` (local development database)
- Test copy: `data/polkadot-test.db` (created temporarily)

## Workflow

1. **Create copy of local database**
   ```bash
   # Windows
   cp data\polkadot.db data\polkadot-test.db

   # Unix
   cp data/polkadot.db data/polkadot-test.db
   ```
   Confirm copy created successfully.

2. **Check current version**
   ```bash
   # Show applied migrations
   sqlite3 data/polkadot-test.db "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
   ```
   Display current version and identify pending migrations.

3. **Run migrations against test copy**
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe migrations\migration_runner.py --db ..\data\polkadot-test.db

   # Unix
   cd backend && .venv/bin/python migrations/migration_runner.py --db ../data/polkadot-test.db
   ```
   Display results, execution time, any errors.

4. **Verify results**
   ```bash
   # Show migration status
   sqlite3 data/polkadot-test.db "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"

   # Show table counts (sanity check)
   sqlite3 data/polkadot-test.db "SELECT
     (SELECT COUNT(*) FROM Referenda) as referenda_count,
     (SELECT COUNT(*) FROM Treasury) as treasury_count,
     (SELECT COUNT(*) FROM \"Treasury Netflows\") as netflows_count"

   # Show schema changes (if user modified specific tables)
   sqlite3 data/polkadot-test.db ".schema TableName"
   ```

5. **Test with application (optional)**
   Ask if user wants to test the migrated database:
   ```bash
   # Temporarily point app at test copy
   DATABASE_PATH=data/polkadot-test.db pnpm api:dev
   ```

6. **Apply to real local database (if successful)**
   If tests pass and user confirms, run against actual local DB:
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe migrations\migration_runner.py --db ..\data\polkadot.db

   # Unix
   cd backend && .venv/bin/python migrations/migration_runner.py --db ../data/polkadot.db
   ```

7. **Cleanup**
   ```bash
   # Windows
   del data\polkadot-test.db

   # Unix
   rm data/polkadot-test.db
   ```

## Notes

- Local `data/polkadot.db` remains untouched until step 6
- Can run multiple times by recreating test copy
- Tests migration against real local data
- Always test on copy first before applying to actual database
- Faster than production testing (no download needed)
- Good for iterative migration development
