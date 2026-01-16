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
├── create_migration.py    # Helper to create new migrations
└── versions/              # Migration files (numbered)
    ├── 001_initial_schema.sql
    ├── 002_add_categories.sql
    └── 003_remove_old_field.py
```

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

### 5. Commit

```bash
git add backend/migrations/versions/004_*.sql
git add backend/data_sinks/sqlite/schema.py
git commit -m "feat: add priority field"
```

### 6. Deploy

Push to GitHub. Docker container automatically runs migrations on startup.

## Existing Databases

If deploying to an **existing production database** with tables, establish a baseline first.

### Option 1: Create Initial Snapshot Migration (Recommended)

1. Create snapshot migration reflecting current schema
2. Export current schema to migration file
3. On production, baseline the database: `pnpm migrate:baseline --version 1`
4. Future migrations (002, 003...) apply normally

### Option 2: Baseline Without Initial Migration

```bash
# On production database
pnpm migrate:baseline --version 0
```

Then create your first real migration as version 001.

### Baseline Command

```bash
pnpm migrate:baseline --version N
```

Marks all migrations up to version N as "already applied" without running them.

**Use when:**
- Deploying migrations to existing production database
- Recovering from migration issues
- Setting up environment with pre-existing schema

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
