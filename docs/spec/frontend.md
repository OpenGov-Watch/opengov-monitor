# Frontend Architecture

## Overview

The frontend is a Vite + React application that provides an interactive dashboard for exploring Polkadot governance data. It fetches data from the Express API server and uses TanStack Table for client-side data manipulation.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Vite 6 | Build tool and dev server |
| React 19 | UI framework |
| React Router v7 | Client-side routing |
| TypeScript | Type safety |
| TanStack Table | Data table with sorting, filtering, pagination |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Accessible UI components |
| Recharts | Charts and visualizations for dashboards |
| react-grid-layout | Drag-and-drop grid layout for dashboards |

---

## Directory Structure

```
frontend/src/
├── main.tsx                      # React entry point
├── router.tsx                    # React Router configuration
├── globals.css                   # Tailwind + CSS variables
│
├── pages/                        # Page components (lazy-loaded)
│   ├── dashboard.tsx             # Dashboard home
│   ├── referenda.tsx             # Referenda table
│   ├── treasury.tsx              # Treasury table
│   ├── child-bounties.tsx        # Child bounties table
│   ├── fellowship.tsx            # Fellowship table
│   ├── fellowship-salary-cycles.tsx
│   ├── fellowship-salary-claimants.tsx
│   ├── spending.tsx              # Aggregated spending
│   ├── outstanding-claims.tsx    # Outstanding claims
│   ├── expired-claims.tsx        # Expired claims
│   ├── logs.tsx                  # System logs
│   ├── dashboards/
│   │   ├── index.tsx             # Dashboard list
│   │   ├── view.tsx              # View dashboard
│   │   └── edit.tsx              # Edit dashboard
│   └── manage/
│       ├── categories.tsx        # CRUD categories
│       ├── bounties.tsx          # Assign bounty categories
│       ├── subtreasury.tsx       # CRUD subtreasury
│       └── sync-settings.tsx     # CSV import for bulk categorization
│
├── api/
│   └── client.ts                 # API client functions
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── select.tsx
│   │   ├── popover.tsx
│   │   ├── checkbox.tsx
│   │   ├── separator.tsx
│   │   ├── command.tsx
│   │   └── dialog.tsx
│   │
│   ├── data-table/               # Reusable table components
│   │   ├── data-table.tsx        # Main table component
│   │   ├── skeleton.tsx          # Loading skeleton
│   │   ├── column-header.tsx     # Sortable column headers
│   │   ├── pagination.tsx        # Page navigation
│   │   ├── toolbar.tsx           # Search, export, view controls
│   │   ├── column-visibility.tsx # Show/hide columns
│   │   └── editable-cells.tsx    # Inline editable cell components
│   │
│   ├── tables/                   # Table-specific columns
│   │   ├── referenda-columns.tsx
│   │   ├── treasury-columns.tsx
│   │   ├── child-bounties-columns.tsx
│   │   ├── fellowship-columns.tsx
│   │   ├── fellowship-salary-cycles-columns.tsx
│   │   ├── fellowship-salary-claimants-columns.tsx
│   │   └── all-spending-columns.tsx
│   │
│   ├── charts/                   # Chart components
│   │   ├── pie-chart.tsx
│   │   ├── bar-chart.tsx
│   │   ├── line-chart.tsx
│   │   └── data-table.tsx
│   │
│   ├── dashboard/                # Dashboard components
│   │   ├── dashboard-grid.tsx    # Grid layout container
│   │   ├── dashboard-component.tsx
│   │   └── component-editor.tsx
│   │
│   ├── query-builder/            # Query builder components
│   │   ├── query-builder.tsx
│   │   ├── sortable-column.tsx   # Drag-and-drop column reordering
│   │   └── types.ts
│   │
│   └── layout/
│       ├── Layout.tsx            # Root layout with sidebar (full-height flex)
│       └── sidebar.tsx           # Collapsible navigation sidebar
│
├── hooks/
│   └── use-view-state.ts         # Table state persistence
│
├── lib/
│   ├── utils.ts                  # cn(), formatters
│   ├── export.ts                 # CSV/JSON export
│   ├── csv-parser.ts             # CSV import parsing utilities
│   ├── column-display-names.ts   # Column display name utility
│   └── db/
│       └── types.ts              # TypeScript interfaces
│
└── types/
    └── react-grid-layout.d.ts    # Type overrides
```

---

## Data Flow

### Client-Side Data Fetching

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Page Component │────▶│   API Client    │────▶│  Express API    │
│  (useEffect)    │     │  fetch('/api/') │     │  (:3001)        │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         ▼ data (JSON)
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   useState      │────▶│   TanStack      │────▶│   Browser       │
│   setData()     │     │   Table         │     │   Render        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Example Page Component

