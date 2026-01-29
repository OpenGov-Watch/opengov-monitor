/**
 * SQL builder module for query builder
 *
 * Contains functions for building SQL query components:
 * SELECT, GROUP BY, ORDER BY, JOIN clauses, and complete query builders.
 */

import type { QueryConfig, FilterCondition, FilterGroup, JoinConfig, FacetQueryConfig } from "../../db/types.js";
import { isSourceAllowed } from "./authorization.js";
import { MAX_ROWS, ALLOWED_AGGREGATES, validateExpression, sanitizeAlias } from "./security.js";
import { getTableColumns, sanitizeColumnName } from "./column-cache.js";
import { isFilterGroup, excludeColumnFromFilterGroup, buildWhereClause } from "./filter-builder.js";

/**
 * Build SELECT clause from QueryConfig.
 */
export function buildSelectClause(config: QueryConfig, availableColumns: string[]): string {
  const parts: string[] = [];
  const hasJoins = config.joins && config.joins.length > 0;

  // Build lookup maps for quick access
  const columnsMap = new Map<string, typeof config.columns[number]>();
  for (const col of config.columns || []) {
    columnsMap.set(`col:${col.column}`, col);
  }

  const expressionsMap = new Map<string, typeof config.expressionColumns extends (infer T)[] | undefined ? T : never>();
  for (const expr of config.expressionColumns || []) {
    expressionsMap.set(`expr:${expr.alias}`, expr);
  }

  // Helper to build a regular column SQL part
  const buildRegularColumnPart = (col: typeof config.columns[number]): string => {
    let columnRef = col.column;
    if (hasJoins && !columnRef.includes('.')) {
      columnRef = `${config.sourceTable}.${columnRef}`;
    }

    const colName = sanitizeColumnName(columnRef, config.sourceTable);
    if (col.aggregateFunction) {
      const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
      const safeAlias = sanitizeAlias(alias);
      return `${col.aggregateFunction}(${colName}) AS "${safeAlias}"`;
    } else {
      const safeAlias = col.alias ? sanitizeAlias(col.alias) : null;
      return safeAlias ? `${colName} AS "${safeAlias}"` : colName;
    }
  };

  // Helper to build an expression column SQL part
  const buildExpressionColumnPart = (expr: NonNullable<typeof config.expressionColumns>[number]): string => {
    const validation = validateExpression(expr.expression, availableColumns);
    if (!validation.valid) {
      throw new Error(`Invalid expression "${expr.alias}": ${validation.error}`);
    }
    const safeAlias = sanitizeAlias(expr.alias);
    if (expr.aggregateFunction) {
      if (!ALLOWED_AGGREGATES.has(expr.aggregateFunction)) {
        throw new Error(`Invalid aggregate function: ${expr.aggregateFunction}`);
      }
      return `${expr.aggregateFunction}((${expr.expression})) AS "${safeAlias}"`;
    } else {
      return `(${expr.expression}) AS "${safeAlias}"`;
    }
  };

  // If columnOrder exists, use it to determine column ordering
  if (config.columnOrder && config.columnOrder.length > 0) {
    const processedIds = new Set<string>();

    for (const id of config.columnOrder) {
      if (id.startsWith('col:')) {
        const col = columnsMap.get(id);
        if (col) {
          parts.push(buildRegularColumnPart(col));
          processedIds.add(id);
        }
      } else if (id.startsWith('expr:')) {
        const expr = expressionsMap.get(id);
        if (expr) {
          parts.push(buildExpressionColumnPart(expr));
          processedIds.add(id);
        }
      }
    }

    // Add any columns not in columnOrder (backward compatibility)
    for (const [id, col] of columnsMap) {
      if (!processedIds.has(id)) {
        parts.push(buildRegularColumnPart(col));
      }
    }
    for (const [id, expr] of expressionsMap) {
      if (!processedIds.has(id)) {
        parts.push(buildExpressionColumnPart(expr));
      }
    }
  } else {
    // Fallback: regular columns first, then expression columns (original behavior)
    for (const col of config.columns || []) {
      parts.push(buildRegularColumnPart(col));
    }
    for (const expr of config.expressionColumns || []) {
      parts.push(buildExpressionColumnPart(expr));
    }
  }

  return parts.join(", ");
}

