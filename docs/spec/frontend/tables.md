# Frontend Table Systems

**Two Distinct Systems:**
1. **Main DataTable System** - Regular pages (referenda, treasury, etc.)
2. **Dashboard System** - Dashboard components (tables, charts)

---

## SYSTEM 1: Main DataTable (TanStack Table)

### Architecture
- **Core**: Unified `DataTable` component
- **Location**: `components/data-table/data-table.tsx`
- **Library**: TanStack Table v8 with row models (core, filtered, sorted, paginated, faceted)
- **Data Pattern**: All pages use QueryConfig → auto-generated columns + columnOverrides

Component hierarchy:
```
DataTable
├── ViewSelector (saved views)
├── DataTableToolbar (search, export, filters, view toggle)
├── Table View (desktop) | Card View (mobile)
└── DataTablePagination (page controls)
```

### Data Integration Pattern

All main table pages now use **QueryConfig with auto-generated columns**:

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

### Filtering
- **Faceted**: Multi-select dropdown with counts, alphabetically sorted
- **Global Search**: `includesString` across all visible columns
- **Custom filterFn**: For uncategorized handling, numeric ranges, complex logic

### Sorting
- **Cycle**: none → asc → desc → none (click column header)
- **Disable**: `enableSorting: false` for filter-only columns
- **UI**: Arrow icons (up/down/chevrons)

### View State
- **Persisted**: sorting, filters, column visibility, global search, pagination
- **Storage**: localStorage (per-table: `opengov-views-{tableName}`)
- **URL Sharing**: Base64-encoded state in `?view=` param
- **Operations**: save, load, delete, set default
- **UI**: Tabs (desktop), dropdown (mobile)

Default views define common scenarios:
```tsx
const defaultViews: SavedView[] = [
  { name: "All", state: {...}, isDefault: true }
]
```

### Column Visibility
- **Requirement**: `accessorFn` must be defined for column to be hideable
- **UI**: Dropdown with checkboxes (hidden on mobile)
- **Display**: Column IDs with underscores/dots → spaces

### Pagination
- **Type**: Server-side (only current page fetched from API)
- **Page sizes**: 10, 20, 30, 50, 100 (default: 100)
- **Controls**: First, Previous, Next, Last (Last hidden on mobile)
- **State**: Part of view state, persisted in localStorage
- **Performance**: Pagination changes trigger API refetch with new offset

### Authentication Patterns

#### Page-Level Protection
```tsx
<RequireAuth><PageContent /></RequireAuth>
```

#### Cell-Level Toggle
```tsx
cell: ({ row }) =>
  isAuthenticated ? <EditableCell /> : <ReadOnlyCell />
```

#### Component Pairs
- `CategorySelector` ↔ `ReadOnlyCategorySelector`
- `EditableNotesCell` ↔ `ReadOnlyNotesCell`
- `EditableHideCheckbox` ↔ `ReadOnlyHideCheckbox`

### API Integration
- **Endpoint**: POST `/api/query/execute` with QueryConfig
- **Pattern**: DataTable component handles data fetching internally (useState + useEffect)
- **Pagination**: Server-side with LIMIT/OFFSET - only current page data fetched
- **Total Count**: Separate COUNT query provides total for pagination UI
- **Error Handling**: Loading/error states with user-friendly messages
- **Data Scope**: Sorting, filtering, and pagination all happen server-side

### Responsive Behavior
- **Breakpoint**: md (768px)
- **Mobile defaults**: Card view, full-width search, column pagination
- **Desktop defaults**: Table view, constrained search, row pagination
- **View Mode**: Persisted per-table in localStorage (`{tableName}-view-mode`)

#### Card View (Mobile)
- First 3 columns: always visible
- Remaining columns: expandable "Show details" section
- Same row data, different layout

### Export
- **Formats**: CSV (with quote escaping) and JSON
- **Scope**: Filtered rows only + visible columns only
- **UI**: Dropdown menu in toolbar

