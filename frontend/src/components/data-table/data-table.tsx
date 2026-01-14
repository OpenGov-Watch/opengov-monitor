"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

import { Loader2, AlertCircle } from "lucide-react";

import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";
import { DataTableCard } from "./data-table-card";
import { ViewSelector } from "./view-selector";
import { useViewState, SavedView } from "@/hooks/use-view-state";
import { QueryConfig, QueryExecuteResponse, DataTableEditConfig } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";
import { sortingStateToOrderBy, filterStateToQueryFilters } from "@/lib/query-config-utils";
import { cn } from "@/lib/utils";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableProps<TData> {
  queryConfig: Omit<QueryConfig, "orderBy" | "filters">;
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
  compactMode?: boolean;

  // Dashboard mode configuration
  dashboardMode?: boolean;
  dashboardComponentId?: string;

  // Feature visibility control
  hideViewSelector?: boolean;
  toolbarCollapsible?: boolean;
  initialToolbarCollapsed?: boolean;

  // Controlled toolbar collapse state (for dashboard integration)
  toolbarCollapsed?: boolean;
  onToolbarCollapseChange?: (collapsed: boolean) => void;
}

export function DataTable<TData>({
  queryConfig: baseQueryConfig,
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
  compactMode = false,
  dashboardMode = false,
  dashboardComponentId,
  hideViewSelector: hideViewSelectorProp,
  toolbarCollapsible: toolbarCollapsibleProp,
  initialToolbarCollapsed: initialToolbarCollapsedProp,
  toolbarCollapsed,
  onToolbarCollapseChange,
}: DataTableProps<TData>) {
  // Apply defaults based on dashboardMode
  const hideViewSelector = hideViewSelectorProp ?? dashboardMode;
  const toolbarCollapsible = toolbarCollapsibleProp ?? dashboardMode;
  const initialToolbarCollapsed = initialToolbarCollapsedProp ?? dashboardMode;
  // VIEW STATE MANAGEMENT (moved before queryConfig to access sorting/filtering)
  const viewState = useViewState(tableName, { defaultSorting, defaultViews });

  const {
    sorting,
    setSorting: setViewSorting,
    columnFilters,
    setColumnFilters: setViewColumnFilters,
    columnVisibility,
    setColumnVisibility,
    pagination,
    setPagination,
    currentViewName,
    getSavedViews,
    saveView,
    loadView,
    deleteView,
    clearViewState: clearView,
  } = viewState;

  // DATA FETCHING
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  // Pass through the original setters without any wrapping
  const setSorting = setViewSorting;
  const setColumnFilters = setViewColumnFilters;
  const clearViewState = clearView;

  // BUILD COMPLETE QUERY CONFIG
  // Merge base config with dynamic sorting/filtering/pagination state
  const queryConfig = useMemo<QueryConfig>(() => ({
    ...baseQueryConfig,
    orderBy: sortingStateToOrderBy(sorting),
    filters: filterStateToQueryFilters(columnFilters),
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
  }), [baseQueryConfig, sorting, columnFilters, pagination]);

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

        const result: QueryExecuteResponse = await response.json();
        setData(result.data as TData[]);
        setTotalCount(result.totalCount);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [queryConfig]);

  // COLUMN GENERATION
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
  }, [
    data,
    tableName,
    editConfig,
    isAuthenticated,
    facetedFilters,
    columnOverrides,
    columnMapping,
  ]);

  // VIEW MODE STATE
  const [viewMode, setViewMode] = React.useState<"table" | "card">(() => {
    if (compactMode) return "table"; // Force table in compact mode
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    const stored = localStorage.getItem(`${tableName}-view-mode`);
    return stored
      ? (stored as "table" | "card")
      : isMobile
        ? "card"
        : "table";
  });

  // Persist view mode preference (not in compact mode)
  React.useEffect(() => {
    if (!compactMode) {
      localStorage.setItem(`${tableName}-view-mode`, viewMode);
    }
  }, [viewMode, tableName, compactMode]);

  // REACT TABLE INSTANCE
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    // getSortedRowModel removed - sorting now server-side via orderBy
    // getFilteredRowModel removed - filtering now server-side via filters
    // getPaginationRowModel removed - pagination now server-side via limit/offset
    manualPagination: true,  // Enable server-side pagination
    rowCount: totalCount ?? 0,  // Total rows from server
    pageCount: totalCount !== undefined
      ? Math.ceil(totalCount / pagination.pageSize)
      : -1,  // -1 means unknown (loading state)
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // RENDER
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {!hideViewSelector && (
        <ViewSelector
          views={getSavedViews()}
          currentViewName={currentViewName}
          onSelectView={loadView}
          onSaveView={saveView}
          onDeleteView={deleteView}
        />
      )}
      <DataTableToolbar
        table={table}
        onClearView={clearViewState}
        tableName={tableName}
        viewMode={viewMode}
        onViewModeChange={compactMode ? undefined : setViewMode}
        compactMode={compactMode}
        toolbarCollapsible={toolbarCollapsible}
        dashboardComponentId={dashboardComponentId}
        initialToolbarCollapsed={initialToolbarCollapsed}
        toolbarCollapsed={toolbarCollapsed}
        onToolbarCollapseChange={onToolbarCollapseChange}
      />

      {viewMode === "card" ? (
        // Card view - mobile-optimized
        <div className="flex-1 min-h-0 overflow-auto relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          <div className={cn(loading && "opacity-30")}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <DataTableCard key={row.id} row={row} />
              ))
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                No results.
              </div>
            )}
          </div>
        </div>
      ) : (
        // Table view - desktop
        <div className="flex-1 min-h-0 rounded-md border relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[calc(0.5rem-1px)]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[calc(0.5rem-1px)]">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          <Table wrapperClassName="h-full">
            <TableHeader className="relative z-20 bg-background">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className={cn(loading && "opacity-30")}>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {footerCells && footerCells.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/50 font-medium">
                  {table.getVisibleLeafColumns().map((column, index) => {
                    const footerCell = footerCells.find(
                      (fc) => fc.columnId === column.id
                    );
                    const hasFooterValue = footerCell?.value !== undefined;
                    return (
                      <TableCell
                        key={column.id}
                        className={
                          index === 0
                            ? "font-bold"
                            : hasFooterValue
                              ? "text-right"
                              : ""
                        }
                      >
                        {index === 0
                          ? footerLabel || "GRAND TOTAL"
                          : footerCell?.value ?? ""}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      <DataTablePagination table={table} compactMode={compactMode} />
    </div>
  );
}
