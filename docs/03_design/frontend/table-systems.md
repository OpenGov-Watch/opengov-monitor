# Frontend Table System

The application uses a **unified DataTable component** (TanStack Table v8) across all contexts - regular pages, dashboards, and embedded views.

## Architecture

**Core**: Unified `DataTable` component
**Location**: `components/data-table/data-table.tsx`
**Library**: TanStack Table v8
**Data Pattern**: QueryConfig → auto-generated columns + columnOverrides

Component hierarchy:
```
DataTable
├── ViewSelector (saved views, hideable in dashboard mode)
├── DataTableToolbar (search, export, filters, collapsible in dashboard mode)
├── Table View (desktop) | Card View (mobile)
└── DataTablePagination (page controls)
```

## Dashboard Mode

Dashboard tables use the same DataTable component with `dashboardMode={true}`:

```tsx
<DataTable
  queryConfig={queryConfig}
  tableName="spending"
  dashboardMode={true}
  hideViewSelector={true}
  toolbarCollapsible={true}
  initialToolbarCollapsed={true}
/>
```

**Dashboard mode features:**
- Collapsible toolbar (collapsed by default)
- Hidden view selector
- Full TanStack Table features (sorting, filtering, pagination)
- Same column formatting and auto-generation as regular pages

**Deprecated**: `components/charts/data-table.tsx` is kept only for backwards compatibility in component editor preview.

## Data Integration

All pages use **QueryConfig with auto-generated columns**:

```tsx
// 1. Define QueryConfig
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

// 2. Override rendering/formatting
const columnOverrides = {
  type: {
    cell: ({ row }) => <Badge>{row.original.type}</Badge>,
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

## Column Configuration

Columns use **three-tier priority**: table-specific config → global config → pattern-based detection → default text.

**Pattern-based auto-detection** (e.g., `DOT_*` → currency, `*_time` → date, `*_status` → badge) configured in `column-config.yaml`.

See [Column Formatting Reference](./column-formatting.md) for detailed patterns, custom configuration, and column mapping.

## Filtering

**Three filter types**: Faceted filters (multi-select dropdowns), Advanced filter composer (AND/OR logic), Global search (across all columns).

**Unified state**: Both faceted and advanced filters share `filterGroup` state. All filtering is server-side via API queries.

**filterColumn mapping**: Display columns can use a different column for filtering via `filterColumn` in columnOverrides. Example: `parentBountyId` displays "Parent" but filters by `parentBountyName` (shows bounty names instead of IDs in dropdowns).

### filterColumn Implementation

The filterColumn feature involves a two-step column name resolution:

1. **Display → Filter column** (`filterColumnMap`): Maps UI column to the column used for filtering
   - Example: `parentBountyId` → `parentBountyName`
   - Function: `mapFilterGroupColumns()` in `lib/query-config-utils.ts`

2. **Filter → DB reference** (`columnIdToRef`): Maps column name to actual DB table.column
   - Example: `parentBountyName` → `b.name`
   - Function: `resolveFilterGroupAliases()` in `lib/query-config-utils.ts`

Both mappings are applied when fetching facet values and sending filter conditions to the backend.

See [Filters Howto](../../howtos/filters.md) for usage patterns and filter strategies.

## Sorting

- **Cycle**: none → asc → desc → none (click column header)
- **Server-side**: All sorting happens server-side (API queries)
- **UI**: Arrow icons (up/down/chevrons)

## View State

- **Persisted**: sorting, filters, column visibility, global search, pagination
- **Storage**: localStorage per-table (`opengov-views-{tableName}`)
- **URL Sharing**: Base64-encoded state in `?view=` param
- **Operations**: save, load, delete, set default
- **UI**: Tabs (desktop), dropdown (mobile)

## Pagination

- **Type**: Server-side (only current page fetched)
- **Page sizes**: 10, 20, 30, 50, 100 (default: 100)
- **Controls**: First, Previous, Next, Last
- **State**: Persisted in view state

## API Integration

- **Data Endpoint**: POST `/api/query/execute` with QueryConfig
- **Facets Endpoint**: POST `/api/query/facets` with FacetQueryConfig (parallel fetch)
- **Pattern**: DataTable handles data fetching internally
- **Pagination**: Server-side LIMIT/OFFSET - only current page fetched
- **Total Count**: Separate COUNT query for pagination UI
- **Scope**: Sorting, filtering, pagination, faceting all server-side

## Responsive Behavior

- **Breakpoint**: md (768px)
- **Mobile**: Card view, full-width search, column pagination
- **Desktop**: Table view, constrained search, row pagination
- **View Mode**: Persisted per-table in localStorage

**Card View (Mobile)**:
- First 3 columns: always visible
- Remaining columns: expandable "Show details" section

## Authentication

**Page-Level**:
```tsx
<RequireAuth><PageContent /></RequireAuth>
```

**Cell-Level**:
```tsx
cell: ({ row }) =>
  isAuthenticated ? <EditableCell /> : <ReadOnlyCell />
