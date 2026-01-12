"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import type { OutstandingClaim } from "@/lib/db/types";

function getExpiryVariant(
  daysUntilExpiry: number | null
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  if (daysUntilExpiry === null) return "outline";
  if (daysUntilExpiry <= 7) return "destructive";
  if (daysUntilExpiry <= 30) return "warning";
  return "success";
}

export const outstandingClaimsColumns: ColumnDef<OutstandingClaim>[] = [
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
      const url = row.original.url;
      const description = row.getValue("description") as string;
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
  {
    accessorKey: "expireAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expires" />
    ),
    cell: ({ row }) => formatDate(row.getValue("expireAt")),
  },
  {
    accessorKey: "latest_status_change",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Update" />
    ),
    cell: ({ row }) => formatDate(row.getValue("latest_status_change")),
  },
  {
    accessorKey: "days_until_expiry",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Days Left" />
    ),
    cell: ({ row }) => {
      const days = row.getValue("days_until_expiry") as number | null;
      const variant = getExpiryVariant(days);
      return (
        <Badge variant={variant} className="font-mono">
          {days !== null ? `${days} days` : "-"}
        </Badge>
      );
    },
  },
];
