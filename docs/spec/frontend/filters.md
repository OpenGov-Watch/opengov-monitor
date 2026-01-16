# Filtering Systems Specification

This document specifies the various filtering mechanisms used across the frontend.

## Overview

The application uses multiple filtering systems for different use cases:

1. **FacetedFilter** - Multi-select dropdown filters with counts (DataTable)
2. **FilterGroupBuilder** - Advanced filter builder with AND/OR logic (QueryBuilder/Dashboard)
3. **Global Search** - Full-text search across columns (DataTable)

## 1. FacetedFilter Component

### Purpose
Multi-select dropdown filters for DataTable columns, showing all unique values with counts.

### Location
`components/data-table/faceted-filter.tsx`

### Features
- Multi-select with checkboxes
- Shows count for each value
- Apply/Cancel buttons for confirmation
- Searchable dropdown
- Sorted alphabetically
- Server-side data fetching

### Architecture

```tsx
<DataTableFacetedFilter
  column={column}
  title="Status"
/>
```

### Server-Side Fetching

Faceted filters fetch data from the server for optimal performance:

- **API Endpoint**: POST `/api/query/facets` with FacetQueryConfig
- **Scope**: Returns ALL distinct values + counts from full dataset (not just current page)
- **Parallel Fetching**: Facet data fetched in parallel with table data using `Promise.all()`
- **Filter Dependencies**: Facet values update when other filters are applied
  - Example: Selecting status="Ongoing" updates track facets to show only tracks with ongoing referenda
- **Performance**: Fast queries via database indexes on faceted columns
- **Graceful Degradation**: Falls back to client-side faceting if API request fails

### Usage in DataTable

Enable faceted filters by listing column IDs in the `facetedFilters` prop:

```tsx
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}  // Enable filters on these columns
/>
```

### UI Behavior

1. **Trigger Button**:
   - Shows column name
   - Dropdown chevron icon
   - Badge showing number of selected values (when filters applied)

2. **Dropdown**:
   - Search input for filtering options
   - Checkbox list of all unique values
   - Count displayed next to each value
   - Clear, Cancel, and Apply buttons at bottom

3. **State Management**:
   - Pending selections (not yet applied) stored locally
   - Clicking Apply commits filters to table state
   - Clicking Cancel reverts to previous state
   - Clear removes all selections in dropdown

### Example

```tsx
// In toolbar, status filter is enabled
<DataTableFacetedFilter
  column={table.getColumn("status")}
  title="Status"
/>

// Results in multi-select dropdown with options like:
// ☑ Executed (1,234)
// ☐ Rejected (567)
// ☑ Ongoing (89)
```

### Technical Details

- Uses TanStack Table's `getFacetedUniqueValues()` for counts
- Filter function: `(row, id, value) => value.includes(row.getValue(id))`
- Sorting disabled on faceted filter columns (`enableSorting: false`)
- Faceted filters automatically get special header component

## 2. FilterGroupBuilder Component

### Purpose
Advanced filter builder with nested AND/OR logic for complex queries.

### Location
`components/data-table/filter-group-builder.tsx`

### Features
- Nested AND/OR groups
- Multiple operators (=, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL)
- Add/remove conditions dynamically
- Recursive group structure
- Used in QueryBuilder and Dashboard filters

### Architecture

```tsx
<FilterGroupBuilder
  group={filterGroup}
  availableColumns={columns}
  onUpdate={(updatedGroup) => setFilters(updatedGroup)}
  level={0}
/>
```

### Data Structure

```typescript
interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

interface FilterCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value?: string | number;
}
```

### Example Structure

**Simple AND group:**
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "=", value: "Executed" },
    { column: "DOT_latest", operator: ">", value: 1000 }
  ]
}
```

**Nested AND/OR groups:**
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "=", value: "Executed" },
    {
      operator: "OR",
      conditions: [
        { column: "track", operator: "=", value: "Root" },
        { column: "track", operator: "=", value: "Whitelisted Caller" }
      ]
    }
  ]
}
```

### UI Components

1. **Group Container**:
   - AND/OR toggle button
   - List of conditions/sub-groups
   - Add condition button
   - Add group button

2. **Condition Row**:
   - Column selector dropdown
   - Operator selector dropdown
   - Value input (text/number)
   - Remove button

3. **Nested Groups**:
   - Recursively renders sub-groups
   - Visual indentation for hierarchy
   - Level tracking prevents excessive nesting

### Operators

| Operator | Label | Value Required | Example |
|----------|-------|----------------|---------|
| `=` | equals | Yes | status = "Executed" |
| `!=` | not equals | Yes | status != "Rejected" |
| `>` | greater than | Yes | DOT_latest > 1000 |
| `<` | less than | Yes | DOT_latest < 10000 |
| `>=` | greater than or equal | Yes | USD_latest >= 5000 |
| `<=` | less than or equal | Yes | USD_latest <= 50000 |
| `LIKE` | contains | Yes | title LIKE "%treasury%" |
| `IN` | in list | Yes | status IN ("Executed", "Ongoing") |
| `IS NULL` | is null | No | notes IS NULL |
| `IS NOT NULL` | is not null | No | notes IS NOT NULL |

