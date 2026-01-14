# Test Migration Against Production Database

Download production database, run migrations against the copy (without touching local DB).

## Production DB Location

- Container: `opengov-monitor`
- Path: `/data/polkadot.db`
- VM: `web-server` (zone: us-central1-a, via IAP)

## Workflow

1. **Download production database**
   ```bash
   # Copy from container to VM
   gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
     --command="sudo docker cp opengov-monitor:/data/polkadot.db /tmp/polkadot-prod.db"

   # Download to local
   gcloud compute scp web-server:/tmp/polkadot-prod.db data/polkadot-prod.db \
     --zone=us-central1-a --tunnel-through-iap
   ```

2. **Check current version**
   ```bash
   # Show applied migrations
   sqlite3 data/polkadot-prod.db "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
   ```
   Display current version and identify pending migrations.

3. **Run migrations against production copy**
   ```bash
   # Windows
   cd backend && .venv\Scripts\python.exe migrations\migration_runner.py --db ..\data\polkadot-prod.db

   # Unix
   cd backend && .venv/bin/python migrations/migration_runner.py --db ../data/polkadot-prod.db
   ```
   Display results, execution time, any errors.

4. **Verify results**
   ```bash
   # Show migration status
   sqlite3 data/polkadot-prod.db "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"

   # Show schema changes (if user modified specific tables)
   sqlite3 data/polkadot-prod.db ".schema TableName"
   ```

5. **Test with application (optional)**
   Ask if user wants to test the migrated database:
   ```bash
   # Temporarily point app at production copy
   DATABASE_PATH=data/polkadot-prod.db pnpm api:dev
   ```

## Notes

- Local `data/polkadot.db` remains untouched
- Can run multiple times by re-downloading production DB
- Tests migration performance on real data volumes
- NEVER modify production database directly
