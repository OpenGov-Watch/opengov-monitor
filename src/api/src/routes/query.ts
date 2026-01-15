import { Router } from "express";
import { getDatabase } from "../db/index.js";
import type { QueryConfig, FilterCondition, ExpressionColumn, JoinConfig, FacetQueryConfig, FacetValue, FacetQueryResponse } from "../db/types.js";

export const queryRouter: Router = Router();

// Whitelist of tables/views that can be queried
const ALLOWED_SOURCES = new Set([
  "Referenda",
  "Treasury",
  "Child Bounties",
  "Fellowship",
  "Fellowship Salary Cycles",
  "Fellowship Salary Claimants",
  "categories",
  "Categories",  // For JOINs
  "bounties",
  "Bounties",    // For JOINs
  "subtreasury",
  "Fellowship Subtreasury",
  "Treasury Netflows",
  "outstanding_claims",
  "expired_claims",
  "all_spending",
]);

const ALLOWED_TABLES = [
  "Referenda",
  "Treasury",
  "Child Bounties",
  "Fellowship",
  "Fellowship Salary Cycles",
  "Fellowship Salary Claimants",
  "categories",
  "bounties",
  "subtreasury",
  "Fellowship Subtreasury",
  "Treasury Netflows",
];

const ALLOWED_VIEWS = [
  "outstanding_claims",
  "expired_claims",
  "all_spending",
];

const MAX_ROWS = 10000;
const ALLOWED_OPERATORS = new Set([
  "=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL",
]);
const ALLOWED_AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX"]);

// Expression column validation
const MAX_EXPRESSION_LENGTH = 500;

// Allowed SQL functions in expressions
const ALLOWED_EXPRESSION_FUNCTIONS = new Set([
  // Math functions
  "ABS", "ROUND", "CEIL", "FLOOR", "MAX", "MIN", "AVG", "SUM", "COUNT",
  "TOTAL", "RANDOM", "ZEROBLOB",
  // String functions
  "UPPER", "LOWER", "LENGTH", "SUBSTR", "SUBSTRING", "TRIM", "LTRIM", "RTRIM",
  "REPLACE", "INSTR", "PRINTF", "QUOTE", "HEX", "UNHEX", "UNICODE", "CHAR",
  "GLOB", "LIKE",
  // Null handling
  "COALESCE", "NULLIF", "IFNULL",
  // Conditional
  "CASE", "WHEN", "THEN", "ELSE", "END", "IIF",
  // Type conversion
  "CAST", "TYPEOF",
  // Date functions (SQLite)
  "DATE", "TIME", "DATETIME", "JULIANDAY", "STRFTIME", "UNIXEPOCH",
  // Aggregate window functions
  "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD",
  "FIRST_VALUE", "LAST_VALUE", "NTH_VALUE",
  // JSON functions
  "JSON", "JSON_ARRAY", "JSON_EXTRACT", "JSON_OBJECT", "JSON_TYPE",
]);

// SQL keywords that are allowed in expressions
const ALLOWED_SQL_KEYWORDS = new Set([
  "AS", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN",
  "TRUE", "FALSE", "ASC", "DESC", "OVER", "PARTITION", "BY", "ORDER",
  "DISTINCT", "ALL", "ESCAPE",
]);

// Blocked patterns that indicate SQL injection attempts
const BLOCKED_PATTERNS: { pattern: RegExp; description: string }[] = [
  { pattern: /;\s*$/, description: "Trailing semicolon" },
  { pattern: /;(?!\s*$)/, description: "Semicolon in expression" },
  { pattern: /--/, description: "SQL comment" },
  { pattern: /\/\*/, description: "Block comment" },
  { pattern: /\bUNION\b/i, description: "UNION keyword" },
  { pattern: /\bSELECT\b/i, description: "SELECT keyword" },
  { pattern: /\bINSERT\b/i, description: "INSERT keyword" },
  { pattern: /\bUPDATE\b/i, description: "UPDATE keyword" },
  { pattern: /\bDELETE\b/i, description: "DELETE keyword" },
  { pattern: /\bDROP\b/i, description: "DROP keyword" },
  { pattern: /\bCREATE\b/i, description: "CREATE keyword" },
  { pattern: /\bALTER\b/i, description: "ALTER keyword" },
  { pattern: /\bEXEC\b/i, description: "EXEC keyword" },
  { pattern: /\bATTACH\b/i, description: "ATTACH keyword" },
  { pattern: /\bDETACH\b/i, description: "DETACH keyword" },
  { pattern: /\bPRAGMA\b/i, description: "PRAGMA keyword" },
  { pattern: /\bVACUUM\b/i, description: "VACUUM keyword" },
  { pattern: /\bREINDEX\b/i, description: "REINDEX keyword" },
];