### Performance Optimization

The FilterGroupBuilder is memoized to prevent unnecessary re-renders:
- Individual condition rows use `React.memo`
- Only changed conditions re-render when updated
- Prevents cascading re-renders when adding new conditions

### Integration

Used in:
- **QueryBuilder**: Build WHERE clauses for dashboard queries
- **Advanced Filter Dialog**: (Potential future feature for DataTable)

## 3. Global Search

### Purpose
Full-text search across all visible table columns.

### Location
`components/data-table/toolbar.tsx` (search input)

### Features
- Searches all visible columns simultaneously
- Case-insensitive
- Uses `includesString` matching
- Real-time filtering as you type
- Part of persisted view state

### Implementation

```tsx
// In toolbar
<Input
  placeholder="Search all columns..."
  value={globalFilter ?? ""}
  onChange={(event) => setGlobalFilter(event.target.value)}
  className="h-8 w-[150px] lg:w-[250px]"
/>
```

### Behavior
- Filters rows where ANY visible column contains the search text
- Substring matching (not exact match)
- Updates faceted filter counts (only matching rows counted)
- Persisted in view state (localStorage + URL)

## Comparison

| Feature | FacetedFilter | FilterGroupBuilder | Global Search |
|---------|---------------|-------------------|---------------|
| **Use Case** | Quick multi-select on specific columns | Complex AND/OR logic queries | Full-text search |
| **Location** | DataTable column headers | QueryBuilder, Dashboard | DataTable toolbar |
| **Operators** | Equals (implicit) | 10 operators | Contains (implicit) |
| **Multi-column** | No (per column) | Yes (any columns) | Yes (all columns) |
| **Nesting** | No | Yes (AND/OR groups) | No |
| **Server-side** | Yes | Yes (via QueryConfig) | No (client-side) |
| **Shows Counts** | Yes | No | No |
| **Apply/Cancel** | Yes | N/A (live update) | N/A (live update) |

## Filter State Management

### DataTable Filters
- Stored in `columnFilters` state (TanStack Table)
- Persisted in localStorage per table (`opengov-views-{tableName}`)
- Can be saved in named views
- URL shareable via base64-encoded `?view=` param

### QueryBuilder Filters
- Stored in `QueryConfig.filters` (FilterGroup structure)
- Saved to database with dashboard component
- Executed server-side by API

### Global Search
- Stored in `globalFilter` state (TanStack Table)
- Persisted in localStorage with view state
- Applied client-side across all visible columns

## API Integration

### Faceted Filters
```typescript
// Request
POST /api/query/facets
{
  sourceTable: "Referenda",
  columns: ["status", "track"],
  currentFilters: [...]  // Other active filters
}

// Response
{
  status: {
    "Executed": 1234,
    "Rejected": 567,
    "Ongoing": 89
  },
  track: {
    "Root": 45,
    "Whitelisted Caller": 123
  }
}
```

### FilterGroupBuilder (via QueryConfig)
```typescript
// Request
POST /api/query/execute
{
  sourceTable: "Referenda",
  columns: [...],
  filters: [
    { column: "status", operator: "=", value: "Executed" },
    { column: "DOT_latest", operator: ">", value: 1000 }
  ]
}

// SQL Generated
SELECT ... FROM Referenda
WHERE status = 'Executed' AND DOT_latest > 1000
```

## Best Practices

### When to Use FacetedFilter
- Column has limited distinct values (< 100)
- Users need to see value counts
- Multi-select is common (status, track, category)
- Column is frequently filtered

### When to Use FilterGroupBuilder
- Complex logic required (AND/OR combinations)
- Building custom queries (QueryBuilder)
- Advanced users creating dashboards
- Programmatic filtering

### When to Use Global Search
- Quick exploration of data
- Don't know which column contains value
- Simple text matching sufficient
- No need for counts or complex logic

## Key Files

```
frontend/src/components/data-table/
├── faceted-filter.tsx         # Multi-select dropdown filter
├── filter-group-builder.tsx   # Advanced AND/OR filter builder
└── toolbar.tsx                 # Contains global search input

frontend/src/lib/
├── query-config-utils.ts      # Convert filters to QueryConfig
└── auto-columns.ts            # Sets up filter functions for columns
```

## See Also

- [Filtering How-To Guide](../../howtos/filters.md) - Practical examples
- [DataTable Specification](./data-table.md) - DataTable system overview
- [QueryBuilder Specification](./query-builder.md) - QueryBuilder integration
