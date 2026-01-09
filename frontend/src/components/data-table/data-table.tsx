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
import { useViewState } from "@/hooks/use-view-state";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableName: string;
  footerCells?: FooterCell[];
  footerLabel?: string;
  defaultSorting?: SortingState;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tableName,
  footerCells,
  footerLabel,
  defaultSorting,
}: DataTableProps<TData, TValue>) {
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
      />
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
      <DataTablePagination table={table} />
    </div>
  );
}
