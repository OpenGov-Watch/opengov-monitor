"use client";

import { ColumnDef, SortingState } from "@tanstack/react-table";
import { QueryConfig, DataTableEditConfig } from "@/lib/db/types";
import { DataTableLegacy, FooterCell } from "./data-table-legacy";
import { DataTableQuery } from "./data-table-query";
import { SavedView } from "@/hooks/use-view-state";

// Legacy mode (current usage - explicit columns and data)
interface DataTablePropsLegacy<TData, TValue> {
  mode?: "legacy";
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
  footerCells?: FooterCell[];
  footerLabel?: string;
  defaultSorting?: SortingState;
  defaultViews?: SavedView[];
}

// Query mode (new usage - QueryConfig with auto-generated columns)
interface DataTablePropsQuery<TData> {
  mode: "query";
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

type DataTableProps<TData, TValue = unknown> =
  | DataTablePropsLegacy<TData, TValue>
  | DataTablePropsQuery<TData>;

export function DataTable<TData, TValue = unknown>(
  props: DataTableProps<TData, TValue>
) {
  if (props.mode === "query") {
    return <DataTableQuery {...props} />;
  }
  return <DataTableLegacy {...props} />;
}

// Re-export FooterCell for convenience
export type { FooterCell };
