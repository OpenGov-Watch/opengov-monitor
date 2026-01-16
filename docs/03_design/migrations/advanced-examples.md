# Advanced Migration Examples

Complex real-world migration scenarios with complete examples.

## Creating Views

Views are saved queries that appear as virtual tables. Useful for combining data from multiple tables.

### Basic View

```sql
-- Migration: Add all_spending view
-- Version: 002

DROP VIEW IF EXISTS all_spending;

CREATE VIEW all_spending AS
SELECT
    'Direct Spend' AS type,
    'ref-' || r.id AS id,
    r.DOT_latest,
    r.category_id
FROM Referenda r
WHERE r.status = 'Executed'
  AND r.hide_in_spends = 0;
```

**Use case:** Combining spending from multiple sources (Referenda, Bounties, etc.) into single queryable view

**Benefits:**
- Simplifies frontend queries
- Centralizes business logic
- No data duplication

---

### View with JOINs

```sql
-- Migration: Add spending_with_categories view
-- Version: 003

DROP VIEW IF EXISTS spending_with_categories;

CREATE VIEW spending_with_categories AS
SELECT
    s.*,
    c.category,
    c.subcategory
FROM all_spending s
LEFT JOIN Categories c ON s.category_id = c.id;
```

**Use case:** Enriching data with related information for easier querying

---

### View with Aggregations

```sql
-- Migration: Add spending_summary view
-- Version: 004

DROP VIEW IF EXISTS spending_summary;

CREATE VIEW spending_summary AS
SELECT
    category_id,
    COUNT(*) as proposal_count,
    SUM(DOT_latest) as total_dot,
    AVG(DOT_latest) as avg_dot,
    MIN(DOT_latest) as min_dot,
    MAX(DOT_latest) as max_dot
FROM all_spending
GROUP BY category_id;
```

**Use case:** Pre-computed aggregations for dashboard queries

**Note:** SQLite views are not materialized - they execute the query each time. For heavy queries, consider a table instead.

---

## Complex Data Migration

### Normalizing Category Data

**Scenario:** Moving from text categories to normalized category IDs

```python
"""
Migration: Normalize category data
Version: 005
"""
import sqlite3

def up(conn: sqlite3.Connection) -> None:
    """Migrate text categories to normalized IDs."""
    cursor = conn.cursor()

    # Create mapping table
    cursor.execute("""
        CREATE TABLE category_mapping (
            old_name TEXT PRIMARY KEY,
            new_id INTEGER NOT NULL
        )
    """)

    # Build mapping from Categories table
    cursor.execute("SELECT id, LOWER(category) FROM Categories")
    mappings = [
        (cat_name.lower(), cat_id)
        for cat_id, cat_name in cursor.fetchall()
    ]

    # Insert mappings
    cursor.executemany(
        "INSERT INTO category_mapping (old_name, new_id) VALUES (?, ?)",
        mappings
    )

    # Update existing records
    cursor.execute("""
        UPDATE Referenda
        SET category_id = (
            SELECT new_id FROM category_mapping
            WHERE LOWER(category_mapping.old_name) = LOWER(Referenda.old_category)
        )
        WHERE Referenda.old_category IS NOT NULL
    """)

    # Verify all categories were mapped
    cursor.execute("""
        SELECT COUNT(*) FROM Referenda
        WHERE old_category IS NOT NULL
        AND category_id IS NULL
    """)
    unmapped_count = cursor.fetchone()[0]

    if unmapped_count > 0:
        raise Exception(f"Found {unmapped_count} unmapped categories")

    # Clean up temporary table
    cursor.execute("DROP TABLE category_mapping")

    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Rollback not supported for this migration."""
    raise NotImplementedError("Cannot reverse category normalization")
```

**Key techniques:**
- Temporary mapping table for complex transformations
- Case-insensitive matching with LOWER()
- Validation step to catch unmapped values
- Cleanup of temporary tables

---

### Migrating JSON Fields to Columns

**Scenario:** Extracting structured data from JSON field into proper columns

```python
"""
Migration: Extract tally data from JSON to columns
Version: 006
"""
import sqlite3
import json

def up(conn: sqlite3.Connection) -> None:
    """Extract tally.ayes and tally.nays from JSON field."""
    cursor = conn.cursor()

    # Add new columns
    cursor.execute('ALTER TABLE "Referenda" ADD COLUMN "ayes" INTEGER')
    cursor.execute('ALTER TABLE "Referenda" ADD COLUMN "nays" INTEGER')

    # Fetch all records with tally data
    cursor.execute('SELECT id, tally FROM Referenda WHERE tally IS NOT NULL')

    updates = []
    for row_id, tally_json in cursor.fetchall():
        try:
            tally = json.loads(tally_json)
            ayes = tally.get('ayes')
            nays = tally.get('nays')

            # Convert to integers, handle various formats
            if isinstance(ayes, str):
                ayes = int(ayes) if ayes.isdigit() else None
            if isinstance(nays, str):
                nays = int(nays) if nays.isdigit() else None

            updates.append((ayes, nays, row_id))
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            print(f"Warning: Could not parse tally for row {row_id}: {e}")
            updates.append((None, None, row_id))

    # Bulk update
    cursor.executemany(
        'UPDATE Referenda SET ayes = ?, nays = ? WHERE id = ?',
        updates
    )

    # Create indexes on new columns
    cursor.execute('CREATE INDEX "idx_referenda_ayes" ON "Referenda" ("ayes")')
    cursor.execute('CREATE INDEX "idx_referenda_nays" ON "Referenda" ("nays")')

    conn.commit()
```

