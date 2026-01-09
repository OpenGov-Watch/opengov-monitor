import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { fellowshipSalaryCyclesColumns } from "@/components/tables/fellowship-salary-cycles-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import type { FellowshipSalaryCycle } from "@/lib/db/types";

export default function FellowshipSalaryCyclesPage() {
  const [data, setData] = useState<FellowshipSalaryCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.salary
      .getCycles()
      .then((res) => setData(res as FellowshipSalaryCycle[]))
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
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Salary Cycles</h1>
        <p className="text-muted-foreground">
          Browse fellowship salary payment cycles
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable
          columns={fellowshipSalaryCyclesColumns}
          data={data}
          tableName="fellowship-salary-cycles"
          defaultSorting={[{ id: "cycle", desc: true }]}
        />
      )}
    </div>
  );
}