function getTableColumns(tableName: string): string[] {
  const db = getDatabase();
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as { name: string }[];
  return columns.map((c) => c.name);
}

function validateExpression(
  expression: string,
  availableColumns: string[]
): { valid: boolean; error?: string } {
  // Check expression length
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    return { valid: false, error: `Expression too long (max ${MAX_EXPRESSION_LENGTH} characters)` };
  }

  // Check for blocked patterns
  for (const { pattern, description } of BLOCKED_PATTERNS) {
    if (pattern.test(expression)) {
      return { valid: false, error: `Expression contains blocked pattern: ${description}` };
    }
  }

  // Remove string literals before extracting identifiers
  // This prevents 'Executed', 'large', 'small' etc from being validated as columns
  const exprWithoutStrings = expression.replace(/'[^']*'/g, "''");

  // Extract and validate identifiers (column references)
  // Matches: "quoted identifiers" or bare_identifiers
  const identifierPattern = /"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_.]*)/g;
  let match;
  while ((match = identifierPattern.exec(exprWithoutStrings)) !== null) {
    const identifier = match[1] || match[2];

    // Skip if it's an allowed function (case-insensitive)
    if (ALLOWED_EXPRESSION_FUNCTIONS.has(identifier.toUpperCase())) {
      continue;
    }

    // Skip SQL keywords
    if (ALLOWED_SQL_KEYWORDS.has(identifier.toUpperCase())) {
      continue;
    }

    // Skip numeric literals that look like identifiers (e.g., part of a number)
    if (/^\d+$/.test(identifier)) {
      continue;
    }

    // Must be a valid column name from the selected table
    if (!availableColumns.includes(identifier)) {
      return { valid: false, error: `Unknown column or function: ${identifier}` };
    }
  }

  return { valid: true };
}

function sanitizeAlias(alias: string): string {
  // Aliases must be simple identifiers (alphanumeric + underscore, starting with letter/underscore)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias)) {
    throw new Error(`Invalid alias: ${alias}. Use only letters, numbers, and underscores.`);
  }
  return alias;
}

function validateQueryConfig(config: QueryConfig): string | null {
  if (!config.sourceTable || !ALLOWED_SOURCES.has(config.sourceTable)) {
    return `Invalid source table: ${config.sourceTable}`;
  }

  // Must have at least one column or expression column
  const hasColumns = config.columns && config.columns.length > 0;
  const hasExpressions = config.expressionColumns && config.expressionColumns.length > 0;
  if (!hasColumns && !hasExpressions) {
    return "At least one column or expression must be selected";
  }

  for (const col of config.columns || []) {
    if (col.aggregateFunction && !ALLOWED_AGGREGATES.has(col.aggregateFunction)) {
      return `Invalid aggregate function: ${col.aggregateFunction}`;
    }
  }

  for (const filter of config.filters || []) {
    if (!ALLOWED_OPERATORS.has(filter.operator)) {
      return `Invalid operator: ${filter.operator}`;
    }
  }

  // Validate expression columns
  for (const expr of config.expressionColumns || []) {
    if (!expr.alias || !expr.alias.trim()) {
      return "Expression columns must have an alias";
    }
    if (!expr.expression || !expr.expression.trim()) {
      return "Expression cannot be empty";
    }
    try {
      sanitizeAlias(expr.alias);
    } catch {
      return `Invalid expression alias: ${expr.alias}. Use only letters, numbers, and underscores.`;
    }
  }

  // Validate joins
  for (const join of config.joins || []) {
    const joinError = validateJoinConfig(join);
    if (joinError) {
      return joinError;
    }
  }

  return null;
}

