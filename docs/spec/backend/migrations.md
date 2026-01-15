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
├── versions/              # Numbered migration files
│   ├── 001_initial.sql
│   └── 002_add_field.sql
├── migration_runner.py    # Discovers, validates, executes migrations
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

Migrations run before API starts via wrapper script:

**`deploy/run-migrations-then-api.sh`:**
```bash
#!/bin/bash
# Run migrations first
python /app/backend/migrations/migration_runner.py --db /data/polkadot.db || exit 1

# Start API only if migrations succeed
exec node /app/api/dist/index.js
```

**`deploy/supervisord.conf`:**
```ini
[program:api]
command=/bin/bash /app/deploy/run-migrations-then-api.sh
priority=10
autorestart=true
```

This prevents race conditions where API starts before migrations complete.

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
3. Update `backend/data_sinks/sqlite/schema.py` to match end state
4. Test locally: `pnpm migrate`
5. Commit both migration and schema files

**Schema.py role:**
- Defines desired end state of schema
- Used by backend code for table creation
- Must stay in sync with migrations

## Key Design Decisions

**Why checksums?**
- Prevents accidental modification of applied migrations
- Forces explicit new migrations for fixes
- Maintains audit trail

**Why explicit transactions?**
- SQLite `executescript()` auto-commits between statements
- Explicit `BEGIN` allows atomic rollback on failure

**Why wrapper script?**
- Prevents API from starting before migrations complete
- Avoids SQLite lock conflicts
- Cleaner than supervisord dependency management

**Why not drop tables?**
- Migrations must preserve existing data
- Table recreation only for column removal (SQLite limitation)

## Security

- Migration files are trusted code (in git)
- Runner requires write access to database
- Checksum validation prevents tampering
- All executions logged for audit trail
