# Database Migrations

Database migration system for OpenGov Monitor using numbered SQL and Python migrations.

## Quick Start

### Running Migrations

```bash
# From repository root
pnpm migrate
```

### Creating a New Migration

```bash
# Create SQL migration
pnpm migrate:create --name add_user_preferences --type sql

# Create Python migration (for complex data transformations)
pnpm migrate:create --name migrate_legacy_data --type py
```

## Structure

```
migrations/
├── README.md              # This file
├── migration_runner.py    # Main migration orchestrator
├── generate_baseline.py   # Dumps schema from migrated DB
├── baseline_schema.sql    # Generated schema for fresh DBs
├── create_migration.py    # Helper to create new migrations
└── versions/              # Migration files (numbered 001-019)
```

## Fresh vs Existing Databases

Two paths to the same schema:

| Database Type | Command | Description |
|---------------|---------|-------------|
| Fresh install | `python migration_runner.py --db new.db --baseline` | Uses baseline_schema.sql |
| Existing/Production | `python migration_runner.py --db existing.db` | Runs migrations sequentially |

Historical migrations (001-019) expect old schema structures. Fresh databases must use the baseline path.

## Migration Files

### Naming Convention

```
<version>_<description>.<type>
```

- **version**: Zero-padded 3-digit number (001, 002, 003...)
- **description**: Snake_case description
- **type**: `sql` or `py`

### SQL Migrations

```sql
-- Migration: Add notes column to Referenda
-- Version: 002

ALTER TABLE "Referenda" ADD COLUMN "notes" TEXT;
CREATE INDEX "idx_referenda_notes" ON "Referenda" ("notes");
```

### Python Migrations

```python
"""
Migration: Complex data transformation
Version: 003
"""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()
    # Your migration logic here
    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback (optional)."""
    pass
```

## Workflow

### 1. Create Migration

```bash
pnpm migrate:create --name add_priority_field --type sql
```

This creates: `backend/migrations/versions/004_add_priority_field.sql`

### 2. Edit Migration

Add your SQL or Python code to the generated file.

### 3. Update Schema Definition

Update `backend/data_sinks/sqlite/schema.py` to match the new schema.

**Schema.py role**: Defines desired end state of schema (must match final migration state)

### 4. Test Locally

```bash
# Backup your database first
cp data/local/polkadot.db data/local/polkadot.db.backup

# Run migration
pnpm migrate

# Verify
sqlite3 data/local/polkadot.db ".schema"
pnpm dev
```

### 5. Regenerate Baseline

After applying migrations to your local database, regenerate the baseline:

```bash
python migrations/generate_baseline.py --db ../../data/local/polkadot.db --output migrations/baseline_schema.sql
```

### 6. Commit

```bash
git add backend/migrations/versions/004_*.sql
git add backend/data_sinks/sqlite/schema.py
git add backend/migrations/baseline_schema.sql
git commit -m "feat: add priority field"
```

### 7. Deploy

Push to GitHub. Docker container automatically runs migrations on startup.

## Existing Production Databases

For **existing production databases** that already have the schema, mark migrations as applied without executing:

```bash
pnpm migrate:baseline --version 19
```

This records all migrations (1-19) as applied without running them. Future migrations (020+) will apply normally.

**Note:** This is different from `--baseline` flag which initializes a fresh empty database from baseline_schema.sql.

## Windows Users

The pnpm scripts use Unix paths. On Windows:

```bash
cd backend
.venv\Scripts\python.exe migrations\migration_runner.py --db ..\data\polkadot.db
```

Or update `package.json` scripts to use `Scripts\python.exe`.

## See Also

**Migration Guides:**
- [Migration Patterns](../../docs/03_design/migrations/patterns.md) - Common patterns (add/remove columns, data transformations)
- [Troubleshooting](../../docs/03_design/migrations/troubleshooting.md) - Common issues and fixes
- [Testing Strategies](../../docs/03_design/migrations/testing-strategies.md) - How to test migrations
- [Advanced Examples](../../docs/03_design/migrations/advanced-examples.md) - Complex scenarios (views, data migrations)

**Architecture:**
- [Migration System Design](../../docs/03_design/backend/migration-system-design.md) - Design decisions and rationale

**Specifications:**
- [Full Migration Specification](../../docs/02_specification/backend/migrations.md) - Requirements and architecture
- [Schema Definitions](../data_sinks/sqlite/schema.py) - Table schemas
