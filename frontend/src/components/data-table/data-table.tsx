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
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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

import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";
import { DataTableCard } from "./data-table-card";
import { ViewSelector } from "./view-selector";
import { useViewState, SavedView } from "@/hooks/use-view-state";
import { QueryConfig, DataTableEditConfig } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableProps<TData> {
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
  compactMode?: boolean;
}

export function DataTable<TData>({
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
  compactMode = false,
}: DataTableProps<TData>) {
  // DATA FETCHING
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // VIEW STATE MANAGEMENT
  const {
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    globalFilter,
    setGlobalFilter,
    pagination,
    setPagination,
    currentViewName,
    getSavedViews,
    saveView,
    loadView,
    deleteView,
    clearViewState,
  } = useViewState(tableName, { defaultSorting, defaultViews });

  // REACT TABLE INSTANCE
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: "includesString",
  });

  // LOADING STATE
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  // RENDER
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {!compactMode && (
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
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        onClearView={clearViewState}
        tableName={tableName}
        viewMode={viewMode}
        onViewModeChange={compactMode ? undefined : setViewMode}
        compactMode={compactMode}
      />

      {viewMode === "card" ? (
        // Card view - mobile-optimized
        <div className="flex-1 min-h-0 overflow-auto">
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
      ) : (
        // Table view - desktop
        <div className="flex-1 min-h-0 rounded-md border">
          <Table wrapperClassName="h-full">
            <TableHeader>
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
            <TableBody>
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
