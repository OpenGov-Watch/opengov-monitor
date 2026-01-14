import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { QueryConfig } from "@/lib/db/types";
import { subsquareUrls } from "@/lib/urls";
import type { Fellowship } from "@/lib/db/types";

export default function FellowshipPage() {
  const queryConfig: QueryConfig = useMemo(() => ({
    sourceTable: "Fellowship",
    columns: [
      { column: "id" },
      { column: "description" },
      { column: "status" },
      { column: "DOT" },
      { column: "USD_proposal_time" },
      { column: "proposal_time" },
      { column: "latest_status_change" },
      { column: "USD_latest" },
    ],
    filters: [],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 1000
  }), []);

  const columnOverrides = useMemo(() => ({
    id: {
      cell: ({ row }: { row: any }) => (
        <a
          href={subsquareUrls.fellowship(row.original.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium w-[60px] hover:underline text-blue-600"
        >
          {row.original.id}
        </a>
      ),
    },
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fellowship Treasury</h1>
        <p className="text-muted-foreground">
          Browse and filter fellowship treasury spends
        </p>
      </div>
      <DataTable<Fellowship>
        queryConfig={queryConfig}
        tableName="fellowship"
        facetedFilters={["status"]}
        columnOverrides={columnOverrides}
        defaultSorting={[{ id: "id", desc: true }]}
      />
    </div>
  );
}
