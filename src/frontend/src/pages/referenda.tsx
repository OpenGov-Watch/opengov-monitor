import { useEffect, useState, useMemo } from "react";
import { Row } from "@tanstack/react-table";
import { api } from "@/api/client";
import { DataTable } from "@/components/data-table/data-table";
import { useAuth } from "@/contexts/auth-context";
import { SavedView } from "@/hooks/use-view-state";
import { DataTableEditConfig, Category } from "@/lib/db/types";
import type { Referendum } from "@/lib/db/types";

// Default views for Referenda
const defaultReferendaViews: SavedView[] = [
  {
    name: "All",
    deletable: false,
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
    },
  },
  {
    name: "Spends",
    deletable: false,
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [],
      columnVisibility: {},
      pagination: { pageIndex: 0, pageSize: 100 },
      filterGroup: {
        operator: "AND",
        conditions: [
          { column: "DOT_proposal_time", operator: ">", value: 0 },
          { column: "status", operator: "=", value: "Executed" },
        ],
      },
    },
  },
];

export default function ReferendaPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    api.categories.getAll().then((res) => setCategories(res as Category[]));
  }, []);

  const queryConfig = useMemo(() => ({
    sourceTable: "Referenda",
    columns: [
      { column: "id" },
      { column: "title" },
      { column: "status" },
      { column: "track" },
      { column: "DOT_proposal_time" },
      { column: "USD_proposal_time" },
      { column: "tally_ayes" },
      { column: "tally_nays" },
      { column: "proposal_time" },
      { column: "latest_status_change" },
      { column: "category_id" },
      { column: "c.category", alias: "category" },
      { column: "c.subcategory", alias: "subcategory" },
      { column: "notes" },
      { column: "hide_in_spends" },
    ],
    joins: [{
      type: "LEFT" as const,
      table: "Categories",
      alias: "c",
      on: { left: "Referenda.category_id", right: "c.id" }
    }]
  }), []);

  const editConfig: DataTableEditConfig | undefined = useMemo(() => {
    if (!isAuthenticated) return undefined;
    return {
      editableColumns: {
        category_id: {
          type: "category-selector",
          categories,
          onUpdate: async (id, value) => {
            await api.referenda.update(Number(id), { category_id: value as number });
          }
        },
        notes: {
          type: "text",
          onUpdate: async (id, value) => {
            await api.referenda.update(Number(id), { notes: value as string });
          },
          placeholder: "Add notes..."
        },
        hide_in_spends: {
          type: "checkbox",
          onUpdate: async (id, value) => {
            await api.referenda.update(Number(id), { hide_in_spends: value as number });
          }
        },
      }
    };
  }, [isAuthenticated, categories]);

  const columnOverrides = useMemo(() => ({
    title: {
      cell: ({ row }: { row: Row<Referendum> }) => (
        <div
          className="max-w-[400px] truncate"
          title={row.original.title}
        >
          {row.original.title}
        </div>
      ),
    },
    track: {
      cell: ({ row }: { row: Row<Referendum> }) => (
        <div className="max-w-[150px] truncate">{row.original.track}</div>
      ),
    },
  }), []);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Referenda</h1>
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
        defaultViews={defaultReferendaViews}
      />
    </div>
  );
}
