"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import type { OutstandingClaim } from "@/lib/db/types";

function getValidVariant(
  daysUntilValid: number | null
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (daysUntilValid === null) return "outline";
  if (daysUntilValid <= 7) return "warning";
  if (daysUntilValid <= 30) return "secondary";
  return "outline";
}

export const upcomingClaimsColumns: ColumnDef<OutstandingClaim>[] = [
  {
    accessorKey: "validFrom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Valid From" />
    ),
    cell: ({ row }) => formatDate(row.getValue("validFrom")),
  },
  {
    accessorKey: "DOT_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DOT" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("DOT_component"))}
      </div>
    ),
  },
  {
    accessorKey: "USDT_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USDT" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("USDT_component"))}
      </div>
    ),
  },
  {
    accessorKey: "USDC_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USDC" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("USDC_component"))}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => {
      const id = row.getValue("id") as number;
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
  {
    accessorKey: "referendumIndex",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referendum" />
    ),
    cell: ({ row }) => {
      const refIndex = row.getValue("referendumIndex") as number | null;
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
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => {
      const description = row.getValue("description") as string;
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
  {
    accessorKey: "expireAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expires" />
    ),
    cell: ({ row }) => formatDate(row.getValue("expireAt")),
  },
  {
    accessorKey: "days_until_valid",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Starts In" />
    ),
    cell: ({ row }) => {
      const days = row.getValue("days_until_valid") as number | null;
      const variant = getValidVariant(days);
      return (
        <Badge variant={variant} className="font-mono">
          {days !== null ? `${days} days` : "-"}
        </Badge>
      );
    },
  },
];
