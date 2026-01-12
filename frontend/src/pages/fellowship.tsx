import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { fellowshipColumns } from "@/components/tables/fellowship-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { Fellowship } from "@/lib/db/types";

export default function FellowshipPage() {
  const [data, setData] = useState<Fellowship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fellowship
      .getAll()
      .then((res) => setData(res as Fellowship[]))
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
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship treasury spends
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable
          columns={fellowshipColumns}
          data={data}
          tableName="fellowship"
          defaultSorting={[{ id: "id", desc: true }]}
        />
      )}
    </div>
  );
}
