import { getDatabase } from "./index.js";
import {
  compileAdvancedFilters,
  compileSortConditions,
  validateGroupBy,
} from "./filter-compiler.js";
import type { AdvancedFilterGroup, SortCondition } from "./types.js";

export interface TableQueryOptions {
  filters?: AdvancedFilterGroup;
  sorts?: SortCondition[];
  groupBy?: string;
  limit?: number;
  offset?: number;
}

/**
 * Gets the column names for a given table or view.
 */
export function getTableColumns(tableName: string): string[] {
  const db = getDatabase();
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as { name: string }[];
  return columns.map((c) => c.name);
}

/**
 * Builds and executes a SELECT query with advanced filtering, sorting, and grouping.
 */
export function buildTableQuery<T>(
  tableName: string,
  options: TableQueryOptions = {}
): { data: T[]; sql: string; params: (string | number)[] } {
  const db = getDatabase();
  const availableColumns = getTableColumns(tableName);

  // Build WHERE clause
  const { clause: whereClause, params } = compileAdvancedFilters(options.filters, availableColumns);

  // Build ORDER BY clause
  const orderByClause = compileSortConditions(options.sorts, availableColumns);

  // Build GROUP BY clause
  const groupByColumn = validateGroupBy(options.groupBy, availableColumns);

  // Build the full query
  const sqlParts: string[] = [`SELECT * FROM "${tableName}"`];

  if (whereClause) {
    sqlParts.push(`WHERE ${whereClause}`);
  }

  if (groupByColumn) {
    sqlParts.push(`GROUP BY ${groupByColumn}`);
  }

  if (orderByClause) {
    sqlParts.push(`ORDER BY ${orderByClause}`);
  }

  // Apply limit and offset
  const limit = Math.min(options.limit || 10000, 10000);
  sqlParts.push(`LIMIT ${limit}`);

  if (options.offset && options.offset > 0) {
    sqlParts.push(`OFFSET ${options.offset}`);
  }

  const sql = sqlParts.join(" ");

  // Execute query
  const data = db.prepare(sql).all(...params) as T[];

  return { data, sql, params };
}

/**
 * Parses query parameters from request and returns TableQueryOptions.
 */
export function parseTableQueryParams(query: {
  filters?: string;
  sorts?: string;
  groupBy?: string;
  limit?: string;
  offset?: string;
}): TableQueryOptions {
  const options: TableQueryOptions = {};

  // Parse filters
  if (query.filters) {
    try {
      const parsed = JSON.parse(query.filters);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "combinator" in parsed &&
        "conditions" in parsed
      ) {
        options.filters = parsed as AdvancedFilterGroup;
      } else {
        throw new Error("Invalid filter format");
      }
    } catch (error) {
      throw new Error(`Failed to parse filters: ${(error as Error).message}`);
    }
  }

  // Parse sorts
  if (query.sorts) {
    try {
      const parsed = JSON.parse(query.sorts);
      if (Array.isArray(parsed)) {
        options.sorts = parsed as SortCondition[];
      } else {
        throw new Error("Sorts must be an array");
      }
    } catch (error) {
      throw new Error(`Failed to parse sorts: ${(error as Error).message}`);
    }
  }

  // Parse groupBy
  if (query.groupBy) {
    options.groupBy = query.groupBy;
  }

  // Parse limit
  if (query.limit) {
    const limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1) {
      throw new Error("Invalid limit value");
    }
    options.limit = limit;
  }

  // Parse offset
  if (query.offset) {
    const offset = parseInt(query.offset, 10);
    if (isNaN(offset) || offset < 0) {
      throw new Error("Invalid offset value");
    }
    options.offset = offset;
  }

  return options;
}
