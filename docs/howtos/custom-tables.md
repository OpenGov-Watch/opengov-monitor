# Custom Tables

Create and manage arbitrary data tables via CSV import.

## Creating a Table

1. Navigate to **Manage > Custom Tables**
2. Click **Create Table**
3. Upload a CSV file
4. Review inferred schema (adjust column names/types as needed)
5. Click **Create Table**

## Supported Column Types

| Type | Detection | Storage |
|------|-----------|---------|
| Text | Default fallback | TEXT |
| Integer | `/^-?\d+$/` | INTEGER |
| Decimal | `/^-?\d*\.?\d+$/` | REAL |
| Date | `YYYY-MM-DD` | TEXT |
| Yes/No | `true/false/yes/no/0/1` | INTEGER (0/1) |

## Data Operations

- **View Data**: Click table row to open data viewer
- **Add Row**: Click "Add Row" in data viewer
- **Edit Row**: Click pencil icon on any row
- **Delete Row**: Click trash icon on any row
- **Re-import**: Upload new CSV (optionally wipe existing data)

## Query Builder Integration

Custom tables automatically appear in the query builder's table selector. Use them in dashboards like any other table.

## Limitations

- Schema is immutable after creation
- Max 50 columns per table
- Column names sanitized (alphanumeric + underscore only)
- SQL keywords disallowed as column names
