# OpenGov Monitor Backend

Python data pipeline: fetches governance data from Subsquare, enriches with USD prices, stores to SQLite.

## Database Setup

The backend requires a properly initialized database with all migrations applied.

### New Database

```bash
# Run all migrations (creates tables and views)
pnpm migrate

# Or from backend directory
python migrations/migration_runner.py --db ../data/local/polkadot.db
```

### Existing Database

If you have an existing database that was created before the migration system,
baseline it first to mark existing migrations as applied:

```bash
# Mark existing database as "up to date" at version N
pnpm migrate:baseline -- --version <latest_version>

# Then apply any new migrations
pnpm migrate
```

Note: The `--` before `--version` is needed to pass arguments through pnpm.

The server will fail to start if migrations have not been run.

## Commands

```bash
source .venv/bin/activate

# Auto-detect mode (backfill empty tables, incremental for populated)
python scripts/run_sqlite.py --db ../data/local/polkadot.db

# Force full backfill
python scripts/run_sqlite.py --db ../data/local/polkadot.db --backfill

# Run tests
pytest
```

## Architecture

See [CLAUDE.md](CLAUDE.md) for key files and detailed documentation.
