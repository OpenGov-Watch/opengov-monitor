# Dashboard System Specification

This document specifies the Dashboard system - a flexible, grid-based system for combining multiple data visualizations.

## Overview

**Core Component**: `DashboardGrid` with `react-grid-layout`
**Location**: `components/dashboard/`, `components/charts/`
**Table Component**: `components/charts/data-table.tsx` (minimal, not TanStack)
**Purpose**: Composable dashboards with tables, charts, and text components

## Architecture

### Component Hierarchy

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

## Comparison with DataTable System

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

**Key Difference**: Both systems use QueryConfig, but Dashboard is for read-only presentation in grid layouts, while DataTable is for interactive data exploration.

## Component Types

```tsx
type DashboardComponentType =
  | "table"        // DashboardDataTable (max rows, no features)
  | "pie"          // PieChart with labelColumn + valueColumn
  | "bar_stacked"  // Stacked bar chart
  | "bar_grouped"  // Grouped bar chart
  | "line"         // Line chart with multiple series
  | "text";        // Markdown content
```

## Configuration Objects

### QueryConfig - Defines SQL query
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

### GridConfig - Grid layout
```tsx
{ x: number; y: number; w: number; h: number; }
```

### ChartConfig - Visualization
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

## QueryBuilder

Visual SQL builder in ComponentEditor dialog.

**Logical workflow order:**
1. Table selection from allowlist
2. JOIN tables (auto-populated ON conditions)
3. Column picker with alias support (includes joined table columns, grouped by table)
4. Expression columns (computed: `column1 + column2`)
5. Filter UI for WHERE conditions
6. ORDER BY controls

**Features:**
- JOIN support (LEFT, INNER, RIGHT)
- Auto-detects FK relationships (e.g., `category_id`, `parentBountyId`)
- Automatically populates ON clause
- Optional table aliases
- Simplified UI (no manual ON condition entry)
- Access joined table columns in picker
- Live preview of query results
- **Fixed row limit** (1000 rows for dashboard queries)

### QueryBuilder JOIN Examples

**Example 1: Claims with Referendum Data**
```typescript
{
  sourceTable: "outstanding_claims",
  joins: [{
    type: "LEFT",
    table: "Referenda",
    on: {
      left: "outstanding_claims.referendumIndex",
      right: "Referenda.id"
    }
  }],
  columns: [
    { column: "outstanding_claims.description" },
    { column: "outstanding_claims.expireAt" },
    { column: "Referenda.proposal_time" }
  ],
  filters: [
    { column: "Referenda.proposal_time", operator: "<=", value: "2025-12-31" },
    { column: "outstanding_claims.expireAt", operator: ">", value: "2025-12-31" }
  ]
}
```

**Example 2: Multiple JOINs with Aliases**
```typescript
{
  sourceTable: "Child Bounties",
  joins: [
    {
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: {
        left: "Child Bounties.category_id",
        right: "c.id"
      }
    },
    {
      type: "LEFT",
      table: "Bounties",
      alias: "b",
      on: {
        left: "Child Bounties.parentBountyId",
        right: "b.id"
      }
    }
  ],
  columns: [
    { column: "Child Bounties.title" },
    { column: "c.name" },
    { column: "b.title" }
  ]
}
```

### Auto-populated JOIN Patterns

The query builder auto-detects foreign key relationships based on naming conventions:

**Pattern 1: `{table}_id` columns**
- `category_id` → joins to `Categories.id`
- `parent_bounty_id` → joins to `Bounties.id`

**Pattern 2: `{table}Id` camelCase**
- `parentBountyId` → joins to `Bounties.id`
- `referendumId` → joins to `Referenda.id`

**Pattern 3: `{table}Index`**
- `referendumIndex` → joins to `Referenda.id`

**Special case: Child Bounties**
- Uses `identifier` as primary key (not `id`)
- Joins TO Child Bounties use `Child Bounties.identifier`

