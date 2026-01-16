# How to Create and Configure DataTables

This guide covers creating table pages using the query-driven DataTable system with auto-generated columns.

## Table of Contents
1. [Simple Read-Only Table](#1-simple-read-only-table)
2. [Table with JOINs](#2-table-with-joins)
3. [Table with Editable Columns](#3-table-with-editable-columns)
4. [Faceted Filters](#4-faceted-filters)
5. [Custom Column Rendering](#5-custom-column-rendering)
6. [Default Views](#6-default-views)
7. [Complete Example (Referenda)](#7-complete-example-referenda)

---

## 1. Simple Read-Only Table

Most basic table: fetch from single table, display all columns with auto-formatting.

```typescript
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { QueryConfig } from "@/lib/db/types";
import type { Fellowship } from "@/lib/db/types";

export default function FellowshipPage() {
  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "Fellowship",
    columns: [
      { column: "id" },
      { column: "url" },
      { column: "description" },
      { column: "status" },
      { column: "DOT" },
      { column: "USD_proposal_time" },
      { column: "proposal_time" },
      { column: "latest_status_change" },
    ],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship treasury spends
        </p>
      </div>
      <DataTable<Fellowship>
        mode="query"
        queryConfig={queryConfig}
        tableName="fellowship"
        facetedFilters={["status"]}
        defaultSorting={[{ id: "id", desc: true }]}
      />
    </div>
  );
}
```

**Auto-formatting applied:**
- `DOT` → Currency with DOT symbol (e.g., "1,234 DOT")
- `USD_proposal_time` → Currency with $ symbol (e.g., "$1,234")
- `status` → Colored badge (Approved=green, Rejected=red)
- `proposal_time` / `latest_status_change` → Formatted date (e.g., "Jan 15, 2025")

---

## 2. Table with JOINs

Use JOINs to include denormalized fields from related tables (e.g., category names from Categories table).

```typescript
const queryConfig: QueryConfig = useMemo(() => ({
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "status" },
    { column: "category_id" },
    // Columns from joined Categories table
    { column: "c.category", alias: "category" },
    { column: "c.subcategory", alias: "subcategory" },
  ],
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: { left: "Referenda.category_id", right: "c.id" }
  }],
  filters: [],
  orderBy: [{ column: "id", direction: "DESC" }],
  limit: 1000
}), []);
```

**JOIN syntax:**
- `type`: "LEFT" | "INNER" | "RIGHT"
- `table`: Table name from database (must be in API allowlist)
- `alias`: Short alias for columns (e.g., "c" for Categories)
- `on`: Join condition with fully qualified column names

**Multiple JOINs example:**
```typescript
joins: [
  {
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: { left: "ChildBounties.category_id", right: "c.id" }
  },
  {
    type: "LEFT",
    table: "Bounties",
    alias: "b",
    on: { left: "ChildBounties.parentBountyId", right: "b.id" }
  }
]
```

---

## 3. Table with Editable Columns

Add inline editing for authenticated users using `editConfig`.

```typescript
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/api/client";
import { DataTableEditConfig, Category } from "@/lib/db/types";

export default function ReferendaPage() {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.categories.getAll().then((res) => setCategories(res as Category[]));
  }, []);

  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "Referenda",
    columns: [
      { column: "id" },
      { column: "title" },
      { column: "category_id" },  // Editable
      { column: "notes" },         // Editable
      { column: "hide_in_spends" }, // Editable
      { column: "c.category", alias: "category" },
      { column: "c.subcategory", alias: "subcategory" },
    ],
    joins: [{
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: { left: "Referenda.category_id", right: "c.id" }
    }],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  const editConfig: DataTableEditConfig | undefined = useMemo(() => {
    if (!isAuthenticated) return undefined;
    return {
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories,
          onUpdate: async (id: number, value: number) => {
            await api.referenda.update(id, { category_id: value });
          }
        },
        notes: {
          type: "text",
          onUpdate: async (id: number, value: string) => {
            await api.referenda.update(id, { notes: value });
          },
          placeholder: "Add notes..."
        },
        hide_in_spends: {
          type: "checkbox",
          onUpdate: async (id: number, value: number) => {
            await api.referenda.update(id, { hide_in_spends: value });
          }
        },
      }
    };
  }, [isAuthenticated, categories]);

  return (
    <DataTable
      mode="query"
      queryConfig={queryConfig}
      tableName="referenda"
      editConfig={editConfig}
      isAuthenticated={isAuthenticated}
    />
  );
}
```

**Editable column types:**
- `category-selector`: Dropdown with category → subcategory cascade
- `text`: Inline text input (saves on blur/Enter)
- `checkbox`: Toggle checkbox

**Auth behavior:**
- When `isAuthenticated=true`: Shows editable components
- When `isAuthenticated=false`: Shows read-only versions (disabled inputs)

---

## 4. Faceted Filters

Enable dropdown filters on specific columns by listing them in `facetedFilters` prop.

```typescript
<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}  // Enable filters
  defaultSorting={[{ id: "id", desc: true }]}
/>
```

**Result:**
- Column headers for "status" and "track" get filter icon
- Click icon → dropdown with all unique values + counts
- Multi-select enabled
- Filter state persisted in views

**Common faceted filter columns:**
- `status`: Multi-value status filters (Executed, Rejected, Ongoing, etc.)
- `track`: Governance track filters (Root, Whitelisted Caller, etc.)
- `category`: Category filters (if using denormalized category field)

---

## 5. Custom Column Rendering

Override auto-generated rendering for specific columns using `columnOverrides`.

```typescript
import { subsquareUrls } from "@/lib/urls";

const columnOverrides = useMemo(() => ({
  id: {
    cell: ({ row }: { row: any }) => (
      <a
        href={subsquareUrls.fellowship(row.original.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium w-[60px] hover:underline text-blue-600"
      >
        {row.original.id}
      </a>
    ),
  },
  title: {
    cell: ({ row }: { row: any }) => (
      <div
        className="max-w-[400px] truncate"
        title={row.original.title}
      >
        {row.original.title}
      </div>
    ),
  },
  description: {
    cell: ({ row }: { row: any }) => {
      const description = row.original.description as string;
      return (
        <div
          className="max-w-[400px] truncate"
          title={description}
        >
          {description || "No description"}
        </div>
      );
    },
  },
}), []);

<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="fellowship"
  columnOverrides={columnOverrides}
/>
```

**Common override use cases:**
- **Links**: ID columns linking to external sites (Subsquare, etc.)
- **Truncation**: Long text fields with fixed width + ellipsis
- **Custom formatting**: Special number formats, conditional styling
- **Icons**: Add icons to cells (external link, copy, etc.)

---

## 6. Default Views

Pre-configure saved views that users can load.

```typescript
import { SavedView } from "@/hooks/use-view-state";

const defaultTreasuryViews: SavedView[] = [
  {
    name: "All",
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      globalFilter: "",
      pagination: { pageIndex: 0, pageSize: 100 }
    },
    isDefault: true
  },
  {
    name: "Positive DOT Value",
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [{ id: "DOT_proposal_time", value: "positive" }],
      columnVisibility: {},
      globalFilter: "",
      pagination: { pageIndex: 0, pageSize: 100 }
    },
    isDefault: false
  }
];

<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="treasury"
  defaultViews={defaultTreasuryViews}
/>
```

**View State Properties:**
- `sorting`: Initial sort order (e.g., `[{ id: "id", desc: true }]`)
- `columnFilters`: Pre-applied filters (e.g., status = "Executed")
- `columnVisibility`: Hidden columns (e.g., `{ "notes": false }`)
- `globalFilter`: Search text
- `pagination`: Page size and index
- `isDefault`: Whether this view loads by default

---

## 7. Complete Example: Referenda Page

Full implementation with all features (JOINs, editing, filters, views, overrides):

```typescript
import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { DataTable } from "@/components/data-table/data-table";
import { useAuth } from "@/contexts/auth-context";
import { SavedView } from "@/hooks/use-view-state";
import { QueryConfig, DataTableEditConfig, Category } from "@/lib/db/types";
import { subsquareUrls } from "@/lib/urls";
import type { Referendum } from "@/lib/db/types";

const defaultReferendaViews: SavedView[] = [
  {
    name: "All",
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      globalFilter: "",
      pagination: { pageIndex: 0, pageSize: 100 },
    },
    isDefault: true,
  },
];

export default function ReferendaPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    api.categories.getAll().then((res) => setCategories(res as Category[]));
  }, []);

  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "Referenda",
    columns: [
      { column: "id" },
      { column: "url" },
      { column: "title" },
      { column: "status" },
      { column: "track" },
      { column: "DOT_proposal_time" },
      { column: "USD_proposal_time" },
      { column: "tally.ayes" },
      { column: "tally.nays" },
      { column: "proposal_time" },
      { column: "latest_status_change" },
      { column: "category_id" },
      { column: "notes" },
      { column: "hide_in_spends" },
      { column: "c.category", alias: "category" },
      { column: "c.subcategory", alias: "subcategory" },
    ],
    joins: [{
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: { left: "Referenda.category_id", right: "c.id" }
    }],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  const editConfig: DataTableEditConfig | undefined = useMemo(() => {
    if (!isAuthenticated) return undefined;
    return {
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories,
          onUpdate: async (id: number, value: number) => {
            await api.referenda.update(id, { category_id: value });
          }
        },
        notes: {
          type: "text",
          onUpdate: async (id: number, value: string) => {
            await api.referenda.update(id, { notes: value });
          },
          placeholder: "Add notes..."
        },
        hide_in_spends: {
          type: "checkbox",
          onUpdate: async (id: number, value: number) => {
            await api.referenda.update(id, { hide_in_spends: value });
          }
        },
      }
    };
  }, [isAuthenticated, categories]);

  const columnOverrides = useMemo(() => ({
    id: {
      cell: ({ row }: { row: any }) => (
        <a
          href={subsquareUrls.referenda(row.original.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium w-[60px] hover:underline text-blue-600"
        >
          {row.original.id}
        </a>
      ),
    },
    title: {
      cell: ({ row }: { row: any }) => (
        <div
          className="max-w-[400px] truncate"
          title={row.original.title}
        >
          {row.original.title}
        </div>
      ),
    },
    track: {
      cell: ({ row }: { row: any }) => (
        <div className="max-w-[150px] truncate">{row.original.track}</div>
      ),
    },
  }), []);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Referenda</h1>
        <p className="text-muted-foreground text-sm">
          Browse and filter Polkadot governance referenda
        </p>
      </div>
      <DataTable<Referendum>
        mode="query"
        queryConfig={queryConfig}
        tableName="referenda"
        editConfig={editConfig}
        isAuthenticated={isAuthenticated}
        facetedFilters={["status", "track"]}
        columnOverrides={columnOverrides}
        defaultSorting={[{ id: "id", desc: true }]}
        defaultViews={defaultReferendaViews}
      />
    </div>
  );
}
```

---

## API Endpoints Reference

- **Query Execution**: `POST /api/query/execute` - Execute QueryConfig, returns `{ data, rowCount, sql }`
- **Categories**: `GET /api/categories` - Fetch categories for selector
- **Update**: `PATCH /api/{resource}/{id}` - Update individual row

---

## Column Decoration System

The auto-column generation system applies formatting in three tiers:

### Tier 1: Editable Columns (Authenticated)
If column is in `editConfig.editableColumns` AND user is authenticated:
- `category-selector` → CategorySelector component (dropdown)
- `text` → EditableNotesCell (inline text input)
- `checkbox` → EditableHideCheckbox (toggle)

### Tier 2: Read-Only Auth-Gated Columns
If column is in `editConfig.editableColumns` BUT user is NOT authenticated:
- `category-selector` → ReadOnlyCategorySelector (disabled dropdown)
- `text` → ReadOnlyNotesCell (plain text)
- `checkbox` → ReadOnlyHideCheckbox (disabled checkbox)

### Tier 3: Standard Rendering (Auto-Formatting)
For all other columns, uses column-renderer.ts rules:

| Pattern | Render Type | Format | Alignment | Example |
|---------|-------------|--------|-----------|---------|
| `DOT*` or `*DOT*` | `currency` | "1,234 DOT" | Right | `DOT_latest` |
| `USD*` or `*USD*` | `currency` | "$1,234" | Right | `USD_latest` |
| `USDC*` or `USDT*` | `currency` | "$1,234.56" | Right | `USDC_latest` |
| `*_time` / `*_date` | `date` | "Jan 15, 2025" | Left | `proposal_time` |
| `status` / `*_status` | `badge` | Colored badge | Left | `status` |
| `beneficiary` / `*address*` | `address` | Truncated | Left | `beneficiary` |
| `url` | `link` | External link | Left | `url` |
| `tally.ayes` | `number` | "1,234" | Right (green) | `tally.ayes` |
| `tally.nays` | `number` | "1,234" | Right (red) | `tally.nays` |

**Customization via column-renderer.ts:**
```typescript
// Add custom column config
export const COLUMN_CONFIGS: Record<string, Record<string, ColumnRenderConfig>> = {
  referenda: {
    "tally.ayes": { render: "number", color: "green" },
    "tally.nays": { render: "number", color: "red" },
  }
};
```

**Override per-page via columnOverrides:**
```typescript
const columnOverrides = {
  id: {
    cell: ({ row }) => <CustomComponent value={row.original.id} />
  }
};
```

### Faceted Filter Configuration

Columns in `facetedFilters` array automatically get:
- Header: `<DataTableFacetedFilter>` instead of `<DataTableColumnHeader>`
- Multi-select dropdown with value counts
- Filter function: `filterFn: (row, id, value) => value.includes(row.getValue(id))`
- Sorting disabled: `enableSorting: false`

```typescript
<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}  // These get special treatment
/>
```

### Column Override Priority

When multiple decoration sources conflict:
1. **Highest**: `columnOverrides` (explicit per-page overrides)
2. **Middle**: `editConfig` (editable column decorators)
3. **Lowest**: Auto-formatting (column-renderer.ts rules)

### Virtual Combined Columns

To combine multiple columns into a single display column (e.g., "Infrastructure > Development"):

```typescript
const columnOverrides = {
  category: {
    // Custom accessor to combine category + subcategory
    accessorFn: (row: any) =>
      row.category ? `${row.category} > ${row.subcategory || ""}` : null,
    cell: ({ row }: { row: any }) => {
      const combined = row.category
        ? `${row.category} > ${row.subcategory || ""}`
        : "-";
      return <span>{combined}</span>;
    },
  },
};

<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="referenda"
  columnOverrides={columnOverrides}
/>
```

**Note**: The QueryConfig should still include both source columns:
```typescript
columns: [
  { column: "c.category", alias: "category" },
  { column: "c.subcategory", alias: "subcategory" },
]
```

You can hide the subcategory column via `columnVisibility` in default views if needed.

### Dot-Notation Columns

Columns with dots in their names (e.g., `tally.ayes`) are automatically handled:

```typescript
const queryConfig: QueryConfig = {
  sourceTable: "Referenda",
  columns: [
    { column: "tally.ayes" },  // Backend returns with dot
    { column: "tally.nays" },
  ],
  // ...
};
```

**Auto-generation behavior:**
- Column name: `"tally.ayes"` → id: `"tally_ayes"` (dots replaced with underscores)
- Uses `accessorFn: (row) => row["tally.ayes"]` instead of `accessorKey`
- Auto-detected as: `{ render: "number", color: "green" }` for `.ayes`
- Auto-detected as: `{ render: "number", color: "red" }` for `.nays`

Override formatting via `columnOverrides` prop or update column-renderer.ts.

---

## Troubleshooting

### "Invalid source table" error
**Cause**: Table not in API allowlist
**Fix**: Add table to `ALLOWED_SOURCES` in `api/src/routes/query.ts`

### "Invalid join table" error
**Cause**: Join table not in API allowlist
**Fix**: Add table to `ALLOWED_SOURCES` in `api/src/routes/query.ts`

### Columns not rendering correctly
**Cause**: Column name doesn't match database schema
**Fix**: Check column names with `GET /api/query/schema` or verify in SQLite schema

### Dot-notation columns (e.g., `tally.ayes`)
**Cause**: Dots in column names need special handling in TanStack Table
**Fix**: Auto-columns.tsx automatically detects dots and uses `accessorFn` instead of `accessorKey`
- Column name: `"tally.ayes"` → id: `"tally_ayes"`
- Backend: Query builder escapes as `"tally.ayes"`
- Frontend: Auto-generates correct accessor function

### Edit updates not reflecting immediately
**Cause**: Query mode fetches data once on mount
**Fix**: Auto-column generator calls `onUpdate` which updates via API. For immediate local updates, component needs refresh logic (not yet implemented)

---

## Performance Tips

1. **Limit rows**: Set reasonable `limit` in QueryConfig (default: 1000)
2. **Hide unused columns**: Use `columnVisibility` in default views
3. **Index frequently filtered columns**: Ensure database has indexes on columns used in filters
4. **Avoid large JOINs**: Only join tables when denormalized fields are needed
5. **Use faceted filters sparingly**: Each faceted filter computes unique values

---

## Examples in Codebase

- **Simple read-only**: `frontend/src/pages/fellowship.tsx`
- **JOINs + editing + filters**: `frontend/src/pages/referenda.tsx`
- **Custom rendering + views**: `frontend/src/pages/treasury.tsx`

---

## See Also

- [DataTable Specification](../spec/frontend/data-table.md) - Detailed architecture
- [DataTable API Reference](../reference/frontend/data-table-api.md) - Props and configuration
- [Filtering How-To](./filters.md) - Filtering strategies
