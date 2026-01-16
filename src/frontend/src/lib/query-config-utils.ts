import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { FilterGroup } from "@/lib/db/types";

/**
 * OrderBy configuration for QueryConfig
 */
export interface OrderByConfig {
  column: string;
  direction: "ASC" | "DESC";
}

/**
 * Filter condition for QueryConfig
 */
export interface FilterCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "IS NULL" | "IS NOT NULL";
  value: string | number | null | string[];
}

/**
 * Convert TanStack Table sorting state to QueryConfig orderBy format.
 *
 * @param sorting - TanStack Table sorting state array
 * @returns OrderBy configuration array for QueryConfig
 *
 * @example
 * sortingStateToOrderBy([{ id: "name", desc: false }])
 * // Returns: [{ column: "name", direction: "ASC" }]
 */
export function sortingStateToOrderBy(sorting: SortingState): OrderByConfig[] {
  return sorting.map(sort => ({
    column: sort.id,
    direction: sort.desc ? "DESC" : "ASC"
  }));
}

/**
 * Convert TanStack Table filter state to QueryConfig filters format.
 *
 * Automatically determines the appropriate SQL operator based on the value type:
 * - String: LIKE (with wildcards)
 * - Array: IN
 * - null/undefined: IS NULL
 * - Other: = (equality)
 *
 * @param filters - TanStack Table column filters state array
 * @returns Filter conditions array for QueryConfig
 *
 * @example
 * filterStateToQueryFilters([{ id: "title", value: "test" }])
 * // Returns: [{ column: "title", operator: "LIKE", value: "%test%" }]
 *
 * filterStateToQueryFilters([{ id: "status", value: ["Active", "Pending"] }])
 * // Returns: [{ column: "status", operator: "IN", value: ["Active", "Pending"] }]
 */
export function filterStateToQueryFilters(
  filters: ColumnFiltersState
): FilterCondition[] {
  return filters.map(filter => {
    const value = filter.value;

    // String filter - use LIKE with wildcards
    if (typeof value === "string") {
      return {
        column: filter.id,
        operator: "LIKE" as const,
        value: `%${value}%`
      };
    }

    // Array filter - use IN
    if (Array.isArray(value)) {
      return {
        column: filter.id,
        operator: "IN" as const,
        value: value as string[]
      };
    }

    // Null/undefined filter
    if (value === null || value === undefined) {
      return {
        column: filter.id,
        operator: "IS NULL" as const,
        value: null
      };
    }

    // Default: equality comparison
    return {
      column: filter.id,
      operator: "=" as const,
      value: value as string | number
    };
  });
}

/**
 * Convert filters to QueryConfig format.
 *
 * PRIMARY STATE: filterGroup is the unified filter state used by both faceted filters
 * and advanced filter composer. Both UI components read from and write to filterGroup.
 *
 * BACKWARD COMPATIBILITY: columnFilters (TanStack Table state) is supported for legacy
 * saved views and scenarios where filterGroup is not provided. In the unified state model,
 * faceted filters no longer write to columnFilters - they write directly to filterGroup.
 *
 * @param columnFilters - Legacy TanStack Table column filters (backward compatibility)
 * @param filterGroup - Primary unified filter state with AND/OR logic
 * @returns Filters in QueryConfig format (FilterCondition[] or FilterGroup)
 */
export function convertFiltersToQueryConfig(
  columnFilters: ColumnFiltersState,
  filterGroup?: FilterGroup
): FilterCondition[] | FilterGroup {
  // PRIMARY: Use filterGroup as the single source of truth
  if (filterGroup && filterGroup.conditions.length > 0) {
    return filterGroup;
  }

  // FALLBACK: Support legacy columnFilters for backward compatibility
  if (columnFilters && columnFilters.length > 0) {
    return filterStateToQueryFilters(columnFilters);
  }

  // Return empty array if no filters
  return [];
}

/**
 * Convert flat FilterCondition array to FilterGroup for UI editing.
 * Used by QueryBuilder to convert dashboard storage format to FilterGroupBuilder format.
 *
 * @param filters - Flat array of filter conditions
 * @returns FilterGroup with AND operator
 *
 * @example
 * filtersToGroup([
 *   { column: "status", operator: "=", value: "Active" },
 *   { column: "amount", operator: ">", value: 1000 }
 * ])
 * // Returns: { operator: "AND", conditions: [...filters] }
 */
export function filtersToGroup(filters: FilterCondition[]): FilterGroup {
  return {
    operator: "AND",
    conditions: filters
  };
}

/**
 * Convert FilterGroup back to flat FilterCondition array for storage.
 * Flattens nested groups with console warning (dashboards don't support nesting yet).
 *
 * @param group - FilterGroup with potentially nested conditions
 * @returns Flat array of filter conditions
 *
 * @example
 * groupToFilters({
 *   operator: "AND",
 *   conditions: [
 *     { column: "status", operator: "=", value: "Active" },
 *     { column: "amount", operator: ">", value: 1000 }
 *   ]
 * })
 * // Returns: [{ column: "status", ... }, { column: "amount", ... }]
 *
 * // Nested groups are flattened:
 * groupToFilters({
 *   operator: "AND",
 *   conditions: [
 *     { column: "status", operator: "=", value: "Active" },
 *     {
 *       operator: "OR",
 *       conditions: [
 *         { column: "priority", operator: "=", value: "High" }
 *       ]
 *     }
 *   ]
 * })
 * // Returns: [{ column: "status", ... }, { column: "priority", ... }]
 * // Logs warning: "Nested filter groups not yet supported in dashboards, flattening to AND"
 */
export function groupToFilters(group: FilterGroup): FilterCondition[] {
  const conditions: FilterCondition[] = [];
  for (const condition of group.conditions) {
    if ('column' in condition) {
      // It's a FilterCondition
      conditions.push(condition);
    } else {
      // It's a nested FilterGroup - flatten with warning
      console.warn('Nested filter groups not yet supported in dashboards, flattening to AND');
      conditions.push(...groupToFilters(condition));
    }
  }
  return conditions;
}
