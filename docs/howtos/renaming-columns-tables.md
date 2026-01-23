# Renaming Columns or Tables

How to rename database columns or tables when Dashboard Components may reference them.

## The Problem

Dashboard Components store column references in `query_config` JSON. When you rename a column:
1. The SQL schema changes
2. But `query_config` still contains old column names
3. Queries fail with "no such column" errors

## Two-Migration Pattern

Use two migrations:

| Migration | Purpose |
|-----------|---------|
| SQL migration | Rename the column/table in the database |
| Python migration | Update `query_config` JSON in Dashboard Components |

## Checklist

### 1. SQL Migration (Schema Change)

Create `src/backend/migrations/versions/NNN_rename_<thing>.sql`:

```sql
-- Rename column
ALTER TABLE "Referenda" RENAME COLUMN "old_name" TO "new_name";

-- Or rename table
ALTER TABLE "OldTable" RENAME TO "NewTable";
```

### 2. Python Migration (Data Fix)

Create `src/backend/migrations/versions/NNN+1_fix_<thing>_refs.py`:

```python
"""
Migration: Fix column references in Dashboard Components
Version: NNN+1
"""
import sqlite3
import json
from typing import Any


def fix_column_refs_in_obj(obj: Any) -> Any:
    """Recursively fix column references in JSON."""
    if isinstance(obj, str):
        # Order matters: qualified names first
        return obj.replace("Table.old_name", "Table.new_name") \
                  .replace("old_name", "new_name")
    elif isinstance(obj, list):
        return [fix_column_refs_in_obj(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: fix_column_refs_in_obj(v) for k, v in obj.items()}
    return obj


def up(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()

    # Find affected components
    cursor.execute("""
        SELECT id, query_config FROM "Dashboard Components"
        WHERE query_config LIKE '%old_name%'
    """)

    for row_id, query_config in cursor.fetchall():
        config = json.loads(query_config)
        fixed = fix_column_refs_in_obj(config)
        cursor.execute(
            'UPDATE "Dashboard Components" SET query_config = ? WHERE id = ?',
            (json.dumps(fixed), row_id)
        )

    # Clear query cache
    cursor.execute('DELETE FROM "Query Cache"')
    conn.commit()


def down(conn: sqlite3.Connection) -> None:
    # Reverse the replacements
    pass  # Implement if needed
```

### 3. Update Backend Code

- [ ] `src/backend/data_sinks/sqlite/schema.py` - Update column/table definition
- [ ] `src/api/src/db/types.ts` - Update TypeScript types
- [ ] `src/api/src/db/queries.ts` - Update query interfaces
- [ ] Any route files that reference the column

### 4. Update Frontend Code

- [ ] `src/frontend/src/lib/db/types.ts` - Update TypeScript types
- [ ] Any components that reference the column directly

### 5. Regenerate Baseline

```bash
cd src/backend
python migrations/generate_baseline.py --db ../../data/local/polkadot.db --output migrations/baseline_schema.sql
```

## JSON Fields to Update

Dashboard Component `query_config` may contain column references in:

| Field | Format |
|-------|--------|
| `columns[].column` | `"Table.column"` |
| `filters` | Recursive FilterGroup or array |
| `orderBy[].column` | `"Table.column"` |
| `groupBy[]` | `"Table.column"` |
| `expressionColumns[].expression` | SQL expression string |

## Testing

1. Run migrations on local DB copy first:
   ```bash
   cp data/local/polkadot.db data/local/polkadot-test.db
   cd src/backend
   .venv/Scripts/python.exe migrations/migration_runner.py --db ../../data/local/polkadot-test.db
   ```

2. Verify no old references remain:
   ```sql
   SELECT COUNT(*) FROM "Dashboard Components"
   WHERE query_config LIKE '%old_name%';
   -- Should return 0
   ```

3. Verify JSON validity:
   ```sql
   SELECT id FROM "Dashboard Components"
   WHERE json_valid(query_config) = 0;
   -- Should return nothing
   ```

## Example: tally.ayes → tally_ayes

See migrations 023 and 024 for a complete example:
- `023_rename_tally_columns.sql` - Renamed the columns
- `024_fix_tally_column_refs.py` - Updated Dashboard Components
