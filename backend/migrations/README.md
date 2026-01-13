# Database Migrations

This directory contains the database migration system for OpenGov Monitor.

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

### 4. Test Locally

```bash
# Backup your database first
cp data/polkadot.db data/polkadot.db.backup

# Run migration
pnpm migrate

# Verify
sqlite3 data/polkadot.db ".schema"
pnpm dev
```

### 5. Commit

```bash
git add backend/migrations/versions/004_*.sql
git add backend/data_sinks/sqlite/schema.py
git commit -m "feat: add priority field"
```

### 6. Deploy

Push to GitHub. Docker container will automatically run migrations on startup.

## Common Patterns

### Adding a Column

```sql
-- Simple addition
ALTER TABLE "TableName" ADD COLUMN "new_column" TEXT;

-- With default value
ALTER TABLE "TableName" ADD COLUMN "priority" INTEGER DEFAULT 0;

-- With index
ALTER TABLE "TableName" ADD COLUMN "category" TEXT;
CREATE INDEX "idx_tablename_category" ON "TableName" ("category");
```

### Removing a Column

SQLite doesn't support DROP COLUMN. You must recreate the table:

```sql
-- Create new table without the column
CREATE TABLE "TableName_new" (
    "id" INTEGER PRIMARY KEY,
    "field1" TEXT,
    -- List all fields EXCEPT the one to remove
    "field2" INTEGER
);

-- Copy data
INSERT INTO "TableName_new"
SELECT id, field1, field2
FROM "TableName";

-- Swap tables
DROP TABLE "TableName";
ALTER TABLE "TableName_new" RENAME TO "TableName";

-- Recreate indexes
CREATE INDEX "idx_tablename_field1" ON "TableName" ("field1");
```

### Renaming a Column

```sql
-- SQLite 3.25+ supports column rename
ALTER TABLE "TableName" RENAME COLUMN "old_name" TO "new_name";
```

### Data Transformation (Python)

Use Python migrations for complex logic:

```python
def up(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    # Fetch rows that need updating
    cursor.execute("SELECT id, old_value FROM TableName")

    # Transform and update
    for row in cursor.fetchall():
        row_id, old_value = row
        new_value = transform(old_value)
        cursor.execute(
            "UPDATE TableName SET new_value = ? WHERE id = ?",
            (new_value, row_id)
        )

    conn.commit()
```

## Troubleshooting

### Migration Failed Mid-Execution

Migrations run in transactions. If a migration fails:
1. The transaction is rolled back
2. No changes are persisted
3. Fix the migration file and re-run

### Applied Migration Was Modified

If you get an error about checksum mismatch:
- The migration has already been applied and recorded
- You cannot modify it now
- Create a new migration to make additional changes

### Gap in Version Numbers

Version numbers must be sequential (001, 002, 003...).
If you deleted a migration file, you'll see an error.
Either restore the file or renumber migrations (only if not deployed).

### Docker Container Won't Start

If migrations fail on container startup:
1. Check logs: `docker logs <container-id>`
2. Locate migration error in `/var/log/supervisor/migrations-error.log`
3. Fix the migration file
4. Rebuild and redeploy container

## See Also

- [Full Migration Specification](../../docs/spec/migrations.md)
- [Schema Definitions](../data_sinks/sqlite/schema.py)
- [Architecture Overview](../../docs/architecture.md)
