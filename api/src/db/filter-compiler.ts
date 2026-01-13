import type {
  AdvancedFilterCondition,
  AdvancedFilterGroup,
  FilterOperator,
  SortCondition,
} from "./types.js";

const ALLOWED_OPERATORS = new Set<FilterOperator>([
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "NOT LIKE",
  "IN",
  "NOT IN",
  "IS NULL",
  "IS NOT NULL",
  "BETWEEN",
]);

/**
 * Sanitizes a column name to prevent SQL injection.
 * Column names must be alphanumeric, underscore, dot, or space.
 */
function sanitizeColumnName(name: string): string {
  if (!/^[a-zA-Z0-9_.\s]+$/.test(name)) {
    throw new Error(`Invalid column name: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Validates that a column exists in the given table.
 */
export function validateColumn(column: string, availableColumns: string[]): void {
  if (!availableColumns.includes(column)) {
    throw new Error(`Invalid column: ${column}. Column does not exist in table.`);
  }
}

/**
 * Type guard to check if a condition is a filter group.
 */
function isFilterGroup(
  condition: AdvancedFilterCondition | AdvancedFilterGroup
): condition is AdvancedFilterGroup {
  return "combinator" in condition && "conditions" in condition;
}

/**
 * Compiles an advanced filter condition into SQL WHERE clause with parameters.
 */
function compileCondition(
  condition: AdvancedFilterCondition,
  availableColumns: string[]
): { sql: string; params: (string | number)[] } {
  // Validate column exists
  validateColumn(condition.column, availableColumns);

  // Validate operator
  if (!ALLOWED_OPERATORS.has(condition.operator)) {
    throw new Error(`Invalid operator: ${condition.operator}`);
  }

  const colName = sanitizeColumnName(condition.column);
  const params: (string | number)[] = [];

  switch (condition.operator) {
    case "IS NULL":
      return { sql: `${colName} IS NULL`, params: [] };

    case "IS NOT NULL":
      return { sql: `${colName} IS NOT NULL`, params: [] };

    case "IN":
      if (!Array.isArray(condition.value)) {
        throw new Error(`IN operator requires an array value`);
      }
      if (condition.value.length === 0) {
        throw new Error(`IN operator requires at least one value`);
      }
      const inPlaceholders = condition.value.map(() => "?").join(", ");
      params.push(...condition.value);
      return { sql: `${colName} IN (${inPlaceholders})`, params };

    case "NOT IN":
      if (!Array.isArray(condition.value)) {
        throw new Error(`NOT IN operator requires an array value`);
      }
      if (condition.value.length === 0) {
        throw new Error(`NOT IN operator requires at least one value`);
      }
      const notInPlaceholders = condition.value.map(() => "?").join(", ");
      params.push(...condition.value);
      return { sql: `${colName} NOT IN (${notInPlaceholders})`, params };

    case "BETWEEN":
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new Error(`BETWEEN operator requires an array with exactly 2 values`);
      }
      params.push(condition.value[0], condition.value[1]);
      return { sql: `${colName} BETWEEN ? AND ?`, params };

    case "LIKE":
    case "NOT LIKE":
      if (typeof condition.value !== "string") {
        throw new Error(`${condition.operator} operator requires a string value`);
      }
      params.push(condition.value);
      return { sql: `${colName} ${condition.operator} ?`, params };

    default:
      // Standard comparison operators: =, !=, >, <, >=, <=
      if (condition.value === null || condition.value === undefined) {
        throw new Error(
          `Operator ${condition.operator} requires a non-null value. Use IS NULL instead.`
        );
      }
      if (Array.isArray(condition.value)) {
        throw new Error(
          `Operator ${condition.operator} does not accept array values. Use IN instead.`
        );
      }
      params.push(condition.value);
      return { sql: `${colName} ${condition.operator} ?`, params };
  }
}

/**
 * Recursively compiles an advanced filter group into SQL WHERE clause with parameters.
 */
function compileFilterGroup(
  group: AdvancedFilterGroup,
  availableColumns: string[],
  depth: number = 0
): { sql: string; params: (string | number)[] } {
  // Prevent stack overflow from deeply nested groups
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    throw new Error(`Filter nesting too deep (max ${MAX_DEPTH} levels)`);
  }

  // Prevent excessive number of conditions
  const MAX_CONDITIONS = 100;
  if (group.conditions.length > MAX_CONDITIONS) {
    throw new Error(`Too many filter conditions (max ${MAX_CONDITIONS})`);
  }

  if (group.conditions.length === 0) {
    return { sql: "", params: [] };
  }

  const sqlParts: string[] = [];
  const allParams: (string | number)[] = [];

  for (const condition of group.conditions) {
    if (isFilterGroup(condition)) {
      const { sql, params } = compileFilterGroup(condition, availableColumns, depth + 1);
      if (sql) {
        sqlParts.push(`(${sql})`);
        allParams.push(...params);
      }
    } else {
      const { sql, params } = compileCondition(condition, availableColumns);
      sqlParts.push(sql);
      allParams.push(...params);
    }
  }

  const combinator = group.combinator === "OR" ? " OR " : " AND ";
  const sql = sqlParts.join(combinator);

  return { sql, params: allParams };
}

/**
 * Compiles an advanced filter group into a SQL WHERE clause with parameters.
 * Returns an object with the WHERE clause (without the "WHERE" keyword) and parameters array.
 */
export function compileAdvancedFilters(
  filters: AdvancedFilterGroup | undefined,
  availableColumns: string[]
): { clause: string; params: (string | number)[] } {
  if (!filters || !filters.conditions || filters.conditions.length === 0) {
    return { clause: "", params: [] };
  }

  const { sql, params } = compileFilterGroup(filters, availableColumns);
  return { clause: sql, params };
}

/**
 * Compiles multi-column sort conditions into SQL ORDER BY clause.
 */
export function compileSortConditions(
  sorts: SortCondition[] | undefined,
  availableColumns: string[]
): string {
  if (!sorts || sorts.length === 0) {
    return "";
  }

  // Validate all columns exist
  for (const sort of sorts) {
    validateColumn(sort.column, availableColumns);
    if (sort.direction !== "ASC" && sort.direction !== "DESC") {
      throw new Error(`Invalid sort direction: ${sort.direction}`);
    }
  }

  return sorts.map((sort) => `${sanitizeColumnName(sort.column)} ${sort.direction}`).join(", ");
}

/**
 * Validates and sanitizes groupBy column name.
 */
export function validateGroupBy(groupBy: string | undefined, availableColumns: string[]): string {
  if (!groupBy) {
    return "";
  }

  validateColumn(groupBy, availableColumns);
  return sanitizeColumnName(groupBy);
}
