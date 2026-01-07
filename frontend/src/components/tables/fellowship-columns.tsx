"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import type { Fellowship } from "@/lib/db/types";

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

export const fellowshipColumns: ColumnDef<Fellowship>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <div className="font-medium w-[60px]">{row.getValue("id")}</div>
    ),
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
          className="max-w-[400px] truncate block hover:underline text-blue-600"
          title={description}
        >
          {description || "No description"}
        </a>
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
    accessorKey: "DOT",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DOT" />
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatNumber(row.getValue("DOT"))}</div>
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
    accessorKey: "latest_status_change",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Update" />
    ),
    cell: ({ row }) => formatDate(row.getValue("latest_status_change")),
  },
];
