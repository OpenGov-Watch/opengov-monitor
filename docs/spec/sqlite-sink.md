# SQLite Data Sink

The SQLite sink provides local database storage as an alternative to Google Sheets.

## Overview

`SQLiteSink` stores governance data in a local SQLite database with:
- UPSERT semantics via `INSERT OR REPLACE`
- Automatic table creation from predefined schemas
- Native datetime handling
- WAL mode for concurrent access

## Usage

### Basic Usage

```python
from data_sinks import SQLiteSink

# Using context manager (recommended)
with SQLiteSink("./data/opengov.db") as sink:
    sink.update_table("Referenda", referenda_df)
    sink.update_table("Treasury", treasury_df)

# Manual connection management
sink = SQLiteSink()  # Uses default path
sink.connect()
sink.update_table("Referenda", referenda_df)
sink.close()
```

### SpreadsheetSink Compatibility

For drop-in replacement of SpreadsheetSink:

```python
# SQLiteSink supports the same interface
sink.update_worksheet(None, "Referenda", df, allow_empty_first_row=True)
```

The `spreadsheet_id` parameter is ignored for SQLite.

## Configuration

### Database Path

Priority order:
1. Constructor argument: `SQLiteSink("./data/my.db")`
2. Environment variable: `OPENGOV_MONITOR_SQLITE_PATH`
3. Default: `opengov_monitor.db` in current directory

## Table Schemas

Predefined schemas exist for all entity types:

| Table | Primary Key | Description |
|-------|-------------|-------------|
| `Referenda` | `id` (INTEGER) | Governance referenda |
| `Treasury` | `id` (INTEGER) | Treasury spend proposals |
| `Child Bounties` | `identifier` (TEXT) | Child bounty records |
| `Fellowship` | `id` (INTEGER) | Fellowship treasury spends |
| `Fellowship Salary Cycles` | `cycle` (INTEGER) | Salary cycle data |
| `Fellowship Salary Claimants` | `address` (TEXT) | Individual claimants |

### Schema Inference

For unknown tables, schemas are inferred from DataFrame dtypes:

| pandas dtype | SQLite type |
|--------------|-------------|
| int64, int32 | INTEGER |
| float64, float32 | REAL |
| object, string | TEXT |
| datetime64 | TIMESTAMP |
| bool | INTEGER |

## Methods

### Core Methods

```python
connect() -> None
    """Establish database connection. Creates file if needed."""

update_table(name: str, df: DataFrame, allow_empty: bool = False) -> None
    """Upsert DataFrame rows into table."""

close() -> None
    """Close database connection."""
```

### Utility Methods

```python
read_table(table_name: str, limit: int = None) -> DataFrame
    """Read all or limited rows from table."""

table_exists(table_name: str) -> bool
    """Check if table exists."""

get_row_count(table_name: str) -> int
    """Count rows in table."""
```

## Implementation Details

### UPSERT Strategy

Uses `INSERT OR REPLACE` which:
1. Inserts row if primary key doesn't exist
2. Replaces entire row if primary key exists

This is simpler than SpreadsheetSink's delta detection.

### Datetime Handling

- Stored as ISO 8601 strings
- Converted automatically on insert
- `None` used for NULL values

### Transaction Safety

- Each `update_table()` call is atomic
- Rollback on error
- WAL mode for concurrent reads

## Running the Pipeline

```bash
# Fetch data and store in SQLite
python scripts/run_sqlite.py --db ./data/opengov.db

# With specific network
python scripts/run_sqlite.py --network kusama --db ./data/kusama.db
```

## File Locations

```
data_sinks/
├── base.py              # DataSink abstract base class
├── sqlite/
│   ├── __init__.py
│   ├── sink.py          # SQLiteSink implementation
│   └── schema.py        # Table schema definitions
```
