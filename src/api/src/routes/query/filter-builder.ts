/**
 * Filter builder module for query builder
 *
 * Contains functions for building WHERE clauses from filter configurations.
 * Supports both simple filter arrays and nested FilterGroup structures.
 */

import type { FilterCondition, FilterGroup } from "../../db/types.js";
import { ALLOWED_OPERATORS } from "./security.js";
import { getColumnType, sanitizeColumnName } from "./column-cache.js";

/**
 * Check if filters is a FilterGroup (vs FilterCondition[]).
 */
export function isFilterGroup(filters: FilterCondition[] | FilterGroup): filters is FilterGroup {
  return !Array.isArray(filters) && 'operator' in filters && 'conditions' in filters;
}

/**
 * Recursively remove a column from FilterGroup.
 * Used for facet queries to exclude the faceted column.
 */
export function excludeColumnFromFilterGroup(
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

/**
 * Recursively validate filter operators against allowed list.
 */
export function validateFilterOperators(filters: FilterCondition[] | FilterGroup): string | null {
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

/**
 * Coerce filter value to match column type.
 * SQLite TEXT columns don't match against numeric values, so we convert numbers to strings.
 * For views, columns may have empty type info, so we convert numbers to strings as a safe default.
 */
export function coerceFilterValue(value: string | number, columnType: string | undefined): string | number {
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

/**
 * Build condition from a single FilterCondition.
 */
export function buildSingleCondition(
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

/**
 * Recursively build conditions from a FilterGroup.
 */
export function buildFilterGroupConditions(
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

/**
 * Build WHERE clause from filters.
 * Supports both FilterCondition[] and FilterGroup formats.
 */
export function buildWhereClause(
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
