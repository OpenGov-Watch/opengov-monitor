# Database Migration System Specification

## Overview

This document specifies the database migration system for OpenGov Monitor. The system enables versioned, trackable schema changes that work seamlessly with the Docker-based deployment workflow.

## Goals

1. **Version Control**: All schema changes tracked in git and applied in order
2. **Idempotent**: Safe to run multiple times without side effects
3. **Automated**: Migrations run automatically on Docker container startup
4. **Testable**: Can be tested locally before deployment
5. **Auditable**: Track which migrations have been applied and when

## Architecture

### Components

```
backend/migrations/
├── versions/              # Migration files (numbered)
│   ├── 001_initial_schema.sql
│   ├── 002_add_categories_table.sql
│   └── 003_remove_old_column.sql
├── migration_runner.py   # Python migration orchestrator
└── README.md             # Migration authoring guide

Backend Database (SQLite):
├── schema_migrations     # Tracks applied migrations
│   ├── version (INTEGER PRIMARY KEY)
│   ├── name (TEXT)
│   ├── applied_at (TIMESTAMP)
│   └── checksum (TEXT)
```

### Migration Tracking Table

The `schema_migrations` table tracks which migrations have been applied:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER
);
```

## Migration File Format

### Naming Convention

```
<version>_<description>.<type>
```

- **version**: Zero-padded 3-digit integer (001, 002, 003...)
- **description**: Snake_case description of the change
- **type**: File extension (`.sql` or `.py`)

Examples:
- `001_initial_schema.sql`
- `002_add_user_preferences.sql`
- `003_migrate_fellowship_data.py`

### SQL Migration Format

SQL migrations contain raw SQL statements with optional transaction control:

```sql
-- Migration: Add notes column to Referenda
-- Version: 002
-- Description: Adds a notes field for internal annotations

-- Up Migration
ALTER TABLE "Referenda" ADD COLUMN "notes" TEXT;
CREATE INDEX "idx_referenda_notes" ON "Referenda" ("notes");

-- Optionally add data transformations
UPDATE "Referenda" SET notes = '' WHERE notes IS NULL;
```

### Python Migration Format

For complex data transformations that require logic:

```python
"""
Migration: Migrate legacy categories to new structure
Version: 003
"""
import sqlite3
from typing import Optional

