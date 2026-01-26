"use client";

import React from "react";
import {
  getColumnConfig,
  getColumnDisplayName,
  formatValue,
  type ColumnRenderConfig,
} from "@/lib/column-renderer";
import { TABLE_STYLES, COLORS } from "@/lib/export-styles";
import {
  processHierarchicalData,
  shouldShowRowBorder,
  type ProcessedHierarchicalData,
  type GroupSubtotal,
} from "./hierarchical-utils";

/** Cell with column ID and formatted value for footer rows */
export interface FooterCell {
  columnId: string;
  value: string;
}

interface SimpleTableProps {
  data: Record<string, unknown>[];
  columns?: string[];
  tableName?: string;
  columnMapping?: Record<string, string>;
  columnOverrides?: Record<string, { header?: string }>;
  hiddenColumns?: Set<string>;
  exportMode?: boolean;
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
  hierarchicalDisplay = false,
  groupByColumns,
  showGroupTotals = false,
  currencyColumns,
  showPageTotals = false,
  grandTotalsCells,
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

  // Get subtotal row style based on level (for export mode)
  const getSubtotalRowStyle = (level: number) => {
    if (!exportMode) return undefined;
    const levelStyles = TABLE_STYLES.subtotalRow.export;
    if (level === 0) return levelStyles.level0;
    if (level === 1) return levelStyles.level1;
    return levelStyles.level2;
  };

  // Get subtotal cell style
  const getSubtotalCellStyle = (
    level: number,
    config: ColumnRenderConfig,
    colIndex: number
  ) => {
    if (!exportMode) return undefined;
    const baseStyle = getSubtotalRowStyle(level);
    return {
      ...baseStyle,
      borderRight:
        colIndex < columns.length - 1 ? `1px solid ${COLORS.border}` : "none",
      textAlign: isRightAligned(config) ? ("right" as const) : ("left" as const),
    };
  };

  // Get footer row style (page totals or grand totals)
  const getFooterCellStyle = (
    type: "pageTotals" | "grandTotals",
    config: ColumnRenderConfig,
    colIndex: number
  ) => {
    if (!exportMode) return undefined;
    const baseStyle = TABLE_STYLES.footerRow.export[type];
    return {
      ...baseStyle,
      borderRight:
        colIndex < columns.length - 1 ? `1px solid ${COLORS.border}` : "none",
      textAlign: isRightAligned(config) ? ("right" as const) : ("left" as const),
    };
  };

  // Process hierarchical data if enabled
  const hierarchicalData: ProcessedHierarchicalData<Record<string, unknown>> | null =
    hierarchicalDisplay && groupByColumns && groupByColumns.length >= 2
      ? processHierarchicalData(
          displayData,
          groupByColumns,
          currencyColumns ?? []
        )
      : null;

  // Calculate page totals if enabled
  const pageTotalValues: Record<string, number> = {};
  if (showPageTotals && currencyColumns) {
    for (const col of currencyColumns) {
      if (columns.includes(col)) {
        let sum = 0;
        for (const row of displayData) {
          const value = row[col];
          if (typeof value === "number") {
            sum += value;
          }
        }
        pageTotalValues[col] = sum;
      }
    }
  }

