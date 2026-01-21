# Adding Backend-Scraped Tables

How to add a new table that is populated by the Python backend scraper (vs CSV-backed tables).

## Prerequisites

1. **API endpoint** - Identify the data source (e.g., Subsquare API)
2. **Table name** - e.g., `Fellowship Salary Payments`
3. **Column definitions** - Data types and which columns need denomination/time conversion
4. **Primary key** - Unique identifier for upserts

## Checklist

### 1. Backend Schema (`src/backend/data_sinks/sqlite/schema.py`)
- [ ] Define `TableSchema` with columns, primary key, and indexes
- [ ] Add to `ALL_SCHEMAS` list if needed for auto-creation

### 2. Backend Fetch Logic (`src/backend/data_providers/subsquare.py`)
- [ ] Add fetch method: `fetch_<table>()` - calls API, returns raw DataFrame
- [ ] Add parse method: `_parse_<record>()` - extracts fields from API response
- [ ] Add transform method: `_transform_<table>()` - applies denominations, converts timestamps
- [ ] Use correct asset denomination (DOT=10 decimals, USDC/USDT=6 decimals)
- [ ] Handle address resolution if applicable (`who`, `beneficiary` fields)

### 3. Backend Integration (`scripts/run_sqlite.py`)
- [ ] Call fetch method in `main()` or appropriate location
- [ ] Apply address resolution batch if needed
- [ ] Insert/upsert to database via sink

### 4. Database Migration
- [ ] Create `src/backend/migrations/versions/NNN_add_<table>.sql`
- [ ] Use next available number (check existing migrations)
- [ ] Run `/db-test-local-migration` to validate

### 5. TypeScript Types

**In `src/api/src/db/types.ts`:**
- [ ] Add interface for the record type
- [ ] Add table name to `TABLE_NAMES` constant

**In `src/frontend/src/lib/db/types.ts`:**
- [ ] Mirror the same interface and `TABLE_NAMES` entry

### 6. Test Database (`src/api/src/test/test-db.ts`)
- [ ] Add CREATE TABLE statement to `SCHEMA_SQL`
- [ ] Add test fixtures if needed

### 7. Frontend Page (`src/frontend/src/pages/<table>.tsx`)
- [ ] Create page component with `DataTable`
- [ ] Define `queryConfig` with columns and default sort
- [ ] Add `columnOverrides` for links/formatting

### 8. Router (`src/frontend/src/router.tsx`)
- [ ] Add lazy import for the page
- [ ] Add route entry in the routes array

### 9. Sidebar (`src/frontend/src/components/layout/sidebar.tsx`)
- [ ] Add navigation link with appropriate icon
- [ ] Place in correct section

### 10. Documentation (`docs/02_specification/data-models.md`)
- [ ] Document table schema, primary key, and field descriptions

## Example: Fellowship Salary Payments

Pattern files to reference:
- Schema: `schema.py` → `FELLOWSHIP_SALARY_PAYMENTS_SCHEMA`
- Fetch: `subsquare.py` → `fetch_fellowship_salary_payments()`
- Page: `fellowship-salary-cycles.tsx` → similar structure
- Types: `types.ts` → `FellowshipSalaryPayment` interface

## Denomination Reference

| Asset | Decimals | Method |
|-------|----------|--------|
| DOT | 10 | `network_info.native_asset` |
| USDC | 6 | `AssetKind.USDC` |
| USDT | 6 | `AssetKind.USDT` |

## Testing Checklist

1. Run backend scrape: `python scripts/run_sqlite.py --db ../data/local/polkadot.db`
2. Verify data in database with correct values
3. `pnpm run build` - Build must pass
4. `pnpm test` - Tests must pass
5. Chrome DevTools: Navigate to page, verify table displays
6. Query Builder: Verify table appears as source option
