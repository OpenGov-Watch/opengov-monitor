import { Router } from "express";
import { getDatabase } from "../db/index.js";
import type { QueryConfig, FilterCondition, ExpressionColumn } from "../db/types.js";

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
  "bounties",
  "subtreasury",
  "Fellowship Subtreasury",
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

  return null;
}

function sanitizeColumnName(name: string): string {
  if (!/^[a-zA-Z0-9_.\s]+$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return `"${name}"`;
}

function buildSelectClause(config: QueryConfig, availableColumns: string[]): string {
  const parts: string[] = [];

  // Regular columns
  for (const col of config.columns || []) {
    const colName = sanitizeColumnName(col.column);
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
  filters: FilterCondition[]
): { clause: string; params: (string | number)[] } {
  if (!filters || filters.length === 0) {
    return { clause: "", params: [] };
  }

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const filter of filters) {
    const colName = sanitizeColumnName(filter.column);

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

function buildGroupByClause(groupBy?: string[]): string {
  if (!groupBy || groupBy.length === 0) {
    return "";
  }
  return `GROUP BY ${groupBy.map((col) => sanitizeColumnName(col)).join(", ")}`;
}

function buildOrderByClause(orderBy?: { column: string; direction: "ASC" | "DESC" }[]): string {
  if (!orderBy || orderBy.length === 0) {
    return "";
  }
  return `ORDER BY ${orderBy
    .map((o) => `${sanitizeColumnName(o.column)} ${o.direction}`)
    .join(", ")}`;
}

function buildQuery(config: QueryConfig): { sql: string; params: (string | number)[] } {
  // Get available columns for expression validation
  const availableColumns = getTableColumns(config.sourceTable);

  const selectClause = buildSelectClause(config, availableColumns);
  const tableName = `"${config.sourceTable}"`;
  const { clause: whereClause, params } = buildWhereClause(config.filters || []);
  const groupByClause = buildGroupByClause(config.groupBy);
  const orderByClause = buildOrderByClause(config.orderBy);
  const limit = Math.min(config.limit || MAX_ROWS, MAX_ROWS);

  const sql = [
    `SELECT ${selectClause}`,
    `FROM ${tableName}`,
    whereClause,
    groupByClause,
    orderByClause,
    `LIMIT ${limit}`,
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
    const { sql, params } = buildQuery(config);
    const results = db.prepare(sql).all(...params);

    res.json({
      data: results,
      rowCount: results.length,
      sql: sql,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
