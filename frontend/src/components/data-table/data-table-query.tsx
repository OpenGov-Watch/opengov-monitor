"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { QueryConfig, DataTableEditConfig } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";
import { DataTableLegacy } from "./data-table-legacy";
import { SavedView } from "@/hooks/use-view-state";
import { FooterCell } from "./data-table-legacy";

interface DataTableQueryProps<TData> {
  queryConfig: QueryConfig;
  tableName: string;
  editConfig?: DataTableEditConfig;
  isAuthenticated?: boolean;
  facetedFilters?: string[];
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnMapping?: Record<string, string>;
  defaultSorting?: SortingState;
  defaultViews?: SavedView[];
  footerCells?: FooterCell[];
  footerLabel?: string;
}

export function DataTableQuery<TData>(props: DataTableQueryProps<TData>) {
  const {
    queryConfig,
    tableName,
    editConfig,
    isAuthenticated,
    facetedFilters,
    columnOverrides,
    columnMapping,
    defaultSorting,
    defaultViews,
    footerCells,
    footerLabel,
  } = props;

  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data via query execution endpoint
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/query/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(queryConfig),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Query failed");
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [queryConfig]);

  // Auto-generate columns
  const columns = useMemo(() => {
    if (data.length === 0) return [];

    return generateColumns({
      data,
      tableName,
      editConfig,
      isAuthenticated,
      facetedFilters,
      columnOverrides,
      columnMapping,
    });
  }, [data, tableName, editConfig, isAuthenticated, facetedFilters, columnOverrides, columnMapping]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <DataTableLegacy
      columns={columns}
      data={data}
      tableName={tableName}
      defaultSorting={defaultSorting}
      defaultViews={defaultViews}
      footerCells={footerCells}
      footerLabel={footerLabel}
    />
  );
}
