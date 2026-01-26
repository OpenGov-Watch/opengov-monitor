"use client";

import {
  getColumnConfig,
  getColumnDisplayName,
  formatValue,
  type ColumnRenderConfig,
} from "@/lib/column-renderer";
import { TABLE_STYLES, COLORS } from "@/lib/export-styles";

interface SimpleTableProps {
  data: Record<string, unknown>[];
  columns?: string[];
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
  hiddenColumns?: Set<string>;
  exportMode?: boolean;
  maxRows?: number;
}

/**
 * Unified simple table component for both interactive display and PNG export.
 *
 * Uses `exportMode` prop to switch between Tailwind classes (interactive)
 * and inline styles (export). This ensures consistent rendering when
 * captured off-screen by html2canvas.
 */
export function SimpleTable({
  data,
  columns: explicitColumns,
  tableName = "",
  columnMapping,
  columnOverrides,
  hiddenColumns,
  exportMode = false,
  maxRows = 50,
}: SimpleTableProps) {
  // Handle empty data
  if (data.length === 0) {
    return (
      <div
        style={exportMode ? TABLE_STYLES.emptyState.export : undefined}
        className={exportMode ? undefined : TABLE_STYLES.emptyState.interactive}
      >
        No data available
      </div>
    );
  }

  // Determine columns to display
  const allColumns = explicitColumns ?? Object.keys(data[0]);
  const columns = hiddenColumns
    ? allColumns.filter((col) => !hiddenColumns.has(col))
    : allColumns;

  // Apply row limit
  const displayData = data.slice(0, maxRows);
  const isTruncated = data.length > maxRows;

  // Get config for each column (use source column name if available)
  const columnConfigs: Record<string, ColumnRenderConfig> = {};
  for (const col of columns) {
    const sourceColumn = columnMapping?.[col] ?? col;
    columnConfigs[col] = getColumnConfig(tableName, sourceColumn);
  }

  // Get display name from overrides or column config
  const getDisplayName = (col: string) => {
    if (columnOverrides?.[col]?.header) {
      return columnOverrides[col].header;
    }
    return getColumnDisplayName(tableName, col);
  };

  // Determine if column should be right-aligned
  const isRightAligned = (config: ColumnRenderConfig) =>
    config.type === "currency" || config.type === "numeric";

  // Format cell value
  const formatCellValue = (value: unknown, config: ColumnRenderConfig) => {
    return formatValue(value, config);
  };

  // Style helpers for conditional rendering
  const getHeaderStyle = (config: ColumnRenderConfig, colIndex: number) => {
    if (!exportMode) return undefined;
    return {
      ...TABLE_STYLES.header.export,
      borderRight:
        colIndex < columns.length - 1 ? `1px solid ${COLORS.border}` : "none",
      textAlign: isRightAligned(config) ? ("right" as const) : ("left" as const),
    };
  };

  const getCellStyle = (config: ColumnRenderConfig, colIndex: number) => {
    if (!exportMode) return undefined;
    return {
      ...TABLE_STYLES.cell.export,
      borderRight:
        colIndex < columns.length - 1 ? `1px solid ${COLORS.border}` : "none",
      textAlign: isRightAligned(config) ? ("right" as const) : ("left" as const),
    };
  };

  const getHeaderClassName = (config: ColumnRenderConfig) => {
    if (exportMode) return undefined;
    const alignment = isRightAligned(config) ? "text-right" : "text-left";
    return `${TABLE_STYLES.header.interactive} ${alignment} border-b-2 border-border`;
  };

  const getCellClassName = (config: ColumnRenderConfig) => {
    if (exportMode) return undefined;
    const alignment = isRightAligned(config) ? "text-right" : "text-left";
    return `${TABLE_STYLES.cell.interactive} ${alignment} border-b border-border`;
  };

  return (
    <div style={exportMode ? TABLE_STYLES.container.export : undefined}>
      <table
        style={exportMode ? TABLE_STYLES.table.export : undefined}
        className={exportMode ? undefined : "w-full border-collapse border border-border bg-background"}
      >
        <thead>
          <tr>
            {columns.map((col, colIndex) => {
              const config = columnConfigs[col];
              return (
                <th
                  key={col}
                  style={getHeaderStyle(config, colIndex)}
                  className={getHeaderClassName(config)}
                >
                  {getDisplayName(col)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              style={exportMode ? { backgroundColor: COLORS.cellBg } : undefined}
              className={exportMode ? undefined : "bg-background"}
            >
              {columns.map((col, colIndex) => {
                const config = columnConfigs[col];
                return (
                  <td
                    key={col}
                    style={getCellStyle(config, colIndex)}
                    className={getCellClassName(config)}
                  >
                    {formatCellValue(row[col], config)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {isTruncated && (
        <div
          style={exportMode ? TABLE_STYLES.truncationNote.export : undefined}
          className={exportMode ? undefined : TABLE_STYLES.truncationNote.interactive}
        >
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}
