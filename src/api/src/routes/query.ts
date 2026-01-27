import { Router } from "express";
import { getDatabase } from "../db/index.js";
import { getCustomTableNames } from "../db/queries.js";
import type { QueryConfig, FilterCondition, FilterGroup, ExpressionColumn, JoinConfig, FacetQueryConfig, FacetValue, FacetQueryResponse } from "../db/types.js";
import { QUERYABLE_TABLE_NAMES, QUERYABLE_VIEW_NAMES } from "../db/types.js";

export const queryRouter: Router = Router();

// Derive allowlists from constants - no hardcoded table names
const BASE_ALLOWED_TABLES = [...QUERYABLE_TABLE_NAMES];
const ALLOWED_VIEWS = [...QUERYABLE_VIEW_NAMES];
const BASE_ALLOWED_SOURCES = [...BASE_ALLOWED_TABLES, ...ALLOWED_VIEWS];

// Dynamic function to get all allowed sources including custom tables
function getAllowedSources(): Set<string> {
  const customTables = getCustomTableNames();
  return new Set([...BASE_ALLOWED_SOURCES, ...customTables]);
}

// Dynamic function to get all allowed tables including custom tables
function getAllowedTables(): string[] {
  const customTables = getCustomTableNames();
  return [...BASE_ALLOWED_TABLES, ...customTables];
}

// Helper to check if a source is allowed
function isSourceAllowed(source: string): boolean {
  return getAllowedSources().has(source);
}

const MAX_ROWS = 10000;
const ALLOWED_OPERATORS = new Set([
  "=", "!=", ">", "<", ">=", "<=", "LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL",
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
  { pattern: /\bload_extension\b/i, description: "load_extension function" },
  { pattern: /\bfts3_tokenizer\b/i, description: "fts3_tokenizer function" },
  { pattern: /\bTRUNCATE\b/i, description: "TRUNCATE keyword" },
  { pattern: /\bwritefile\b/i, description: "writefile function" },
];

/**
 * Validate table name format to prevent SQL injection in PRAGMA calls.
 * Table names must be alphanumeric with underscores/spaces, max 128 chars.
 */
function isValidTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(name) && name.length <= 128;
}

function getTableColumns(tableName: string): string[] {
  if (!isValidTableName(tableName)) {
    throw new Error(`Invalid table name format: ${tableName}`);
  }
  const db = getDatabase();
  const columns = db
    .prepare(`PRAGMA table_info("${tableName}")`)
    .all() as { name: string }[];
  return columns.map((c) => c.name);
}

// Cache for column type information
const columnTypeCache = new Map<string, Map<string, string>>();

