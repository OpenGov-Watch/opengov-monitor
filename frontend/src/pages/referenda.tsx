import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { referendaColumns } from "@/components/tables/referenda-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { Referendum } from "@/lib/db/types";

export default function ReferendaPage() {
  const [data, setData] = useState<Referendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.referenda
      .getAll()
      .then((res) => setData(res as Referendum[]))
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
        <h1 className="text-3xl font-bold tracking-tight">Referenda</h1>
        <p className="text-muted-foreground">
          Browse and filter Polkadot governance referenda
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={referendaColumns} data={data} tableName="referenda" />
      )}
    </div>
  );
}
