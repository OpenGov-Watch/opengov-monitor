import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { SavedView } from "@/hooks/use-view-state";
import type { TreasurySpend } from "@/lib/db/types";

// Default views for Treasury
const defaultTreasuryViews: SavedView[] = [
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
];

export default function TreasuryPage() {
  const queryConfig = useMemo(() => ({
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
    ]
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
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Treasury</h1>
        <p className="text-muted-foreground text-sm">
          Browse and filter treasury spend proposals
        </p>
      </div>
      <DataTable<TreasurySpend>
        queryConfig={queryConfig}
        tableName="treasury"
        facetedFilters={["status"]}
        columnOverrides={columnOverrides}
        defaultViews={defaultTreasuryViews}
      />
    </div>
  );
}
