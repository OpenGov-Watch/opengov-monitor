"use client";

import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { LogEntry } from "@/lib/db/types";

function getLogLevelVariant(
  level: string
): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "destructive";
    case "WARNING":
      return "warning";
    case "INFO":
      return "default";
    case "DEBUG":
      return "secondary";
    default:
      return "outline";
  }
}

export const logsColumns: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs w-[60px]">{row.getValue("id")}</div>
    ),
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Timestamp" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs whitespace-nowrap">
        {formatDateTime(row.getValue("timestamp"))}
      </div>
    ),
  },
  {
    accessorKey: "log_level",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Level" />
    ),
    cell: ({ row }) => {
      const level = row.getValue("log_level") as string;
      return (
        <Badge variant={getLogLevelVariant(level)} className="font-mono">
          {level}
        </Badge>
      );
    },
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id));
    },
    enableSorting: false,
  },
  {
    accessorKey: "source",
    header: ({ column }) => (
      <DataTableFacetedFilter column={column} title="Source" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs max-w-[150px] truncate" title={row.getValue("source")}>
        {row.getValue("source")}
      </div>
    ),
    filterFn: (row, id, value: string[]) => {
      return value.includes(row.getValue(id));
    },
    enableSorting: false,
  },
  {
    accessorKey: "content",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Message" />
    ),
    cell: ({ row }) => {
      const content = row.getValue("content") as string;
      return (
        <div
          className="max-w-[400px] truncate"
          title={content}
        >
          {content}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "extra",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Extra" />
    ),
    cell: ({ row }) => {
      const extra = row.getValue("extra") as string | null;
      if (!extra) return <span className="text-muted-foreground">-</span>;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(extra);
      } catch {
        return <span className="text-muted-foreground text-xs">{extra}</span>;
      }

      // Filter out asctime as it duplicates timestamp
      const filtered = Object.fromEntries(
        Object.entries(parsed).filter(([key]) => key !== "asctime")
      );

      if (Object.keys(filtered).length === 0) {
        return <span className="text-muted-foreground">-</span>;
      }

      const formatted = JSON.stringify(filtered, null, 0);
      return (
        <div
          className="font-mono text-xs max-w-[200px] truncate text-muted-foreground"
          title={JSON.stringify(filtered, null, 2)}
        >
          {formatted}
        </div>
      );
    },
    enableSorting: false,
  },
];