**Key techniques:**
- JSON parsing with error handling
- Type conversion and validation
- Bulk updates for performance
- Logging warnings for data issues

---

### Splitting a Table

**Scenario:** Splitting a monolithic table into related tables

```sql
-- Migration: Split UserData into Users and UserPreferences
-- Version: 007

-- Create new tables
CREATE TABLE "Users" (
    "id" INTEGER PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

CREATE TABLE "UserPreferences" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "theme" TEXT,
    "language" TEXT,
    "notifications_enabled" INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Copy user data
INSERT INTO Users (id, email, name, created_at)
SELECT id, email, name, created_at
FROM UserData;

-- Copy preferences
INSERT INTO UserPreferences (user_id, theme, language, notifications_enabled)
SELECT id, theme, language, notifications_enabled
FROM UserData;

-- Verify counts match
-- (This check happens in a separate step)

-- Drop old table (only after verification)
DROP TABLE UserData;

-- Create indexes
CREATE INDEX "idx_users_email" ON "Users" ("email");
CREATE INDEX "idx_userprefs_userid" ON "UserPreferences" ("user_id");
```

**Important steps:**
1. Create new tables
2. Copy data with verification
3. Only drop old table after confirming success
4. Recreate all indexes

---

### Backfilling Computed Values

**Scenario:** Adding a computed column and populating it for existing records

```python
"""
Migration: Add and populate USD values
Version: 008
"""
import sqlite3
from datetime import datetime

def up(conn: sqlite3.Connection) -> None:
    """Add USD_latest column and compute values from DOT prices."""
    cursor = conn.cursor()

    # Add new column
    cursor.execute('ALTER TABLE "Referenda" ADD COLUMN "USD_latest" REAL')

    # Fetch exchange rate (simplified - in reality, fetch historical rates)
    DOT_USD_RATE = 6.50

    # Fetch all records with DOT values
    cursor.execute('''
        SELECT id, DOT_latest, proposal_time
        FROM Referenda
        WHERE DOT_latest IS NOT NULL
    ''')

    updates = []
    for row_id, dot_value, proposal_time in cursor.fetchall():
        # In real implementation, lookup historical rate for proposal_time
        usd_value = dot_value * DOT_USD_RATE
        updates.append((usd_value, row_id))

    # Bulk update
    cursor.executemany(
        'UPDATE Referenda SET USD_latest = ? WHERE id = ?',
        updates
    )

    # Create index
    cursor.execute('CREATE INDEX "idx_referenda_usd" ON "Referenda" ("USD_latest")')

    conn.commit()

def down(conn: sqlite3.Connection) -> None:
    """Remove USD column."""
    # SQLite requires table recreation to remove column
    pass
```

**Key techniques:**
- Adding computed columns
- Bulk computation with external data
- Historical data consideration

---

## Multi-Step Complex Migration

**Scenario:** Complete schema refactoring with data preservation

```sql
-- Migration: Refactor Bounties table structure
-- Version: 009

-- Step 1: Create new table with improved structure
CREATE TABLE "Bounties_new" (
    "id" INTEGER PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value_dot" REAL,
    "value_usd" REAL,
    "status" TEXT NOT NULL,
    "category_id" INTEGER,
    "curator_address" TEXT,
    "beneficiary_address" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES Categories(id)
);

-- Step 2: Migrate data with transformations
INSERT INTO Bounties_new (
    id,
    title,
    description,
    value_dot,
    value_usd,
    status,
    category_id,
    curator_address,
    beneficiary_address,
    created_at,
    updated_at
)
SELECT
    id,
    title,
    NULLIF(description, ''),  -- Convert empty strings to NULL
    DOT,  -- Renamed from DOT to value_dot
    USD,  -- Renamed from USD to value_usd
    UPPER(status),  -- Normalize status to uppercase
    category_id,
    CASE
        WHEN curator = '' THEN NULL
        ELSE curator
    END as curator_address,
    CASE
        WHEN beneficiary = '' THEN NULL
        ELSE beneficiary
    END as beneficiary_address,
    proposal_time,  -- Renamed to created_at
    latest_status_change  -- Renamed to updated_at
FROM Bounties;

-- Step 3: Verify row counts match
-- (Should be done programmatically, not in SQL)

-- Step 4: Drop old table and rename new one
DROP TABLE Bounties;
ALTER TABLE Bounties_new RENAME TO Bounties;

-- Step 5: Recreate all indexes
CREATE INDEX "idx_bounties_status" ON "Bounties" ("status");
CREATE INDEX "idx_bounties_category" ON "Bounties" ("category_id");
CREATE INDEX "idx_bounties_created" ON "Bounties" ("created_at");

-- Step 6: Recreate views that depend on this table
DROP VIEW IF EXISTS all_spending;
CREATE VIEW all_spending AS
SELECT 'Bounty' AS type, id, value_dot, category_id
FROM Bounties
WHERE status = 'EXECUTED'
UNION ALL
SELECT 'Referenda' AS type, id, DOT_latest, category_id
FROM Referenda
WHERE status = 'Executed';
```

**Complexity handled:**
- Schema changes (column renames, type changes)
- Data transformations (uppercase, NULL handling)
- Dependent views
- Index recreation
- Foreign key preservation

---

## See Also

- [Migration Patterns](./patterns.md) - Common migration patterns
- [Troubleshooting](./troubleshooting.md) - Common issues and fixes
- [Testing Strategies](./testing-strategies.md) - How to test migrations
