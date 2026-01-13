import { useEffect, useState, useMemo } from "react";
import { api } from "@/api/client";
import { DataTable } from "@/components/data-table/data-table";
import { useAuth } from "@/contexts/auth-context";
import { SavedView } from "@/hooks/use-view-state";
import { QueryConfig, DataTableEditConfig, Category } from "@/lib/db/types";
import { subsquareUrls } from "@/lib/urls";
import type { Referendum } from "@/lib/db/types";

// Default views for Referenda
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
