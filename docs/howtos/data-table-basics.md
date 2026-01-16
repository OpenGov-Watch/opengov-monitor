# DataTable Basics

Step-by-step guide for creating simple table pages using the DataTable component.

For advanced features (editing, default views, complex examples), see [DataTable Advanced](./data-table-advanced.md).

## 1. Simple Read-Only Table

Basic table: fetch from single table, auto-format columns.

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

---

## 2. Table with JOINs

Include fields from related tables.

```typescript
const queryConfig: QueryConfig = useMemo(() => ({
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "status" },
    { column: "category_id" },
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

**Multiple JOINs:**
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

## 3. Faceted Filters

Enable dropdown filters on columns.

```typescript
<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}
  defaultSorting={[{ id: "id", desc: true }]}
/>
```

Adds filter icon to column headers with multi-select dropdown showing counts.

---

## 4. Custom Column Rendering

Override auto-formatting with `columnOverrides`.

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
}), []);

<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="fellowship"
  columnOverrides={columnOverrides}
/>
```

Common uses: links, truncation, custom formatting, icons.

---

## Column Auto-Formatting

Auto-formatting applies based on column naming patterns (configured in `public/config/column-config.yaml`):

| Pattern | Format | Example |
|---------|--------|---------|
| `DOT_*` | Currency (DOT) | `DOT_latest` → "1,234 DOT" |
| `USD_*` | Currency (USD) | `USD_latest` → "$1,234" |
| `*_time`, `*_date` | Date | `proposal_time` → "Jan 15, 2025" |
| `status`, `*_status` | Badge | `status` → Colored badge |
| `.ayes`, `.nays` | Number (colored) | `tally.ayes` → "1,234" (green) |
| `beneficiary`, `*address*` | Address | Truncated address |

**Precedence**: `columnOverrides` → `editConfig` → Auto-formatting

See `lib/column-renderer.ts` for full configuration.

---

## Troubleshooting

**"Invalid source table" error**: Add table to `ALLOWED_SOURCES` in `api/src/routes/query.ts`

**"Invalid join table" error**: Add join table to `ALLOWED_SOURCES` in `api/src/routes/query.ts`

**Columns not rendering**: Check column names match database schema (verify with `GET /api/query/schema`)

**Edit updates not reflecting**: Query mode fetches data once on mount. Refresh page to see updates.

---

## Examples in Codebase

- **Simple read-only**: `frontend/src/pages/fellowship.tsx`
- **JOINs + editing + filters**: `frontend/src/pages/referenda.tsx`
- **Custom rendering + views**: `frontend/src/pages/treasury.tsx`

---

## Next Steps

- For editable tables, default views, and complex examples, see [DataTable Advanced](./data-table-advanced.md)
- For filter strategies, see [Filtering How-To](./filters.md)
- For architecture details, see [DataTable Specification](../01_requirements/frontend/data-table.md)
