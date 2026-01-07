"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import type { AllSpending, SpendingType } from "@/lib/db/types";
import { ExternalLink } from "lucide-react";

function getTypeVariant(
  type: SpendingType
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (type) {
    case "Direct Spend":
      return "default";
    case "Claim":
      return "success";
    case "Bounty":
      return "warning";
    case "Subtreasury":
      return "secondary";
    case "Fellowship Salary":
      return "outline";
    case "Fellowship Grants":
      return "outline";
    default:
      return "default";
  }
}

export const allSpendingColumns: ColumnDef<AllSpending>[] = [
  {
    accessorKey: "latest_status_change",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => formatDate(row.getValue("latest_status_change")),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as SpendingType;
      return (
        <Badge variant={getTypeVariant(type)} className="whitespace-nowrap">
          {type}
        </Badge>
      );
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => {
      const url = row.original.url;
      const title = row.getValue("title") as string;
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[350px] truncate block hover:underline text-blue-600 inline-flex items-center gap-1"
          title={title}
        >
          {title || "No title"}
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </a>
      ) : (
        <span className="max-w-[350px] truncate block" title={title}>
          {title || "No title"}
        </span>
      );
    },
  },
  {
    accessorKey: "DOT_latest",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DOT" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("DOT_latest"))}
      </div>
    ),
  },
  {
    accessorKey: "USD_latest",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USD" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("USD_latest"))}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => row.getValue("category") || "-",
    filterFn: (row, id, value: string[]) => {
      const category = row.getValue(id) as string | null;
      if (!category) return value.includes("(Uncategorized)");
      return value.includes(category);
    },
  },
  {
    accessorKey: "subcategory",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subcategory" />
    ),
    cell: ({ row }) => row.getValue("subcategory") || "-",
  },
  {
    accessorKey: "DOT_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="DOT Comp" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("DOT_component"))}
      </div>
    ),
  },
  {
    accessorKey: "USDC_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USDC Comp" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("USDC_component"))}
      </div>
    ),
  },
  {
    accessorKey: "USDT_component",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="USDT Comp" />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono">
        {formatNumber(row.getValue("USDT_component"))}
      </div>
    ),
  },
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => {
      const id = row.getValue("id") as string;
      return <span className="font-mono text-sm text-muted-foreground">{id}</span>;
    },
  },
];
