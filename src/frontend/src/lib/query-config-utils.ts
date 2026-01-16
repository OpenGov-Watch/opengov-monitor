import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { FilterGroup, FacetQueryConfig, QueryConfig } from "@/lib/db/types";

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
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL";
  value: string | number | null | string[];
}

/**
 * Get the key name used in query results for a column definition.
 *
 * @param col - Column definition from QueryConfig
 * @returns The key used in result data objects
 *
 * @example
 * getColumnKey({ column: "c.category", alias: "category" })
 * // Returns: "category"
 *
 * getColumnKey({ column: "amount", aggregateFunction: "SUM" })
 * // Returns: "sum_amount"
 *
 * getColumnKey({ column: "id" })
 * // Returns: "id"
 */
export function getColumnKey(col: { column: string; alias?: string; aggregateFunction?: string }): string {
  if (col.alias) return col.alias;
  if (col.aggregateFunction) {
    return `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
  }
  return col.column;
}

/**
 * Convert TanStack Table sorting state to QueryConfig orderBy format.
 *
 * For columns with aliases (especially joined columns), resolves column IDs
 * back to original column references using the provided mapping.
 *
 * @param sorting - TanStack Table sorting state array
 * @param queryConfig - Query configuration with column definitions (optional)
 * @param columnIdToRef - Mapping from column IDs to original references (optional)
 * @returns OrderBy configuration array for QueryConfig
 */
export function sortingStateToOrderBy(
  sorting: SortingState,
  queryConfig?: { columns?: { column: string; alias?: string }[] },
  columnIdToRef?: Record<string, string>
): OrderByConfig[] {
  return sorting.map(sort => {
    let columnRef = sort.id;

    // Strategy 1: Use columnIdToRef mapping (most reliable)
    if (columnIdToRef && columnIdToRef[sort.id]) {
      columnRef = columnIdToRef[sort.id];
    }
    // Strategy 2: Look up alias in queryConfig columns (fallback)
    else if (queryConfig?.columns) {
      const columnDef = queryConfig.columns.find(c => c.alias === sort.id);
      if (columnDef) {
        columnRef = columnDef.column;
      }
    }
    // Strategy 3: Use sort.id as-is (backward compatibility)

    return {
      column: columnRef,
      direction: sort.desc ? "DESC" : "ASC"
    };
  });
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
 * Recursively resolve column aliases in a FilterGroup to actual DB references.
 * Mirrors the alias resolution pattern used in sortingStateToOrderBy().
 *
 * @param filterGroup - FilterGroup with potentially aliased column names
 * @param columnIdToRef - Mapping from column IDs to original references
 * @returns FilterGroup with resolved column references
 */
export function resolveFilterGroupAliases(
  filterGroup: FilterGroup,
  columnIdToRef: Record<string, string>
): FilterGroup {
  return {
    operator: filterGroup.operator,
    conditions: filterGroup.conditions.map(condition => {
      // Nested group - recurse
      if ('operator' in condition && 'conditions' in condition) {
        return resolveFilterGroupAliases(condition as FilterGroup, columnIdToRef);
      }

      // Single condition - resolve column alias
      const filterCondition = condition as FilterCondition;
      const resolvedColumn = columnIdToRef[filterCondition.column] || filterCondition.column;
      return {
        ...filterCondition,
        column: resolvedColumn
      };
    })
  };
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
 * @param columnIdToRef - Mapping from column IDs to original references (for resolving joined column aliases)
 * @returns Filters in QueryConfig format (FilterCondition[] or FilterGroup)
 */
export function convertFiltersToQueryConfig(
  columnFilters: ColumnFiltersState,
  filterGroup?: FilterGroup,
  columnIdToRef?: Record<string, string>
): FilterCondition[] | FilterGroup {
  // PRIMARY: Use filterGroup as the single source of truth
  if (filterGroup && filterGroup.conditions.length > 0) {
    // Resolve aliases if mapping provided
    if (columnIdToRef) {
      return resolveFilterGroupAliases(filterGroup, columnIdToRef);
    }
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
 * @deprecated This function is deprecated. Use FilterGroup directly instead.
 *
 * Previously used to convert FilterGroup back to flat FilterCondition array for storage.
 * This flattened nested groups, losing the nested AND/OR logic. Now that dashboards
 * support nested FilterGroups natively, this conversion is no longer needed.
 *
 * @param group - FilterGroup with potentially nested conditions
 * @returns Flat array of filter conditions (nested groups are flattened)
 *
 * @example
 * // OLD APPROACH (deprecated):
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
 * // WARNING: Nested OR group is lost!
 *
 * // NEW APPROACH (recommended):
 * // Just use the FilterGroup directly - no conversion needed
 * updateConfig({ filters: group });
 */
export function groupToFilters(group: FilterGroup): FilterCondition[] {
  console.warn('[DEPRECATED] groupToFilters() is deprecated. Use FilterGroup directly instead of flattening.');
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

/**
 * Parameters for building a FacetQueryConfig with proper alias resolution.
 */
export interface BuildFacetQueryConfigParams {
  sourceTable: string;
  columns: string[];
  joins?: QueryConfig["joins"];
  filters?: FilterGroup;
  columnIdToRef?: Record<string, string>;
}

/**
 * Build a FacetQueryConfig with proper alias resolution.
 * Resolves column aliases and filter aliases before sending to backend.
 *
 * @param params - Configuration parameters
 * @returns FacetQueryConfig ready to send to the facets API
 *
 * @example
 * const config = buildFacetQueryConfig({
 *   sourceTable: "Referenda",
 *   columns: ["category", "subcategory"],
 *   joins: [{ type: "LEFT", table: "Categories", alias: "c", on: {...} }],
 *   filters: { operator: "AND", conditions: [...] },
 *   columnIdToRef: { category: "c.category", subcategory: "c.subcategory" }
 * });
 * // config.columns will be ["c.category", "c.subcategory"]
 * // config.filters will have resolved column references
 */
export function buildFacetQueryConfig({
  sourceTable,
  columns,
  joins,
  filters,
  columnIdToRef
}: BuildFacetQueryConfigParams): FacetQueryConfig {
  // Resolve column aliases
  const resolvedColumns = columnIdToRef
    ? columns.map(col => columnIdToRef[col] || col)
    : columns;

  // Resolve filter aliases
  const resolvedFilters = filters && columnIdToRef
    ? resolveFilterGroupAliases(filters, columnIdToRef)
    : filters;

  return {
    sourceTable,
    columns: resolvedColumns,
    ...(joins && { joins }),
    ...(resolvedFilters && { filters: resolvedFilters })
  };
}