/**
 * Build GROUP BY clause.
 *
 * When groupBy references an expression column alias, we substitute the actual
 * expression instead of quoting the alias (which SQLite would interpret as a
 * non-existent column name).
 */
export function buildGroupByClause(groupBy?: string[], config?: QueryConfig): string {
  if (!groupBy || groupBy.length === 0) {
    return "";
  }

  // Build lookup for expression columns by alias
  const exprLookup = new Map<string, { expression: string; alias: string }>();
  for (const expr of config?.expressionColumns || []) {
    exprLookup.set(expr.alias, expr);
  }

  return `GROUP BY ${groupBy
    .map((col) => {
      // Check if this is an expression column alias
      const exprDef = exprLookup.get(col);
      if (exprDef) {
        // Use the actual expression (wrapped in parentheses for safety)
        return `(${exprDef.expression})`;
      }
      // Regular column: use existing sanitization
      return sanitizeColumnName(col, config?.sourceTable);
    })
    .join(", ")}`;
}

/**
 * Build ORDER BY clause.
 */
export function buildOrderByClause(
  orderBy?: { column: string; direction: "ASC" | "DESC" }[],
  config?: QueryConfig
): string {
  if (!orderBy || orderBy.length === 0) {
    return "";
  }

  const hasJoins = config?.joins && config.joins.length > 0;

  // Build lookup for columns with aggregate functions
  const columnLookup = new Map<string, { alias?: string; aggregateFunction?: string; column: string }>();
  for (const col of config?.columns || []) {
    // Store by full column name (e.g., "all_spending.DOT_component")
    columnLookup.set(col.column, col);
    // Also store by simple column name (e.g., "DOT_component") for backward compatibility
    if (col.column.includes('.')) {
      const simpleName = col.column.split('.').pop()!;
      columnLookup.set(simpleName, col);
    }
  }

  // Build lookup for expression columns with aggregate functions
  const exprLookup = new Map<string, { alias: string; aggregateFunction?: string }>();
  for (const expr of config?.expressionColumns || []) {
    exprLookup.set(expr.alias, expr);
  }

  return `ORDER BY ${orderBy
    .map((o) => {
      let columnRef = o.column;

      // Check if this column has an aggregate function
      const colDef = columnLookup.get(columnRef);
      if (colDef?.aggregateFunction) {
        // Use the alias for aggregated columns (PostgreSQL requires this)
        const alias = colDef.alias || `${colDef.aggregateFunction.toLowerCase()}_${colDef.column.replace(/[.\s]/g, "_")}`;
        return `"${sanitizeAlias(alias)}" ${o.direction}`;
      }

      // Check if this is an expression column with aggregation
      const exprDef = exprLookup.get(columnRef);
      if (exprDef?.aggregateFunction) {
        return `"${sanitizeAlias(exprDef.alias)}" ${o.direction}`;
      }

      // Non-aggregated column: use the original behavior
      if (hasJoins && config && !columnRef.includes('.')) {
        columnRef = `${config.sourceTable}.${columnRef}`;
      }
      return `${sanitizeColumnName(columnRef, config?.sourceTable)} ${o.direction}`;
    })
    .join(", ")}`;
}

/**
 * Validate JOIN configuration.
 */
export function validateJoinConfig(join: JoinConfig): string | null {
  const allowedTypes = new Set(['LEFT', 'INNER', 'RIGHT']);
  if (!allowedTypes.has(join.type)) {
    return `Invalid join type: ${join.type}`;
  }
  if (!isSourceAllowed(join.table)) {
    return `Invalid join table: ${join.table}`;
  }
  if (!join.on || !join.on.left || !join.on.right) {
    return 'Join condition must have left and right columns';
  }
  return null;
}

/**
 * Build JOIN clause.
 */
