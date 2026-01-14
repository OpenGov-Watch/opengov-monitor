import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/auth/require-auth";
import { formatNumber, formatDate } from "@/lib/utils";
import type { AllSpending, SpendingType, QueryConfig } from "@/lib/db/types";

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

function SpendingPageContent() {
  const queryConfig: QueryConfig = useMemo(
    () => ({
      sourceTable: "all_spending",
      columns: [
        { column: "latest_status_change" },
        { column: "type" },
        { column: "title" },
        { column: "DOT_latest" },
        { column: "USD_latest" },
        { column: "category" },
        { column: "subcategory" },
        { column: "DOT_component" },
        { column: "USDC_component" },
        { column: "USDT_component" },
        { column: "id" },
      ],
      filters: [],
      orderBy: [{ column: "latest_status_change", direction: "DESC" }],
      limit: 10000,
    }),
    []
  );

  const columnOverrides = useMemo(
    () => ({
      latest_status_change: {
        header: "Date",
        cell: ({ row }: { row: any }) => formatDate(row.original.latest_status_change),
      },
      type: {
        cell: ({ row }: { row: any }) => {
          const type = row.original.type as SpendingType;
          return (
            <Badge variant={getTypeVariant(type)} className="whitespace-nowrap">
              {type}
            </Badge>
          );
        },
      },
      title: {
        cell: ({ row }: { row: any }) => {
          const title = row.original.title;
          return (
            <span className="max-w-[350px] truncate block" title={title}>
              {title || "No title"}
            </span>
          );
        },
      },
      DOT_latest: {
        header: "DOT",
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-mono">
            {formatNumber(row.original.DOT_latest)}
          </div>
        ),
      },
      USD_latest: {
        header: "USD",
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-mono">
            {formatNumber(row.original.USD_latest)}
          </div>
        ),
      },
      category: {
        cell: ({ row }: { row: any }) => row.original.category || "-",
      },
      subcategory: {
        cell: ({ row }: { row: any }) => row.original.subcategory || "-",
      },
      DOT_component: {
        header: "DOT Comp",
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-mono">
            {formatNumber(row.original.DOT_component)}
          </div>
        ),
      },
      USDC_component: {
        header: "USDC Comp",
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-mono">
            {formatNumber(row.original.USDC_component)}
          </div>
        ),
      },
      USDT_component: {
        header: "USDT Comp",
        cell: ({ row }: { row: any }) => (
          <div className="text-right font-mono">
            {formatNumber(row.original.USDT_component)}
          </div>
        ),
      },
      id: {
        header: "ID",
        cell: ({ row }: { row: any }) => {
          const id = row.original.id;
          return <span className="font-mono text-sm text-muted-foreground">{id}</span>;
        },
      },
    }),
    []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">All Spending</h1>
        <p className="text-muted-foreground">
          Aggregated view of all treasury spending across sources
        </p>
      </div>
      <DataTable<AllSpending>
        queryConfig={queryConfig}
        tableName="all-spending"
        facetedFilters={["type", "category"]}
        columnOverrides={columnOverrides}
      />
    </div>
  );
}

export default function SpendingPage() {
  return (
    <RequireAuth>
      <SpendingPageContent />
    </RequireAuth>
  );
}