**When no FK pattern is found:**
- ON clause left empty
- User can manually select columns (fallback behavior)

## Grid Layout

- `react-grid-layout` with 12-column grid
- Breakpoints: lg (1200), md (996), sm (768), xs (480), xxs (0)
- Drag-to-reposition (edit mode only)
- Resize handles (edit mode only)
- Layout persists to database via API

### Layout & Scrolling Architecture

**Critical CSS patterns** for proper height constraints and scrolling:

1. **Height chain** (flex layout from page → grid → component):
   ```tsx
   // Dashboard pages (view.tsx, edit.tsx)
   <div className="flex-1 min-h-0 flex flex-col gap-6">
     <div className="flex-1 min-h-0">
       <DashboardGrid />
     </div>
   </div>
   ```

2. **Grid container overflow**:
   ```tsx
   // dashboard-grid.tsx
   <div className="w-full h-full overflow-auto">
     <ResponsiveGridLayout />
   </div>
   ```

3. **Grid item overflow** (prevents content from expanding entire grid):
   ```css
   /* globals.css - REQUIRED for proper height calculation */
   .react-grid-item {
     overflow: hidden;
   }
   ```

4. **Grid item wrapper** (propagates react-grid-layout's inline heights):
   ```tsx
   // dashboard-grid.tsx - wrapper div MUST have h-full
   <div key={component.id} className="h-full">
     <DashboardComponent />
   </div>
   ```

5. **Component content scrolling**:
   ```tsx
   // dashboard-component.tsx
   <div className="h-full flex flex-col">
     <div className="flex-1 p-3 min-h-0 overflow-auto">
       {/* Tables scroll here, sticky headers work */}
     </div>
   </div>
   ```

**Why this matters:**
- react-grid-layout sets heights via inline styles (e.g., `height: 350px`)
- Without `overflow: hidden` on grid items, tall content (tables) expands the entire grid
- Without the complete height chain, components can't calculate scroll boundaries
- `min-h-0` allows flex children to shrink below content size (enables scrolling)

**Sticky table headers:**
- Applied at `<th>` cell level, not `<thead>` wrapper
- Base UI component: `components/ui/table.tsx` TableHead has `sticky top-0 z-20`
- Works in both main DataTable and dashboard tables

## Data Flow

```
ComponentEditor
  → QueryBuilder builds QueryConfig
  → POST /api/query/execute with QueryConfig
  → API validates against allowlist
  → SQL executed, returns array of objects
  → Data transformed for chart type
  → Rendered via DashboardComponent
```

## Column Formatting

Uses `lib/column-renderer.ts` (shared with Main DataTable):
- **columnMapping**: Maps result columns to source columns
  - Example: `{ "sum_DOT_latest": "DOT_latest" }`
  - Used to find formatting config (currency, number, date)
- Applies across all chart types (table, bar, line, pie tooltips)

## API Endpoints

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

## Pages

- `/dashboards` - Dashboard listing (DataTable-based list)
- `/dashboards/:id` - View dashboard (read-only grid)
- `/dashboards/:id/edit` - Edit dashboard (editable grid + ComponentEditor)

## Key Files

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

## Use Cases

**Use Dashboard System when:**
- Combining multiple visualizations
- Fixed layout with positioning (drag/resize grid)
- User builds custom queries via QueryBuilder
- Read-only presentation
- Mixed content types (tables + charts + text)
- Space-constrained display

**Use DataTable System when:**
- Need advanced features (sorting, filtering, pagination, views)
- Full-page dedicated table view
- User-driven exploration and analysis
- Client-side state management
- Editable cells (with auth)

## See Also

- [Dashboard How-To Guide](../../howtos/dashboard.md) - Practical examples and recipes
- [Dashboard API Reference](../../reference/frontend/dashboard-api.md) - Props and configuration
- [QueryBuilder Specification](./query-builder.md) - Visual SQL builder details
- [DataTable System](./data-table.md) - Alternative table system for pages
