"use client";

import * as React from "react";
import { ColumnDef, Table as TanstackTable, flexRender } from "@tanstack/react-table";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getColumnConfig, formatValue } from "@/lib/column-renderer";
import { shouldShowRowBorder, type ProcessedHierarchicalData } from "../hierarchical-utils";
import { FooterTotals } from "./footer-totals";
import type { FooterCell } from "../data-table";

interface TableViewProps<TData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: TanstackTable<TData>;
  columns: ColumnDef<TData>[];
  loading: boolean;
  error: string | null;
  dashboardMode?: boolean;
  // Hierarchical display props
  hierarchicalData: ProcessedHierarchicalData<TData> | null;
  normalizedGroupByColumns: string[] | null;
  showGroupTotals?: boolean;
  // Footer props
  pageTotalsCells: FooterCell[];
  grandTotalsCells: FooterCell[];
  footerCells?: FooterCell[];
  footerLabel?: string;
  // Column mapping for subtotal formatting
  tableName: string;
  columnMapping?: Record<string, string>;
}

export function TableView<TData>({
  table,
  columns,
  loading,
  error,
  dashboardMode = false,
  hierarchicalData,
  normalizedGroupByColumns,
  showGroupTotals,
  pageTotalsCells,
  grandTotalsCells,
  footerCells,
  footerLabel,
  tableName,
  columnMapping,
}: TableViewProps<TData>) {
  return (
    <div className={cn(
      "flex-1 min-h-0 relative",
      !dashboardMode && "rounded-md border",
      dashboardMode && "overflow-auto"
    )}>
      {/* Loading Overlay */}
      {loading && (
        <div className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10", !dashboardMode && "rounded-[calc(0.5rem-1px)]")}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10", !dashboardMode && "rounded-[calc(0.5rem-1px)]")}>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Error: {error}</span>
          </div>
        </div>
      )}

      <Table wrapperClassName="h-full">
        <TableHeader className="relative z-20 bg-muted/30">
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
            hierarchicalData ? (
              // Hierarchical display mode
              <>
                {table.getRowModel().rows.map((row, rowIndex) => {
                  const meta = hierarchicalData.rows[rowIndex]?.meta;
                  // Filter out subtotals with only 1 row - they're redundant
                  const subtotalsAfter = showGroupTotals
                    ? (hierarchicalData.subtotalsAfterRow.get(rowIndex) || [])
                        .filter(st => st.rowCount > 1)
                    : [];
                  const showBorder = meta && normalizedGroupByColumns
                    ? shouldShowRowBorder(meta, normalizedGroupByColumns)
                    : false;

                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        className={cn(
                          row.getIsGrouped() && "bg-muted/50 font-medium",
                          row.depth > 0 && "pl-8",
                          // Add top border only for first row of outermost group
                          showBorder && rowIndex > 0 && "border-t-2 border-border"
                        )}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const columnId = cell.column.id;
                          const isGroupColumn = normalizedGroupByColumns?.includes(columnId);
                          const shouldSuppress = isGroupColumn && meta && !meta.visibleColumns.has(columnId);

                          return (
                            <TableCell
                              key={cell.id}
                              style={{
                                paddingLeft: row.depth > 0 ? `${row.depth * 2}rem` : undefined,
                              }}
                            >
                              {shouldSuppress ? (
                                // Suppressed group column - render empty
                                ""
                              ) : cell.getIsGrouped() ? (
                                // Render group cell with expand/collapse button
                                <button
                                  onClick={row.getToggleExpandedHandler()}
                                  className="flex items-center gap-2 font-medium"
                                >
                                  {row.getIsExpanded() ? "▼" : "►"}
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}{" "}
                                  ({row.subRows.length})
                                </button>
                              ) : cell.getIsAggregated() ? (
                                // Render aggregated cell
                                flexRender(
                                  cell.column.columnDef.aggregatedCell ??
                                    cell.column.columnDef.cell,
                                  cell.getContext()
                                )
                              ) : cell.getIsPlaceholder() ? null : (
                                // Render normal cell
                                flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {/* Render subtotal rows after this data row */}
                      {subtotalsAfter.map((subtotal, stIndex) => {
                        // Background color based on level (deeper = lighter)
                        // Uses theme-aware muted color with varying opacity
                        const bgClass = subtotal.level === 0
                          ? "bg-muted/70"
                          : subtotal.level === 1
                            ? "bg-muted/50"
                            : "bg-muted/30";

                        return (
                          <TableRow
                            key={`subtotal-${rowIndex}-${stIndex}`}
                            className={cn("font-medium", bgClass)}
                          >
                            {table.getVisibleLeafColumns().map((column) => {
                              const isGroupColumn = normalizedGroupByColumns?.includes(column.id);
                              const groupColIndex = normalizedGroupByColumns?.indexOf(column.id) ?? -1;

                              // For group columns: show value or "Subtotal" label
                              if (isGroupColumn && groupColIndex >= 0) {
                                if (groupColIndex < subtotal.level) {
                                  // Higher-level group column - show empty (inherited)
                                  return <TableCell key={column.id} />;
                                } else if (groupColIndex === subtotal.level) {
                                  // This is the subtotal's level - show "<group value> Subtotal"
                                  return (
                                    <TableCell key={column.id} className="font-bold">
                                      {String(subtotal.groupValue)} Subtotal
                                    </TableCell>
                                  );
                                } else {
                                  // Lower-level group column - show empty
                                  return <TableCell key={column.id} />;
                                }
                              }

                              // For value columns: show subtotal value if currency
                              const subtotalValue = subtotal.totals[column.id];
                              if (subtotalValue !== undefined) {
                                const sourceCol = columnMapping?.[column.id] || column.id;
                                const colWithoutTable = sourceCol.includes('.') ? sourceCol.split('.').pop()! : sourceCol;
                                let config = getColumnConfig(tableName, sourceCol);
                                if (config.type === "text" && colWithoutTable !== sourceCol) {
                                  config = getColumnConfig(tableName, colWithoutTable);
                                }
                                return (
                                  <TableCell key={column.id} className="text-right">
                                    {formatValue(subtotalValue, config)}
                                  </TableCell>
                                );
                              }

                              return <TableCell key={column.id} />;
                            })}
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </>
            ) : (
              // Standard display mode
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    row.getIsGrouped() && "bg-muted/50 font-medium",
                    row.depth > 0 && "pl-8"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={{
                        paddingLeft: row.depth > 0 ? `${row.depth * 2}rem` : undefined,
                      }}
                    >
                      {cell.getIsGrouped() ? (
                        // Render group cell with expand/collapse button
                        <button
                          onClick={row.getToggleExpandedHandler()}
                          className="flex items-center gap-2 font-medium"
                        >
                          {row.getIsExpanded() ? "▼" : "►"}
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}{" "}
                          ({row.subRows.length})
                        </button>
                      ) : cell.getIsAggregated() ? (
                        // Render aggregated cell
                        flexRender(
                          cell.column.columnDef.aggregatedCell ??
                            cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      ) : cell.getIsPlaceholder() ? null : (
                        // Render normal cell
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )
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
        <FooterTotals
          visibleColumns={table.getVisibleLeafColumns()}
          pageTotalsCells={pageTotalsCells}
          grandTotalsCells={grandTotalsCells}
          footerCells={footerCells}
          footerLabel={footerLabel}
        />
      </Table>
    </div>
  );
}
