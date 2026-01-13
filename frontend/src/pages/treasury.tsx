import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { treasuryColumns } from "@/components/tables/treasury-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { SavedView } from "@/hooks/use-view-state";
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
  const [data, setData] = useState<TreasurySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.treasury
      .getAll()
      .then((res) => setData(res as TreasurySpend[]))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <h2 className="font-semibold text-destructive">Error</h2>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter treasury spend proposals
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable
          columns={treasuryColumns}
          data={data}
          tableName="treasury"
          defaultSorting={[{ id: "id", desc: true }]}
          defaultViews={defaultTreasuryViews}
        />
      )}
    </div>
  );
}
