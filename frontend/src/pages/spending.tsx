import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { allSpendingColumns } from "@/components/tables/all-spending-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { AllSpending } from "@/lib/db/types";

export default function SpendingPage() {
  const [data, setData] = useState<AllSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.spending
      .getAll()
      .then((res) => setData(res as AllSpending[]))
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
        <h1 className="text-3xl font-bold tracking-tight">All Spending</h1>
        <p className="text-muted-foreground">
          Aggregated view of all treasury spending across sources
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={allSpendingColumns} data={data} tableName="all-spending" />
      )}
    </div>
  );
}
