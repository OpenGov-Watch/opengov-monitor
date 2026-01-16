# Migration Patterns

Common patterns for database migrations with SQLite.

## Adding a Column

### Simple Addition

```sql
ALTER TABLE "TableName" ADD COLUMN "new_column" TEXT;
```

**Use when:** Adding a nullable column with no default value

---

### With Default Value

```sql
ALTER TABLE "TableName" ADD COLUMN "priority" INTEGER DEFAULT 0;
```

**Use when:** Adding a column that should have a specific default for existing rows

**Note:** SQLite will apply the default value to all existing rows automatically

---

### With Index

```sql
ALTER TABLE "TableName" ADD COLUMN "category" TEXT;
CREATE INDEX "idx_tablename_category" ON "TableName" ("category");
```

**Use when:** Adding a column that will be frequently filtered or searched

**Performance:** Always create indexes for columns used in WHERE clauses or JOINs

---

## Removing a Column

SQLite doesn't support DROP COLUMN directly. You must recreate the table.

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

**Important:**
- List ALL columns you want to keep in the new table
- Copy data with SELECT matching the new table structure
- Recreate ALL indexes (they're lost when dropping the old table)
- Recreate ALL triggers and foreign keys if you have them

**Why this pattern:** SQLite's table structure is immutable once created. The only way to remove a column is to create a new table with the desired structure.

---

## Renaming a Column

```sql
-- SQLite 3.25+ supports column rename
ALTER TABLE "TableName" RENAME COLUMN "old_name" TO "new_name";
```

**Requirements:** SQLite version 3.25 or higher

**Check your version:**
```bash
sqlite3 --version
```

**If using older SQLite:** Use the table recreation pattern (same as removing a column) with the new column name

---

## Data Transformation (Python)

Use Python migrations for complex logic that can't be expressed in pure SQL.

```python
"""
Migration: Transform legacy data format
Version: 003
"""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    """Apply the migration."""
    cursor = conn.cursor()

    # Fetch rows that need updating
    cursor.execute("SELECT id, old_value FROM TableName")

    # Transform and update
    for row in cursor.fetchall():
        row_id, old_value = row
        new_value = transform(old_value)  # Your transformation logic
        cursor.execute(
            "UPDATE TableName SET new_value = ? WHERE id = ?",
            (new_value, row_id)
        )

    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback (optional)."""
    pass

def transform(old_value):
    """Example transformation logic."""
    if old_value:
        return old_value.upper()
    return None
```

**Use when:**
- Transformation requires conditional logic
- Need to parse or reformat existing data
- Calculation depends on multiple columns
- External data lookup needed

**Best practices:**
- Keep transformations idempotent (safe to run multiple times)
- Handle NULL values explicitly
- Use parameterized queries to prevent SQL injection
- Commit at the end, not per row (performance)

---

## Creating Views

```sql
-- Migration: Add all_spending view
-- Version: 002

DROP VIEW IF EXISTS all_spending;

CREATE VIEW all_spending AS
SELECT
    'Direct Spend' AS type,
    'ref-' || r.id AS id,
    r.DOT_latest,
    r.category
FROM Referenda r
WHERE r.status = 'Executed';
```

**Use when:** Need to combine data from multiple tables for querying

**Important:**
- Always DROP VIEW IF EXISTS first (views can be recreated)
- Views don't store data, they're just saved queries
- Performance: Views are not materialized in SQLite

---

## Creating Indexes

```sql
-- Single column index
CREATE INDEX "idx_tablename_column" ON "TableName" ("column");

-- Multi-column index (composite)
CREATE INDEX "idx_tablename_col1_col2" ON "TableName" ("col1", "col2");

-- Unique index
CREATE UNIQUE INDEX "idx_tablename_email_unique" ON "TableName" ("email");
```

**When to index:**
- Columns frequently used in WHERE clauses
- Columns used in JOIN conditions
- Columns used in ORDER BY
- Foreign key columns

**When NOT to index:**
- Small tables (< 1000 rows)
- Columns rarely queried
- Columns with low cardinality (few distinct values)

**Naming convention:** `idx_<tablename>_<columns>_<type>`

---

## Adding UNIQUE Constraints

```sql
-- Add UNIQUE constraint to existing table
CREATE UNIQUE INDEX "idx_tablename_field_unique" ON "TableName" ("field");
```

**Note:** SQLite implements UNIQUE constraints as unique indexes

**Use when:** Need to prevent duplicate values in a column

**Before adding:** Verify no duplicates exist:
```sql
SELECT field, COUNT(*) as count
FROM TableName
GROUP BY field
HAVING COUNT(*) > 1;
```

---

## Combining Multiple Operations

```sql
-- Migration: Add and populate new column
-- Version: 004

-- Step 1: Add column
ALTER TABLE "Referenda" ADD COLUMN "category_id" INTEGER;

-- Step 2: Populate from existing data (if needed)
UPDATE "Referenda"
SET category_id = (
    SELECT id FROM Categories
    WHERE Categories.name = Referenda.old_category
);

-- Step 3: Create index
CREATE INDEX "idx_referenda_category_id" ON "Referenda" ("category_id");
```

**Best practice:** Break complex migrations into clear, commented steps

---

## See Also

- [Troubleshooting](./troubleshooting.md) - Common migration issues
- [Testing Strategies](./testing-strategies.md) - How to test migrations
- [Advanced Examples](./advanced-examples.md) - Complex migration scenarios