function sanitizeColumnName(name: string, sourceTable?: string): string {
  if (!/^[a-zA-Z0-9_.\s]+$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }

  // Handle table.column format (e.g., "Referenda.id" or "c.category")
  // But NOT columns with dots in their names (e.g., "tally.ayes")
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

function buildSelectClause(config: QueryConfig, availableColumns: string[]): string {
  const parts: string[] = [];
  const hasJoins = config.joins && config.joins.length > 0;

  // Regular columns
  for (const col of config.columns || []) {
    // If column doesn't have a table prefix (no dot before last segment) and we have JOINs,
    // prefix with source table to avoid ambiguity
    let columnRef = col.column;
    if (hasJoins && !columnRef.includes('.')) {
      // Column from source table without prefix - add table name
      columnRef = `${config.sourceTable}.${columnRef}`;
    }

    const colName = sanitizeColumnName(columnRef, config.sourceTable);
    if (col.aggregateFunction) {
      const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
      const safeAlias = sanitizeAlias(alias);
      parts.push(`${col.aggregateFunction}(${colName}) AS "${safeAlias}"`);
    } else {
      const safeAlias = col.alias ? sanitizeAlias(col.alias) : null;
      parts.push(safeAlias ? `${colName} AS "${safeAlias}"` : colName);
    }
  }

  // Expression columns
  for (const expr of config.expressionColumns || []) {
    const validation = validateExpression(expr.expression, availableColumns);
    if (!validation.valid) {
      throw new Error(`Invalid expression "${expr.alias}": ${validation.error}`);
    }
    const safeAlias = sanitizeAlias(expr.alias);
    parts.push(`(${expr.expression}) AS "${safeAlias}"`);
  }

  return parts.join(", ");
}

function buildWhereClause(
  filters: FilterCondition[],
  sourceTable?: string
): { clause: string; params: (string | number)[] } {
  if (!filters || filters.length === 0) {
    return { clause: "", params: [] };
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const filter of filters) {
    const colName = sanitizeColumnName(filter.column, sourceTable);

    switch (filter.operator) {
      case "IS NULL":
        conditions.push(`${colName} IS NULL`);
        break;
      case "IS NOT NULL":
        conditions.push(`${colName} IS NOT NULL`);
        break;
      case "IN":
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => "?").join(", ");
          conditions.push(`${colName} IN (${placeholders})`);
          params.push(...filter.value);
        }
        break;
      default:
        conditions.push(`${colName} ${filter.operator} ?`);
        params.push(filter.value as string | number);
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function buildGroupByClause(groupBy?: string[], sourceTable?: string): string {
  if (!groupBy || groupBy.length === 0) {
    return "";
  }
  return `GROUP BY ${groupBy.map((col) => sanitizeColumnName(col, sourceTable)).join(", ")}`;
}

function buildOrderByClause(
  orderBy?: { column: string; direction: "ASC" | "DESC" }[],
  config?: QueryConfig
): string {
  if (!orderBy || orderBy.length === 0) {
    return "";
  }

  const hasJoins = config?.joins && config.joins.length > 0;

  return `ORDER BY ${orderBy
    .map((o) => {
      let columnRef = o.column;
      // Prefix with source table if no prefix and JOINs present
      if (hasJoins && config && !columnRef.includes('.')) {
        columnRef = `${config.sourceTable}.${columnRef}`;
      }
      return `${sanitizeColumnName(columnRef, config?.sourceTable)} ${o.direction}`;
    })
    .join(", ")}`;
}

function validateJoinConfig(join: JoinConfig): string | null {
  const allowedTypes = new Set(['LEFT', 'INNER', 'RIGHT']);
  if (!allowedTypes.has(join.type)) {
    return `Invalid join type: ${join.type}`;
  }
  if (!ALLOWED_SOURCES.has(join.table)) {
    return `Invalid join table: ${join.table}`;
  }
  if (!join.on || !join.on.left || !join.on.right) {
    return 'Join condition must have left and right columns';
  }
  return null;
}

function buildJoinClause(joins?: JoinConfig[]): string {
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

function buildQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  // Get available columns for expression validation
  const availableColumns = getTableColumns(config.sourceTable);

  const selectClause = buildSelectClause(config, availableColumns);
  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable);
  const groupByClause = buildGroupByClause(config.groupBy, config.sourceTable);
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

function buildCountQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable);

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

function buildFacetQuery(
  config: FacetQueryConfig,
  columnName: string
): { sql: string; params: (string | number)[] } {
  // Validate column exists in source table
  const availableColumns = getTableColumns(config.sourceTable);
  if (!availableColumns.includes(columnName)) {
    throw new Error(`Column ${columnName} not found in table ${config.sourceTable}`);
  }

  const tableName = `"${config.sourceTable}"`;
  const joinClause = buildJoinClause(config.joins);

  // Build WHERE clause but exclude filter for the faceted column itself
  // This ensures facet counts reflect all possible values, not just filtered ones
  const filtersExcludingFacetedColumn = (config.filters || []).filter(
    (filter) => filter.column !== columnName
  );
  const { clause: whereClause, params } = buildWhereClause(
    filtersExcludingFacetedColumn,
    config.sourceTable
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

// GET /api/query/schema - Get database schema for query builder
queryRouter.get("/schema", (_req, res) => {
  try {
    const db = getDatabase();

    const tablesAndViews = db
      .prepare(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'view')
         AND name NOT LIKE 'sqlite_%'
         ORDER BY type, name`
      )
      .all() as { name: string; type: string }[];

    const result: { name: string; columns: { name: string; type: string; nullable: boolean }[] }[] = [];

    for (const item of tablesAndViews) {
      const isAllowedTable = ALLOWED_TABLES.includes(item.name);
      const isAllowedView = ALLOWED_VIEWS.includes(item.name);

      if (!isAllowedTable && !isAllowedView) {
        continue;
      }

      const columns = db
        .prepare(`PRAGMA table_info("${item.name}")`)
        .all() as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[];

      result.push({
        name: item.name,
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
        })),
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/query/execute - Execute a query
queryRouter.post("/execute", (req, res) => {
  try {
    const config = req.body as QueryConfig;

    const validationError = validateQueryConfig(config);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const db = getDatabase();

    // If offset is present, perform server-side pagination with count query
    let totalCount: number | undefined;
    if (config.offset !== undefined) {
      const { sql: countSql, params: countParams } = buildCountQuery(config);
      const countResult = db.prepare(countSql).get(...countParams) as { total: number };
      totalCount = countResult.total;
    }

    const { sql, params } = buildQuery(config);
    const results = db.prepare(sql).all(...params);

    res.json({
      data: results,
      rowCount: results.length,
      totalCount,  // undefined for non-paginated queries (dashboard mode)
      sql: sql,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/query/facets - Get distinct values + counts for faceted columns
queryRouter.post("/facets", (req, res) => {
  try {
    const config = req.body as FacetQueryConfig;

    // Validate source table
    if (!config.sourceTable || !ALLOWED_SOURCES.has(config.sourceTable)) {
      res.status(400).json({ error: `Invalid source table: ${config.sourceTable}` });
      return;
    }

    // Validate columns array
    if (!config.columns || !Array.isArray(config.columns) || config.columns.length === 0) {
      res.status(400).json({ error: "At least one column must be specified" });
      return;
    }

    // Validate joins if present
    if (config.joins) {
      for (const join of config.joins) {
        const joinError = validateJoinConfig(join);
        if (joinError) {
          res.status(400).json({ error: joinError });
          return;
        }
      }
    }

    // Validate filters if present
    if (config.filters) {
      for (const filter of config.filters) {
        if (!ALLOWED_OPERATORS.has(filter.operator)) {
          res.status(400).json({ error: `Invalid operator: ${filter.operator}` });
          return;
        }
      }
    }

    const db = getDatabase();
    const facets: Record<string, FacetValue[]> = {};

    // For each column, build and execute facet query
    for (const columnName of config.columns) {
      try {
        const { sql, params } = buildFacetQuery(config, columnName);
        const results = db.prepare(sql).all(...params) as Array<{ [key: string]: string | number; count: number }>;

        // Convert results to FacetValue format
        // The first column in results is the faceted column value, second is count
        facets[columnName] = results.map((row) => {
          // Get the column value (it's the first property that's not "count")
          const valueKey = Object.keys(row).find((key) => key !== "count");
          const value = valueKey ? row[valueKey] : null;
          return {
            value: value as string | number,
            count: row.count,
          };
        });
      } catch (error) {
        res.status(400).json({ error: `Error computing facets for column ${columnName}: ${(error as Error).message}` });
        return;
      }
    }

    const response: FacetQueryResponse = { facets };
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
