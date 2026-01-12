import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { expiredClaimsColumns } from "@/components/tables/expired-claims-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { ExpiredClaim } from "@/lib/db/types";

export default function ExpiredClaimsPage() {
  const [data, setData] = useState<ExpiredClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.claims
      .getExpired()
      .then((res) => setData(res as ExpiredClaim[]))
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
        <h1 className="text-3xl font-bold tracking-tight">Expired Claims</h1>
        <p className="text-muted-foreground">
          Treasury claims that have expired unclaimed
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={expiredClaimsColumns} data={data} tableName="expired-claims" />
      )}
    </div>
  );
}
