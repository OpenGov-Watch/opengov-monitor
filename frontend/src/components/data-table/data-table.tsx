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
import { useViewState } from "@/hooks/use-view-state";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

export type ViewMode = "table" | "card";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
  footerCells?: FooterCell[];
  footerLabel?: string;
  defaultSorting?: SortingState;
  cardViewPrimaryFields?: string[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tableName,
  footerCells,
  footerLabel,
  defaultSorting,
  cardViewPrimaryFields,
}: DataTableProps<TData, TValue>) {
  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    const saved = localStorage.getItem(`${tableName}-view-mode`);
    // Default to card view on mobile, table on desktop
    const isMobile = window.innerWidth < 768;
    return (saved as ViewMode) || (isMobile ? "card" : "table");
  });

  // Persist view mode
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
    saveViewState,
    loadViewState,
    clearViewState,
  } = useViewState(tableName, { defaultSorting });

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

  // Determine primary fields for card view
  const primaryFields = cardViewPrimaryFields ||
    columns.slice(0, 3).map((col: any) => col.id || col.accessorKey).filter(Boolean);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        onSaveView={saveViewState}
        onLoadView={loadViewState}
        onClearView={clearViewState}
        tableName={tableName}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Table View */}
      {viewMode === "table" && (
        <>
          <div className="flex-1 min-h-0 rounded-md border overflow-auto">
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
        </>
      )}

      {/* Card View */}
      {viewMode === "card" && (
        <div className="flex-1 min-h-0 overflow-auto">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <DataTableCard
                key={row.id}
                row={row}
                primaryFields={primaryFields}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-24 text-center text-muted-foreground">
              No results.
            </div>
          )}
        </div>
      )}

      <DataTablePagination table={table} />
    </div>
  );
}
