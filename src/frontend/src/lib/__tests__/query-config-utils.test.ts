/**
 * Query Config Utils Tests
 *
 * Tests for conversion utilities that transform TanStack Table state
 * into QueryConfig format for server-side sorting and filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sortingStateToOrderBy, filterStateToQueryFilters, filtersToGroup, groupToFilters } from "../query-config-utils";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";
import type { FilterCondition, FilterGroup } from "@/lib/db/types";

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

describe("groupToFilters", () => {
  // Mock console.warn to prevent test output noise
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(console.warn).toHaveBeenCalledTimes(2);
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
    expect(console.warn).not.toHaveBeenCalled();
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
