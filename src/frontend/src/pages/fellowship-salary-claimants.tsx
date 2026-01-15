import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import type { QueryConfig } from "@/lib/db/types";
import type { FellowshipSalaryClaimant } from "@/lib/db/types";

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (status?.toLowerCase()) {
    case "registered":
      return "success";
    case "attempted":
      return "warning";
    case "nothing":
      return "secondary";
    default:
      return "outline";
  }
}

function getRankLabel(rank: number | null): string {
  if (rank === null || rank === undefined) return "-";
  const rankNames: Record<number, string> = {
    0: "Candidate",
    1: "Member I",
    2: "Member II",
    3: "Member III",
    4: "Architect I",
    5: "Architect II",
    6: "Fellow",
    7: "Master",
  };
  return rankNames[rank] || `Rank ${rank}`;
}

export default function FellowshipSalaryClaimantsPage() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "Fellowship Salary Claimants",
      columns: [
        { column: "display_name" },
        { column: "address" },
        { column: "rank" },
        { column: "status_type" },
        { column: "registered_amount_usdc" },
        { column: "attempt_amount_usdc" },
        { column: "attempt_id" },
        { column: "last_active_time" },
      ],
      filters: [],
      orderBy: [{ column: "display_name", direction: "ASC" }]
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      display_name: {
        cell: ({ row }: { row: any }) => {
          const displayName = row.original.display_name;
          const address = row.original.address;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{displayName || "Unknown"}</span>
              <span
                className="font-mono text-xs text-muted-foreground"
                title={address}
              >
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </span>
            </div>
          );
        },
      },
      rank: {
        cell: ({ row }: { row: any }) => {
          const rank = row.original.rank;
          return (
            <Badge variant="outline" className="font-mono">
              {getRankLabel(rank)}
            </Badge>
          );
        },
        filterFn: (row: any, id: string, value: string[]) => {
          const rank = row.getValue(id);
          return value.includes(String(rank));
        },
      },
      status_type: {
        cell: ({ row }: { row: any }) => {
          const status = row.original.status_type;
          const variant = getStatusVariant(status);
          return <Badge variant={variant}>{status || "unknown"}</Badge>;
        },
      },
      attempt_id: {
        cell: ({ row }: { row: any }) => {
          const attemptId = row.original.attempt_id;
          return attemptId !== null ? `#${attemptId}` : "-";
        },
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Fellowship Salary Claimants
        </h1>
        <p className="text-muted-foreground">
          Browse fellowship members claiming salary
        </p>
      </div>
      <DataTable<FellowshipSalaryClaimant>
        queryConfig={queryConfig}
        tableName="fellowship-salary-claimants"
        facetedFilters={["status_type"]}
        columnOverrides={columnOverrides}
      />
    </div>
  );
}
