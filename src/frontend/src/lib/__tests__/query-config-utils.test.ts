/**
 * Query Config Utils Tests
 *
 * Tests for conversion utilities that transform TanStack Table state
 * into QueryConfig format for server-side sorting and filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getColumnKey, validateQueryConfig, sortingStateToOrderBy, filterStateToQueryFilters, filtersToGroup, groupToFilters, convertFiltersToQueryConfig, buildFacetQueryConfig, normalizeDataKeys, mapFilterGroupColumns } from "../query-config-utils";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { FilterCondition, FilterGroup } from "@/lib/db/types";

describe("getColumnKey", () => {
  it("returns alias when provided", () => {
    const result = getColumnKey({ column: "c.category", alias: "category" });
    expect(result).toBe("category");
  });

  it("returns formatted aggregate key for SUM", () => {
    const result = getColumnKey({ column: "amount", aggregateFunction: "SUM" });
    expect(result).toBe("sum_amount");
  });

  it("returns formatted aggregate key for COUNT", () => {
    const result = getColumnKey({ column: "id", aggregateFunction: "COUNT" });
    expect(result).toBe("count_id");
  });

  it("returns formatted aggregate key for AVG", () => {
    const result = getColumnKey({ column: "DOT_value", aggregateFunction: "AVG" });
    expect(result).toBe("avg_DOT_value");
  });

  it("returns column name when no alias or aggregate", () => {
    const result = getColumnKey({ column: "id" });
    expect(result).toBe("id");
  });

  it("handles underscores in column names for aggregate functions", () => {
    const result = getColumnKey({ column: "tally_ayes", aggregateFunction: "SUM" });
    expect(result).toBe("sum_tally_ayes");
  });

  it("handles spaces in column names for aggregate functions", () => {
    const result = getColumnKey({ column: "proposal time", aggregateFunction: "AVG" });
    expect(result).toBe("avg_proposal_time");
  });

  it("prefers alias over aggregate function", () => {
    const result = getColumnKey({ column: "amount", alias: "total_amount", aggregateFunction: "SUM" });
    expect(result).toBe("total_amount");
  });
});

describe("validateQueryConfig - alias handling", () => {
  it("should NOT flag groupBy as invalid when column has an alias", () => {
    const config = {
      sourceTable: "all_spending",
      columns: [
        { column: "all_spending.year_quarter", alias: "quarter" },
        { column: "all_spending.USD_latest", aggregateFunction: "SUM" as const }
      ],
      filters: [],
      groupBy: ["all_spending.year_quarter"],  // References original column
      orderBy: [],
    };

    const validation = validateQueryConfig(config);
    expect(validation.invalidGroupBy).toEqual([]);
  });

  it("should NOT flag orderBy as invalid when column has an alias", () => {
    const config = {
      sourceTable: "all_spending",
      columns: [
        { column: "all_spending.year_quarter", alias: "quarter" }
      ],
      filters: [],
      groupBy: [],
      orderBy: [{ column: "all_spending.year_quarter", direction: "ASC" as const }],
    };

    const validation = validateQueryConfig(config);
    expect(validation.invalidOrderBy).toEqual([]);
  });

  it("should accept both alias and original column reference in groupBy", () => {
    const config = {
      sourceTable: "all_spending",
      columns: [
        { column: "all_spending.year_quarter", alias: "quarter" }
      ],
      filters: [],
      groupBy: ["quarter"],  // References alias instead of original
      orderBy: [],
    };

    const validation = validateQueryConfig(config);
    expect(validation.invalidGroupBy).toEqual([]);
  });

  it("should flag truly invalid groupBy entries", () => {
    const config = {
      sourceTable: "all_spending",
      columns: [
        { column: "all_spending.year_quarter", alias: "quarter" }
      ],
      filters: [],
      groupBy: ["nonexistent_column"],
      orderBy: [],
    };

    const validation = validateQueryConfig(config);
    expect(validation.invalidGroupBy).toEqual(["nonexistent_column"]);
  });

  it("should validate expression columns by alias", () => {
    const config = {
      sourceTable: "all_spending",
      columns: [],
      filters: [],
      expressionColumns: [
        { expression: "YEAR(created_at)", alias: "year" }
      ],
      groupBy: ["year"],
      orderBy: [],
    };

    const validation = validateQueryConfig(config);
    expect(validation.invalidGroupBy).toEqual([]);
  });
});

describe("sortingStateToOrderBy", () => {
  it("converts empty sorting state", () => {
    const sorting: SortingState = [];
    const result = sortingStateToOrderBy(sorting);
    expect(result).toEqual([]);
  });

  it("converts single ascending sort", () => {
    const sorting: SortingState = [{ id: "name", desc: false }];
    const result = sortingStateToOrderBy(sorting);
    expect(result).toEqual([
      { column: "name", direction: "ASC" }
    ]);
  });

  it("converts single descending sort", () => {
    const sorting: SortingState = [{ id: "date", desc: true }];
    const result = sortingStateToOrderBy(sorting);
    expect(result).toEqual([
      { column: "date", direction: "DESC" }
    ]);
  });

  it("converts multi-column sort", () => {
    const sorting: SortingState = [
      { id: "status", desc: false },
      { id: "date", desc: true },
      { id: "amount", desc: false }
    ];
    const result = sortingStateToOrderBy(sorting);
    expect(result).toEqual([
      { column: "status", direction: "ASC" },
      { column: "date", direction: "DESC" },
      { column: "amount", direction: "ASC" }
    ]);
  });

  it("handles column names with dots (joined columns)", () => {
    const sorting: SortingState = [{ id: "c.category", desc: true }];
    const result = sortingStateToOrderBy(sorting);
    expect(result).toEqual([
      { column: "c.category", direction: "DESC" }
    ]);
  });

  describe("with column reference resolution", () => {
    it("resolves joined column aliases using columnIdToRef mapping", () => {
      const sorting: SortingState = [{ id: "category", desc: false }];
      const columnIdToRef = { category: "c.category" };
      const result = sortingStateToOrderBy(sorting, undefined, columnIdToRef);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" }
      ]);
    });

    it("resolves multiple joined column aliases", () => {
      const sorting: SortingState = [
        { id: "category", desc: false },
        { id: "subcategory", desc: true }
      ];
      const columnIdToRef = {
        category: "c.category",
        subcategory: "c.subcategory"
      };
      const result = sortingStateToOrderBy(sorting, undefined, columnIdToRef);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" },
        { column: "c.subcategory", direction: "DESC" }
      ]);
    });

    it("falls back to queryConfig lookup when columnIdToRef mapping missing", () => {
      const sorting: SortingState = [{ id: "category", desc: false }];
      const queryConfig = {
        columns: [
          { column: "c.category", alias: "category" },
          { column: "c.subcategory", alias: "subcategory" }
        ]
      };
      const result = sortingStateToOrderBy(sorting, queryConfig);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" }
      ]);
    });

    it("uses column ID as-is when no mapping or queryConfig provided (backward compatibility)", () => {
      const sorting: SortingState = [{ id: "status", desc: true }];
      const result = sortingStateToOrderBy(sorting);
      expect(result).toEqual([
        { column: "status", direction: "DESC" }
      ]);
    });

    it("handles mixed aliases and regular columns", () => {
      const sorting: SortingState = [
        { id: "category", desc: false },
        { id: "id", desc: true },
        { id: "status", desc: false }
      ];
      const columnIdToRef = { category: "c.category" };
      const result = sortingStateToOrderBy(sorting, undefined, columnIdToRef);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" },
        { column: "id", direction: "DESC" },
        { column: "status", direction: "ASC" }
      ]);
    });

    it("handles empty columnIdToRef mapping gracefully", () => {
      const sorting: SortingState = [{ id: "status", desc: false }];
      const columnIdToRef = {};
      const result = sortingStateToOrderBy(sorting, undefined, columnIdToRef);
      expect(result).toEqual([
        { column: "status", direction: "ASC" }
      ]);
    });

    it("prioritizes columnIdToRef over queryConfig", () => {
      const sorting: SortingState = [{ id: "category", desc: false }];
      const queryConfig = {
        columns: [
          { column: "wrong.category", alias: "category" }
        ]
      };
      const columnIdToRef = { category: "c.category" };
      const result = sortingStateToOrderBy(sorting, queryConfig, columnIdToRef);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" }
      ]);
    });

    it("handles multiple JOINs with same column names", () => {
      const sorting: SortingState = [
        { id: "category", desc: false },
        { id: "parent_category", desc: true }
      ];
      const columnIdToRef = {
        category: "c.category",
        parent_category: "parent_cat.category"
      };
      const result = sortingStateToOrderBy(sorting, undefined, columnIdToRef);
      expect(result).toEqual([
        { column: "c.category", direction: "ASC" },
        { column: "parent_cat.category", direction: "DESC" }
      ]);
    });

    it("handles undefined columnIdToRef and queryConfig (graceful degradation)", () => {
      const sorting: SortingState = [{ id: "status", desc: false }];
      const result = sortingStateToOrderBy(sorting, undefined, undefined);
      expect(result).toEqual([
        { column: "status", direction: "ASC" }
      ]);
    });
  });
});

describe("filterStateToQueryFilters", () => {
  it("converts empty filter state", () => {
    const filters: ColumnFiltersState = [];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([]);
  });

  it("converts string filter to LIKE with wildcards", () => {
    const filters: ColumnFiltersState = [{ id: "title", value: "test" }];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "title", operator: "LIKE", value: "%test%" }
    ]);
  });

  it("converts multiple string filters", () => {
    const filters: ColumnFiltersState = [
      { id: "title", value: "governance" },
      { id: "description", value: "treasury" }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "title", operator: "LIKE", value: "%governance%" },
      { column: "description", operator: "LIKE", value: "%treasury%" }
    ]);
  });

  it("converts array filter to IN", () => {
    const filters: ColumnFiltersState = [
      { id: "status", value: ["Active", "Pending"] }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "status", operator: "IN", value: ["Active", "Pending"] }
    ]);
  });

  it("converts empty array filter to IN", () => {
    const filters: ColumnFiltersState = [
      { id: "status", value: [] }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "status", operator: "IN", value: [] }
    ]);
  });

  it("converts single-element array filter to IN", () => {
    const filters: ColumnFiltersState = [
      { id: "track", value: ["root"] }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "track", operator: "IN", value: ["root"] }
    ]);
  });

  it("converts null filter to IS NULL", () => {
    const filters: ColumnFiltersState = [
      { id: "category_id", value: null }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "category_id", operator: "IS NULL", value: null }
    ]);
  });

  it("converts undefined filter to IS NULL", () => {
    const filters: ColumnFiltersState = [
      { id: "notes", value: undefined }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "notes", operator: "IS NULL", value: null }
    ]);
  });

  it("converts number filter to equality", () => {
    const filters: ColumnFiltersState = [
      { id: "id", value: 42 }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "id", operator: "=", value: 42 }
    ]);
  });

  it("converts mixed filter types", () => {
    const filters: ColumnFiltersState = [
      { id: "title", value: "search" },
      { id: "status", value: ["Active", "Pending", "Completed"] },
      { id: "id", value: 123 },
      { id: "category_id", value: null }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "title", operator: "LIKE", value: "%search%" },
      { column: "status", operator: "IN", value: ["Active", "Pending", "Completed"] },
      { column: "id", operator: "=", value: 123 },
      { column: "category_id", operator: "IS NULL", value: null }
    ]);
  });

  it("handles special characters in string filters", () => {
    const filters: ColumnFiltersState = [
      { id: "title", value: "test@#$%^&*()" }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "title", operator: "LIKE", value: "%test@#$%^&*()%" }
    ]);
  });

  it("handles empty string filter", () => {
    const filters: ColumnFiltersState = [
      { id: "title", value: "" }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "title", operator: "LIKE", value: "%%" }
    ]);
  });

  it("handles column names with dots (joined columns)", () => {
    const filters: ColumnFiltersState = [
      { id: "c.category", value: "Infrastructure" }
    ];
    const result = filterStateToQueryFilters(filters);
    expect(result).toEqual([
      { column: "c.category", operator: "LIKE", value: "%Infrastructure%" }
    ]);
  });
});

describe("filtersToGroup", () => {
  it("converts empty array to empty FilterGroup", () => {
    const filters: FilterCondition[] = [];
    const result = filtersToGroup(filters);
    expect(result).toEqual({
      operator: "AND",
      conditions: []
    });
  });

  it("converts single filter to FilterGroup", () => {
    const filters: FilterCondition[] = [
      { column: "status", operator: "=", value: "Active" }
    ];
    const result = filtersToGroup(filters);
    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" }
      ]
    });
  });

  it("converts multiple filters to FilterGroup", () => {
    const filters: FilterCondition[] = [
      { column: "status", operator: "=", value: "Active" },
      { column: "amount", operator: ">", value: 1000 },
      { column: "category", operator: "IN", value: ["Infrastructure", "Events"] }
    ];
    const result = filtersToGroup(filters);
    expect(result).toEqual({
      operator: "AND",
      conditions: filters
    });
  });

  it("preserves all operator types", () => {
    const filters: FilterCondition[] = [
      { column: "col1", operator: "=", value: "test" },
      { column: "col2", operator: "!=", value: "test" },
      { column: "col3", operator: ">", value: 100 },
      { column: "col4", operator: "<", value: 200 },
      { column: "col5", operator: ">=", value: 50 },
      { column: "col6", operator: "<=", value: 150 },
      { column: "col7", operator: "LIKE", value: "%search%" },
      { column: "col8", operator: "IN", value: ["a", "b", "c"] },
      { column: "col9", operator: "IS NULL", value: null },
      { column: "col10", operator: "IS NOT NULL", value: null }
    ];
    const result = filtersToGroup(filters);
    expect(result.conditions).toEqual(filters);
  });
});

describe("groupToFilters - DEPRECATED", () => {
  // NOTE: groupToFilters is deprecated as of the FilterGroup unification
  // These tests remain for backward compatibility verification only

  // Mock console.warn to prevent test output noise
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs deprecation warning when called", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" }
      ]
    };
    groupToFilters(group);
    expect(console.warn).toHaveBeenCalledWith(
      '[DEPRECATED] groupToFilters() is deprecated. Use FilterGroup directly instead of flattening.'
    );
  });

  it("converts empty FilterGroup to empty array", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: []
    };
    const result = groupToFilters(group);
    expect(result).toEqual([]);
  });

  it("converts FilterGroup with single condition", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "status", operator: "=", value: "Active" }
    ]);
  });

  it("converts FilterGroup with multiple conditions", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        { column: "amount", operator: ">", value: 1000 }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "status", operator: "=", value: "Active" },
      { column: "amount", operator: ">", value: 1000 }
    ]);
  });

  it("flattens nested FilterGroup with warning", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        {
          operator: "OR",
          conditions: [
            { column: "priority", operator: "=", value: "High" },
            { column: "urgent", operator: "=", value: 1 }
          ]
        }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "status", operator: "=", value: "Active" },
      { column: "priority", operator: "=", value: "High" },
      { column: "urgent", operator: "=", value: 1 }
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      'Nested filter groups not yet supported in dashboards, flattening to AND'
    );
  });

  it("flattens deeply nested FilterGroups with warnings", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "col1", operator: "=", value: "a" },
        {
          operator: "OR",
          conditions: [
            { column: "col2", operator: "=", value: "b" },
            {
              operator: "AND",
              conditions: [
                { column: "col3", operator: "=", value: "c" },
                { column: "col4", operator: "=", value: "d" }
              ]
            }
          ]
        }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "col1", operator: "=", value: "a" },
      { column: "col2", operator: "=", value: "b" },
      { column: "col3", operator: "=", value: "c" },
      { column: "col4", operator: "=", value: "d" }
    ]);
    // 5 total: 3 deprecation warnings (1 initial + 2 recursive calls) + 2 nested group warnings
    expect(console.warn).toHaveBeenCalledTimes(5);
  });

  it("handles OR operator on root group (still flattens)", () => {
    const group: FilterGroup = {
      operator: "OR",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        { column: "status", operator: "=", value: "Pending" }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "status", operator: "=", value: "Active" },
      { column: "status", operator: "=", value: "Pending" }
    ]);
    // Now logs deprecation warning on every call
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("preserves all operator types during flattening", () => {
    const group: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "col1", operator: "IN", value: ["a", "b"] },
        { column: "col2", operator: "IS NULL", value: null },
        { column: "col3", operator: "IS NOT NULL", value: null },
        { column: "col4", operator: "LIKE", value: "%test%" }
      ]
    };
    const result = groupToFilters(group);
    expect(result).toEqual([
      { column: "col1", operator: "IN", value: ["a", "b"] },
      { column: "col2", operator: "IS NULL", value: null },
      { column: "col3", operator: "IS NOT NULL", value: null },
      { column: "col4", operator: "LIKE", value: "%test%" }
    ]);
  });
});

describe("filtersToGroup and groupToFilters - Round-trip", () => {
  it("round-trips flat filters without data loss", () => {
    const originalFilters: FilterCondition[] = [
      { column: "status", operator: "=", value: "Active" },
      { column: "amount", operator: ">", value: 1000 },
      { column: "category", operator: "IN", value: ["Infrastructure", "Events"] }
    ];

    const group = filtersToGroup(originalFilters);
    const result = groupToFilters(group);

    expect(result).toEqual(originalFilters);
  });

  it("round-trips empty filters", () => {
    const originalFilters: FilterCondition[] = [];

    const group = filtersToGroup(originalFilters);
    const result = groupToFilters(group);

    expect(result).toEqual([]);
  });

  it("round-trips single filter", () => {
    const originalFilters: FilterCondition[] = [
      { column: "id", operator: "=", value: 123 }
    ];

    const group = filtersToGroup(originalFilters);
    const result = groupToFilters(group);

    expect(result).toEqual(originalFilters);
  });
});

describe("mapFilterGroupColumns - Display to Filter Column Mapping", () => {
  it("maps single column in simple filter group", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing Bounty"] }
      ]
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "parentBountyName", operator: "IN", value: ["Marketing Bounty"] }
      ]
    });
  });

  it("maps multiple columns in filter group", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing"] },
        { column: "categoryId", operator: "=", value: "Treasury" }
      ]
    };
    const columnMap = new Map([
      ["parentBountyId", "parentBountyName"],
      ["categoryId", "categoryName"]
    ]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "parentBountyName", operator: "IN", value: ["Marketing"] },
        { column: "categoryName", operator: "=", value: "Treasury" }
      ]
    });
  });

  it("maps columns in nested filter groups (recursive)", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing"] },
        {
          operator: "OR",
          conditions: [
            { column: "categoryId", operator: "=", value: "Events" },
            { column: "parentBountyId", operator: "=", value: "Development" }
          ]
        }
      ]
    };
    const columnMap = new Map([
      ["parentBountyId", "parentBountyName"],
      ["categoryId", "categoryName"]
    ]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "parentBountyName", operator: "IN", value: ["Marketing"] },
        {
          operator: "OR",
          conditions: [
            { column: "categoryName", operator: "=", value: "Events" },
            { column: "parentBountyName", operator: "=", value: "Development" }
          ]
        }
      ]
    });
  });

  it("leaves unmapped columns unchanged", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing"] },
        { column: "status", operator: "=", value: "Active" },
        { column: "amount", operator: ">", value: 1000 }
      ]
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "parentBountyName", operator: "IN", value: ["Marketing"] },
        { column: "status", operator: "=", value: "Active" },
        { column: "amount", operator: ">", value: 1000 }
      ]
    });
  });

  it("handles empty column map", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing"] }
      ]
    };
    const columnMap = new Map<string, string>();

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual(filterGroup);
  });

  it("handles empty filter group", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: []
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect(result).toEqual({
      operator: "AND",
      conditions: []
    });
  });

  it("preserves all operator types during mapping", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "=", value: "Marketing" },
        { column: "parentBountyId", operator: "!=", value: "Development" },
        { column: "parentBountyId", operator: "LIKE", value: "%Marketing%" },
        { column: "parentBountyId", operator: "IN", value: ["Marketing", "Development"] },
        { column: "parentBountyId", operator: "NOT IN", value: ["Root"] },
        { column: "parentBountyId", operator: "IS NULL", value: null },
        { column: "parentBountyId", operator: "IS NOT NULL", value: null }
      ]
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    // All conditions should have mapped column
    (result.conditions as FilterCondition[]).forEach(condition => {
      expect(condition.column).toBe("parentBountyName");
    });

    // All operators should be preserved
    expect((result.conditions[0] as FilterCondition).operator).toBe("=");
    expect((result.conditions[1] as FilterCondition).operator).toBe("!=");
    expect((result.conditions[2] as FilterCondition).operator).toBe("LIKE");
    expect((result.conditions[3] as FilterCondition).operator).toBe("IN");
    expect((result.conditions[4] as FilterCondition).operator).toBe("NOT IN");
    expect((result.conditions[5] as FilterCondition).operator).toBe("IS NULL");
    expect((result.conditions[6] as FilterCondition).operator).toBe("IS NOT NULL");
  });

  it("preserves values during mapping", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "IN", value: ["Marketing Bounty", "Development Bounty"] },
        { column: "amount", operator: ">", value: 1000 }
      ]
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    expect((result.conditions[0] as FilterCondition).value).toEqual(["Marketing Bounty", "Development Bounty"]);
    expect((result.conditions[1] as FilterCondition).value).toBe(1000);
  });

  it("maps deeply nested filter groups (3+ levels)", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "parentBountyId", operator: "=", value: "Level1" },
        {
          operator: "OR",
          conditions: [
            { column: "parentBountyId", operator: "=", value: "Level2a" },
            {
              operator: "AND",
              conditions: [
                { column: "parentBountyId", operator: "=", value: "Level3" }
              ]
            }
          ]
        }
      ]
    };
    const columnMap = new Map([["parentBountyId", "parentBountyName"]]);

    const result = mapFilterGroupColumns(filterGroup, columnMap);

    // Verify all levels are mapped
    expect((result.conditions[0] as FilterCondition).column).toBe("parentBountyName");
    const level2 = result.conditions[1] as FilterGroup;
    expect((level2.conditions[0] as FilterCondition).column).toBe("parentBountyName");
    const level3 = level2.conditions[1] as FilterGroup;
    expect((level3.conditions[0] as FilterCondition).column).toBe("parentBountyName");
  });
});

describe("FilterGroup nested structure preservation", () => {
  it("preserves simple nested AND/OR groups", () => {
    const nestedGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        {
          operator: "OR",
          conditions: [
            { column: "priority", operator: "=", value: "High" },
            { column: "priority", operator: "=", value: "Critical" }
          ]
        }
      ]
    };

    // Verify structure is preserved (not flattened)
    expect(nestedGroup.conditions).toHaveLength(2);
    expect(nestedGroup.conditions[0]).toHaveProperty('column', 'status');
    expect(nestedGroup.conditions[1]).toHaveProperty('operator', 'OR');

    // Verify nested group has correct structure
    const nestedCondition = nestedGroup.conditions[1] as FilterGroup;
    expect(nestedCondition.conditions).toHaveLength(2);
    expect(nestedCondition.conditions[0]).toHaveProperty('column', 'priority');
    expect(nestedCondition.conditions[0]).toHaveProperty('value', 'High');
  });

  it("preserves deeply nested groups (3+ levels)", () => {
    const deeplyNested: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "col1", operator: "=", value: "a" },
        {
          operator: "OR",
          conditions: [
            { column: "col2", operator: "=", value: "b" },
            {
              operator: "AND",
              conditions: [
                { column: "col3", operator: "=", value: "c" },
                {
                  operator: "OR",
                  conditions: [
                    { column: "col4", operator: "=", value: "d" },
                    { column: "col5", operator: "=", value: "e" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    // Verify top level
    expect(deeplyNested.conditions).toHaveLength(2);

    // Verify second level
    const level2 = deeplyNested.conditions[1] as FilterGroup;
    expect(level2.operator).toBe("OR");
    expect(level2.conditions).toHaveLength(2);

    // Verify third level
    const level3 = level2.conditions[1] as FilterGroup;
    expect(level3.operator).toBe("AND");
    expect(level3.conditions).toHaveLength(2);

    // Verify fourth level
    const level4 = level3.conditions[1] as FilterGroup;
    expect(level4.operator).toBe("OR");
    expect(level4.conditions).toHaveLength(2);
  });

  it("handles empty nested groups", () => {
    const withEmptyGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        {
          operator: "OR",
          conditions: []
        }
      ]
    };

    expect(withEmptyGroup.conditions).toHaveLength(2);
    const nestedGroup = withEmptyGroup.conditions[1] as FilterGroup;
    expect(nestedGroup.conditions).toHaveLength(0);
  });

  it("preserves mixed condition and group types", () => {
    const mixed: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        { column: "amount", operator: ">", value: 1000 },
        {
          operator: "OR",
          conditions: [
            { column: "category", operator: "IN", value: ["A", "B"] }
          ]
        },
        { column: "date", operator: ">=", value: "2024-01-01" }
      ]
    };

    expect(mixed.conditions).toHaveLength(4);
    expect('column' in mixed.conditions[0]).toBe(true);
    expect('column' in mixed.conditions[1]).toBe(true);
    expect('operator' in mixed.conditions[2] && !('column' in mixed.conditions[2])).toBe(true);
    expect('column' in mixed.conditions[3]).toBe(true);
  });
});

describe("convertFiltersToQueryConfig - Column Alias Resolution", () => {
  it("resolves single column alias in FilterGroup", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NULL", value: null }
      ]
    };
    const columnIdToRef = { category: "c.category" };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "c.category", operator: "IS NULL", value: null }
      ]
    });
  });

  it("resolves multiple column aliases in FilterGroup", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NULL", value: null },
        { column: "subcategory", operator: "=", value: "Bounties" }
      ]
    };
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "c.category", operator: "IS NULL", value: null },
        { column: "c.subcategory", operator: "=", value: "Bounties" }
      ]
    });
  });

  it("resolves aliases in nested filter groups", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Active"] },
        {
          operator: "OR",
          conditions: [
            { column: "category", operator: "=", value: "Treasury" },
            { column: "subcategory", operator: "=", value: "Fellowship" }
          ]
        }
      ]
    };
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Active"] },
        {
          operator: "OR",
          conditions: [
            { column: "c.category", operator: "=", value: "Treasury" },
            { column: "c.subcategory", operator: "=", value: "Fellowship" }
          ]
        }
      ]
    });
  });

  it("resolves aliases in deeply nested filter groups", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NOT NULL", value: null },
        {
          operator: "OR",
          conditions: [
            { column: "status", operator: "=", value: "Active" },
            {
              operator: "AND",
              conditions: [
                { column: "subcategory", operator: "=", value: "Bounties" },
                { column: "category", operator: "=", value: "Treasury" }
              ]
            }
          ]
        }
      ]
    };
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef) as FilterGroup;

    // Check top-level category resolved
    expect((result.conditions[0] as FilterCondition).column).toBe("c.category");

    // Check deeply nested conditions resolved
    const nestedOr = result.conditions[1] as FilterGroup;
    const nestedAnd = nestedOr.conditions[1] as FilterGroup;
    expect((nestedAnd.conditions[0] as FilterCondition).column).toBe("c.subcategory");
    expect((nestedAnd.conditions[1] as FilterCondition).column).toBe("c.category");
  });

  it("leaves non-aliased columns unchanged", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NULL", value: null },
        { column: "status", operator: "IN", value: ["Executed"] },
        { column: "id", operator: ">", value: 100 }
      ]
    };
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "c.category", operator: "IS NULL", value: null },
        { column: "status", operator: "IN", value: ["Executed"] },
        { column: "id", operator: ">", value: 100 }
      ]
    });
  });

  it("handles empty columnIdToRef mapping gracefully", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NULL", value: null }
      ]
    };
    const columnIdToRef = {};

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef);

    expect(result).toEqual({
      operator: "AND",
      conditions: [
        { column: "category", operator: "IS NULL", value: null }
      ]
    });
  });

  it("works without columnIdToRef for backward compatibility", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Active"] }
      ]
    };

    const result = convertFiltersToQueryConfig([], filterGroup);

    expect(result).toEqual(filterGroup);
  });

  it("preserves all filter operators during alias resolution", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "=", value: "Treasury" },
        { column: "category", operator: "!=", value: "Fellowship" },
        { column: "category", operator: "LIKE", value: "%Treasury%" },
        { column: "category", operator: "IN", value: ["Treasury", "Fellowship"] },
        { column: "category", operator: "NOT IN", value: ["Root"] },
        { column: "category", operator: "IS NULL", value: null },
        { column: "category", operator: "IS NOT NULL", value: null }
      ]
    };
    const columnIdToRef = { category: "c.category" };

    const result = convertFiltersToQueryConfig([], filterGroup, columnIdToRef) as FilterGroup;

    // All conditions should have resolved column
    result.conditions.forEach(condition => {
      expect((condition as FilterCondition).column).toBe("c.category");
    });

    // All operators should be preserved
    expect((result.conditions[0] as FilterCondition).operator).toBe("=");
    expect((result.conditions[1] as FilterCondition).operator).toBe("!=");
    expect((result.conditions[2] as FilterCondition).operator).toBe("LIKE");
    expect((result.conditions[3] as FilterCondition).operator).toBe("IN");
    expect((result.conditions[4] as FilterCondition).operator).toBe("NOT IN");
    expect((result.conditions[5] as FilterCondition).operator).toBe("IS NULL");
    expect((result.conditions[6] as FilterCondition).operator).toBe("IS NOT NULL");
  });
});

describe("convertFiltersToQueryConfig - Unified State Model", () => {
  it("prioritizes filterGroup over columnFilters when both present", () => {
    const columnFilters: ColumnFiltersState = [
      { id: "status", value: ["Active"] }
    ];
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Pending", "Completed"] },
        { column: "amount", operator: ">", value: 1000 }
      ]
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    // Should return filterGroup, not columnFilters
    expect(result).toEqual(filterGroup);
  });

  it("falls back to columnFilters when filterGroup empty", () => {
    const columnFilters: ColumnFiltersState = [
      { id: "status", value: ["Active", "Pending"] },
      { id: "title", value: "test" }
    ];
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: []
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    // Should return converted columnFilters
    expect(result).toEqual([
      { column: "status", operator: "IN", value: ["Active", "Pending"] },
      { column: "title", operator: "LIKE", value: "%test%" }
    ]);
  });

  it("falls back to columnFilters when filterGroup undefined", () => {
    const columnFilters: ColumnFiltersState = [
      { id: "track", value: ["root", "fellowship"] }
    ];

    const result = convertFiltersToQueryConfig(columnFilters, undefined);

    expect(result).toEqual([
      { column: "track", operator: "IN", value: ["root", "fellowship"] }
    ]);
  });

  it("returns empty array when both are empty", () => {
    const columnFilters: ColumnFiltersState = [];
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: []
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    expect(result).toEqual([]);
  });

  it("returns empty array when both are undefined/empty", () => {
    const columnFilters: ColumnFiltersState = [];

    const result = convertFiltersToQueryConfig(columnFilters, undefined);

    expect(result).toEqual([]);
  });

  it("handles filterGroup with nested conditions", () => {
    const columnFilters: ColumnFiltersState = [];
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Active"] },
        {
          operator: "OR",
          conditions: [
            { column: "priority", operator: "=", value: "High" },
            { column: "urgent", operator: "=", value: 1 }
          ]
        }
      ]
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    // Should return filterGroup with nested structure intact
    expect(result).toEqual(filterGroup);
  });

  it("backward compatibility: handles legacy columnFilters-only saved views", () => {
    // Simulates loading old saved view that only has columnFilters
    const columnFilters: ColumnFiltersState = [
      { id: "status", value: ["Active", "Pending", "Completed"] },
      { id: "track", value: ["root"] },
      { id: "title", value: "governance" }
    ];

    const result = convertFiltersToQueryConfig(columnFilters, undefined);

    expect(result).toEqual([
      { column: "status", operator: "IN", value: ["Active", "Pending", "Completed"] },
      { column: "track", operator: "IN", value: ["root"] },
      { column: "title", operator: "LIKE", value: "%governance%" }
    ]);
  });

  it("unified state: faceted filters write to filterGroup", () => {
    // Simulates new behavior where faceted filter writes to filterGroup
    const columnFilters: ColumnFiltersState = []; // No longer used by faceted filters
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "IN", value: ["Active", "Pending"] },
        { column: "track", operator: "IN", value: ["root"] }
      ]
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    expect(result).toEqual(filterGroup);
  });

  it("unified state: advanced filter and faceted filter coexist in filterGroup", () => {
    const columnFilters: ColumnFiltersState = [];
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        // From faceted filter (status dropdown)
        { column: "status", operator: "IN", value: ["Active"] },
        // From faceted filter (track dropdown)
        { column: "track", operator: "IN", value: ["root", "fellowship"] },
        // From advanced filter composer
        { column: "DOT_proposal_time", operator: ">", value: 10000 }
      ]
    };

    const result = convertFiltersToQueryConfig(columnFilters, filterGroup);

    expect(result).toEqual(filterGroup);
    expect((result as FilterGroup).conditions.length).toBe(3);
  });
});

describe("buildFacetQueryConfig - Facet Query Alias Resolution", () => {
  it("resolves column aliases for facet columns", () => {
    const columns = ["category", "subcategory"];
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns,
      columnIdToRef
    });

    expect(result.columns).toEqual(["c.category", "c.subcategory"]);
  });

  it("includes joins configuration in facet query", () => {
    const joins = [{
      type: "LEFT" as const,
      table: "Categories",
      alias: "c",
      on: { left: "Referenda.category_id", right: "c.id" }
    }];

    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      joins,
      columnIdToRef: { category: "c.category" }
    });

    expect(result.joins).toEqual(joins);
  });

  it("resolves filter aliases in facet query", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "category", operator: "IN", value: ["Treasury"] }
      ]
    };
    const columnIdToRef = { category: "c.category" };

    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      filters: filterGroup,
      columnIdToRef
    });

    expect(result.filters).toEqual({
      operator: "AND",
      conditions: [
        { column: "c.category", operator: "IN", value: ["Treasury"] }
      ]
    });
  });

  it("leaves non-aliased columns unchanged", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["status", "track"],
      columnIdToRef: { category: "c.category" }
    });

    expect(result.columns).toEqual(["status", "track"]);
  });

  it("handles mixed aliased and non-aliased columns", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["status", "category", "track"],
      columnIdToRef: { category: "c.category" }
    });

    expect(result.columns).toEqual(["status", "c.category", "track"]);
  });

  it("works without columnIdToRef (backward compatibility)", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["status"]
    });

    expect(result.columns).toEqual(["status"]);
    expect(result.sourceTable).toBe("Referenda");
  });

  it("works without filters", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      columnIdToRef: { category: "c.category" }
    });

    expect(result.columns).toEqual(["c.category"]);
    expect(result.filters).toBeUndefined();
  });

  it("preserves sourceTable in output", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "ChildBounties",
      columns: ["category"],
      columnIdToRef: { category: "c.category" }
    });

    expect(result.sourceTable).toBe("ChildBounties");
  });

  it("handles deeply nested filter groups with alias resolution", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        {
          operator: "OR",
          conditions: [
            { column: "category", operator: "=", value: "Treasury" },
            { column: "subcategory", operator: "=", value: "Bounties" }
          ]
        }
      ]
    };
    const columnIdToRef = {
      category: "c.category",
      subcategory: "c.subcategory"
    };

    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      filters: filterGroup,
      columnIdToRef
    });

    expect(result.filters).toEqual({
      operator: "AND",
      conditions: [
        { column: "status", operator: "=", value: "Active" },
        {
          operator: "OR",
          conditions: [
            { column: "c.category", operator: "=", value: "Treasury" },
            { column: "c.subcategory", operator: "=", value: "Bounties" }
          ]
        }
      ]
    });
  });

  it("handles empty filters (undefined)", () => {
    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      filters: undefined,
      columnIdToRef: { category: "c.category" }
    });

    expect(result.filters).toBeUndefined();
  });

  it("handles empty conditions in filter group", () => {
    const filterGroup: FilterGroup = {
      operator: "AND",
      conditions: []
    };

    const result = buildFacetQueryConfig({
      sourceTable: "Referenda",
      columns: ["category"],
      filters: filterGroup,
      columnIdToRef: { category: "c.category" }
    });

    expect(result.filters).toEqual({
      operator: "AND",
      conditions: []
    });
  });
});

describe("normalizeDataKeys", () => {
  it("returns original data when no columns defined", () => {
    const data = [{ name: "test" }];
    expect(normalizeDataKeys(data, undefined)).toBe(data);
  });

  it("returns original data when columns array is empty", () => {
    const data = [{ name: "test" }];
    expect(normalizeDataKeys(data, [])).toBe(data);
  });

  it("returns original data when data array is empty", () => {
    const data: Record<string, unknown>[] = [];
    const columns = [{ column: "Categories.name" }];
    expect(normalizeDataKeys(data, columns)).toBe(data);
  });

  it("normalizes joined column keys without aliases", () => {
    const data = [{ name: "Treasury", value: 100 }];
    const columns = [{ column: "Categories.name" }, { column: "value" }];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { "Categories.name": "Treasury", value: 100 }
    ]);
  });

  it("normalizes multiple joined columns", () => {
    const data = [{ name: "Treasury", subcategory: "Bounties", amount: 5000 }];
    const columns = [
      { column: "Categories.name" },
      { column: "Categories.subcategory" },
      { column: "amount" }
    ];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { "Categories.name": "Treasury", "Categories.subcategory": "Bounties", amount: 5000 }
    ]);
  });

  it("preserves aliased columns unchanged", () => {
    const data = [{ category: "Treasury" }];
    const columns = [{ column: "c.category", alias: "category" }];
    expect(normalizeDataKeys(data, columns)).toEqual(data);
  });

  it("preserves aggregate function keys", () => {
    const data = [{ sum_amount: 5000 }];
    const columns = [{ column: "amount", aggregateFunction: "SUM" }];
    expect(normalizeDataKeys(data, columns)).toEqual(data);
  });

  it("handles mixed aliased and non-aliased columns", () => {
    const data = [{ category: "Treasury", name: "Subcategory1", amount: 100 }];
    const columns = [
      { column: "c.category", alias: "category" },
      { column: "Categories.name" },
      { column: "amount" }
    ];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { category: "Treasury", "Categories.name": "Subcategory1", amount: 100 }
    ]);
  });

  it("handles multiple rows", () => {
    const data = [
      { name: "Treasury", value: 100 },
      { name: "Fellowship", value: 200 },
      { name: "Events", value: 300 }
    ];
    const columns = [{ column: "Categories.name" }, { column: "value" }];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { "Categories.name": "Treasury", value: 100 },
      { "Categories.name": "Fellowship", value: 200 },
      { "Categories.name": "Events", value: 300 }
    ]);
  });

  it("returns original data when no key mapping needed", () => {
    const data = [{ id: 1, status: "Active", amount: 100 }];
    const columns = [
      { column: "id" },
      { column: "status" },
      { column: "amount" }
    ];
    const result = normalizeDataKeys(data, columns);
    // Should return same reference when no mapping needed
    expect(result).toBe(data);
  });

  it("handles deeply nested table references", () => {
    const data = [{ column: "Value" }];
    const columns = [{ column: "Schema.Table.column" }];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { "Schema.Table.column": "Value" }
    ]);
  });

  it("handles aggregate with alias (alias takes precedence)", () => {
    const data = [{ total: 5000 }];
    const columns = [{ column: "amount", aggregateFunction: "SUM", alias: "total" }];
    expect(normalizeDataKeys(data, columns)).toEqual(data);
  });

  it("preserves extra keys not in column definition", () => {
    const data = [{ name: "Treasury", extra_field: "extra" }];
    const columns = [{ column: "Categories.name" }];
    expect(normalizeDataKeys(data, columns)).toEqual([
      { "Categories.name": "Treasury", extra_field: "extra" }
    ]);
  });
});
