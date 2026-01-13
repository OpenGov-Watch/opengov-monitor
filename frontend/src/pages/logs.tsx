import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/auth/require-auth";
import { formatDateTime } from "@/lib/utils";
import type { LogEntry, QueryConfig } from "@/lib/db/types";

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

export default function LogsPage() {
  return (
    <RequireAuth>
      <LogsPageContent />
    </RequireAuth>
  );
}

function LogsPageContent() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "Logs",
      columns: [
        { column: "id" },
        { column: "timestamp" },
        { column: "log_level" },
        { column: "source" },
        { column: "content" },
        { column: "extra" },
      ],
      filters: [],
      orderBy: [{ column: "timestamp", direction: "DESC" }],
      limit: 10000,
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      id: {
        header: "ID",
        cell: ({ row }: { row: any }) => (
          <div className="font-mono text-xs w-[60px]">{row.original.id}</div>
        ),
      },
      timestamp: {
        cell: ({ row }: { row: any }) => (
          <div className="font-mono text-xs whitespace-nowrap">
            {formatDateTime(row.original.timestamp)}
          </div>
        ),
      },
      log_level: {
        header: "Level",
        cell: ({ row }: { row: any }) => {
          const level = row.original.log_level;
          return (
            <Badge variant={getLogLevelVariant(level)} className="font-mono">
              {level}
            </Badge>
          );
        },
      },
      source: {
        cell: ({ row }: { row: any }) => (
          <div className="font-mono text-xs max-w-[150px] truncate" title={row.original.source}>
            {row.original.source}
          </div>
        ),
      },
      content: {
        header: "Message",
        cell: ({ row }: { row: any }) => {
          const content = row.original.content;
          return (
            <div className="max-w-[400px] truncate" title={content}>
              {content}
            </div>
          );
        },
      },
      extra: {
        header: "Extra",
        cell: ({ row }: { row: any }) => {
          const extra = row.original.extra;
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
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        <p className="text-muted-foreground">
          Backend pipeline execution logs
        </p>
      </div>
      <DataTable<LogEntry>
        queryConfig={queryConfig}
        tableName="logs"
        facetedFilters={["log_level", "source"]}
        columnOverrides={columnOverrides}
      />
    </div>
  );
}
