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

Main migration orchestrator:

```python
"""
Database migration runner for OpenGov Monitor.

Discovers and executes pending database migrations in version order.
"""
import argparse
import hashlib
import logging
import sqlite3
import sys
from pathlib import Path
from typing import List, Tuple, Optional
import time

# Migration file structure
Migration = Tuple[int, str, Path]  # (version, name, file_path)

def setup_logging():
    """Configure logging for migration runner."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger('migration_runner')

def ensure_migrations_table(conn: sqlite3.Connection):
    """Create schema_migrations table if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT NOT NULL,
            execution_time_ms INTEGER
        )
    """)
    conn.commit()

def discover_migrations(migrations_dir: Path) -> List[Migration]:
    """Find all migration files in versions directory."""
    versions_dir = migrations_dir / 'versions'
    if not versions_dir.exists():
        return []

    migrations = []
    for file_path in sorted(versions_dir.glob('*')):
        if file_path.suffix not in ['.sql', '.py']:
            continue

        # Parse version from filename: 001_description.sql
        name = file_path.stem
        parts = name.split('_', 1)
        if len(parts) < 2:
            continue

        try:
            version = int(parts[0])
            description = parts[1]
            migrations.append((version, description, file_path))
        except ValueError:
            continue

    return sorted(migrations, key=lambda m: m[0])

def compute_checksum(file_path: Path) -> str:
    """Compute SHA256 checksum of migration file."""
    return hashlib.sha256(file_path.read_bytes()).hexdigest()

def get_applied_migrations(conn: sqlite3.Connection) -> dict:
    """Get dictionary of applied migrations: {version: checksum}."""
    cursor = conn.execute(
        "SELECT version, checksum FROM schema_migrations ORDER BY version"
    )
    return {row[0]: row[1] for row in cursor.fetchall()}

def validate_migrations(
    migrations: List[Migration],
    applied: dict,
    logger: logging.Logger
) -> List[Migration]:
    """
    Validate migration consistency and return pending migrations.

    Checks:
    - No gaps in version numbers
    - No duplicate versions
    - Applied migrations haven't been modified (checksum match)
    """
    if not migrations:
        logger.info("No migrations found")
        return []

    # Check for gaps
    versions = [m[0] for m in migrations]
    expected = list(range(1, len(versions) + 1))
    if versions != expected:
        logger.error(f"Gap in migration versions. Expected {expected}, got {versions}")
        sys.exit(1)

    # Check for duplicates
    if len(versions) != len(set(versions)):
        logger.error("Duplicate migration versions found")
        sys.exit(1)

    # Verify applied migrations haven't changed
    for version, name, file_path in migrations:
        if version in applied:
            current_checksum = compute_checksum(file_path)
            if current_checksum != applied[version]:
                logger.error(
                    f"Migration {version} ({name}) has been modified after being applied. "
                    f"Create a new migration instead."
                )
                sys.exit(1)

    # Return pending migrations (not yet applied)
    pending = [m for m in migrations if m[0] not in applied]
    return pending

def execute_sql_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
) -> int:
    """Execute SQL migration file. Returns execution time in ms."""
    version, name, file_path = migration
    sql = file_path.read_text()

    start_time = time.time()
    conn.executescript(sql)
    execution_time = int((time.time() - start_time) * 1000)

    return execution_time

def execute_python_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
) -> int:
    """Execute Python migration file. Returns execution time in ms."""
    version, name, file_path = migration

    # Import the migration module
    import importlib.util
    spec = importlib.util.spec_from_file_location(f"migration_{version}", file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, 'up'):
        logger.error(f"Migration {version} missing 'up' function")
        sys.exit(1)

    start_time = time.time()
    module.up(conn)
    execution_time = int((time.time() - start_time) * 1000)

    return execution_time

def run_migration(
    conn: sqlite3.Connection,
    migration: Migration,
    logger: logging.Logger
):
    """Execute a single migration and record it."""
    version, name, file_path = migration
    checksum = compute_checksum(file_path)

    logger.info(f"Running migration {version}: {name}")

    try:
        # Execute migration based on file type
        if file_path.suffix == '.sql':
            execution_time = execute_sql_migration(conn, migration, logger)
        elif file_path.suffix == '.py':
            execution_time = execute_python_migration(conn, migration, logger)
        else:
            logger.error(f"Unknown migration file type: {file_path.suffix}")
            sys.exit(1)

        # Record successful migration
        conn.execute(
            """
            INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
            VALUES (?, ?, ?, ?)
            """,
            (version, name, checksum, execution_time)
        )
        conn.commit()

        logger.info(f"Migration {version} completed in {execution_time}ms")

    except Exception as e:
        conn.rollback()
        logger.error(f"Migration {version} failed: {e}", exc_info=True)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Run database migrations')
    parser.add_argument(
        '--db',
        default='../data/polkadot.db',
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--migrations-dir',
        default=None,
        help='Path to migrations directory (default: same dir as script)'
    )
    args = parser.parse_args()

    logger = setup_logging()

    # Determine migrations directory
    if args.migrations_dir:
        migrations_dir = Path(args.migrations_dir)
    else:
        migrations_dir = Path(__file__).parent

    logger.info(f"Migrations directory: {migrations_dir}")
    logger.info(f"Database: {args.db}")

    # Connect to database
    conn = sqlite3.connect(args.db)

    try:
        # Ensure migrations table exists
        ensure_migrations_table(conn)

        # Discover migration files
        migrations = discover_migrations(migrations_dir)
        logger.info(f"Found {len(migrations)} migration files")

        # Get applied migrations
        applied = get_applied_migrations(conn)
        logger.info(f"Already applied: {len(applied)} migrations")

        # Validate and get pending migrations
        pending = validate_migrations(migrations, applied, logger)

        if not pending:
            logger.info("No pending migrations. Database is up to date.")
            return

        logger.info(f"Pending migrations: {len(pending)}")

        # Execute pending migrations
        for migration in pending:
            run_migration(conn, migration, logger)

        logger.info("All migrations completed successfully")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
```

