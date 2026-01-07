# Frontend Architecture

## Overview

The frontend is a Next.js 14+ application that provides an interactive dashboard for exploring Polkadot governance data. It uses Server Components to read directly from SQLite, with client-side interactivity powered by TanStack Table.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14+ | React framework with App Router |
| TypeScript | Type safety |
| TanStack Table | Data table with sorting, filtering, pagination |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Accessible UI components |
| better-sqlite3 | SQLite access from Server Components |

---

## Directory Structure

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with sidebar
│   ├── page.tsx                  # Dashboard home
│   ├── globals.css               # Tailwind + CSS variables
│   ├── referenda/page.tsx        # Referenda table
│   ├── treasury/page.tsx         # Treasury table
│   ├── child-bounties/page.tsx   # Child bounties table
│   ├── fellowship/page.tsx       # Fellowship table
│   ├── fellowship-salary-cycles/page.tsx
│   └── fellowship-salary-claimants/page.tsx
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
│   │   ├── data-table-wrapper.tsx # Suspense wrapper for DataTable
│   │   ├── column-header.tsx     # Sortable column headers
│   │   ├── pagination.tsx        # Page navigation
│   │   ├── toolbar.tsx           # Search, export, view controls
│   │   └── column-visibility.tsx # Show/hide columns
│   │
│   ├── tables/                   # Table-specific columns
│   │   ├── referenda-columns.tsx
│   │   ├── treasury-columns.tsx
│   │   ├── child-bounties-columns.tsx
│   │   ├── fellowship-columns.tsx
│   │   ├── fellowship-salary-cycles-columns.tsx
│   │   └── fellowship-salary-claimants-columns.tsx
│   │
│   └── layout/
│       └── sidebar.tsx           # Navigation sidebar
│
├── lib/
│   ├── utils.ts                  # cn(), formatters
│   ├── export.ts                 # CSV/JSON export
│   └── db/
│       ├── index.ts              # Database singleton
│       ├── queries.ts            # Query functions
│       └── types.ts              # TypeScript interfaces
│
└── hooks/
    └── use-view-state.ts         # Table state persistence
```

---

## Data Flow

### Server-Side Data Fetching

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Page.tsx   │────▶│  queries.ts │────▶│   SQLite    │
│  (Server    │     │ getReferenda│     │  Database   │
│  Component) │     │     ()      │     │             │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       ▼ data (serialized)
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  DataTable  │────▶│  TanStack   │────▶│   Browser   │
│  (Client    │     │   Table     │     │   Render    │
│  Component) │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Example Page Component

```tsx
// app/referenda/page.tsx (Server Component)
import { getReferenda } from "@/lib/db/queries";
import { referendaColumns } from "@/components/tables/referenda-columns";
import { DataTable } from "@/components/data-table/data-table";

export default function ReferendaPage() {
  // Runs on server - reads from SQLite
  const data = getReferenda();

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

## Database Layer

### Singleton Connection

```typescript
// lib/db/index.ts
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH ||
  path.join(process.cwd(), "..", "data", "polkadot.db");

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}
```

### Query Functions

```typescript
// lib/db/queries.ts
export function getReferenda(): Referendum[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM "Referenda"').all() as Referendum[];
}
```

### TypeScript Types

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
│  │  100 rows │ Rows: [20 ▼] │ Page 1 of 5 │ < 1 2 3 >           │  │
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
  getFacetedRowModel: getFacetedRowModel(),           // For faceted filters
  getFacetedUniqueValues: getFacetedUniqueValues(),   // Unique values per column
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

Both the column name and sort arrows are clickable for sortable columns. Column visibility is managed separately via the Columns button in the toolbar.

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
  {
    accessorKey: "track",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Track" />
    ),
    cell: ({ row }) => row.getValue("track"),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  // ...
];
```

### Faceted Filter Component

The `DataTableFacetedFilter` component provides a multi-select dropdown for filtering categorical columns:

```tsx
// components/data-table/faceted-filter.tsx
interface FacetedFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableFacetedFilter({ column, title }: FacetedFilterProps) {
  const facets = column.getFacetedUniqueValues();  // Get unique values
  const selectedValues = new Set(column.getFilterValue() as string[]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-8 gap-1">
          {title}
          <ChevronDown className="h-4 w-4" />
          {selectedValues.size > 0 && (
            <Badge variant="secondary">{selectedValues.size}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandInput placeholder={`Filter ${title}...`} />
          <CommandList>
            {Array.from(facets.keys()).map((value) => (
              <CommandItem
                key={value}
                onSelect={() => toggleValue(value)}
              >
                <Checkbox checked={selectedValues.has(value)} />
                <span>{value}</span>
                <span className="ml-auto text-muted-foreground">
                  {facets.get(value)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

The dropdown shows:
- All unique values in the column
- Count of rows for each value
- Checkboxes for multi-select
- Search input to filter options
- Badge showing number of active filters

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
  pagination: PaginationState;
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

### JSON Export

```typescript
export function exportToJSON(data: unknown[], filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, "application/json");
}
```

Exports include only the currently filtered/visible data.

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

### Next.js Config

```javascript
// next.config.js (Next.js 15+)
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config) => {
    config.externals.push({
      'better-sqlite3': 'commonjs better-sqlite3',
    });
    return config;
  },
};
```

> **Note**: In Next.js 15+, `experimental.serverComponentsExternalPackages` was moved to top-level `serverExternalPackages`.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `../data/polkadot.db` | Path to SQLite database |

---

## Implementation Notes

### Suspense Boundary for useSearchParams

The `useViewState` hook uses `useSearchParams()` for URL state persistence. In Next.js 15+, this requires a Suspense boundary during static generation. The `DataTableWrapper` component handles this:

```tsx
// components/data-table/data-table-wrapper.tsx
export function DataTableWrapper({ columns, data, tableName }) {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <DataTable columns={columns} data={data} tableName={tableName} />
    </Suspense>
  );
}
```

All page components use `DataTableWrapper` instead of `DataTable` directly.

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

### Handling Missing Tables

Not all tables exist in every database. Fellowship Salary tables are only populated by `fetch_salaries.py`. Pages check for table existence before querying:

```tsx
export default function FellowshipSalaryCyclesPage() {
  const exists = tableExists(TABLE_NAMES.fellowshipSalaryCycles);

  if (!exists) {
    return <TableNotAvailableMessage />;
  }

  const data = getFellowshipSalaryCycles();
  return <DataTableWrapper ... />;
}
```

---

## Future Enhancements

Planned features for dashboard evolution:

- **Charts & Visualizations** - Aggregate statistics, trends over time
- **Cross-table Filtering** - Filter referenda by treasury spend
- **Real-time Updates** - Periodic data refresh
- **Advanced Filters** - Date ranges, numeric ranges
- **Saved Views** - Named view configurations
- **Dark Mode** - Theme toggle