  // Render a subtotal row
  const renderSubtotalRow = (subtotal: GroupSubtotal, keyPrefix: string) => {
    // Background class based on level
    const bgClass =
      subtotal.level === 0
        ? "bg-muted/70"
        : subtotal.level === 1
          ? "bg-muted/50"
          : "bg-muted/30";

    return (
      <tr
        key={`${keyPrefix}-subtotal-${subtotal.level}`}
        style={exportMode ? getSubtotalRowStyle(subtotal.level) : undefined}
        className={exportMode ? undefined : `font-medium ${bgClass}`}
      >
        {columns.map((col, colIndex) => {
          const config = columnConfigs[col];
          const isGroupColumn = groupByColumns?.includes(col);
          const groupColIndex = groupByColumns?.indexOf(col) ?? -1;

          // For group columns: show value or "Subtotal" label
          if (isGroupColumn && groupColIndex >= 0) {
            if (groupColIndex < subtotal.level) {
              // Higher-level group column - show empty (inherited)
              return (
                <td
                  key={col}
                  style={getSubtotalCellStyle(subtotal.level, config, colIndex)}
                  className={exportMode ? undefined : getCellClassName(config)}
                />
              );
            } else if (groupColIndex === subtotal.level) {
              // This is the subtotal's level - show "<group value> Subtotal"
              return (
                <td
                  key={col}
                  style={
                    exportMode
                      ? { ...getSubtotalCellStyle(subtotal.level, config, colIndex), fontWeight: 700 }
                      : undefined
                  }
                  className={exportMode ? undefined : `${getCellClassName(config)} font-bold`}
                >
                  {String(subtotal.groupValue)} Subtotal
                </td>
              );
            } else {
              // Lower-level group column - show empty
              return (
                <td
                  key={col}
                  style={getSubtotalCellStyle(subtotal.level, config, colIndex)}
                  className={exportMode ? undefined : getCellClassName(config)}
                />
              );
            }
          }

          // For value columns: show subtotal value if currency
          const subtotalValue = subtotal.totals[col];
          if (subtotalValue !== undefined) {
            const sourceCol = columnMapping?.[col] || col;
            const colWithoutTable = sourceCol.includes(".")
              ? sourceCol.split(".").pop()!
              : sourceCol;
            let cellConfig = getColumnConfig(tableName, sourceCol);
            if (cellConfig.type === "text" && colWithoutTable !== sourceCol) {
              cellConfig = getColumnConfig(tableName, colWithoutTable);
            }
            return (
              <td
                key={col}
                style={
                  exportMode
                    ? { ...getSubtotalCellStyle(subtotal.level, cellConfig, colIndex), textAlign: "right" }
                    : undefined
                }
                className={exportMode ? undefined : `${getCellClassName(cellConfig)} text-right`}
              >
                {formatValue(subtotalValue, cellConfig)}
              </td>
            );
          }

          return (
            <td
              key={col}
              style={getSubtotalCellStyle(subtotal.level, config, colIndex)}
              className={exportMode ? undefined : getCellClassName(config)}
            />
          );
        })}
      </tr>
    );
  };

  // Render a data row (with hierarchical suppression if enabled)
  const renderDataRow = (
    row: Record<string, unknown>,
    rowIndex: number,
    meta?: { visibleColumns: Set<string>; isGroupStart: Record<string, boolean>; groupRowIndex: number }
  ) => {
    const showBorder =
      hierarchicalData && meta && groupByColumns
        ? shouldShowRowBorder(meta, groupByColumns)
        : false;

    return (
      <tr
        key={rowIndex}
        style={
          exportMode
            ? {
                backgroundColor: COLORS.cellBg,
                ...(showBorder && rowIndex > 0 ? TABLE_STYLES.groupBorder.export : {}),
              }
            : undefined
        }
        className={
          exportMode
            ? undefined
            : `bg-background ${showBorder && rowIndex > 0 ? "border-t-2 border-border" : ""}`
        }
      >
        {columns.map((col, colIndex) => {
          const config = columnConfigs[col];
          const isGroupColumn = groupByColumns?.includes(col);
          const shouldSuppress =
            hierarchicalDisplay && isGroupColumn && meta && !meta.visibleColumns.has(col);

          return (
            <td
              key={col}
              style={getCellStyle(config, colIndex)}
              className={getCellClassName(config)}
            >
              {shouldSuppress ? "" : formatCellValue(row[col], config)}
            </td>
          );
        })}
      </tr>
    );
  };