### `create_migration.py`

Helper to create new migration files:

```python
"""
Create a new migration file with proper naming and template.
"""
import argparse
from pathlib import Path
from datetime import datetime

SQL_TEMPLATE = """-- Migration: {description}
-- Version: {version:03d}
-- Created: {timestamp}

-- Add your SQL statements below

"""

PYTHON_TEMPLATE = '''"""
Migration: {description}
Version: {version:03d}
Created: {timestamp}
"""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()

    # Add your migration logic here

    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback the migration (optional)."""
    pass
'''

def get_next_version(migrations_dir: Path) -> int:
    """Determine the next migration version number."""
    versions_dir = migrations_dir / 'versions'
    if not versions_dir.exists():
        versions_dir.mkdir(parents=True)
        return 1

    max_version = 0
    for file_path in versions_dir.glob('*'):
        if file_path.suffix not in ['.sql', '.py']:
            continue
        try:
            version = int(file_path.stem.split('_')[0])
            max_version = max(max_version, version)
        except (ValueError, IndexError):
            continue

    return max_version + 1

def create_migration(
    name: str,
    migration_type: str,
    migrations_dir: Path
):
    """Create a new migration file."""
    version = get_next_version(migrations_dir)
    timestamp = datetime.now().isoformat()

    # Format filename
    filename = f"{version:03d}_{name}.{migration_type}"
    file_path = migrations_dir / 'versions' / filename

    # Choose template
    if migration_type == 'sql':
        template = SQL_TEMPLATE
    else:
        template = PYTHON_TEMPLATE

    # Write file
    content = template.format(
        description=name.replace('_', ' ').title(),
        version=version,
        timestamp=timestamp
    )
    file_path.write_text(content)

    print(f"Created migration: {file_path}")
    print(f"Version: {version}")

def main():
    parser = argparse.ArgumentParser(description='Create a new migration file')
    parser.add_argument(
        '--name',
        required=True,
        help='Migration name (snake_case)'
    )
    parser.add_argument(
        '--type',
        choices=['sql', 'py'],
        default='sql',
        help='Migration type (default: sql)'
    )
    parser.add_argument(
        '--migrations-dir',
        default=None,
        help='Path to migrations directory'
    )
    args = parser.parse_args()

    # Determine migrations directory
    if args.migrations_dir:
        migrations_dir = Path(args.migrations_dir)
    else:
        migrations_dir = Path(__file__).parent

    create_migration(args.name, args.type, migrations_dir)

if __name__ == '__main__':
    main()
```

## Testing Strategy

### Unit Tests

Test individual migration runner functions:

```python
# backend/tests/migrations/test_migration_runner.py
import pytest
from backend.migrations.migration_runner import (
    discover_migrations,
    compute_checksum,
    validate_migrations
)

def test_discover_migrations(tmp_path):
    """Test migration file discovery."""
    versions_dir = tmp_path / 'versions'
    versions_dir.mkdir()

    # Create test migration files
    (versions_dir / '001_initial.sql').write_text("CREATE TABLE test;")
    (versions_dir / '002_add_field.sql').write_text("ALTER TABLE test ADD COLUMN x;")

    migrations = discover_migrations(tmp_path)
    assert len(migrations) == 2
    assert migrations[0][0] == 1
    assert migrations[1][0] == 2
```

### Integration Tests

Test full migration workflow on test database:

```python
def test_migration_workflow(tmp_path):
    """Test complete migration workflow."""
    db_path = tmp_path / 'test.db'
    # Create test migrations
    # Run migration_runner
    # Verify schema_migrations table
    # Verify schema changes applied
```

### Manual Testing Checklist

Before deploying migrations:

- [ ] Run migrations on empty database (fresh start)
- [ ] Run migrations on database with existing data
- [ ] Verify API still works after migrations
- [ ] Verify frontend still loads data correctly
- [ ] Check migration logs for errors
- [ ] Verify schema_migrations table is correct

## Rollback Strategy

### Automated Rollback (Optional)

Implement `down()` functions in Python migrations to enable rollback:

```bash
pnpm migrate:rollback --version 4
```

This would execute the `down()` function of migration 004 and remove its entry from `schema_migrations`.

**Note**: Rollback is optional and may not always be possible (e.g., after data deletion).

### Manual Rollback

For production issues:

1. **Immediate**: Restore database from backup
2. **Fix-forward**: Create a new migration to undo the changes
3. **Rebuild**: In extreme cases, rebuild database from source data

## Security Considerations

1. **SQL Injection**: Migration files are trusted code (in git), not user input
2. **Permissions**: Migration runner needs write access to database
3. **Validation**: Checksum verification prevents tampering
4. **Logging**: All migrations logged for audit trail

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

- **Automated deployment**: Migrations run on Docker startup
- **Local testing**: Test migrations before deploying via `pnpm migrate`
- **Version control**: All schema changes tracked in git
- **Safety**: Checksum validation and transaction rollback
- **Flexibility**: Support both SQL and Python migrations

The system integrates cleanly with the existing Docker workflow and requires minimal changes to the deployment pipeline.