```tsx
// pages/referenda.tsx
import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { referendaColumns } from "@/components/tables/referenda-columns";

export default function ReferendaPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/referenda")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DataTableSkeleton />;

  return (
    <DataTable
      columns={referendaColumns}
      data={data}
      tableName="referenda"
    />
  );
}
```

---

## API Configuration

The frontend supports dynamic API server selection via `ApiProvider` context.

### Runtime Configuration

API presets are defined in `public/config.json`:

```json
{
  "apiPresets": {
    "local": "/api",
    "production": "https://your-domain.com/api"
  },
  "defaultPreset": "local"
}
```

### URL Parameter Selection

Switch API servers via URL parameter:
- Preset name: `?api=production`
- Port number: `?api=3002` → `http://localhost:3002/api`
- Full URL: `?api=https://custom.example.com/api`

Selection persists to localStorage across sessions.

### Development Sidebar

In dev mode (`import.meta.env.DEV`), a dropdown in the sidebar allows switching between configured API presets.

---

## API Client

The API client (`src/api/client.ts`) provides typed fetch functions for all endpoints:

```typescript
// api/client.ts
let apiBase = "/api";  // Dynamic, set by ApiProvider

export const api = {
  referenda: {
    getAll: () => fetch(`${API_BASE}/referenda`).then(r => r.json()),
  },
  treasury: {
    getAll: () => fetch(`${API_BASE}/treasury`).then(r => r.json()),
  },
  dashboards: {
    getAll: () => fetch(`${API_BASE}/dashboards`).then(r => r.json()),
    create: (data) => fetch(`${API_BASE}/dashboards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    // ...
  },
  query: {
    getSchema: () => fetch(`${API_BASE}/query/schema`).then(r => r.json()),
    execute: (config) => fetch(`${API_BASE}/query/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then(r => r.json()),
  },
};
```

---

## TypeScript Types

Types in `lib/db/types.ts` mirror the backend's SQLite schema:

```typescript
export interface Referendum {
  id: number;
  url: string;
  title: string;
  status: string;
  DOT_proposal_time: number | null;
  USD_proposal_time: number | null;
  track: string;
  "tally.ayes": number | null;
  "tally.nays": number | null;
  proposal_time: string | null;
  latest_status_change: string | null;
  // ...
}
```

---

## DataTable Component

### Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                            DataTable                               │
├───────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                        Toolbar                               │  │
│  │  [Search...] [Columns ▼] [Save View] [Load] [Reset] [Export] │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                         Table                                │  │
│  │  ┌─────────┬──────────┬───────────┬──────────┬─────────┐    │  │
│  │  │ ID ▲▼   │ Title ▲▼ │ Status ▼  │ Track ▼  │ DOT ▲▼  │    │  │
│  │  │ (sort)  │ (sort)   │ (filter)  │ (filter) │ (sort)  │    │  │
│  │  ├─────────┼──────────┼───────────┼──────────┼─────────┤    │  │
│  │  │ 1234    │ Prop...  │ ✓ Executed│ Treasury │ 10,000  │    │  │
│  │  │ 1235    │ Fund...  │ ○ Ongoing │ Spender  │ 5,000   │    │  │
│  │  └─────────┴──────────┴───────────┴──────────┴─────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                       Pagination                             │  │
│  │  100 rows │ Rows: [100 ▼] │ Page 1 of 5 │ < 1 2 3 >          │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘

Column Header Types:
  ▲▼ = Sortable (click to cycle: asc → desc → none)
  ▼  = Filterable (click to open multi-select dropdown)
```

### TanStack Table Integration

```tsx
// components/data-table/data-table.tsx
const table = useReactTable({
  data,
  columns,
  state: {
    sorting,
    columnFilters,
    columnVisibility,
    globalFilter,
    pagination,
  },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onColumnVisibilityChange: setColumnVisibility,
  onGlobalFilterChange: setGlobalFilter,
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  globalFilterFn: "includesString",
});
```

---

## Column Definitions

Each table has a column definition file that configures:

- **Header rendering** - Sortable or filterable column headers
- **Cell rendering** - Custom formatting (numbers, dates, badges)
- **Filter functions** - How column filtering works

### Column Header Behavior

| Column Type | Click Behavior | Example Columns |
|-------------|----------------|-----------------|
| **Sortable** | Cycles through: ascending → descending → none | ID, Title, DOT, USD, dates |
| **Filterable** | Opens dropdown to select visible values | Status, Track |

### Example

```tsx
// components/tables/referenda-columns.tsx
export const referendaColumns: ColumnDef<Referendum>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("id")}</div>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return <Badge variant={getStatusVariant(status)}>{status}</Badge>;
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
];
```

---

## View State Management

### Overview

The `useViewState` hook manages table state (sorting, filters, pagination) and persists it to:

1. **localStorage** - For saving/loading named views
2. **URL parameters** - For shareable links

### State Structure

```typescript
interface ViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  globalFilter: string;
  pagination: PaginationState;  // Default: pageSize 100
}
```

### URL Encoding

View state is base64-encoded and stored in the `view` URL parameter:

```
/referenda?view=eyJzb3J0aW5nIjpbeyJpZCI6InN0YXR1cyIsImRlc2MiOnRydWV9XX0=
```

### Usage

```tsx
const {
  sorting,
  setSorting,
  columnFilters,
  setColumnFilters,
  saveViewState,   // Save to localStorage + URL
  loadViewState,   // Restore from localStorage
  clearViewState,  // Reset to defaults
} = useViewState("referenda");
```

---

## Export Functionality

### CSV Export

```typescript
// lib/export.ts
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => escapeCSV(row[h])).join(",")
    ),
  ].join("\n");

  downloadFile(csvContent, `${filename}.csv`, "text/csv");
}
```

Exports include only the currently filtered/visible data.

---

## Routing

### React Router Configuration

```tsx
// router.tsx
import { createBrowserRouter } from "react-router";
import { lazy } from "react";
import { Layout } from "@/components/layout/Layout";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ReferendaPage = lazy(() => import("@/pages/referenda"));
// ... more lazy imports

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "referenda", element: <ReferendaPage /> },
      { path: "treasury", element: <TreasuryPage /> },
      { path: "dashboards", element: <DashboardsPage /> },
      { path: "dashboards/:id", element: <DashboardViewPage /> },
      { path: "dashboards/:id/edit", element: <DashboardEditPage /> },
      // ...
    ],
  },
]);
```

### Navigation

Uses React Router hooks instead of Next.js:

| React Router | Purpose |
|--------------|---------|
| `Link` | Navigation links |
| `useNavigate` | Programmatic navigation |
| `useLocation` | Current pathname |
| `useParams` | Route parameters |
| `useSearchParams` | URL query parameters |

---

## Styling

### Tailwind CSS

Uses Tailwind with CSS variables for theming:

```css
/* globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}
```

### shadcn/ui Components

Pre-built accessible components from shadcn/ui:

- Button, Input, Badge
- Table, DropdownMenu, Select
- Popover, Dialog, Command
- Checkbox, Separator

---

## Configuration

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Read API port from file written by API server on startup
function getApiPort(): number {
  const portFile = path.resolve(__dirname, "../data/.api-port");
  try {
    const port = parseInt(fs.readFileSync(portFile, "utf-8").trim(), 10);
    if (!isNaN(port)) return port;
  } catch {
    // Port file doesn't exist yet, use default
  }
  return 3001;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Allow fallback to next available port
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${getApiPort()}`,
        changeOrigin: true,
      },
    },
  },
});
```

The dev server proxies all `/api/*` requests to the Express API server. The API port is read dynamically from `data/.api-port` (written by the API server on startup), enabling automatic port discovery when default ports are in use.

---

## Implementation Notes

### Dot-Notation Column Names

SQLite columns like `tally.ayes` contain literal dots. TanStack Table interprets dots in `accessorKey` as nested property paths. Use `accessorFn` instead:

```tsx
// WRONG - interprets as row.tally.ayes (nested object)
{ accessorKey: "tally.ayes" }

// CORRECT - accesses row["tally.ayes"] literally
{
  id: "tally_ayes",
  accessorFn: (row) => row["tally.ayes"],
  cell: ({ row }) => row.original["tally.ayes"],
}
```

### Loading States

Each page manages its own loading state with `useState`:

```tsx
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch("/api/endpoint")
    .then(res => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);

if (loading) return <DataTableSkeleton />;
```

### React Router Params

Route parameters are always strings. Parse numeric IDs:

```tsx
const { id } = useParams();
const numericId = parseInt(id as string, 10);
```

---

## Custom Dashboards

The dashboard feature allows users to create custom visualizations using a visual query builder.

### Features

- **CRUD Dashboards**: Create, view, edit, and delete custom dashboards
- **Drag-and-Drop Grid**: Arrange components on a responsive grid layout
- **Component Types**: Table, Pie Chart, Bar Chart (stacked/grouped), Line Chart, Text (Markdown)
- **Visual Query Builder**: Select tables, columns, filters, and aggregations without writing SQL
- **Live Preview**: Preview query results before saving components
- **Duplicate Components**: Clone existing components with smart positioning (places to the right if space available, otherwise below)
- **Inline Editing**: Edit dashboard name and description directly in edit mode
- **Auto-scroll & Highlight**: New/duplicated components trigger smooth scroll and pulse highlight animation

### Chart Data Transformation

Bar charts (stacked/grouped) automatically pivot data when needed:

- **Input**: Long format with categorical column (e.g., `quarter | sum_usd | category`)
- **Output**: Wide format with categories as series (e.g., `quarter | Development | Outreach`)

The `transformToBarData` function detects categorical columns by checking if values are non-numeric strings, then pivots automatically. This allows queries with `GROUP BY quarter, category` to render as stacked bars without manual transformation.

### Query Builder

The query builder provides a visual interface for constructing database queries:

1. **Table Selection**: Choose from whitelisted tables/views
2. **Column Selection**: Select columns with optional aggregation (COUNT, SUM, AVG, MIN, MAX)
3. **Filters**: Add conditions with operators (=, !=, >, <, LIKE, IS NULL, etc.)
4. **Group By**: Group results by non-aggregated columns
5. **Order By**: Sort results by selected columns
6. **Limit**: Cap the number of returned rows (max 10,000)

### Security

- Only whitelisted tables are queryable (see `/api/query/schema`)
- All filter values are parameterized (no SQL injection)
- Row limits enforced on all queries

### Column Display Names

Column names are automatically converted to human-readable display names in the query builder and dashboard charts.

**Auto-generation rules:**
- Replace underscores with spaces: `DOT_latest` → "DOT Latest"
- Title case each word
- Preserve currency abbreviations: DOT, USD, USDC, USDT

**YAML overrides (`public/config/column-display-names.yaml`):**

```yaml
# Global overrides (apply to all tables)
DOT_latest: "DOT Value"
year_month: "Month"

# Table-specific overrides
all_spending:
  type: "Spending Type"
  title: "Description"

Referenda:
  id: "Ref #"
  tally.ayes: "Ayes"
```

**Usage in code:**

```typescript
import { getColumnDisplayName, loadColumnNameOverrides } from "@/lib/column-display-names";

// Load overrides on mount
await loadColumnNameOverrides();

// Get display name for a column
const name = getColumnDisplayName("all_spending", "DOT_latest"); // "DOT Value"
const auto = getColumnDisplayName("all_spending", "category");    // "Category" (auto-generated)
```

---

## Inline Editing

The Referenda and Child Bounties tables support inline editing for categorization:

### Editable Cell Components

Located in `components/data-table/editable-cells.tsx`:

| Component | Purpose |
|-----------|---------|
| `EditableCategoryCell` | Dropdown to select category from Categories table |
| `EditableSubcategoryCell` | Dropdown filtered by selected category |
| `EditableNotesCell` | Text input with blur-to-save |
| `EditableHideCheckbox` | Checkbox to hide from spending reports |

### Column Factory Pattern

Tables with inline editing use factory functions instead of static column definitions:

```tsx
// Creates columns with edit callbacks
const columns = createReferendaColumns({
  categories,
  onUpdate: (id, data) => api.referenda.update(id, data),
});
```

---

## CSV Import (Sync Settings)

The Sync Settings page (`/manage/sync`) allows bulk import of category mappings.

### Features

- **File Upload**: Upload CSV files to bulk-update categories
- **Apply Defaults**: One-click import of default mappings from `data/defaults/`
- **Format Support**: Handles quoted values and both legacy/new column formats

### CSV Format

```csv
id,category,subcategory,notes,hide_in_spends
1,Development,Core,,0
4,Outreach,Marketing,Campaign notes,0
```

For child bounties, use `identifier` instead of `id`:

```csv
identifier,category,subcategory,notes,hide_in_spends
1_23,Development,SDK,,0
```

### CSV Parser

Located in `lib/csv-parser.ts`:

- `parseCSV(content)` - Generic CSV to array of objects
- `parseReferendaCSV(content)` - Parses referenda format
- `parseChildBountiesCSV(content)` - Parses child bounties format

---

## Future Enhancements

Planned features:

- **Query Cache**: TTL-based caching for dashboard queries
- **Cross-table Filtering** - Filter referenda by treasury spend
- **Real-time Updates** - Periodic data refresh
- **Advanced Filters** - Date ranges, numeric ranges
- **Dark Mode** - Theme toggle
