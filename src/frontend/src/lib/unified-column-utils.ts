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
 * Regular columns are added first, followed by expression columns.
 *
 * @param columns - Array of ColumnSelection from QueryConfig
 * @param expressionColumns - Array of ExpressionColumn from QueryConfig (optional)
 * @returns Array of UnifiedColumn for UI state
 */
export function toUnifiedColumns(
  columns: ColumnSelection[],
  expressionColumns?: ExpressionColumn[]
): UnifiedColumn[] {
  const unified: UnifiedColumn[] = [];

  // Add regular columns
  for (const col of columns) {
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
    unified.push(regularCol);
  }

  // Add expression columns
  if (expressionColumns) {
    for (const expr of expressionColumns) {
      const exprCol: UnifiedColumn = {
        type: "expression",
        expression: expr.expression,
        alias: expr.alias,
      };
      if (expr.aggregateFunction) {
        exprCol.aggregateFunction = expr.aggregateFunction;
      }
      unified.push(exprCol);
    }
  }

  return unified;
}

/**
 * Converts unified format back to API format (columns + expressionColumns).
 * Extracts regular columns and expression columns while preserving their properties.
 *
 * Note: The order of regular columns and expression columns in the API format
 * is based on their relative order within each type, not their position in the
 * unified array. The unified array order is used only for display purposes.
 *
 * @param unifiedColumns - Array of UnifiedColumn from UI state
 * @returns Object with columns and expressionColumns arrays
 */
export function fromUnifiedColumns(unifiedColumns: UnifiedColumn[]): {
  columns: ColumnSelection[];
  expressionColumns: ExpressionColumn[];
} {
  const columns: ColumnSelection[] = [];
  const expressionColumns: ExpressionColumn[] = [];

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
    } else {
      const exprCol: ExpressionColumn = {
        expression: col.expression,
        alias: col.alias,
      };
      if (col.aggregateFunction) {
        exprCol.aggregateFunction = col.aggregateFunction;
      }
      expressionColumns.push(exprCol);
    }
  }

  return { columns, expressionColumns };
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
