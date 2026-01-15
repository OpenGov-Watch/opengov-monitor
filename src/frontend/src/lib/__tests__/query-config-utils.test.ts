/**
 * Query Config Utils Tests
 *
 * Tests for conversion utilities that transform TanStack Table state
 * into QueryConfig format for server-side sorting and filtering.
 */

import { describe, it, expect } from "vitest";
import { sortingStateToOrderBy, filterStateToQueryFilters } from "../query-config-utils";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";

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
