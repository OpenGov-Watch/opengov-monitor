"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDateTime } from "@/lib/utils";
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

export const fellowshipSalaryClaimantsColumns: ColumnDef<FellowshipSalaryClaimant>[] = [
  {
    accessorKey: "display_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const displayName = row.getValue("display_name") as string;
      const address = row.original.address;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{displayName || "Unknown"}</span>
          <span className="font-mono text-xs text-muted-foreground" title={address}>
            {address?.slice(0, 8)}...{address?.slice(-6)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "rank",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rank" />
    ),
    cell: ({ row }) => {
      const rank = row.getValue("rank") as number | null;
      return (
        <Badge variant="outline" className="font-mono">
          {getRankLabel(rank)}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      const rank = row.getValue(id);
      return value.includes(String(rank));
    },
  },
  {
    accessorKey: "status_type",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status_type") as string;
      const variant = getStatusVariant(status);
      return <Badge variant={variant}>{status || "unknown"}</Badge>;
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: "registered_amount_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Registered (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("registered_amount_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "attempt_amount_dot",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Attempt (DOT)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("attempt_amount_dot"))}
      </div>
    ),
  },
  {
    accessorKey: "attempt_id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Attempt ID" />
    ),
    cell: ({ row }) => {
      const attemptId = row.getValue("attempt_id") as number | null;
      return attemptId !== null ? `#${attemptId}` : "-";
    },
  },
  {
    accessorKey: "last_active_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Active" />
    ),
    cell: ({ row }) => formatDateTime(row.getValue("last_active_time")),
  },
];
