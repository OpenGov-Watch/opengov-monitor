import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SavedView } from "@/hooks/use-view-state";
import { QueryConfig } from "@/lib/db/types";
import type { TreasurySpend } from "@/lib/db/types";

// Default views for Treasury
const defaultTreasuryViews: SavedView[] = [
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
  {
    name: "Positive DOT Value",
    state: {
      sorting: [{ id: "id", desc: true }],
      columnFilters: [{ id: "DOT_proposal_time", value: "positive" }],
      columnVisibility: {},
      globalFilter: "",
      pagination: { pageIndex: 0, pageSize: 100 },
    },
    isDefault: true,
  },
];

export default function TreasuryPage() {
  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "Treasury",
    columns: [
      { column: "id" },
      { column: "referendumIndex" },
      { column: "status" },
      { column: "description" },
      { column: "DOT_proposal_time" },
      { column: "USD_proposal_time" },
      { column: "DOT_latest" },
      { column: "USD_latest" },
      { column: "DOT_component" },
      { column: "USDC_component" },
      { column: "USDT_component" },
      { column: "proposal_time" },
      { column: "latest_status_change" },
      { column: "validFrom" },
      { column: "expireAt" },
    ],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  const columnOverrides = useMemo(() => ({
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter treasury spend proposals
        </p>
      </div>
      <DataTable<TreasurySpend>
        queryConfig={queryConfig}
        tableName="treasury"
        facetedFilters={["status"]}
        columnOverrides={columnOverrides}
        defaultSorting={[{ id: "id", desc: true }]}
        defaultViews={defaultTreasuryViews}
      />
    </div>
  );
}
