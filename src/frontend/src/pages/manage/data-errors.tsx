import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { RequireAuth } from "@/components/auth/require-auth";
import type { QueryConfig } from "@/lib/db/types";

interface DataError {
  id: number;
  table_name: string;
  record_id: string;
  error_type: string;
  error_message: string;
  raw_data: string | null;
  metadata: string | null;
  timestamp: string;
  classification: string;
}

function DataErrorsPageContent() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "DataErrors",
      columns: [
        { column: "table_name" },
        { column: "record_id" },
        { column: "error_type" },
        { column: "error_message" },
        { column: "timestamp" },
        { column: "metadata" },
        { column: "raw_data" },
      ],
      expressionColumns: [
        {
          expression: `CASE
            WHEN json_extract(metadata, '$.status') IN ('TimedOut', 'Rejected', 'Cancelled', 'Killed')
            THEN 'Acceptable'
            ELSE 'Needs Investigation'
          END`,
          alias: "classification",
        },
      ],
      filters: [],
      orderBy: [{ column: "timestamp", direction: "DESC" }],
    }),
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Data Validation Errors</h1>
        <p className="text-muted-foreground">
          View and diagnose data validation errors across all tables
        </p>
      </div>
      <DataTable<DataError>
        queryConfig={queryConfig}
        tableName="DataErrors"
        facetedFilters={["table_name", "error_type", "classification"]}
      />
    </div>
  );
}

export default function DataErrorsPage() {
  return (
    <RequireAuth>
      <DataErrorsPageContent />
    </RequireAuth>
  );
}