### Editable Cells
- **CategorySelector**: Cascading category → subcategory with auto-select
- **EditableNotesCell**: Text input with blur-to-save
- **EditableHideCheckbox**: Boolean toggle
- **Pattern**: Local state + onChange callback to parent

### Formatting Utilities
- `formatNumber(value)`: `1,234.56`
- `formatCurrency(value)`: `$1,235`
- `formatDate(value)`: `Jan 15, 2025`
- `formatDateTime(value)`: `Jan 15, 2025, 02:30 PM`

### Key Files
```
frontend/src/components/
├── data-table/
│   ├── data-table.tsx (unified component: fetch + generate columns + render)
│   ├── use-view-state.ts (state hook)
│   ├── toolbar.tsx (search, export, filters)
│   ├── column-header.tsx (sort UI)
│   ├── faceted-filter.tsx (filter UI)
│   ├── column-visibility.tsx (visibility toggle)
│   ├── view-selector.tsx (saved views UI)
│   ├── pagination.tsx (page controls)
│   ├── data-table-card.tsx (mobile view)
│   └── editable-cells.tsx (inline editors)
├── tables/ (legacy - 2 files remain for special cases)
│   ├── monthly-claims-summary.tsx
│   └── upcoming-claims-columns.tsx
├── lib/
│   └── auto-columns.ts (column generation from QueryConfig)
└── ui/table.tsx (shadcn base components)
```

### Table Inventory (19 pages)
- Referenda, Treasury, Child Bounties, Fellowship (3 tables)
- Spending, Claims (3 tables), Logs
- Manage: Categories, Bounties, Subtreasury
- Dashboards (list, view, edit)

### Performance Notes
- All filtering/sorting/pagination: server-side (API calls with LIMIT/OFFSET)
- Only current page data transferred (e.g., 100 rows instead of 10,000)
- Columns auto-generated on data load, cached with `useMemo`
- Default page size: 100 rows

### Known Limitations

#### Faceted Filters with Server-Side Pagination
Faceted filters show counts based on the current page only, not the entire filtered dataset. This is a known limitation of server-side pagination with client-side faceting.

### Compact Mode
- Added in PR #38 for potential dashboard integration
- `compactMode={true}` prop available on DataTable
- Reduces toolbar/pagination sizing
- Hides "Reset View" button and view mode toggle
- Currently unused (dashboard uses separate optimized component)

---

## SYSTEM 2: Dashboard System (Query-Driven)

### Architecture
- **Core**: `DashboardGrid` with `react-grid-layout`
- **Location**: `components/dashboard/`, `components/charts/`
- **Table Component**: `components/charts/data-table.tsx` (minimal, not TanStack)

Component hierarchy:
```
DashboardGrid (react-grid-layout)
├── DashboardComponent (per grid item)
│   ├── DashboardDataTable (simple HTML table)
│   ├── DashboardPieChart (Recharts)
│   ├── DashboardBarChart (Recharts)
│   ├── DashboardLineChart (Recharts)
│   └── TextComponent (Markdown)
└── ComponentEditor (edit dialog)
    └── QueryBuilder (visual SQL builder)
```

### Key Differences from Main DataTable
| Feature | Main DataTable | Dashboard Table |
|---------|---------------|-----------------|
| Library | TanStack Table | Plain HTML table |
| Features | Sort, filter, pagination, views | Display only |
| State | localStorage + URL | Database-backed |
| Data Source | QueryConfig → `/api/query/execute` | QueryConfig → `/api/query/execute` |
| Column Generation | Auto-generated + columnOverrides | Auto-generated + columnMapping |
| Layout | Full page | Grid cell with x,y,w,h |
| Editable | Inline cells (auth) | N/A (read-only display) |
| Mobile View | Card mode toggle | Grid adapts responsive |

### Component Types
```tsx
type DashboardComponentType =
  | "table"        // DashboardDataTable (max rows, no features)
  | "pie"          // PieChart with labelColumn + valueColumn
  | "bar_stacked"  // Stacked bar chart
  | "bar_grouped"  // Grouped bar chart
  | "line"         // Line chart with multiple series
  | "text";        // Markdown content
```

