/**
 * Unified Column Utilities
 *
 * Conversion utilities between unified column state (for UI drag-and-drop)
 * and API format (QueryConfig columns/expressionColumns).
 *
 * The unified column model allows regular columns and expression columns
 * to be reordered together in the UI while maintaining backward compatibility
 * with the API format that keeps them separate.
 */

import type { ColumnSelection, ExpressionColumn } from "@/lib/db/types";

/**
 * Aggregate function type (same as in ColumnSelection)
 */
export type AggregateFunction = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

/**
 * Discriminated union representing either a regular column or an expression column.
 * Used for unified drag-and-drop ordering in the query builder UI.
 */
export type UnifiedColumn =
  | {
      type: "regular";
      column: string;
      alias?: string;
      aggregateFunction?: AggregateFunction;
    }
  | {
      type: "expression";
      expression: string;
      alias: string;
      aggregateFunction?: AggregateFunction;
      sourceColumn?: string; // Source column for formatting lookup
    };

/**
 * Generates a unique ID for a unified column.
 * Uses prefixes to distinguish between regular columns and expressions.
 *
 * @param col - The unified column
 * @returns A unique string ID with prefix (col: or expr:)
 */
export function getColumnId(col: UnifiedColumn): string {
  if (col.type === "regular") {
    return `col:${col.column}`;
  }
  return `expr:${col.alias}`;
}

/**
 * Converts API format (columns + expressionColumns) to unified format.
 * If columnOrder is provided, columns are arranged in that order.
 * Otherwise, regular columns are added first, followed by expression columns.
 *
 * @param columns - Array of ColumnSelection from QueryConfig
 * @param expressionColumns - Array of ExpressionColumn from QueryConfig (optional)
 * @param columnOrder - Array of column IDs specifying interleaved order (optional)
 * @returns Array of UnifiedColumn for UI state
 */
export function toUnifiedColumns(
  columns: ColumnSelection[],
  expressionColumns?: ExpressionColumn[],
  columnOrder?: string[]
): UnifiedColumn[] {
  // Build lookup maps
  const columnsMap = new Map<string, ColumnSelection>();
  for (const col of columns) {
    columnsMap.set(`col:${col.column}`, col);
  }

  const expressionsMap = new Map<string, ExpressionColumn>();
  if (expressionColumns) {
    for (const expr of expressionColumns) {
      expressionsMap.set(`expr:${expr.alias}`, expr);
    }
  }

  // Helper to convert ColumnSelection to UnifiedColumn
  const toRegularUnified = (col: ColumnSelection): UnifiedColumn => {
    const regularCol: UnifiedColumn = {
      type: "regular",
      column: col.column,
    };
    if (col.alias) {
      regularCol.alias = col.alias;
    }
    if (col.aggregateFunction) {
      regularCol.aggregateFunction = col.aggregateFunction;
    }
    return regularCol;
  };

  // Helper to convert ExpressionColumn to UnifiedColumn
  const toExpressionUnified = (expr: ExpressionColumn): UnifiedColumn => {
    const exprCol: UnifiedColumn = {
      type: "expression",
      expression: expr.expression,
      alias: expr.alias,
    };
    if (expr.aggregateFunction) {
      exprCol.aggregateFunction = expr.aggregateFunction;
    }
    if (expr.sourceColumn) {
      exprCol.sourceColumn = expr.sourceColumn;
    }
    return exprCol;
  };

  // If columnOrder is provided, use it to arrange columns
  if (columnOrder && columnOrder.length > 0) {
    const unified: UnifiedColumn[] = [];
    const processedIds = new Set<string>();

    for (const id of columnOrder) {
      if (id.startsWith("col:")) {
        const col = columnsMap.get(id);
        if (col) {
          unified.push(toRegularUnified(col));
          processedIds.add(id);
        }
      } else if (id.startsWith("expr:")) {
        const expr = expressionsMap.get(id);
        if (expr) {
          unified.push(toExpressionUnified(expr));
          processedIds.add(id);
        }
      }
    }

    // Add any columns not in columnOrder (backward compatibility)
    for (const [id, col] of columnsMap) {
      if (!processedIds.has(id)) {
        unified.push(toRegularUnified(col));
      }
    }
    for (const [id, expr] of expressionsMap) {
      if (!processedIds.has(id)) {
        unified.push(toExpressionUnified(expr));
      }
    }

    return unified;
  }

  // Fallback: regular columns first, then expression columns
  const unified: UnifiedColumn[] = [];

  for (const col of columns) {
    unified.push(toRegularUnified(col));
  }

  if (expressionColumns) {
    for (const expr of expressionColumns) {
      unified.push(toExpressionUnified(expr));
    }
  }

  return unified;
}

/**
 * Converts unified format back to API format (columns + expressionColumns + columnOrder).
 * Extracts regular columns and expression columns while preserving their properties.
 * Also generates columnOrder to preserve the interleaved ordering.
 *
 * @param unifiedColumns - Array of UnifiedColumn from UI state
 * @returns Object with columns, expressionColumns, and columnOrder arrays
 */
export function fromUnifiedColumns(unifiedColumns: UnifiedColumn[]): {
  columns: ColumnSelection[];
  expressionColumns: ExpressionColumn[];
  columnOrder: string[];
} {
  const columns: ColumnSelection[] = [];
  const expressionColumns: ExpressionColumn[] = [];
  const columnOrder: string[] = [];

  for (const col of unifiedColumns) {
    if (col.type === "regular") {
      const selection: ColumnSelection = { column: col.column };
      if (col.alias) {
        selection.alias = col.alias;
      }
      if (col.aggregateFunction) {
        selection.aggregateFunction = col.aggregateFunction;
      }
      columns.push(selection);
      columnOrder.push(getColumnId(col));
    } else {
      const exprCol: ExpressionColumn = {
        expression: col.expression,
        alias: col.alias,
      };
      if (col.aggregateFunction) {
        exprCol.aggregateFunction = col.aggregateFunction;
      }
      if (col.sourceColumn) {
        exprCol.sourceColumn = col.sourceColumn;
      }
      expressionColumns.push(exprCol);
      columnOrder.push(getColumnId(col));
    }
  }

  return { columns, expressionColumns, columnOrder };
}

/**
 * Helper to get all expression column aliases from unified columns.
 * Useful for making expression aliases available in filters/group by/order by.
 *
 * @param unifiedColumns - Array of UnifiedColumn
 * @returns Array of alias strings from expression columns
 */
export function getExpressionAliases(unifiedColumns: UnifiedColumn[]): string[] {
  return unifiedColumns
    .filter((col): col is UnifiedColumn & { type: "expression" } => col.type === "expression")
    .map((col) => col.alias);
}

/**
 * Helper to check if a column ID refers to an expression column.
 *
 * @param id - Column ID from drag-and-drop
 * @returns True if the ID represents an expression column
 */
export function isExpressionId(id: string): boolean {
  return id.startsWith("expr:");
}

/**
 * Helper to check if a column ID refers to a regular column.
 *
 * @param id - Column ID from drag-and-drop
 * @returns True if the ID represents a regular column
 */
export function isRegularColumnId(id: string): boolean {
  return id.startsWith("col:");
}

/**
 * Extracts the actual column name or alias from a prefixed ID.
 *
 * @param id - Prefixed column ID (col:... or expr:...)
 * @returns The column name or alias without prefix
 */
export function getColumnFromId(id: string): string {
  if (id.startsWith("col:")) {
    return id.slice(4);
  }
  if (id.startsWith("expr:")) {
    return id.slice(5);
  }
  return id;
}