  // Render page totals row
  const renderPageTotalsRow = () => {
    if (!showPageTotals || Object.keys(pageTotalValues).length === 0) return null;

    return (
      <tr
        style={exportMode ? TABLE_STYLES.footerRow.export.pageTotals : undefined}
        className={exportMode ? undefined : "bg-muted/50 font-medium"}
      >
        {columns.map((col, colIndex) => {
          const config = columnConfigs[col];

          // First column shows label
          if (colIndex === 0) {
            return (
              <td
                key={col}
                style={getFooterCellStyle("pageTotals", config, colIndex)}
                className={exportMode ? undefined : `${getCellClassName(config)} whitespace-nowrap`}
              >
                PAGE TOTAL
              </td>
            );
          }

          // Currency columns show sum
          const totalValue = pageTotalValues[col];
          if (totalValue !== undefined) {
            return (
              <td
                key={col}
                style={
                  exportMode
                    ? { ...getFooterCellStyle("pageTotals", config, colIndex), textAlign: "right" }
                    : undefined
                }
                className={exportMode ? undefined : `${getCellClassName(config)} text-right`}
              >
                {formatValue(totalValue, config)}
              </td>
            );
          }

          return (
            <td
              key={col}
              style={getFooterCellStyle("pageTotals", config, colIndex)}
              className={exportMode ? undefined : getCellClassName(config)}
            />
          );
        })}
      </tr>
    );
  };

  // Render grand totals row
  const renderGrandTotalsRow = () => {
    if (!grandTotalsCells || grandTotalsCells.length === 0) return null;

    // Create lookup map for quick access
    const grandTotalsMap = new Map(grandTotalsCells.map((c) => [c.columnId, c.value]));

    return (
      <tr
        style={exportMode ? TABLE_STYLES.footerRow.export.grandTotals : undefined}
        className={exportMode ? undefined : "bg-muted/70 font-semibold"}
      >
        {columns.map((col, colIndex) => {
          const config = columnConfigs[col];

          // First column shows label
          if (colIndex === 0) {
            return (
              <td
                key={col}
                style={getFooterCellStyle("grandTotals", config, colIndex)}
                className={exportMode ? undefined : `${getCellClassName(config)} whitespace-nowrap`}
              >
                TOTAL
              </td>
            );
          }

          // Currency columns show grand total
          const totalValue = grandTotalsMap.get(col);
          if (totalValue !== undefined) {
            return (
              <td
                key={col}
                style={
                  exportMode
                    ? { ...getFooterCellStyle("grandTotals", config, colIndex), textAlign: "right" }
                    : undefined
                }
                className={exportMode ? undefined : `${getCellClassName(config)} text-right`}
              >
                {totalValue}
              </td>
            );
          }

          return (
            <td
              key={col}
              style={getFooterCellStyle("grandTotals", config, colIndex)}
              className={exportMode ? undefined : getCellClassName(config)}
            />
          );
        })}
      </tr>
    );
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
          {hierarchicalData
            ? // Hierarchical display mode
              hierarchicalData.rows.map((processedRow, rowIndex) => {
                // Filter out subtotals with only 1 row - they're redundant
                const subtotalsAfter = showGroupTotals
                  ? (hierarchicalData.subtotalsAfterRow.get(rowIndex) || []).filter(
                      (st) => st.rowCount > 1
                    )
                  : [];

                return (
                  <React.Fragment key={rowIndex}>
                    {renderDataRow(processedRow.data, rowIndex, processedRow.meta)}
                    {subtotalsAfter.map((subtotal, stIndex) =>
                      renderSubtotalRow(subtotal, `${rowIndex}-${stIndex}`)
                    )}
                  </React.Fragment>
                );
              })
            : // Standard display mode
              displayData.map((row, rowIndex) => renderDataRow(row, rowIndex))}
        </tbody>
        {/* Footer rows: Page Totals and Grand Totals */}
        {(showPageTotals || (grandTotalsCells && grandTotalsCells.length > 0)) && (
          <tfoot>
            {renderPageTotalsRow()}
            {renderGrandTotalsRow()}
          </tfoot>
        )}
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
