"use client";

import {
  getColumnConfig,
  getColumnDisplayName,
  formatValue,
  type ColumnRenderConfig,
} from "@/lib/column-renderer";

interface ExportTableProps {
  data: Record<string, unknown>[];
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
  hiddenColumns?: Set<string>;
  maxRows?: number;
}

/**
 * Simplified table component for PNG export.
 * Uses plain HTML elements with explicit inline styles to ensure
 * consistent rendering when captured off-screen by html2canvas.
 */
export function ExportTable({
  data,
  tableName = "",
  columnMapping,
  columnOverrides,
  hiddenColumns,
  maxRows = 50,
}: ExportTableProps) {
  if (data.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#666", fontSize: "14px" }}>
        No data available
      </div>
    );
  }

  // Filter out hidden columns
  const allColumns = Object.keys(data[0]);
  const columns = hiddenColumns
    ? allColumns.filter(col => !hiddenColumns.has(col))
    : allColumns;
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

  // Format cell value for export
  const formatCellValue = (value: unknown, config: ColumnRenderConfig) => {
    return formatValue(value, config);
  };

  return (
    <div style={{ width: "100%", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <table style={{
        borderCollapse: "collapse",
        width: "100%",
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
      }}>
        <thead>
          <tr>
            {columns.map((col, colIndex) => {
              const config = columnConfigs[col];
              return (
                <th
                  key={col}
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    padding: "12px 16px",
                    borderBottom: "2px solid #e5e7eb",
                    borderRight: colIndex < columns.length - 1 ? "1px solid #e5e7eb" : "none",
                    backgroundColor: "#f9fafb",
                    whiteSpace: "nowrap",
                    textAlign: isRightAligned(config) ? "right" : "left",
                    color: "#111827",
                  }}
                >
                  {getDisplayName(col)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, rowIndex) => (
            <tr key={rowIndex} style={{ backgroundColor: "#ffffff" }}>
              {columns.map((col, colIndex) => {
                const config = columnConfigs[col];
                return (
                  <td
                    key={col}
                    style={{
                      fontSize: "14px",
                      padding: "10px 16px",
                      borderBottom: "1px solid #e5e7eb",
                      borderRight: colIndex < columns.length - 1 ? "1px solid #e5e7eb" : "none",
                      whiteSpace: "nowrap",
                      textAlign: isRightAligned(config) ? "right" : "left",
                      color: "#374151",
                      backgroundColor: "#ffffff",
                    }}
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
          style={{
            padding: "12px",
            textAlign: "center",
            fontSize: "12px",
            color: "#666",
            backgroundColor: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}
