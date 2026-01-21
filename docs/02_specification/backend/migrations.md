# Database Migration System Specification

## Overview

Versioned database schema changes tracked in git, executed automatically in Docker deployment and manually during local development.

## Goals

- Version-controlled schema changes
- Idempotent execution (safe to run multiple times)
- Automated deployment (runs before API starts)
- Checksum validation (prevents modification of applied migrations)

## Architecture

```
backend/migrations/
├── versions/              # Numbered migration files (001-019)
├── baseline_schema.sql    # Generated schema for fresh databases
├── migration_runner.py    # Discovers, validates, executes migrations
├── generate_baseline.py   # Dumps schema from migrated DB to baseline file
├── create_migration.py    # Generates new migration files
├── baseline.py            # Marks migrations as applied without execution
└── README.md              # User guide

Database:
└── schema_migrations      # Tracks applied migrations
    ├── version (INTEGER PRIMARY KEY)
    ├── name (TEXT)
    ├── applied_at (TIMESTAMP)
    ├── checksum (TEXT)      # SHA256 of file contents
    └── execution_time_ms (INTEGER)
```

## Dual-Path Database Setup

Two paths to the same schema state:

```
Existing/Production DBs:
  migrations/versions/001-019 → Applied sequentially → Current state

Fresh DBs:
  migrations/baseline_schema.sql → Applied once → Current state
```

**Why:** Historical migrations (001-019) expect old schema (url columns, old column names). Fresh databases need the baseline path.

**Usage:**
```bash
# Fresh database (baseline path)
python migration_runner.py --db new.db --baseline

# Existing database (migration path)
python migration_runner.py --db existing.db
```

## Migration Tracking

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER
);
```

**Checksum validation:**
- Computed from file contents using SHA256
- Prevents modification of applied migrations
- Mismatch aborts migration run (developer must create new migration)

## File Format

**Naming convention:**
```
<version>_<description>.<type>
```

- `version`: Zero-padded 3-digit integer (001, 002, 003...)
- `description`: Snake_case description
- `type`: `sql` or `py`

**SQL migrations:**
```sql
-- Migration: Add notes column
-- Version: 002

ALTER TABLE "Referenda" ADD COLUMN "notes" TEXT;
```

**Python migrations:**
```python
"""
Migration: Complex data transformation
Version: 003
"""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()
    # Migration logic here
    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback (optional)."""
    pass
```

## Migration Runner

**Core logic** (`migration_runner.py`):
1. Ensure `schema_migrations` table exists
2. Discover migration files in `versions/` directory
3. Validate: check for gaps, duplicates, checksum mismatches
4. Filter pending migrations (not in `schema_migrations`)
5. Execute in order within transactions
6. Record in `schema_migrations` after success

**Transaction handling:**
- Each migration runs in explicit `BEGIN...COMMIT` transaction
- Automatic rollback on failure
- Stops on error (remaining migrations not executed)

**Execution:**
- SQL: Execute statements sequentially (not via `executescript()` to avoid auto-commit)
- Python: Import module, call `up(conn)` function

## Docker Integration

Migrations run automatically in Docker before API starts via wrapper script

## Local Development

**Commands** (in root `package.json`):
```bash
pnpm migrate                              # Run pending migrations
pnpm migrate:create --name <name> --type sql  # Create new migration
pnpm migrate:baseline --version N         # Mark migrations as applied
```

**Windows note:** Use `.venv/Scripts/python.exe` instead of `.venv/bin/python`

## Baseline Process

For existing databases with tables already created, mark migrations as applied without executing:

```bash
pnpm migrate:baseline --version N
```

This inserts records into `schema_migrations` with:
- Correct checksums from migration files
- `execution_time_ms = 0` (indicates baseline)
- Current timestamp

**Use case:** Deploying migration system to production database that already has schema.

**Process:**
1. Create snapshot migration (001) of existing schema
2. Deploy migration system
3. Run baseline on production: `pnpm migrate:baseline --version 1`
4. Future migrations (002+) run normally

## Workflow Integration

**When modifying schema:**
1. Create migration file: `pnpm migrate:create --name add_field --type sql`
2. Write migration SQL/Python
3. Update `backend/data_sinks/sqlite/schema.py` (must stay in sync with final migration state)
4. Test locally: `pnpm migrate`
5. Regenerate baseline: `python migrations/generate_baseline.py --db ../../data/local/polkadot.db --output migrations/baseline_schema.sql`
6. Commit migration file, schema.py, and updated baseline_schema.sql

## Security

- Migration files are trusted code (in git)
- Runner requires write access to database
- Checksum validation prevents tampering
- All executions logged for audit trail

## See Also

- [Migrations README](../../../src/backend/migrations/README.md) - User guide for creating and running migrations
- [Migration System Design](../../03_design/backend/migration-system-design.md) - Architecture and design decisions
- [Migration Patterns](../../03_design/migrations/patterns.md) - Common patterns (add/remove columns, views, indexes)
- [Troubleshooting](../../03_design/migrations/troubleshooting.md) - Common issues and fixes
- [Testing Strategies](../../03_design/migrations/testing-strategies.md) - How to test migrations
- [Advanced Examples](../../03_design/migrations/advanced-examples.md) - Complex migration scenarios