### Configuration Objects

#### QueryConfig - Defines SQL query
```tsx
{
  sourceTable: string;
  columns: ColumnSelection[];
  expressionColumns?: ExpressionColumn[];  // Computed columns
  filters: FilterCondition[];              // WHERE clauses
  groupBy?: string[];
  orderBy?: OrderByConfig[];
  limit?: number;
}
```

#### GridConfig - Grid layout
```tsx
{ x: number; y: number; w: number; h: number; }
```

#### ChartConfig - Visualization
```tsx
{
  colors?: string[];
  labelColumn?: string;
  valueColumn?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  content?: string;  // Markdown for text components
}
```

### QueryBuilder
- Visual SQL builder in ComponentEditor dialog
- Table selection from allowlist
- Column picker with alias support
- Expression columns (computed: `column1 + column2`)
- Filter UI for WHERE conditions
- GROUP BY, ORDER BY, LIMIT controls
- Live preview of query results

### Grid Layout
- `react-grid-layout` with 12-column grid
- Breakpoints: lg (1200), md (996), sm (768), xs (480), xxs (0)
- Drag-to-reposition (edit mode only)
- Resize handles (edit mode only)
- Layout persists to database via API

### Data Flow
```
ComponentEditor
  → QueryBuilder builds QueryConfig
  → POST /api/query/execute with QueryConfig
  → API validates against allowlist
  → SQL executed, returns array of objects
  → Data transformed for chart type
  → Rendered via DashboardComponent
```

### Column Formatting
Uses `lib/column-renderer.ts` (shared with Main DataTable):
- **columnMapping**: Maps result columns to source columns
  - Example: `{ "sum_DOT_latest": "DOT_latest" }`
  - Used to find formatting config (currency, number, date)
- Applies across all chart types (table, bar, line, pie tooltips)

### API Endpoints
- `GET /api/dashboards` - List dashboards
- `GET /api/dashboards?id=X` - Get dashboard
- `POST /api/dashboards` - Create (auth)
- `PUT /api/dashboards` - Update metadata (auth)
- `DELETE /api/dashboards?id=X` - Delete (auth)
- `GET /api/dashboards/components?dashboard_id=X` - Get components
- `POST /api/dashboards/components` - Create component (auth)
- `PUT /api/dashboards/components` - Update component (auth)
- `PUT /api/dashboards/components` + `grid_only: true` - Update layout only
- `DELETE /api/dashboards/components?id=X` - Delete component (auth)
- `POST /api/query/execute` - Execute QueryConfig

### Pages
- `/dashboards` - Dashboard listing (DataTable-based list)
- `/dashboards/:id` - View dashboard (read-only grid)
- `/dashboards/:id/edit` - Edit dashboard (editable grid + ComponentEditor)

### Key Files
```
frontend/src/
├── pages/dashboards/
│   ├── index.tsx (list)
│   ├── view.tsx (read-only)
│   └── edit.tsx (editable)
├── components/dashboard/
│   ├── dashboard-grid.tsx (react-grid-layout wrapper)
│   ├── dashboard-component.tsx (component renderer)
│   └── component-editor.tsx (edit dialog)
├── components/charts/
│   ├── data-table.tsx (minimal table, NOT TanStack)
│   ├── pie-chart.tsx
│   ├── bar-chart.tsx
│   └── line-chart.tsx
└── components/query-builder/
    └── query-builder.tsx (visual SQL builder)
```

---

## Comparison Summary

**Both systems use QueryConfig** for data fetching via POST `/api/query/execute`.

**Use Main DataTable when:**
- Need advanced features (sorting, filtering, pagination, views)
- Full-page dedicated table view
- User-driven exploration and analysis
- Client-side state management
- Editable cells (with auth)

**Use Dashboard System when:**
- Combining multiple visualizations
- Fixed layout with positioning (drag/resize grid)
- User builds custom queries via QueryBuilder
- Read-only presentation
- Mixed content types (tables + charts + text)
- Space-constrained display
