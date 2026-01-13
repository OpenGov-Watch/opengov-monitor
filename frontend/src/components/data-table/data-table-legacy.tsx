"use client";

import * as React from "react";
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

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableLegacyProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
  footerCells?: FooterCell[];
  footerLabel?: string;
  defaultSorting?: SortingState;
  defaultViews?: SavedView[];
}

export function DataTableLegacy<TData, TValue>({
  columns,
  data,
  tableName,
  footerCells,
  footerLabel,
  defaultSorting,
  defaultViews,
}: DataTableLegacyProps<TData, TValue>) {
  // View mode state (table vs card)
  const [viewMode, setViewMode] = React.useState<"table" | "card">(() => {
    // Check for mobile screen and default to card view
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const stored = localStorage.getItem(`${tableName}-view-mode`);
    return stored ? (stored as "table" | "card") : (isMobile ? "card" : "table");
  });

  // Persist view mode preference
  React.useEffect(() => {
    localStorage.setItem(`${tableName}-view-mode`, viewMode);
  }, [viewMode, tableName]);

  // View state management
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

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <ViewSelector
        views={getSavedViews()}
        currentViewName={currentViewName}
        onSelectView={loadView}
        onSaveView={saveView}
        onDeleteView={deleteView}
      />
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        onClearView={clearViewState}
        tableName={tableName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
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

      <DataTablePagination table={table} />
    </div>
  );
}
