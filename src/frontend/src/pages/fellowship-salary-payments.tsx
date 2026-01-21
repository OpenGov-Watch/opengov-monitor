import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { subsquareUrls } from "@/lib/urls";
import type { QueryConfig, FellowshipSalaryPayment } from "@/lib/db/types";

export default function FellowshipSalaryPaymentsPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "Fellowship Salary Payments",
      columns: [
        { column: "payment_id" },
        { column: "cycle" },
        { column: "who_name" },
        { column: "amount_usdc" },
        { column: "salary_usdc" },
        { column: "rank" },
        { column: "block_time" },
      ],
      filters: [],
      orderBy: [{ column: "block_time", direction: "DESC" }],
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      cycle: {
        cell: ({ row }: { row: { original: FellowshipSalaryPayment } }) => (
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
          Fellowship Salary Payments
        </h1>
        <p className="text-muted-foreground">
          Individual salary payment records by cycle
        </p>
      </div>
      <DataTable<FellowshipSalaryPayment>
        queryConfig={queryConfig}
        tableName="fellowship-salary-payments"
        columnOverrides={columnOverrides}
        defaultSorting={[{ id: "block_time", desc: true }]}
      />
    </div>
  );
}
