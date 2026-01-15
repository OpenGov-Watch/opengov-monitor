import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import type { QueryConfig } from "@/lib/db/types";
import type { OutstandingClaim } from "@/lib/db/types";

function getExpiryVariant(
  daysUntilExpiry: number | null
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (daysUntilExpiry === null) return "outline";
  if (daysUntilExpiry <= 7) return "destructive";
  if (daysUntilExpiry <= 30) return "warning";
  return "success";
}

export default function OutstandingClaimsPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "outstanding_claims",
      columns: [
        { column: "validFrom" },
        { column: "DOT_component" },
        { column: "USDT_component" },
        { column: "USDC_component" },
        { column: "id" },
        { column: "referendumIndex" },
        { column: "description" },
        { column: "expireAt" },
        { column: "latest_status_change" },
        { column: "days_until_expiry" },
      ],
      filters: [],
      orderBy: [{ column: "days_until_expiry", direction: "ASC" }]
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      id: {
        cell: ({ row }: { row: any }) => {
          const id = row.original.id;
          return (
            <a
              href={`https://polkadot.subsquare.io/treasury/spends/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:underline"
            >
              #{id}
            </a>
          );
        },
      },
      referendumIndex: {
        cell: ({ row }: { row: any }) => {
          const refIndex = row.original.referendumIndex;
          return refIndex ? (
            <a
              href={`https://polkadot.subsquare.io/referenda/${refIndex}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              #{refIndex}
            </a>
          ) : (
            "-"
          );
        },
      },
      description: {
        cell: ({ row }: { row: any }) => {
          const description = row.original.description;
          return (
            <span
              className="max-w-[350px] truncate block"
              title={description}
            >
              {description || "No description"}
            </span>
          );
        },
      },
      days_until_expiry: {
        cell: ({ row }: { row: any }) => {
          const days = row.original.days_until_expiry;
          const variant = getExpiryVariant(days);
          return (
            <Badge variant={variant} className="font-mono">
              {days !== null ? `${days} days` : "-"}
            </Badge>
          );
        },
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Outstanding Claims
        </h1>
        <p className="text-muted-foreground">
          Approved treasury claims not yet expired
        </p>
      </div>
      <DataTable<OutstandingClaim>
        queryConfig={queryConfig}
        tableName="outstanding-claims"
        columnOverrides={columnOverrides}
      />
    </div>
  );
}