function getColumnTypes(tableName: string): Map<string, string> {
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

// Get the column type, handling table.column references
function getColumnType(columnRef: string, sourceTable: string): string | undefined {
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
  // Auto-sanitize aliases to valid SQL identifiers
  // Replace any invalid characters (spaces, special chars) with underscores
  let sanitized = alias.replace(/[^a-zA-Z0-9_]/g, "_");
  // Ensure it starts with a letter or underscore
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
}

function validateQueryConfig(config: QueryConfig): string | null {
  if (!config.sourceTable || !isSourceAllowed(config.sourceTable)) {
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

  // Validate filters (supports both FilterCondition[] and FilterGroup)
  if (config.filters) {
    const filterError = validateFilterOperators(config.filters);
    if (filterError) {
      return filterError;
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
    // Note: sanitizeAlias now auto-sanitizes, so no validation error needed
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

// Helper function to check if filters is a FilterGroup
function isFilterGroup(filters: FilterCondition[] | FilterGroup): filters is FilterGroup {
  return !Array.isArray(filters) && 'operator' in filters && 'conditions' in filters;
}

// Helper function to recursively remove a column from FilterGroup
function excludeColumnFromFilterGroup(
  group: FilterGroup,
  columnName: string
): FilterGroup {
  const filteredConditions: (FilterCondition | FilterGroup)[] = [];

  for (const condition of group.conditions) {
    if (isFilterGroup(condition)) {
      // Recursive case: nested FilterGroup
      const filteredSubGroup = excludeColumnFromFilterGroup(condition, columnName);
      // Only include the subgroup if it has conditions
      if (filteredSubGroup.conditions.length > 0) {
        filteredConditions.push(filteredSubGroup);
      }
    } else {
      // Base case: FilterCondition - only include if not the excluded column
      if (condition.column !== columnName) {
        filteredConditions.push(condition);
      }
    }
  }

  return {
    operator: group.operator,
    conditions: filteredConditions
  };
}

// Helper function to recursively validate filter operators
function validateFilterOperators(filters: FilterCondition[] | FilterGroup): string | null {
  if (isFilterGroup(filters)) {
    // FilterGroup case: validate all conditions recursively
    for (const condition of filters.conditions) {
      if (isFilterGroup(condition)) {
        const error = validateFilterOperators(condition);
        if (error) return error;
      } else {
        // FilterCondition: validate operator
        if (!ALLOWED_OPERATORS.has(condition.operator)) {
          return `Invalid operator: ${condition.operator}`;
        }
      }
    }
  } else {
    // Array case: validate each filter
    for (const filter of filters) {
      if (!ALLOWED_OPERATORS.has(filter.operator)) {
        return `Invalid operator: ${filter.operator}`;
      }
    }
  }
  return null;
}

// Helper to coerce filter value to match column type
// SQLite TEXT columns don't match against numeric values, so we convert numbers to strings
// For views, columns may have empty type info, so we convert numbers to strings as a safe default
function coerceFilterValue(value: string | number, columnType: string | undefined): string | number {
  if (typeof value === 'number') {
    // Convert to string if:
    // 1. Column is TEXT type
    // 2. Column type is empty/unknown (common for view columns)
    // 3. Column type is undefined
    // SQLite's loose typing handles string-to-number comparisons for numeric columns
    if (!columnType || columnType === '' || columnType.includes('TEXT')) {
      return String(value);
    }
  }
  return value;
}

// Recursive function to build condition from a single FilterCondition
function buildSingleCondition(
  filter: FilterCondition,
  sourceTable: string | undefined,
  params: (string | number)[],
  hasJoins: boolean
): string {
  // If we have JOINs and the column doesn't have a table prefix, add the source table prefix
  // This prevents "ambiguous column name" errors when multiple joined tables have the same column
  let columnRef = filter.column;
  if (hasJoins && sourceTable && !columnRef.includes('.')) {
    columnRef = `${sourceTable}.${columnRef}`;
  }

  const colName = sanitizeColumnName(columnRef, sourceTable);

  // Get column type for value coercion
  const columnType = sourceTable ? getColumnType(columnRef, sourceTable) : undefined;

  switch (filter.operator) {
    case "IS NULL":
      return `${colName} IS NULL`;
    case "IS NOT NULL":
      return `${colName} IS NOT NULL`;
    case "IN":
      if (Array.isArray(filter.value) && filter.value.length > 0) {
        const placeholders = filter.value.map(() => "?").join(", ");
        const coercedValues = filter.value.map(v => coerceFilterValue(v, columnType));
        params.push(...coercedValues);
        return `${colName} IN (${placeholders})`;
      }
      return "";
    case "NOT IN":
      if (Array.isArray(filter.value) && filter.value.length > 0) {
        const placeholders = filter.value.map(() => "?").join(", ");
        const coercedValues = filter.value.map(v => coerceFilterValue(v, columnType));
        params.push(...coercedValues);
        return `${colName} NOT IN (${placeholders})`;
      }
      return "";
    case "!=":
      // Skip conditions with empty/null values
      if (filter.value === null || filter.value === undefined || filter.value === "") {
        return "";
      }
      // != in SQL doesn't match NULL values, so include them explicitly
      const neCoercedValue = coerceFilterValue(filter.value as string | number, columnType);
      params.push(neCoercedValue);
      return `(${colName} != ? OR ${colName} IS NULL)`;
    default:
      // Skip conditions with empty/null values (except IS NULL operators)
      if (filter.value === null || filter.value === undefined || filter.value === "") {
        return "";
      }
      const coercedValue = coerceFilterValue(filter.value as string | number, columnType);
      params.push(coercedValue);
      return `${colName} ${filter.operator} ?`;
  }
}

// Recursive function to build conditions from a FilterGroup
function buildFilterGroupConditions(
  group: FilterGroup,
  sourceTable: string | undefined,
  params: (string | number)[],
  hasJoins: boolean
): string {
  if (!group.conditions || group.conditions.length === 0) {
    return "";
  }

  const subConditions: string[] = [];

  for (const condition of group.conditions) {
    if (isFilterGroup(condition)) {
      // Recursive case: nested FilterGroup
      const subGroup = buildFilterGroupConditions(condition, sourceTable, params, hasJoins);
      if (subGroup) {
        subConditions.push(`(${subGroup})`);
      }
    } else {
      // Base case: FilterCondition
      const singleCondition = buildSingleCondition(condition, sourceTable, params, hasJoins);
      if (singleCondition) {
        subConditions.push(singleCondition);
      }
    }
  }

  return subConditions.join(` ${group.operator} `);
}

function buildWhereClause(
  filters: FilterCondition[] | FilterGroup,
  sourceTable: string | undefined,
  hasJoins: boolean
): { clause: string; params: (string | number)[] } {
  const params: (string | number)[] = [];
  let conditionString = "";

  if (isFilterGroup(filters)) {
    // New format: FilterGroup with recursive nesting
    conditionString = buildFilterGroupConditions(filters, sourceTable, params, hasJoins);
  } else {
    // Old format: FilterCondition[] (backward compatibility)
    if (!filters || filters.length === 0) {
      return { clause: "", params: [] };
    }

    const conditions: string[] = [];
    for (const filter of filters) {
      const singleCondition = buildSingleCondition(filter, sourceTable, params, hasJoins);
      if (singleCondition) {
        conditions.push(singleCondition);
      }
    }
    conditionString = conditions.join(" AND ");
  }

  return {
    clause: conditionString ? `WHERE ${conditionString}` : "",
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

function validateJoinConfig(join: JoinConfig): string | null {
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
  const hasJoins = !!(config.joins && config.joins.length > 0);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable, hasJoins);
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
  const hasJoins = !!(config.joins && config.joins.length > 0);
  const { clause: whereClause, params } = buildWhereClause(config.filters || [], config.sourceTable, hasJoins);
  const groupByClause = buildGroupByClause(config.groupBy, config.sourceTable);

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

function buildFacetQuery(
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
      const isAllowedTable = getAllowedTables().includes(item.name);
      const isAllowedView = ALLOWED_VIEWS.includes(item.name);

      if (!isAllowedTable && !isAllowedView) {
        continue;
      }

      // Validate table name format before PRAGMA call
      if (!isValidTableName(item.name)) {
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
    if (!config.sourceTable || !isSourceAllowed(config.sourceTable)) {
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
      const filterError = validateFilterOperators(config.filters);
      if (filterError) {
        res.status(400).json({ error: filterError });
        return;
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
