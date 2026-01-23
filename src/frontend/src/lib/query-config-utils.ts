import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { FilterGroup, FacetQueryConfig, QueryConfig } from "@/lib/db/types";

/**
 * Validation result for QueryConfig groupBy and orderBy entries.
 * Returns lists of invalid entries that reference columns no longer in the query.
 */
export interface QueryConfigValidation {
  invalidGroupBy: string[];
  invalidOrderBy: { column: string; direction: string }[];
}

/**
 * Validate QueryConfig groupBy and orderBy entries against selected columns.
 *
 * Returns lists of invalid entries that reference columns no longer in the query.
 * This can happen when columns are removed but groupBy/orderBy entries remain.
 *
 * @param queryConfig - The QueryConfig to validate
 * @returns Validation result with lists of invalid entries
 *
 * @example
 * const validation = validateQueryConfig(config);
 * if (hasInvalidQueryConfig(validation)) {
 *   // Show error or clean up invalid entries
 * }
 */
export function validateQueryConfig(queryConfig: QueryConfig): QueryConfigValidation {
  const result: QueryConfigValidation = {
    invalidGroupBy: [],
    invalidOrderBy: [],
  };

  // Build set of valid column keys from current query config (selected columns + expressions)
  const validColumns = new Set<string>();
  for (const col of queryConfig.columns || []) {
    validColumns.add(getColumnKey(col));  // alias or derived key
    validColumns.add(col.column);          // original column reference
  }
  for (const expr of queryConfig.expressionColumns || []) {
    validColumns.add(expr.alias);
  }

  // Check groupBy - must be in selected columns
  for (const gb of queryConfig.groupBy || []) {
    if (!validColumns.has(gb)) {
      result.invalidGroupBy.push(gb);
    }
  }

  // Check orderBy - must be in selected columns
  for (const ob of queryConfig.orderBy || []) {
    if (!validColumns.has(ob.column)) {
      result.invalidOrderBy.push(ob);
    }
  }

  return result;
}

/**
 * Check if a QueryConfigValidation has any invalid entries.
 *
 * @param validation - The validation result from validateQueryConfig
 * @returns true if there are invalid groupBy or orderBy entries
 */
export function hasInvalidQueryConfig(validation: QueryConfigValidation): boolean {
  return validation.invalidGroupBy.length > 0 || validation.invalidOrderBy.length > 0;
}

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
 * Sanitize an alias to a valid SQL identifier.
 * Matches the backend's sanitizeAlias function in query.ts.
 *
 * @param alias - The alias to sanitize
 * @returns A valid SQL identifier (alphanumeric + underscore)
 */
export function sanitizeAlias(alias: string): string {
  let sanitized = alias.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
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
 *
 * getColumnKey({ column: "amount", alias: "DOT Component" })
 * // Returns: "DOT_Component" (sanitized to match backend)
 */
export function getColumnKey(col: { column: string; alias?: string; aggregateFunction?: string }): string {
  if (col.alias) return sanitizeAlias(col.alias);
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
 * Map display column names to filter column names in a FilterGroup.
 * Used when display columns use a different column for filtering
 * (e.g., parentBountyId → parentBountyName for showing names instead of IDs).
 *
 * This is the first step of the two-step column resolution:
 * 1. Display → Filter column (this function)
 * 2. Filter → DB reference (resolveFilterGroupAliases)
 *
 * @param filterGroup - FilterGroup with display column names
 * @param columnMap - Mapping from display columns to filter columns
 * @returns FilterGroup with filter column names
 *
 * @example
 * // parentBountyId shows in UI but filters by parentBountyName
 * mapFilterGroupColumns(
 *   { operator: "AND", conditions: [{ column: "parentBountyId", operator: "IN", value: ["Marketing"] }] },
 *   new Map([["parentBountyId", "parentBountyName"]])
 * )
 * // Returns: { operator: "AND", conditions: [{ column: "parentBountyName", operator: "IN", value: ["Marketing"] }] }
 */
export function mapFilterGroupColumns(
  filterGroup: FilterGroup,
  columnMap: Map<string, string>
): FilterGroup {
  return {
    operator: filterGroup.operator,
    conditions: filterGroup.conditions.map(condition => {
      // Nested group - recurse
      if ('operator' in condition && 'conditions' in condition) {
        return mapFilterGroupColumns(condition as FilterGroup, columnMap);
      }
      // Single condition - map column name
      const filterCondition = condition as FilterCondition;
      const mappedColumn = columnMap.get(filterCondition.column) || filterCondition.column;
      return { ...filterCondition, column: mappedColumn };
    })
  };
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
 * @param filterColumnMap - Mapping from display columns to filter columns (for filterColumn feature)
 * @returns Filters in QueryConfig format (FilterCondition[] or FilterGroup)
 */
export function convertFiltersToQueryConfig(
  columnFilters: ColumnFiltersState,
  filterGroup?: FilterGroup,
  columnIdToRef?: Record<string, string>,
  filterColumnMap?: Map<string, string>
): FilterCondition[] | FilterGroup {
  // PRIMARY: Use filterGroup as the single source of truth
  if (filterGroup && filterGroup.conditions.length > 0) {
    // Step 1: Map display columns to filter columns (e.g., parentBountyId → parentBountyName)
    let mappedGroup = filterGroup;
    if (filterColumnMap && filterColumnMap.size > 0) {
      mappedGroup = mapFilterGroupColumns(filterGroup, filterColumnMap);
    }

    // Step 2: Resolve filter columns to DB references (e.g., parentBountyName → b.name)
    if (columnIdToRef) {
      return resolveFilterGroupAliases(mappedGroup, columnIdToRef);
    }
    return mappedGroup;
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
/**
 * Normalize data keys from SQLite result format to expected frontend keys.
 *
 * SQLite returns keys differently based on alias presence:
 * - With alias: returns the alias
 * - Without alias for "Table.column": returns just "column"
 *
 * This normalizes keys to match getColumnKey() output, ensuring charts
 * can access data using the same key format the frontend expects.
 *
 * @param data - Array of row objects from API response
 * @param columns - Column definitions from QueryConfig
 * @returns Data with normalized keys matching getColumnKey() output
 *
 * @example
 * // SQLite returns { name: "Treasury", value: 100 } for "Categories.name" column
 * // normalizeDataKeys transforms to { "Categories.name": "Treasury", value: 100 }
 */
export function normalizeDataKeys(
  data: Record<string, unknown>[] | undefined,
  columns: { column: string; alias?: string; aggregateFunction?: string }[] | undefined
): Record<string, unknown>[] {
  if (!data || !columns || columns.length === 0 || data.length === 0) {
    return data ?? [];
  }

  // Build mapping: SQLite returned key -> expected key
  const keyMap = new Map<string, string>();

  for (const col of columns) {
    const expectedKey = getColumnKey(col);

    // Determine what SQLite actually returns
    let sqliteKey: string;
    if (col.alias) {
      sqliteKey = col.alias;
    } else if (col.aggregateFunction) {
      sqliteKey = expectedKey; // Aggregates match
    } else {
      // No alias: SQLite returns last part after dot
      const lastDot = col.column.lastIndexOf('.');
      sqliteKey = lastDot > 0 ? col.column.substring(lastDot + 1) : col.column;
    }

    if (sqliteKey !== expectedKey) {
      keyMap.set(sqliteKey, expectedKey);
    }
  }

  if (keyMap.size === 0) return data;

  return data.map(row => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[keyMap.get(key) ?? key] = value;
    }
    return normalized;
  });
}

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