def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()

    # Example: Complex data transformation
    cursor.execute("SELECT id, old_category FROM Items")
    for row in cursor.fetchall():
        item_id, old_cat = row
        new_cat = transform_category(old_cat)
        cursor.execute(
            "UPDATE Items SET new_category = ? WHERE id = ?",
            (new_cat, item_id)
        )

    # Remove old column
    # Note: SQLite requires table recreation for column removal
    cursor.execute("""
        CREATE TABLE Items_new AS
        SELECT id, name, new_category
        FROM Items
    """)
    cursor.execute("DROP TABLE Items")
    cursor.execute("ALTER TABLE Items_new RENAME TO Items")

    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback the migration (optional)."""
    # Reverse migrations are optional but recommended
    # Leave empty if not reversible
    pass

def transform_category(old: str) -> str:
    """Transform old category format to new."""
    mapping = {
        "dev": "Development",
        "mkt": "Marketing",
    }
    return mapping.get(old, "Other")
```

## Migration Runner

### Core Logic

The migration runner (`backend/migrations/migration_runner.py`):

1. **Initialize**: Ensure `schema_migrations` table exists
2. **Discover**: Find all migration files in `versions/` directory
3. **Validate**: Check for gaps in version numbers, duplicate versions
4. **Filter**: Identify migrations not yet applied
5. **Execute**: Run pending migrations in order
6. **Record**: Update `schema_migrations` table after each successful migration

### Checksum Validation

Each migration file has a checksum computed from its contents:
- Prevents accidental modification of applied migrations
- If checksum mismatch detected, abort with error
- Developers must create a new migration to fix issues

### Error Handling

- **Transaction per migration**: Each migration runs in a transaction
- **Rollback on failure**: Failed migration triggers rollback
- **Stop on error**: No further migrations run if one fails
- **Detailed logging**: Log file location, version, error details

## Integration Points

### 1. Docker Startup

The migration runner executes during container initialization, before the API starts:

**Updated `Dockerfile`:**
```dockerfile
# After copying backend files
COPY backend/migrations/ ./backend/migrations/

# No changes to build stages
```

**Updated `deploy/supervisord.conf`:**
```ini
[program:migrations]
command=/app/backend/.venv/bin/python /app/backend/migrations/migration_runner.py --db /data/polkadot.db
directory=/app/backend
autostart=true
autorestart=false
startsecs=0
stdout_logfile=/var/log/supervisor/migrations.log
stderr_logfile=/var/log/supervisor/migrations-error.log
priority=1  # Run before API

[program:api]
command=/usr/local/bin/node /app/api/dist/index.js
directory=/app/api
environment=NODE_ENV="production",PORT="3001",DATABASE_PATH="/data/polkadot.db"
autostart=true
autorestart=true
stdout_logfile=/var/log/supervisor/api.log
stderr_logfile=/var/log/supervisor/api-error.log
priority=10  # Run after migrations
depends_on=migrations
```

### 2. Local Development

**New pnpm script** in root `package.json`:

```json
{
  "scripts": {
    "migrate": "cd backend && .venv/bin/python migrations/migration_runner.py --db ../data/polkadot.db",
    "migrate:create": "cd backend && .venv/bin/python migrations/create_migration.py"
  }
}
```

**Usage:**
```bash
# Run pending migrations locally
pnpm migrate

# Create a new migration file
pnpm migrate:create --name add_user_preferences --type sql
```

### 3. Backend Schema Updates

When `backend/data_sinks/sqlite/schema.py` changes, the developer must:

1. Create a migration file reflecting the schema change
2. Update `schema.py` to match the desired end state
3. Test locally: reset DB, run migrations, verify schema matches

This keeps migrations and schema definitions in sync.

## Workflows

### Creating a New Migration

1. **Identify the change needed** (e.g., add a column)

2. **Create migration file:**
   ```bash
   pnpm migrate:create --name add_referenda_priority --type sql
   ```

   This generates: `backend/migrations/versions/004_add_referenda_priority.sql`

3. **Edit the migration file:**
   ```sql
   -- Migration: Add priority field to Referenda
   -- Version: 004

   ALTER TABLE "Referenda" ADD COLUMN "priority" INTEGER DEFAULT 0;
   CREATE INDEX "idx_referenda_priority" ON "Referenda" ("priority");
   ```

4. **Update schema definition** in `backend/data_sinks/sqlite/schema.py`:
   ```python
   REFERENDA_SCHEMA = TableSchema(
       name="Referenda",
       columns={
           "id": "INTEGER",
           # ... existing columns ...
           "priority": "INTEGER",  # Add new column
       },
       # ...
   )
   ```

5. **Test locally:**
   ```bash
   # Backup your DB first
   cp data/polkadot.db data/polkadot.db.backup

   # Run migration
   pnpm migrate

   # Verify schema
   sqlite3 data/polkadot.db ".schema Referenda"

   # Test with real data
   pnpm dev
   ```

6. **Commit both files:**
   ```bash
   git add backend/migrations/versions/004_add_referenda_priority.sql
   git add backend/data_sinks/sqlite/schema.py
   git commit -m "feat: add priority field to referenda"
   ```

### Testing Migrations Locally

**Option 1: Test on existing database**
```bash
# Run migrations on your current DB
pnpm migrate
```

**Option 2: Test from scratch**
```bash
# Start with empty DB
rm data/polkadot.db
pnpm migrate  # Creates tables via migrations
pnpm dev      # Verify application works
```

**Option 3: Test on production data copy**
```bash
# Download production DB (if accessible)
scp user@server:/data/polkadot.db ./data/polkadot.db.prod

# Test migration on production data
pnpm migrate

# Verify results
sqlite3 data/polkadot.db.prod "SELECT * FROM schema_migrations"
```

### Removing a Column (Complex Example)

SQLite doesn't support `DROP COLUMN` directly, so column removal requires table recreation:

**Migration file: `005_remove_old_field.sql`**
```sql
-- Migration: Remove deprecated 'old_field' from Referenda
-- Version: 005

-- SQLite doesn't support DROP COLUMN, so we recreate the table

-- Step 1: Create new table without the old column
CREATE TABLE "Referenda_new" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT,
    "status" TEXT,
    -- All other columns EXCEPT old_field
    "notes" TEXT
);

-- Step 2: Copy data
INSERT INTO "Referenda_new"
SELECT id, title, status, notes  -- Exclude old_field
FROM "Referenda";

-- Step 3: Drop old table
DROP TABLE "Referenda";

-- Step 4: Rename new table
ALTER TABLE "Referenda_new" RENAME TO "Referenda";

-- Step 5: Recreate indexes
CREATE INDEX "idx_referenda_status" ON "Referenda" ("status");
CREATE INDEX "idx_referenda_track" ON "Referenda" ("track");
```

## Migration Helper Scripts

### `migration_runner.py`

**Location**: [`backend/migrations/migration_runner.py`](../../backend/migrations/migration_runner.py)

Main migration orchestrator with the following responsibilities:

**Core Functions:**
- `discover_migrations()`: Scans versions/ directory, parses filenames
- `validate_migrations()`: Checks for gaps, duplicates, modified checksums
- `execute_sql_migration()`: Runs SQL files within transactions (statement-by-statement)
- `execute_python_migration()`: Imports and calls `up()` function
- `run_migration()`: Wraps execution in explicit transaction with rollback on failure

**Key Implementation Details:**
- Uses SHA256 checksums to detect modified migrations
- Validates sequential version numbers (detects gaps)
- Explicit `BEGIN` transaction for atomic rollback
- Avoids `executescript()` to prevent auto-commit issues
- Records execution time and checksum in `schema_migrations`

See [`backend/migrations/migration_runner.py`](../../backend/migrations/migration_runner.py) for implementation.

### `create_migration.py`

Helper to create new migration files with proper naming and templates.

**Key functions:**
- `get_next_version()`: Finds max version + 1
- `create_migration()`: Generates file with template

See [`backend/migrations/create_migration.py`](../../backend/migrations/create_migration.py) for implementation.

### `baseline.py`

Marks migrations as applied without executing them (for existing databases):

```bash
python baseline.py --db /data/polkadot.db --version N
```

See [`backend/migrations/baseline.py`](../../backend/migrations/baseline.py) for implementation.

## Migration Helper Scripts

The migration system consists of three Python scripts in `backend/migrations/`:

### `migration_runner.py`

**Purpose**: Main orchestrator that discovers, validates, and executes pending migrations

**Key functions**:
- `discover_migrations()` - Finds all migration files in versions/
- `validate_migrations()` - Checks for gaps, duplicates, modified migrations
- `execute_sql_migration()` - Runs SQL migrations in transaction
- `execute_python_migration()` - Imports and executes Python migration modules
- `run_migration()` - Orchestrates execution and records in schema_migrations

**Transaction handling**:
- Uses explicit `BEGIN` transaction for all migrations
- Rolls back atomically on any failure
- Sets `isolation_level='DEFERRED'` for proper SQLite transaction mode

See [migration_runner.py](../../backend/migrations/migration_runner.py) for implementation.

### `create_migration.py`

Helper script to generate new migration files:
- Determines next sequential version number
- Creates file with proper naming convention (NNN_description.{sql|py})
- Populates with template based on type
- See [create_migration.py](../../backend/migrations/create_migration.py)

### `baseline.py`

Marks existing migrations as applied without executing them:
- Used when deploying to existing databases
- Inserts records into schema_migrations with correct checksums
- See [baseline.py](../../backend/migrations/baseline.py)

## Docker Integration

### Wrapper Script Approach

To prevent race conditions where the API starts before migrations complete, we use a wrapper script:

**`deploy/run-migrations-then-api.sh`**:
- Runs migrations first
- Only starts API if migrations succeed
- Prevents SQLite lock conflicts
- See [run-migrations-then-api.sh](../../deploy/run-migrations-then-api.sh)

**`deploy/supervisord.conf`**:
```ini
[program:api]
command=/bin/bash /app/deploy/run-migrations-then-api.sh
environment=NODE_ENV="production",PORT="3001",DATABASE_PATH="/data/polkadot.db"
autostart=true
autorestart=true
```

This ensures migrations always complete before API serves requests.

## Security Considerations

1. **SQL Injection**: Migration files are trusted code (in git), not user input
2. **Permissions**: Migration runner needs write access to database
3. **Validation**: Checksum verification prevents tampering
4. **Logging**: All migrations logged for audit trail

## Handling Existing Databases

When deploying the migration system to a database that already has tables, you need to establish a **baseline** to prevent migrations from trying to recreate existing structures.

### Baseline Process

The `baseline.py` script marks migrations as "already applied" without executing them:

```bash
pnpm migrate:baseline --version N
```

This inserts records into `schema_migrations` for all migrations up to version N with:
- Correct checksums from the migration files
- `execution_time_ms` set to 0 (indicating baseline)
- Current timestamp

### Recommended Approach for Production

**Before deploying the migration system to production:**

1. **Create initial snapshot migration locally:**
   ```bash
   pnpm migrate:create --name initial_schema --type sql
   sqlite3 data/polkadot.db .schema > backend/migrations/versions/001_initial_schema.sql
   ```

2. **Commit and deploy** the migration system with version 001

3. **On production**, baseline the database:
   ```bash
   # Inside the container or on the server
   python backend/migrations/baseline.py --db /data/polkadot.db --version 1
   ```

4. **Future migrations** (002, 003, etc.) will run normally

### Alternative: Start from Version 0

If you don't want a snapshot migration:

```bash
# On production
pnpm migrate:baseline --version 0
```

Then start creating migrations from version 001 that only contain new changes.

### Safety Checks

The baseline script:
- Verifies the migrations directory exists
- Computes correct checksums for each migration
- Skips migrations already marked as applied
- Reports what it's doing for audit purposes

## Future Enhancements

### Phase 2 Features

1. **Dry-run mode**: Preview migrations without applying
   ```bash
   pnpm migrate --dry-run
   ```

2. **Migration dependencies**: Specify that migration X requires Y
   ```python
   # In migration file
   DEPENDS_ON = [4, 5]  # Requires migrations 4 and 5
   ```

3. **Data validation**: Run data integrity checks after migration
   ```python
   def validate(conn: sqlite3.Connection) -> bool:
       """Verify migration results."""
       return True
   ```

4. **Rollback support**: Implement `down()` functions for all migrations

5. **Migration status command**: Show which migrations are pending
   ```bash
   pnpm migrate:status
   ```

6. **Multi-database support**: Handle both `polkadot.db` and `sessions.db`

## Summary

This migration system provides:

- **Automated deployment**: Migrations run before API via wrapper script
- **Local testing**: Test migrations before deploying via `pnpm migrate`
- **Version control**: All schema changes tracked in git
- **Safety**: Transaction-based execution with checksum validation
- **Flexibility**: Support for both SQL and Python migrations
- **Baseline support**: Deploy to existing databases without conflicts

The system integrates cleanly with the Docker workflow and prevents race conditions through sequential execution.



| Add/modify table columns | `frontend/src/components/tables/*-columns.tsx` |
| Database schema | `backend/data_sinks/sqlite/schema.py`, `api/src/db/types.ts` |
| Database migrations | `backend/migrations/versions/`, use `pnpm migrate:create` |

