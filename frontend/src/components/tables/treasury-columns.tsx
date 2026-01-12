"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { subsquareUrls } from "@/lib/urls";
import type { TreasurySpend } from "@/lib/db/types";

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" | "success" {
  switch (status?.toLowerCase()) {
    case "approved":
    case "paid":
      return "success";
    case "rejected":
    case "expired":
      return "destructive";
    case "pending":
      return "secondary";
    default:
      return "outline";
  }
}

export const treasuryColumns: ColumnDef<TreasurySpend>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <a
        href={subsquareUrls.treasury(row.original.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium w-[60px] hover:underline text-blue-600"
      >
        {row.getValue("id")}
      </a>
    ),
  },
  {
    accessorKey: "referendumIndex",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referendum" />
    ),
    cell: ({ row }) => {
      const refIndex = row.getValue("referendumIndex") as number | null;
      return refIndex ? (
        <span className="text-muted-foreground">#{refIndex}</span>
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
        <div
          className="max-w-[350px] truncate"
          title={description}
        >
          {description || "No description"}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variant = getStatusVariant(status);
      return <Badge variant={variant}>{status}</Badge>;
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: "DOT_proposal_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DOT (Proposal)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatNumber(row.getValue("DOT_proposal_time"))}
      </div>
    ),
  },
  {
    accessorKey: "USD_proposal_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USD (Proposal)" />
    ),
    cell: ({ row }) => (
      <div className="text-right">
        {formatCurrency(row.getValue("USD_proposal_time"))}
      </div>
    ),
  },
  {
    accessorKey: "proposal_time",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Proposed" />
    ),
    cell: ({ row }) => formatDate(row.getValue("proposal_time")),
  },
  {
    accessorKey: "validFrom",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Valid From" />
    ),
    cell: ({ row }) => formatDate(row.getValue("validFrom")),
  },
  {
    accessorKey: "expireAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expires At" />
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
];
