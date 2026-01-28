/**
 * Column cache module for query builder
 *
 * Manages column metadata and type caching for tables/views.
 * Provides helpers for column name sanitization.
 */

import { getDatabase } from "../../db/index.js";
import { isValidTableName } from "./security.js";

// Cache for column type information
const columnTypeCache = new Map<string, Map<string, string>>();

/**
 * Get all column names for a table.
 */
export function getTableColumns(tableName: string): string[] {
  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  const db = getDatabase();
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as { name: string }[];
  return columns.map((c) => c.name);
}

/**
 * Get column types for a table, with caching.
 */
export function getColumnTypes(tableName: string): Map<string, string> {
  if (columnTypeCache.has(tableName)) {
    return columnTypeCache.get(tableName)!;
  }

  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }

  const db = getDatabase();
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as { name: string; type: string }[];

  const typeMap = new Map<string, string>();
  for (const col of columns) {
    typeMap.set(col.name, col.type.toUpperCase());
  }

  columnTypeCache.set(tableName, typeMap);
  return typeMap;
}

/**
 * Get the type of a specific column, handling table.column references.
 */
export function getColumnType(columnRef: string, sourceTable: string): string | undefined {
  const lastDotIndex = columnRef.lastIndexOf('.');
  let tableName = sourceTable;
  let columnName = columnRef;

  if (lastDotIndex > 0 && lastDotIndex < columnRef.length - 1) {
    tableName = columnRef.substring(0, lastDotIndex);
    columnName = columnRef.substring(lastDotIndex + 1);
  }

  try {
    const types = getColumnTypes(tableName);
    return types.get(columnName);
  } catch {
    return undefined;
  }
}

/**
 * Sanitize a column name for safe use in SQL queries.
 * Handles both simple column names and table.column references.
 */
export function sanitizeColumnName(name: string, sourceTable?: string): string {
  if (!/^[a-zA-Z0-9_.\s]+$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }

  // Handle table.column format (e.g., "Referenda.id" or "c.category")
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < name.length - 1) {
    // Check if this might be a column-with-dots by seeing if it exists in source table
    if (sourceTable) {
      try {
        const availableColumns = getTableColumns(sourceTable);
        if (availableColumns.includes(name)) {
          // It's a column name with dots, quote the whole thing
          return `"${name}"`;
        }
      } catch {
        // If we can't get columns, proceed with table.column logic
      }
    }

    // It's a table.column reference, quote separately: "Referenda"."id"
    const tablePart = name.substring(0, lastDotIndex);
    const columnPart = name.substring(lastDotIndex + 1);
    return `"${tablePart}"."${columnPart}"`;
  }

  return `"${name}"`;
}
