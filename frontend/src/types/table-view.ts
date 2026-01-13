// Advanced Filter Types for Notion-like filtering
export type FilterOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN";

export type FilterCombinator = "AND" | "OR";

export interface AdvancedFilterCondition {
  column: string;
  operator: FilterOperator;
  value: string | number | string[] | [number, number] | [string, string] | null;
}

export interface AdvancedFilterGroup {
  combinator: FilterCombinator;
  conditions: (AdvancedFilterCondition | AdvancedFilterGroup)[];
}

// Sort configuration for multi-column sorting
export interface SortCondition {
  column: string;
  direction: "ASC" | "DESC";
}

// Grouping configuration
export interface GroupConfig {
  column: string;
  aggregations?: {
    column: string;
    function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
    alias?: string;
  }[];
}

// Table view state for save/load
export interface TableViewState {
  name: string;
  filters?: AdvancedFilterGroup;
  sorts?: SortCondition[];
  grouping?: GroupConfig;
  columnVisibility?: Record<string, boolean>;
  pagination?: {
    pageIndex: number;
    pageSize: number;
  };
}

// Type guard to check if a condition is a group
export function isFilterGroup(
  condition: AdvancedFilterCondition | AdvancedFilterGroup
): condition is AdvancedFilterGroup {
  return "combinator" in condition && "conditions" in condition;
}

// Helper to create an empty filter group
export function createEmptyFilterGroup(): AdvancedFilterGroup {
  return {
    combinator: "AND",
    conditions: [],
  };
}

// Helper to convert legacy columnFilters to AdvancedFilterGroup
export function convertLegacyFilters(
  columnFilters: { id: string; value: unknown }[]
): AdvancedFilterGroup {
  const conditions: AdvancedFilterCondition[] = columnFilters.map((filter) => {
    // Determine operator based on value type
    let operator: FilterOperator = "=";
    let value: string | number | string[] | null = null;

    if (Array.isArray(filter.value)) {
      operator = "IN";
      value = filter.value as string[];
    } else if (filter.value === null || filter.value === undefined) {
      operator = "IS NULL";
      value = null;
    } else if (typeof filter.value === "string") {
      // Check if it's a search pattern
      if (
        filter.value.includes("%") ||
        filter.value.includes("_")
      ) {
        operator = "LIKE";
        value = filter.value;
      } else {
        operator = "=";
        value = filter.value;
      }
    } else {
      value = filter.value as string | number;
    }

    return {
      column: filter.id,
      operator,
      value,
    };
  });

  return {
    combinator: "AND",
    conditions,
  };
}
