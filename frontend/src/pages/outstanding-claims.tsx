import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { outstandingClaimsColumns } from "@/components/tables/outstanding-claims-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { OutstandingClaim } from "@/lib/db/types";

export default function OutstandingClaimsPage() {
  const [data, setData] = useState<OutstandingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.claims
      .getOutstanding()
      .then((res) => setData(res as OutstandingClaim[]))
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
        <h1 className="text-3xl font-bold tracking-tight">Outstanding Claims</h1>
        <p className="text-muted-foreground">
          Approved treasury claims not yet expired
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={outstandingClaimsColumns} data={data} tableName="outstanding-claims" />
      )}
    </div>
  );
}
