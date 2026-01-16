# DataTable Advanced

Advanced DataTable features: inline editing, default views, complex patterns.

For basic usage (read-only tables, JOINs, filters), see [DataTable Basics](./data-table-basics.md).

## Table with Editable Columns

Add inline editing with `editConfig`.

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

**Editable types**: `category-selector` (cascade dropdown), `text` (inline input), `checkbox` (toggle)

---

## Default Views

Pre-configure saved views.

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

---

## Complete Example: Referenda Page

Full implementation with JOINs, editing, filters, views, overrides.

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

## Advanced Patterns

### Dot-Notation Columns

Columns with dots (e.g., `tally.ayes`) are automatically handled - no special configuration needed.

### Virtual Combined Columns

Combine multiple columns into one display:

```typescript
const columnOverrides = {
  category: {
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
```

### Category Inheritance (Child Bounties)

For entities inheriting categories from parents:

```typescript
const columnOverrides = useMemo(() => ({
  category_id: {
    header: "Category",
    cell: ({ row }: { row: any }) => {
      const categoryId = row.original.category_id;
      const parentCategory = row.original.parentCategory;
      const parentSubcategory = row.original.parentSubcategory;

      if (isAuthenticated) {
        return (
          <CategorySelector
            categoryId={categoryId}
            categories={categories}
            onChange={async (newCategoryId) => {
              await api.childBounties.update(row.original.identifier, {
                category_id: newCategoryId,
              });
            }}
            parentCategory={parentCategory}
            parentSubcategory={parentSubcategory}
          />
        );
      }

      return (
        <ReadOnlyCategorySelector
          categoryId={categoryId}
          categories={categories}
          parentCategory={parentCategory}
          parentSubcategory={parentSubcategory}
        />
      );
    },
  },
}), [isAuthenticated, categories]);
```

When `category_id` is NULL, displays parent's category as grayed placeholder. See `frontend/src/pages/child-bounties.tsx` for full example.

---

## Performance Tips

1. Set reasonable `limit` in QueryConfig (default: 1000)
2. Hide unused columns via `columnVisibility` in default views
3. Ensure database indexes on frequently filtered columns
4. Avoid large JOINs - only join when denormalized fields needed
5. Use faceted filters sparingly

---

## Examples in Codebase

- **JOINs + editing + filters**: `frontend/src/pages/referenda.tsx`
- **Custom rendering + views**: `frontend/src/pages/treasury.tsx`
- **Category inheritance**: `frontend/src/pages/child-bounties.tsx`

---

## See Also

- [DataTable Basics](./data-table-basics.md) - Getting started
- [DataTable Specification](../spec/frontend/data-table.md) - Architecture details
- [Table Systems Reference](../reference/frontend/table-systems.md) - Implementation reference
