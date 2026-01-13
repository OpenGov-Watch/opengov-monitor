import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import type { QueryConfig } from "@/lib/db/types";
import type { ExpiredClaim } from "@/lib/db/types";

function getExpiryVariant(
  daysSinceExpiry: number | null
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (daysSinceExpiry === null) return "outline";
  if (daysSinceExpiry <= 7) return "warning";
  if (daysSinceExpiry <= 30) return "secondary";
  return "destructive";
}

export default function ExpiredClaimsPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "expired_claims",
      columns: [
        { column: "validFrom" },
        { column: "DOT_component" },
        { column: "USDT_component" },
        { column: "USDC_component" },
        { column: "id" },
        { column: "referendumIndex" },
        { column: "description" },
        { column: "url" },
        { column: "expireAt" },
        { column: "latest_status_change" },
        { column: "days_since_expiry" },
      ],
      filters: [],
      orderBy: [{ column: "days_since_expiry", direction: "DESC" }],
      limit: 1000,
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
          const url = row.original.url;
          const description = row.original.description;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[350px] truncate block hover:underline text-blue-600"
              title={description}
            >
              {description || "No description"}
            </a>
          );
        },
      },
      days_since_expiry: {
        cell: ({ row }: { row: any }) => {
          const days = row.original.days_since_expiry;
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
        <h1 className="text-3xl font-bold tracking-tight">Expired Claims</h1>
        <p className="text-muted-foreground">
          Treasury claims that have expired unclaimed
        </p>
      </div>
      <DataTable<ExpiredClaim>
        mode="query"
        queryConfig={queryConfig}
        tableName="expired-claims"
        columnOverrides={columnOverrides}
      />
    </div>
  );
}
