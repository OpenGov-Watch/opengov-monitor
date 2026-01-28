"use client";

import { Column } from "@tanstack/react-table";
import {
  TableFooter,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FooterCell } from "../data-table";

interface FooterTotalsProps<TData> {
  visibleColumns: Column<TData, unknown>[];
  pageTotalsCells: FooterCell[];
  grandTotalsCells: FooterCell[];
  footerCells?: FooterCell[];
  footerLabel?: string;
}

export function FooterTotals<TData>({
  visibleColumns,
  pageTotalsCells,
  grandTotalsCells,
  footerCells,
  footerLabel,
}: FooterTotalsProps<TData>) {
  const hasContent =
    pageTotalsCells.length > 0 ||
    grandTotalsCells.length > 0 ||
    (footerCells && footerCells.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <TableFooter className="sticky bottom-0">
      {/* Page Totals Row - lighter background */}
      {pageTotalsCells.length > 0 && (
        <TableRow className="bg-muted/50">
          {visibleColumns.map((column, index) => {
            const cell = pageTotalsCells.find(
              (fc) => fc.columnId === column.id
            );
            const hasValue = cell?.value !== undefined;
            return (
              <TableCell
                key={column.id}
                className={cn("whitespace-nowrap", hasValue && "text-right")}
              >
                {index === 0 ? "PAGE TOTAL" : cell?.value ?? ""}
              </TableCell>
            );
          })}
        </TableRow>
      )}
      {/* Grand Totals Row - more prominent background */}
      {grandTotalsCells.length > 0 && (
        <TableRow className="bg-muted/70">
          {visibleColumns.map((column, index) => {
            const cell = grandTotalsCells.find(
              (fc) => fc.columnId === column.id
            );
            const hasValue = cell?.value !== undefined;
            return (
              <TableCell
                key={column.id}
                className={cn("whitespace-nowrap", hasValue && "text-right")}
              >
                {index === 0 ? "TOTAL" : cell?.value ?? ""}
              </TableCell>
            );
          })}
        </TableRow>
      )}
      {/* Legacy footerCells prop (backwards compatibility) */}
      {footerCells && footerCells.length > 0 && (
        <TableRow className="bg-muted/50 font-medium">
          {visibleColumns.map((column, index) => {
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
      )}
    </TableFooter>
  );
}
