"use client";

import { SimpleTable, type FooterCell } from "./simple-table";

interface ExportTableProps {
  data: Record<string, unknown>[];
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
  hiddenColumns?: Set<string>;
  maxRows?: number;

  // Hierarchical display options
  /** Enable hierarchical display with collapsed group values */
  hierarchicalDisplay?: boolean;
  /** Ordered array of columns for grouping (outer to inner) */
  groupByColumns?: string[];
  /** Show subtotals for each group level */
  showGroupTotals?: boolean;
  /** Column names that are currency (for subtotal calculation) */
  currencyColumns?: string[];

  // Totals options
  /** Show page totals row at bottom */
  showPageTotals?: boolean;
  /** Pre-calculated grand totals cells (column ID -> formatted value) */
  grandTotalsCells?: FooterCell[];
}

/**
 * Table component for PNG export.
 *
 * Thin wrapper around SimpleTable with exportMode enabled.
 * Uses inline styles for consistent html2canvas rendering.
 */
export function ExportTable(props: ExportTableProps) {
  return <SimpleTable {...props} exportMode={true} />;
}
