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
 * Convert filters to QueryConfig format. Supports both legacy ColumnFiltersState
 * and new FilterGroup format.
 *
 * @param columnFilters - Legacy TanStack Table column filters (for backward compatibility)
 * @param filterGroup - New FilterGroup with AND/OR logic
 * @returns Filters in QueryConfig format (FilterCondition[] or FilterGroup)
 */
export function convertFiltersToQueryConfig(
  columnFilters: ColumnFiltersState,
  filterGroup?: FilterGroup
): FilterCondition[] | FilterGroup {
  // Prefer new filterGroup format if present
  if (filterGroup && filterGroup.conditions.length > 0) {
    return filterGroup;
  }

  // Fall back to legacy columnFilters
  if (columnFilters && columnFilters.length > 0) {
    return filterStateToQueryFilters(columnFilters);
  }

  // Return empty array if no filters
  return [];
}
