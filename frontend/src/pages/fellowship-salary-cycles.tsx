import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { subsquareUrls } from "@/lib/urls";
import type { QueryConfig } from "@/lib/db/types";
import type { FellowshipSalaryCycle } from "@/lib/db/types";

export default function FellowshipSalaryCyclesPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "Fellowship Salary Cycles",
      columns: [
        { column: "cycle" },
        { column: "budget_dot" },
        { column: "registeredCount" },
        { column: "registeredPaidCount" },
        { column: "registered_paid_amount_dot" },
        { column: "total_registrations_dot" },
        { column: "unregistered_paid_dot" },
        { column: "start_time" },
        { column: "end_time" },
      ],
      filters: [],
      orderBy: [{ column: "cycle", direction: "DESC" }],
      limit: 1000,
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      cycle: {
        cell: ({ row }: { row: any }) => (
          <a
            href={subsquareUrls.salaryCycle(row.original.cycle)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline text-blue-600"
          >
            #{row.original.cycle}
          </a>
        ),
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Fellowship Salary Cycles
        </h1>
        <p className="text-muted-foreground">
          Browse fellowship salary payment cycles
        </p>
      </div>
      <DataTable<FellowshipSalaryCycle>
        mode="query"
        queryConfig={queryConfig}
        tableName="fellowship-salary-cycles"
        columnOverrides={columnOverrides}
        defaultSorting={[{ id: "cycle", desc: true }]}
      />
    </div>
  );
}
