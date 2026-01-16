# DataTable System Specification

This document specifies the DataTable system - a unified, query-driven table component for full-page data exploration and analysis.

## Overview

**Core Component**: `DataTable` (TanStack Table v8)
**Location**: `components/data-table/data-table.tsx`
**Purpose**: Full-featured data tables for main application pages (referenda, treasury, etc.)
**Data Pattern**: QueryConfig → auto-generated columns + columnOverrides

## Architecture

### Component Hierarchy

```
DataTable
├── ViewSelector (saved views)
├── DataTableToolbar (search, export, filters, view toggle)
├── Table View (desktop) | Card View (mobile)
└── DataTablePagination (page controls)
```

### Data Integration Pattern

All table pages use **QueryConfig with auto-generated columns**:

```tsx
// 1. Define QueryConfig (what data to fetch)
const queryConfig: QueryConfig = {
  sourceTable: "all_spending",
  columns: [
    { column: "latest_status_change" },
    { column: "type" },
    { column: "title" },
    { column: "DOT_latest" },
  ],
  filters: [],
  orderBy: [{ column: "latest_status_change", direction: "DESC" }],
  limit: 10000,
};

// 2. Define columnOverrides (custom rendering/formatting)
const columnOverrides = {
  type: {
    cell: ({ row }) => (
      <Badge variant={getTypeVariant(row.original.type)}>
        {row.original.type}
      </Badge>
    ),
  },
  DOT_latest: {
    header: "DOT",
    cell: ({ row }) => formatNumber(row.original.DOT_latest),
  },
};

// 3. Pass to DataTable
<DataTable
  queryConfig={queryConfig}
  tableName="spending"
  columnOverrides={columnOverrides}
  facetedFilters={["type", "category"]}
/>
```

## Column System

### Column Configuration System

The column formatting system uses a three-tier priority system:

**1. Table-Specific Config** → **2. Global Columns Config** → **3. Pattern-Based Detection** → **4. Default (text)**

### Pattern-Based Auto-Detection

Columns are automatically formatted based on naming patterns defined in `frontend/public/config/column-config.yaml`.

**Pattern Types:**
- `exact` - Column name must match exactly (e.g., "status")
- `prefix` - Column starts with pattern (e.g., "DOT_*")
- `suffix` - Column ends with pattern (e.g., "*.ayes", "*_status")
- `substring` - Column contains pattern (e.g., "*_time*", "*_date*")

**Pattern Matching Options:**
- `caseInsensitive: true/false` - Controls case sensitivity (default: false)
- Patterns are evaluated in array order - first match wins

**Built-in Patterns (via YAML):**

| Pattern | Type | Example Matches | Rendering |
|---------|------|-----------------|-----------|
| `DOT_` | prefix | DOT_latest, DOT_proposal_time | Currency (DOT, 0 decimals) |
| `USD_` | prefix | USD_latest, USD_value | Currency (USD, 0 decimals) |
| `USDC_` | prefix | USDC_component | Currency (USDC, 2 decimals) |
| `USDT_` | prefix | USDT_amount | Currency (USDT, 2 decimals) |
| `.ayes` | suffix | tally.ayes | Number (green, 0 decimals) |
| `.nays` | suffix | tally.nays | Number (red, 0 decimals) |
| `_time` | substring | proposal_time, latest_time | Date |
| `_date` | substring | start_date, end_date | Date |
| `createdat` | exact | createdat | Date |
| `status` | exact | status | Badge (with variants) |
| `_status` | suffix | proposal_status | Badge (with variants) |
| `beneficiary` | exact | beneficiary | Address (truncated) |
| `address` | exact | address | Address (truncated) |
| `who` | exact | who | Address (truncated) |
| `_address` | suffix | wallet_address | Address (truncated) |

### Column Override Patterns

#### Custom Cell Rendering
- **Status Badge**: Badge component with semantic colors
- **Numeric**: Right-aligned with `formatNumber()`
- **Currency**: `formatCurrency()` USD with no decimals
- **Date/DateTime**: `formatDate()` / `formatDateTime()`
- **Links**: Custom cell with href
- **Editable**: `CategorySelector`, `EditableNotesCell`, etc. (auth-gated)

#### Dot-Notation (SQLite columns with dots)
Auto-generated columns handle dot notation automatically. No special handling needed.

### Column Visibility
- **Requirement**: `accessorFn` must be defined for column to be hideable
- **UI**: Dropdown with checkboxes (hidden on mobile)
- **Display**: Column IDs with underscores/dots → spaces

## Filtering System

### Faceted Filters (Server-Side)

Multi-select dropdown filters with counts, fetched server-side:

- **API Endpoint**: POST `/api/query/facets` with FacetQueryConfig
- **Scope**: Returns ALL distinct values + counts from the full dataset (not just current page)
- **Parallel Fetching**: Facet data fetched in parallel with table data using `Promise.all()`
- **Filter Dependencies**: Facet values automatically update when other filters are applied
- **Performance**: Fast queries via database indexes on faceted columns
- **Graceful Degradation**: Falls back to client-side faceting if API request fails

### Global Search
- **Type**: `includesString` across all visible columns
- **Case**: Insensitive
- **UI**: Search input in toolbar