export function buildJoinClause(joins?: JoinConfig[]): string {
  if (!joins || joins.length === 0) return "";

  return joins.map((join) => {
    const tableName = sanitizeColumnName(join.table);
    const alias = join.alias || "";
    const tableExpr = alias ? `${tableName} AS ${alias}` : tableName;
    const leftCol = sanitizeColumnName(join.on.left);
    const rightCol = sanitizeColumnName(join.on.right);
    return `${join.type} JOIN ${tableExpr} ON ${leftCol} = ${rightCol}`;
  }).join(" ");
}

/**
 * Build complete query from QueryConfig.
 */
export function buildQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  // Get available columns for expression validation
  const availableColumns = getTableColumns(config.sourceTable);

  const selectClause = buildSelectClause(config, availableColumns);
  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);
  const hasJoins = !!(config.joins && config.joins.length > 0);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable, hasJoins);
  const groupByClause = buildGroupByClause(config.groupBy, config);
  const orderByClause = buildOrderByClause(config.orderBy, config);
  const limit = Math.min(config.limit || MAX_ROWS, MAX_ROWS);

  // Pagination logic: add OFFSET only when server-side pagination is enabled
  const paginationClause = config.offset !== undefined
    ? `LIMIT ${limit} OFFSET ${config.offset}`
    : `LIMIT ${limit}`;

  const sql = [
    `SELECT ${selectClause}`,
    `FROM ${tableName}`,
    joinClause,
    whereClause,
    groupByClause,
    orderByClause,
    paginationClause,
  ]
    .filter(Boolean)
    .join(" ");

  return { sql, params };
}

/**
 * Build count query from QueryConfig.
 */
export function buildCountQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);
  const hasJoins = !!(config.joins && config.joins.length > 0);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable, hasJoins);
  const groupByClause = buildGroupByClause(config.groupBy, config);

  // When GROUP BY is present, count distinct groups instead of raw rows
  if (groupByClause) {
    const innerSql = [
      `SELECT 1`,
      `FROM ${tableName}`,
      joinClause,
      whereClause,
      groupByClause,
    ]
      .filter(Boolean)
      .join(" ");

    return { sql: `SELECT COUNT(*) as total FROM (${innerSql})`, params };
  }

  const sql = [
    `SELECT COUNT(*) as total`,
    `FROM ${tableName}`,
    joinClause,
    whereClause,
  ]
    .filter(Boolean)
    .join(" ");

  return { sql, params };
}

/**
 * Build facet query for a specific column.
 */
export function buildFacetQuery(
  config: FacetQueryConfig,
  columnName: string
): { sql: string; params: (string | number)[] } {
  // Validate column exists in source table or is a joined column (has table/alias prefix)
  const hasTablePrefix = columnName.includes('.');
  if (!hasTablePrefix) {
    const availableColumns = getTableColumns(config.sourceTable);
    if (!availableColumns.includes(columnName)) {
      throw new Error(`Column ${columnName} not found in table ${config.sourceTable}`);
    }
  }
  // For prefixed columns (e.g., "c.category"), we trust the caller provided valid JOINs
  // The SQL will fail naturally if the column/alias doesn't exist

  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);

  // Build WHERE clause but exclude filter for the faceted column itself
  // This ensures facet counts reflect all possible values, not just filtered ones
  let filtersExcludingFacetedColumn: FilterCondition[] | FilterGroup;

  if (config.filters && isFilterGroup(config.filters)) {
    // FilterGroup case: recursively remove conditions matching faceted column
    filtersExcludingFacetedColumn = excludeColumnFromFilterGroup(
      config.filters,
      columnName
    );
  } else {
    // Array case (backward compatibility)
    filtersExcludingFacetedColumn = (config.filters || []).filter(
      (filter) => filter.column !== columnName
    );
  }

  const hasJoins = !!(config.joins && config.joins.length > 0);
  const { clause: whereClause, params } = buildWhereClause(
    filtersExcludingFacetedColumn,
    config.sourceTable,
    hasJoins
  );

  const colName = sanitizeColumnName(columnName, config.sourceTable);

  const sql = [
    `SELECT ${colName}, COUNT(*) as count`,
    `FROM ${tableName}`,
    joinClause,
    whereClause,
    `GROUP BY ${colName}`,
    `ORDER BY ${colName}`,
  ]
    .filter(Boolean)
    .join(" ");

  return { sql, params };
}