```

**Component Pairs**:
- `CategorySelector` ↔ `ReadOnlyCategorySelector`
- `EditableNotesCell` ↔ `ReadOnlyNotesCell`
- `EditableHideCheckbox` ↔ `ReadOnlyHideCheckbox`

## Export

- **Formats**: CSV (with quote escaping), JSON, and PNG (tables/charts)
- **Scope**: Filtered rows + visible columns only
- **UI**: Dropdown menu in toolbar

### PNG Export Rendering

Tables and charts support PNG export via `html2canvas`. Since html2canvas cannot reliably resolve Tailwind CSS classes on off-screen elements, exportable components use an `exportMode` prop:

```
exportMode=false (default): Tailwind CSS classes for interactive display
exportMode=true: Inline styles for html2canvas capture
```

**Architecture**:
- `SimpleTable`: Unified table component with `exportMode` prop
- `ExportTable`: Thin wrapper that sets `exportMode={true}`
- `ChartLegend`: Shared legend component for pie/bar/line charts

**Shared logic** (same code path for both modes):
- Column config lookup (`getColumnConfig`)
- Value formatting (`formatValue`)
- Display name resolution (`getColumnDisplayName`)
- Hidden column filtering

**Style constants** in `lib/export-styles.ts` define corresponding values for both modes to keep them in sync.

**Key files**:
- `components/data-table/simple-table.tsx` - Unified table with exportMode
- `components/data-table/export-table.tsx` - Export-mode wrapper
- `components/charts/shared/chart-legend.tsx` - Shared chart legend
- `lib/export-styles.ts` - Style constants

## Dashboard Integration

Dashboards use `react-grid-layout` with DataTable components (`dashboardMode={true}`) as grid items.

**Key differences**: Grid positioning (x,y,w,h), drag/resize in edit mode, collapsed toolbar by default, no view selector, database-backed configuration.

**Configuration stored in DB**: `QueryConfig` (data fetching), `GridConfig` (position/size), `columnMapping` (column format mapping).

See [Dashboard Howto](../../howtos/dashboard.md) for creating dashboards with DataTable components.

## Key Files

```
frontend/src/components/
├── data-table/
│   ├── data-table.tsx (unified component: regular + dashboard mode)
│   ├── simple-table.tsx (unified table with exportMode prop)
│   ├── export-table.tsx (thin wrapper for PNG export)
│   ├── use-view-state.ts (state management)
│   ├── toolbar.tsx (search, export, filters)
│   ├── column-header.tsx (sort UI)
│   ├── faceted-filter.tsx (filter UI)
│   ├── column-visibility.tsx (visibility toggle)
│   ├── view-selector.tsx (saved views UI)
│   ├── pagination.tsx (page controls)
│   ├── data-table-card.tsx (mobile view)
│   └── editable-cells.tsx (inline editors)
├── charts/
│   ├── pie-chart.tsx, bar-chart.tsx, line-chart.tsx
│   └── shared/
│       └── chart-legend.tsx (unified legend with exportMode)
├── dashboard/
│   ├── dashboard-grid.tsx (react-grid-layout wrapper)
│   ├── dashboard-component.tsx (grid item renderer)
│   └── component-editor.tsx (edit dialog)
├── query-builder/
│   └── query-builder.tsx (visual SQL builder)
└── lib/
    ├── auto-columns.ts (column generation from QueryConfig)
    ├── column-renderer.ts (formatting utilities)
    └── export-styles.ts (style constants for export mode)
```

## Pages Using DataTable

**19 table pages**:
- Referenda, Treasury, Child Bounties, Fellowship (3 tables)
- Spending, Claims (3 tables), Logs
- Manage: Categories, Bounties, Subtreasury
- Dashboards (list, view, edit)

## Performance

- All filtering/sorting/pagination: server-side (API calls)
- Only current page data transferred (100 rows instead of 10,000)
- Columns auto-generated and cached with `useMemo`
- Default page size: 100 rows
- Facets fetched in parallel with table data

## Related Documentation

- [Data Table Howto](../../howtos/data-table.md) - Usage guide
- [Query Builder Howto](../../howtos/query-builder.md) - Building queries
- [Filter Howto](../../howtos/filters.md) - Filter patterns
- [Data Table Spec](../../01_requirements/frontend/data-table.md) - Requirements
- [Dashboard Spec](../../01_requirements/frontend/dashboard.md) - Dashboard requirements