### Custom Filter Functions
For complex filtering logic (uncategorized handling, numeric ranges, etc.), use custom `filterFn`.

## Sorting

- **Cycle**: none → asc → desc → none (click column header)
- **Disable**: `enableSorting: false` for filter-only columns
- **UI**: Arrow icons (up/down/chevrons)
- **Server-side**: Sorting handled by database query

## Pagination

- **Type**: Server-side (only current page fetched from API)
- **Page sizes**: 10, 20, 30, 50, 100 (default: 100)
- **Controls**: First, Previous, Next, Last (Last hidden on mobile)
- **State**: Part of view state, persisted in localStorage
- **Performance**: Pagination changes trigger API refetch with new offset

## View State Management

### Persisted State
- **Storage**: localStorage (per-table: `opengov-views-{tableName}`)
- **Includes**: sorting, filters, column visibility, global search, pagination
- **URL Sharing**: Base64-encoded state in `?view=` param
- **Operations**: save, load, delete, set default
- **UI**: Tabs (desktop), dropdown (mobile)

### Default Views
Define common scenarios:
```tsx
const defaultViews: SavedView[] = [
  { name: "All", state: {...}, isDefault: true }
]
```

## Authentication & Editing

### Page-Level Protection
```tsx
<RequireAuth><PageContent /></RequireAuth>
```

### Cell-Level Toggle
```tsx
cell: ({ row }) =>
  isAuthenticated ? <EditableCell /> : <ReadOnlyCell />
```

### Component Pairs
- `CategorySelector` ↔ `ReadOnlyCategorySelector`
- `EditableNotesCell` ↔ `ReadOnlyNotesCell`
- `EditableHideCheckbox` ↔ `ReadOnlyHideCheckbox`

### Editable Cells
- **CategorySelector**: Cascading category → subcategory with auto-select
- **EditableNotesCell**: Text input with blur-to-save
- **EditableHideCheckbox**: Boolean toggle
- **Pattern**: Local state + onChange callback to parent

## API Integration

- **Data Endpoint**: POST `/api/query/execute` with QueryConfig
- **Facets Endpoint**: POST `/api/query/facets` with FacetQueryConfig (parallel fetch)
- **Pattern**: DataTable component handles data fetching internally (useState + useEffect)
- **Pagination**: Server-side with LIMIT/OFFSET - only current page data fetched
- **Total Count**: Separate COUNT query provides total for pagination UI
- **Error Handling**: Loading/error states with user-friendly messages
- **Data Scope**: Sorting, filtering, pagination, and faceting all happen server-side

## Responsive Behavior

- **Breakpoint**: md (768px)
- **Mobile defaults**: Card view, full-width search, column pagination
- **Desktop defaults**: Table view, constrained search, row pagination
- **View Mode**: Persisted per-table in localStorage (`{tableName}-view-mode`)

### Card View (Mobile)
- First 3 columns: always visible
- Remaining columns: expandable "Show details" section
- Same row data, different layout

## Export

- **Formats**: CSV (with quote escaping) and JSON
- **Scope**: Filtered rows only + visible columns only
- **UI**: Dropdown menu in toolbar

## Formatting Utilities

- `formatNumber(value)`: `1,234.56`
- `formatCurrency(value)`: `$1,235`
- `formatDate(value)`: `Jan 15, 2025`
- `formatDateTime(value)`: `Jan 15, 2025, 02:30 PM`

## Key Files

```
frontend/src/components/
├── data-table/
│   ├── data-table.tsx (unified component: fetch + generate columns + render)
│   ├── use-view-state.ts (state hook)
│   ├── toolbar.tsx (search, export, filters)
│   ├── column-header.tsx (sort UI)
│   ├── faceted-filter.tsx (filter UI)
│   ├── filter-group-builder.tsx (advanced filter UI)
│   ├── column-visibility.tsx (visibility toggle)
│   ├── view-selector.tsx (saved views UI)
│   ├── pagination.tsx (page controls)
│   ├── data-table-card.tsx (mobile view)
│   └── editable-cells.tsx (inline editors)
├── lib/
│   └── auto-columns.ts (column generation from QueryConfig)
└── ui/table.tsx (shadcn base components)
```

## Table Inventory (19 pages)

- Referenda, Treasury, Child Bounties, Fellowship (3 tables)
- Spending, Claims (3 tables), Logs
- Manage: Categories, Bounties, Subtreasury
- Dashboards (list, view, edit)

## Performance Notes

- All filtering/sorting/pagination: server-side (API calls with LIMIT/OFFSET)
- Only current page data transferred (e.g., 100 rows instead of 10,000)
- Columns auto-generated on data load, cached with `useMemo`
- Default page size: 100 rows

## Compact Mode

- Added in PR #38 for potential dashboard integration
- `compactMode={true}` prop available on DataTable
- Reduces toolbar/pagination sizing
- Hides "Reset View" button and view mode toggle
- Currently unused (dashboard uses separate optimized component)

## See Also

- [DataTable How-To Guide](../../howtos/data-table.md) - Practical examples and recipes
- [DataTable API Reference](../../reference/frontend/data-table-api.md) - Props and configuration
- [Dashboard System](./dashboard.md) - Alternative table system for dashboards
- [Filtering Systems](./filters.md) - Detailed filtering documentation
