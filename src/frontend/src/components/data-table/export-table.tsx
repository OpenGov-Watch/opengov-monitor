"use client";

import { SimpleTable } from "./simple-table";

interface ExportTableProps {
  data: Record<string, unknown>[];
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
  hiddenColumns?: Set<string>;
  maxRows?: number;
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
