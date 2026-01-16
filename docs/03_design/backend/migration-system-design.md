# Migration System Design

Architectural decisions and design rationale for the database migration system.

## Overview

The migration system is designed for **safety, reliability, and auditability** in production deployments. Key design principles:

- **Checksums prevent tampering** - Applied migrations cannot be modified
- **Explicit transactions** - Each migration runs in isolated transaction
- **Automated execution** - Migrations run on container startup
- **Data preservation** - Never drop tables with existing data
- **Audit trail** - All executions logged with timestamps and duration

## Why Checksums?

**Problem**: Without checksums, developers could modify already-applied migrations, causing divergence between environments.

**Solution**: SHA256 checksums computed from file contents and stored in `schema_migrations` table.

**Behavior**:
- Checksum computed when migration first applied
- On subsequent runs, file checksum compared to stored checksum
- **Mismatch aborts migration run** - forces developer to create new migration instead

**Example scenario**:
```bash
# Developer applies migration 005
pnpm migrate  # Checksum: abc123 stored

# Developer later edits 005_add_field.sql
pnpm migrate  # ERROR: Checksum mismatch! abc123 != def456
```

**Why this matters**: Prevents "works on my machine" issues where production has version A of migration but local has version B.

## Why Explicit Transactions?

**Problem**: SQLite's default autocommit mode commits each statement immediately, making rollback impossible.

**Solution**: Wrap each migration in explicit `BEGIN...COMMIT` transaction.

**Implementation**:
```python
# In migration_runner.py
conn.execute("BEGIN")
try:
    # Execute migration statements
    execute_migration(migration_file, conn)
    conn.commit()
    # Record in schema_migrations
except Exception as e:
    conn.rollback()
    raise
```

**Benefits**:
- **Atomicity**: Migration either fully succeeds or fully fails
- **Rollback on error**: Database state unchanged if migration fails
- **No partial migrations**: Can't have half-applied migration corrupting schema

**Why not use executescript()?**: The `executescript()` method automatically commits, bypassing our transaction control.

## Why Wrapper Script?

**Problem**: API should not start if migrations fail. supervisord doesn't support dependency ordering.

**Solution**: Wrapper script runs migrations before starting API.

**Implementation** (`src/deploy/scripts/run_migrations_and_api.sh`):
```bash
#!/bin/bash
set -e  # Exit on any error

# Run migrations first
python backend/migrations/migration_runner.py --db /data/polkadot.db

# Only start API if migrations succeeded
exec node dist/index.js
```

**supervisord configuration**:
```ini
[program:api]
command=/app/scripts/run_migrations_and_api.sh
autorestart=unexpected
exitcodes=0
```

**Behavior**:
- Migrations run on every container startup (idempotent - safe to run multiple times)
- If migrations fail (exit code ≠ 0), wrapper script exits
- API never starts if migrations fail
- supervisord marks API as FATAL, preventing broken deployments

**Why this matters**: Prevents API from serving requests with incorrect schema.

## Why Not Drop Tables?

**Problem**: Dropping tables permanently deletes production data.

**Policy**: Migrations **MUST NOT** drop tables with existing data.

**Alternative approaches**:

### For Unused Tables
```sql
-- Don't drop immediately
-- Instead: Mark with comment and set delete date

-- Migration 010: Deprecate old_table (to be removed 2024-06-01)
-- DO NOT USE old_table - use new_table instead
-- This table will be dropped in migration 015

-- Later migration (after verification period):
-- Migration 015: Remove old_table
DROP TABLE IF EXISTS old_table;
```

### For Schema Changes
```sql
-- Don't drop and recreate
-- Instead: Rename columns or create new table

-- Bad:
DROP TABLE users;
CREATE TABLE users (...);

-- Good:
ALTER TABLE users RENAME TO users_old;
CREATE TABLE users (...);
INSERT INTO users SELECT ... FROM users_old;
-- Keep users_old until verified, drop in later migration
```

### For Data Migrations
```python
# Don't drop source table immediately
def up(conn):
    # Migrate data
    conn.execute("INSERT INTO new_table SELECT ... FROM old_table")

    # Verify counts match
    old_count = conn.execute("SELECT COUNT(*) FROM old_table").fetchone()[0]
    new_count = conn.execute("SELECT COUNT(*) FROM new_table").fetchone()[0]

    if old_count != new_count:
        raise Exception(f"Data migration failed: {old_count} != {new_count}")

    # Leave old_table for safety - drop in later migration
```

**Enforcement**: Monitored during code review, but not technically prevented.

## Transaction Handling

### SQL Migrations

**Approach**: Execute statements sequentially, not with `executescript()`.

```python
# Read SQL file
with open(migration_file) as f:
    sql = f.read()

# Execute in transaction
conn.execute("BEGIN")
try:
    # Split on semicolons and execute separately
    for statement in split_sql_statements(sql):
        conn.execute(statement)
    conn.commit()
except:
    conn.rollback()
    raise
```

