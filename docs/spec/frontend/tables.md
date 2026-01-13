# Frontend Table Systems

**Two Distinct Systems:**
1. **Main DataTable System** - Regular pages (referenda, treasury, etc.)
2. **Dashboard System** - Dashboard components (tables, charts)

---

## SYSTEM 1: Main DataTable (TanStack Table)

### Architecture
- **Core**: `DataTable<TData, TValue>` generic component
- **Location**: `components/data-table/data-table.tsx`
- **Library**: TanStack Table v8 with row models (core, filtered, sorted, paginated, faceted)

Component hierarchy:
```
DataTable
├── ViewSelector (saved views)
├── DataTableToolbar (search, export, filters, view toggle)
├── Table View (desktop) | Card View (mobile)
└── DataTablePagination (page controls)
```

### Column Patterns

#### Dot-Notation (SQLite columns with dots)
```tsx
{
  id: "tally_ayes",  // Must provide explicit ID
  accessorFn: (row) => row["tally.ayes"],  // Bracket notation
  cell: ({ row }) => formatNumber(row.original["tally.ayes"])
}
```

#### Column Types
- **ID/Link**: `accessorKey` + custom cell with href
- **Status Badge**: Helper fn + Badge component with semantic colors
- **Numeric**: Right-aligned with `formatNumber()`
- **Currency**: `formatCurrency()` USD with no decimals
- **Date/DateTime**: `formatDate()` / `formatDateTime()`
- **Faceted Filter**: `DataTableFacetedFilter` in header + custom `filterFn`
- **Editable**: `CategorySelector`, `EditableNotesCell`, etc. (auth-gated)

#### Factory Pattern (for editable tables)
```tsx
export function createReferendaColumns(options: {
  categories: Category[];
  onUpdate: (id: number, data: Partial<Referendum>) => void;
  isAuthenticated?: boolean;
}): ColumnDef<Referendum>[]
```

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
- **Page sizes**: 10, 20, 30, 50, 100 (default: 100)
- **Controls**: First, Previous, Next, Last (Last hidden on mobile)
- **State**: Part of view state, persisted in localStorage

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
- **Client**: `api.{resource}.getAll()` with credentials: "include"
- **Pattern**: useState + useEffect, loading states
- **Error Handling**: Try-catch with error message display
- **Data Scope**: Fetch all on mount, client-side processing

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
│   ├── data-table.tsx (main orchestrator)
│   ├── use-view-state.ts (state hook)
│   ├── toolbar.tsx (search, export, filters)
│   ├── column-header.tsx (sort UI)
│   ├── faceted-filter.tsx (filter UI)
│   ├── column-visibility.tsx (visibility toggle)
│   ├── view-selector.tsx (saved views UI)
│   ├── pagination.tsx (page controls)
│   ├── data-table-card.tsx (mobile view)
│   └── editable-cells.tsx (inline editors)
├── tables/*-columns.tsx (12 column definition files)
└── ui/table.tsx (shadcn base components)
```

### Table Inventory (19 pages)
- Referenda, Treasury, Child Bounties, Fellowship (3 tables)
- Spending, Claims (3 tables), Logs
- Manage: Categories, Bounties, Subtreasury
- Dashboards (list, view, edit)

### Performance Notes
- All filtering/sorting/pagination: client-side (no API calls)
- TanStack Table row models handle large datasets
- `useMemo` for columns (deps: categories, auth state)
- Default page size: 100 rows

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
| Data Source | Direct API endpoints | QueryBuilder → `/api/query/execute` |
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

**Use Main DataTable when:**
- Need advanced features (sorting, filtering, pagination, views)
- Full-page dedicated table view
- User-driven exploration and analysis
- Client-side state management

**Use Dashboard System when:**
- Combining multiple visualizations
- Fixed layout with positioning
- Query-driven data (user builds SQL)
- Read-only presentation
- Mixed content types (tables + charts + text)
