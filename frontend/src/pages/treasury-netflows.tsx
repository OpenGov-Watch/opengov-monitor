import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import type { TreasuryNetflow, QueryConfig } from "@/lib/db/types";

export default function TreasuryNetflowsPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "Treasury Netflows",
      columns: [
        { column: "month" },
        { column: "asset_name" },
        { column: "flow_type" },
        { column: "amount_usd" },
        { column: "amount_dot_equivalent" },
      ],
      filters: [],
      orderBy: [{ column: "month", direction: "DESC" }],
      limit: 10000,
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      month: {
        header: "Month",
      },
      asset_name: {
        header: "Asset",
      },
      flow_type: {
        header: "Flow Type",
      },
      amount_usd: {
        header: "Amount (USD)",
        cell: ({ row }: { row: any }) => {
          const value = row.original.amount_usd as number;
          const formatted = Math.abs(value).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
          return value < 0 ? `-$${formatted}` : `$${formatted}`;
        },
      },
      amount_dot_equivalent: {
        header: "Amount (DOT)",
        cell: ({ row }: { row: any }) => {
          const value = row.original.amount_dot_equivalent as number;
          return value.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          });
        },
      },
    }),
    []
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury Netflows</h1>
        <p className="text-muted-foreground">
          Quarterly treasury flow data tracking inflows and outflows by asset and type
        </p>
      </div>
      <DataTable<TreasuryNetflow>
        queryConfig={queryConfig}
        tableName="treasury-netflows"
        columnOverrides={columnOverrides}
      />
    </div>
  );
}