**Why not executescript()?**:
- `executescript()` issues implicit COMMIT before executing
- This bypasses our transaction control
- Prevents rollback on failure

### Python Migrations

**Approach**: Pass connection to `up()` function, let migration control commits.

```python
def up(conn: sqlite3.Connection) -> None:
    """Migration code - connection already in transaction."""
    cursor = conn.cursor()

    # Do work
    cursor.execute("ALTER TABLE ...")
    cursor.execute("UPDATE ...")

    # Explicit commit required
    conn.commit()
```

**Runner handles transaction**:
```python
conn.execute("BEGIN")
try:
    migration_module.up(conn)
    # Migration responsible for conn.commit()
except:
    conn.rollback()
    raise
```

## Migration Discovery and Validation

### Discovery Process

1. **Scan versions/ directory** for files matching `###_*.sql` or `###_*.py`
2. **Extract version number** from filename (e.g., `005_add_field.sql` → version 5)
3. **Sort by version** (not alphabetically - 10 comes after 9)

### Validation Checks

**Check 1: No gaps**
```python
# Versions must be sequential: 1, 2, 3, 4...
# Not allowed: 1, 2, 4, 5 (missing 3)
if versions != list(range(1, max(versions) + 1)):
    raise Exception("Gap detected in migration versions")
```

**Check 2: No duplicates**
```python
# Only one file per version number
# Not allowed: 005_add_field.sql and 005_other.sql
if len(versions) != len(set(versions)):
    raise Exception("Duplicate version numbers detected")
```

**Check 3: Checksum integrity**
```python
# For already-applied migrations, checksums must match
stored_checksum = get_checksum_from_db(version)
current_checksum = compute_checksum(migration_file)

if stored_checksum != current_checksum:
    raise Exception(f"Migration {version} was modified after being applied")
```

## Schema Migrations Table

**Purpose**: Track which migrations have been applied and prevent tampering.

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER
);
```

**Fields**:
- `version`: Migration number (001, 002, etc.)
- `name`: Migration filename for reference
- `applied_at`: When migration was executed (audit trail)
- `checksum`: SHA256 of file contents (tamper detection)
- `execution_time_ms`: How long migration took (performance monitoring)

**Special case - Baseline**:
- `execution_time_ms = 0` indicates migration was baselined (marked as applied without execution)
- Used when deploying migration system to existing production database

## Error Handling

### Migration Failure

**Behavior**:
1. Transaction automatically rolled back
2. Error logged with full traceback
3. **Runner exits with non-zero code**
4. Remaining migrations NOT executed
5. Application startup blocked (wrapper script fails)

**Recovery**:
1. Fix the migration file (if new migration)
2. OR create new migration to fix issue (if already applied)
3. Test locally
4. Deploy fix

### Checksum Mismatch

**Behavior**:
1. Validation fails before executing any migrations
2. Clear error message identifies which migration was modified
3. Runner exits immediately

**Recovery**:
1. Revert file to original version
2. OR create new migration with desired changes
3. Never modify applied migrations

## Docker Integration

### Startup Sequence

1. **Container starts** - supervisord launches
2. **Wrapper script runs** - `run_migrations_and_api.sh`
3. **Migrations execute** - `migration_runner.py` runs
4. **API starts** - Only if migrations succeeded
5. **Health check passes** - Container marked healthy

### Failure Modes

**Migration fails**:
- Wrapper script exits with code 1
- API never starts
- supervisord marks program as FATAL
- Container unhealthy, deployment blocked

**Migration succeeds, API fails**:
- Migrations already applied (safe)
- Fix API issue and restart
- Migrations are idempotent (safe to re-run)

## Baseline Process

**Use case**: Deploying migration system to production database that already has tables.

**Problem**: Migrations expect empty database, but production has data.

**Solution**: Mark migrations as "already applied" without executing them.

**Command**:
```bash
pnpm migrate:baseline --version N
```

**What it does**:
1. Computes checksums for migrations 1 through N
2. Inserts records into `schema_migrations`:
   - Correct checksums
   - Current timestamp
   - `execution_time_ms = 0` (indicates baseline)
3. Does NOT execute migrations

**After baseline**:
- Future migrations (N+1, N+2...) run normally
- Migration system operational on existing database
- No data loss

**Example scenario**:
```bash
# Production has tables from manual SQL scripts
# Create migration 001 reflecting current schema
pnpm migrate:create --name initial_schema --type sql

# Manually populate 001_initial_schema.sql with current production schema
# (export from SQLite: .schema)

# On production, mark as applied without running
pnpm migrate:baseline --version 1

# Future migrations (002, 003...) will run normally
```

## See Also

- [Migration System Spec](../../spec/backend/migrations.md) - Requirements
- [Migrations README](../../../src/backend/migrations/README.md) - Usage guide
- [Migration Patterns](./patterns.md) - Common patterns
- [Troubleshooting](./troubleshooting.md) - Common issues
