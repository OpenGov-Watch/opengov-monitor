/**
 * Column Metadata
 *
 * Provides column type information for filtering behavior.
 * Uses the unified column configuration from column-renderer.ts.
 */
import { getColumnConfig, ColumnType } from "./column-renderer";

// Re-export ColumnType for consumers
export type { ColumnType };

/**
 * Check if a string looks like a table name.
 * Table names are either PascalCase (Referenda) or snake_case (all_spending).
 */
function looksLikeTableName(name: string): boolean {
  if (!name) return false;
  // Table names start with uppercase (Referenda) or contain underscore (all_spending)
  return name[0] === name[0].toUpperCase() || name.includes("_");
}

/**
 * Extract bare column name from table-prefixed name
 * e.g., "Referenda.track" → "track"
 */
export function extractColumnName(fullColumnName: string): string {
  const dotIndex = fullColumnName.indexOf(".");
  if (dotIndex < 0) return fullColumnName;

  const firstPart = fullColumnName.substring(0, dotIndex);
  // Only split if first part looks like a table name
  if (looksLikeTableName(firstPart)) {
    return fullColumnName.substring(dotIndex + 1);
  }
  return fullColumnName;
}

/**
 * Extract table name from table-prefixed column name
 * e.g., "Referenda.track" → "Referenda"
 */
export function extractTableName(fullColumnName: string): string {
  const dotIndex = fullColumnName.indexOf(".");
  if (dotIndex < 0) return "";

  const firstPart = fullColumnName.substring(0, dotIndex);
  // Only extract if first part looks like a table name
  if (looksLikeTableName(firstPart)) {
    return firstPart;
  }
  return "";
}

/**
 * Get the column type from config.
 * Handles table-prefixed columns (e.g., "Referenda.track").
 */
export function getColumnType(columnName: string): ColumnType {
  const bareColumn = extractColumnName(columnName);
  const tableName = extractTableName(columnName);
  const config = getColumnConfig(tableName, bareColumn);
  return config.type || "text";
}

/**
 * Check if column is categorical (for filter UI decisions).
 * Categorical columns use multiselect dropdowns and IN/NOT IN operators.
 */
export function isCategoricalColumn(columnName: string): boolean {
  return getColumnType(columnName) === "categorical";
}

/**
 * Get available operators for a column type
 */
export function getOperatorsForColumnType(columnType: ColumnType): string[] {
  switch (columnType) {
    case "categorical":
      return ["IN", "NOT IN", "IS NULL", "IS NOT NULL"];
    case "currency":
    case "numeric":
      return ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"];
    case "date":
      return ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"];
    case "link":
    case "address":
      return ["=", "!=", "LIKE", "IS NULL", "IS NOT NULL"];
    case "text_long":
      return ["IS NULL", "IS NOT NULL"];
    case "text":
    default:
      return ["=", "!=", ">", "<", ">=", "<=", "LIKE", "IS NULL", "IS NOT NULL"];
  }
}
