import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { logsColumns } from "@/components/tables/logs-columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableSkeleton } from "@/components/data-table/skeleton";
import { RequireAuth } from "@/components/auth/require-auth";
import type { LogEntry } from "@/lib/db/types";

export default function LogsPage() {
  return (
    <RequireAuth>
      <LogsPageContent />
    </RequireAuth>
  );
}

function LogsPageContent() {
  const [data, setData] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.logs
      .getAll()
      .then((res) => setData(res as LogEntry[]))
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
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground">
          Backend pipeline execution logs
        </p>
      </div>
      {loading ? (
        <DataTableSkeleton />
      ) : (
        <DataTable columns={logsColumns} data={data} tableName="logs" />
      )}
    </div>
  );
}
