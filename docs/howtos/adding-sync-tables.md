# Adding CSV-Backed Sync Tables

How to add a new table that can be imported via CSV on the Sync Settings page.

## Prerequisites

Gather this information before starting:
1. **Table name** - e.g., `cross_chain_flows` (use snake_case for key, display name with spaces)
2. **CSV file** - Place default in `data/defaults/`
3. **Column mapping** - CSV headers → snake_case DB columns
4. **UI visibility** - Should it appear in Query Builder?

## Checklist

### 1. Database Migration
- [ ] Create `src/backend/migrations/versions/NNN_add_<table>.sql`
- [ ] Define columns with appropriate types (TEXT, INTEGER, REAL)
- [ ] Add indexes for commonly filtered/joined columns
- [ ] Run migration locally to test

### 2. Backend Types & Queries (`src/api/src/db/`)

**In `types.ts`:**
- [ ] Add table name to `TABLE_NAMES` constant

**In `queries.ts`:**
- [ ] Add interface for the item type (e.g., `CrossChainFlowItem`)
- [ ] Add replace function using `createTableReplacer<T>()`
- [ ] Export both the interface and function

Example:
```typescript
export interface CrossChainFlowItem {
  message_hash: string;
  from_account: string;
  // ... other fields
}

export const replaceAllCrossChainFlows = createTableReplacer<CrossChainFlowItem>(
  TABLE_NAMES.crossChainFlows,
  ["message_hash", "from_account", /* ... other columns */],
  (item) => [item.message_hash, item.from_account, /* ... */]
);
```

### 3. Backend Routes

**Create new route file** `src/api/src/routes/<table>.ts`:
- [ ] Import the replace function and type from queries
- [ ] Create POST `/import` endpoint with validation
- [ ] Use `requireAuth` middleware

**In `src/api/src/routes/sync.ts`:**
- [ ] Add GET `/defaults/<table>` endpoint pointing to CSV file

**In `src/api/src/index.ts`:**
- [ ] Import the new router
- [ ] Register with `app.use("/api/<table>", router)`

### 4. Frontend CSV Parser (`src/frontend/src/lib/csv-parser.ts`)
- [ ] Add interface matching the DB item type
- [ ] Add parser function mapping CSV headers → DB columns
- [ ] Handle column name variations (spaces, casing)
- [ ] Filter out invalid rows

Example:
```typescript
export function parseCrossChainFlowsCSV(content: string): CrossChainFlowCsvRow[] {
  const rows = parseCSV(content);
  return rows
    .map((row) => ({
      message_hash: (row["Message Hash"] || row.message_hash || "").trim(),
      // ... other mappings
    }))
    .filter((row) => row.message_hash !== "");
}
```

### 5. Frontend API Client (`src/frontend/src/api/client.ts`)
- [ ] Add import method under new key
- [ ] Add sync.getDefault<Table>() method

### 6. Frontend UI (`src/frontend/src/pages/manage/sync-settings.tsx`)
- [ ] Add import for new parser function
- [ ] Add state: `const [<table>File, set<Table>File] = useState<File | null>(null)`
- [ ] Add upload handler function
- [ ] Add apply defaults handler function
- [ ] Add Card component with file input and buttons
- [ ] Add CSV format description to the format Card

### 7. Query Builder Visibility
- [ ] Add to `TABLE_NAMES` in `src/frontend/src/lib/db/types.ts`
- [ ] Add to `TABLE_NAMES` in `src/api/src/db/types.ts`

### 8. Documentation
- [ ] Add table spec to `docs/02_specification/data-models.md` if appropriate

## Column Naming Convention

| CSV Header | DB Column |
|------------|-----------|
| Message Hash | message_hash |
| From Account | from_account |
| year-month | year_month |
| Time | time |

Rules:
- Replace spaces with underscores
- Replace hyphens with underscores
- Convert to lowercase
- Keep consistent with existing tables

## The `createTableReplacer` Helper

Located in `src/api/src/db/queries.ts`, this helper creates a function that:
1. Deletes all existing rows in the table
2. Inserts all new rows in a single transaction
3. Returns the count of inserted rows

Parameters:
- `tableName` - The table name from `TABLE_NAMES`
- `columns` - Array of column names in insert order
- `mapItem` - Function that maps an item to an array of values

## Testing Checklist

After implementation:
1. `pnpm run build` - Build must pass
2. `pnpm test` - Tests must pass
3. Manual testing via Chrome DevTools:
   - Navigate to Sync Settings page
   - Click "Apply Defaults" for new table
   - Verify success message
   - Navigate to Query Builder
   - Verify table appears in source dropdown
   - Run simple query on the table
