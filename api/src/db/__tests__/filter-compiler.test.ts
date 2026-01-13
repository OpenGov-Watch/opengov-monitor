/**
 * Filter Compiler Tests
 *
 * SECURITY CRITICAL: Tests for SQL injection prevention and input validation
 * in the advanced filter compiler.
 */

import { describe, it, expect } from "vitest";
import {
  compileAdvancedFilters,
  compileSortConditions,
  validateGroupBy,
  validateColumn,
} from "../filter-compiler.js";
import type { AdvancedFilterGroup, AdvancedFilterCondition, SortCondition } from "../types.js";

const mockColumns = ["id", "status", "title", "DOT_latest", "USD_latest", "category", "proposal_time"];

describe("Filter Compiler", () => {
  describe("validateColumn", () => {
    it("should accept valid column names", () => {
      expect(() => validateColumn("id", mockColumns)).not.toThrow();
      expect(() => validateColumn("status", mockColumns)).not.toThrow();
    });

    it("should reject invalid column names", () => {
      expect(() => validateColumn("invalid_column", mockColumns)).toThrow("Invalid column");
      expect(() => validateColumn("DROP TABLE", mockColumns)).toThrow("Invalid column");
    });
  });

  describe("compileAdvancedFilters - Basic Conditions", () => {
    it("should compile simple equality filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "=", value: "Executed" },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" = ?');
      expect(params).toEqual(["Executed"]);
    });

    it("should compile inequality filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "!=", value: "Rejected" },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" != ?');
      expect(params).toEqual(["Rejected"]);
    });

    it("should compile comparison filters", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "DOT_latest", operator: ">", value: 10000 },
          { column: "DOT_latest", operator: "<", value: 50000 },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"DOT_latest" > ? AND "DOT_latest" < ?');
      expect(params).toEqual([10000, 50000]);
    });

    it("should compile LIKE filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "title", operator: "LIKE", value: "%infrastructure%" },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"title" LIKE ?');
      expect(params).toEqual(["%infrastructure%"]);
    });

    it("should compile NOT LIKE filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "title", operator: "NOT LIKE", value: "%test%" },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"title" NOT LIKE ?');
      expect(params).toEqual(["%test%"]);
    });

    it("should compile IS NULL filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "category", operator: "IS NULL", value: null },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"category" IS NULL');
      expect(params).toEqual([]);
    });

    it("should compile IS NOT NULL filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "category", operator: "IS NOT NULL", value: null },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"category" IS NOT NULL');
      expect(params).toEqual([]);
    });

    it("should compile IN filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: ["Executed", "Approved", "Rejected"] },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" IN (?, ?, ?)');
      expect(params).toEqual(["Executed", "Approved", "Rejected"]);
    });

    it("should compile NOT IN filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "NOT IN", value: ["Rejected", "Cancelled"] },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" NOT IN (?, ?)');
      expect(params).toEqual(["Rejected", "Cancelled"]);
    });

    it("should compile BETWEEN filter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "DOT_latest", operator: "BETWEEN", value: [1000, 5000] },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"DOT_latest" BETWEEN ? AND ?');
      expect(params).toEqual([1000, 5000]);
    });
  });

  describe("compileAdvancedFilters - Complex Groups", () => {
    it("should compile AND group with multiple conditions", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "=", value: "Executed" },
          { column: "DOT_latest", operator: ">", value: 10000 },
          { column: "category", operator: "IS NOT NULL", value: null },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" = ? AND "DOT_latest" > ? AND "category" IS NOT NULL');
      expect(params).toEqual(["Executed", 10000]);
    });

    it("should compile OR group with multiple conditions", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "OR",
        conditions: [
          { column: "status", operator: "=", value: "Executed" },
          { column: "status", operator: "=", value: "Approved" },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"status" = ? OR "status" = ?');
      expect(params).toEqual(["Executed", "Approved"]);
    });

    it("should compile nested filter groups", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "category", operator: "IS NOT NULL", value: null },
          {
            combinator: "OR",
            conditions: [
              { column: "status", operator: "=", value: "Executed" },
              { column: "DOT_latest", operator: ">", value: 50000 },
            ],
          },
        ],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe('"category" IS NOT NULL AND ("status" = ? OR "DOT_latest" > ?)');
      expect(params).toEqual(["Executed", 50000]);
    });

    it("should handle empty conditions array", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [],
      };

      const { clause, params } = compileAdvancedFilters(filters, mockColumns);
      expect(clause).toBe("");
      expect(params).toEqual([]);
    });

    it("should handle undefined filters", () => {
      const { clause, params } = compileAdvancedFilters(undefined, mockColumns);
      expect(clause).toBe("");
      expect(params).toEqual([]);
    });
  });

  describe("compileAdvancedFilters - Security Tests", () => {
    it("should reject invalid column names", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "invalid_column", operator: "=", value: "test" },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "Invalid column: invalid_column"
      );
    });

    it("should reject invalid operators", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "UNION" as any, value: "test" },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow("Invalid operator");
    });

    it("should reject deeply nested filters (>10 levels)", () => {
      // Create 11 levels of nesting
      let deepFilter: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [{ column: "status", operator: "=", value: "test" }],
      };

      for (let i = 0; i < 11; i++) {
        deepFilter = {
          combinator: "AND",
          conditions: [deepFilter],
        };
      }

      expect(() => compileAdvancedFilters(deepFilter, mockColumns)).toThrow(
        "Filter nesting too deep"
      );
    });

    it("should reject excessive number of conditions", () => {
      const conditions: AdvancedFilterCondition[] = [];
      for (let i = 0; i < 101; i++) {
        conditions.push({ column: "status", operator: "=", value: `test${i}` });
      }

      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions,
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "Too many filter conditions"
      );
    });

    it("should reject IN operator with empty array", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: [] },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "IN operator requires at least one value"
      );
    });

    it("should reject IN operator with non-array value", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "IN", value: "test" as any },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "IN operator requires an array value"
      );
    });

    it("should reject BETWEEN operator with invalid value", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "DOT_latest", operator: "BETWEEN", value: [1000] as any },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "BETWEEN operator requires an array with exactly 2 values"
      );
    });

    it("should reject comparison operators with null value", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "=", value: null },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "requires a non-null value"
      );
    });

    it("should reject LIKE operator with non-string value", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "title", operator: "LIKE", value: 123 as any },
        ],
      };

      expect(() => compileAdvancedFilters(filters, mockColumns)).toThrow(
        "LIKE operator requires a string value"
      );
    });
  });

  describe("compileSortConditions", () => {
    it("should compile single sort condition", () => {
      const sorts: SortCondition[] = [
        { column: "DOT_latest", direction: "DESC" },
      ];

      const orderBy = compileSortConditions(sorts, mockColumns);
      expect(orderBy).toBe('"DOT_latest" DESC');
    });

    it("should compile multiple sort conditions", () => {
      const sorts: SortCondition[] = [
        { column: "status", direction: "ASC" },
        { column: "DOT_latest", direction: "DESC" },
      ];

      const orderBy = compileSortConditions(sorts, mockColumns);
      expect(orderBy).toBe('"status" ASC, "DOT_latest" DESC');
    });

    it("should handle empty sorts array", () => {
      const orderBy = compileSortConditions([], mockColumns);
      expect(orderBy).toBe("");
    });

    it("should handle undefined sorts", () => {
      const orderBy = compileSortConditions(undefined, mockColumns);
      expect(orderBy).toBe("");
    });

    it("should reject invalid column names", () => {
      const sorts: SortCondition[] = [
        { column: "invalid_column", direction: "ASC" },
      ];

      expect(() => compileSortConditions(sorts, mockColumns)).toThrow("Invalid column");
    });

    it("should reject invalid sort direction", () => {
      const sorts: SortCondition[] = [
        { column: "status", direction: "INVALID" as any },
      ];

      expect(() => compileSortConditions(sorts, mockColumns)).toThrow(
        "Invalid sort direction"
      );
    });
  });

  describe("validateGroupBy", () => {
    it("should validate and return quoted column name", () => {
      const groupBy = validateGroupBy("category", mockColumns);
      expect(groupBy).toBe('"category"');
    });

    it("should handle undefined groupBy", () => {
      const groupBy = validateGroupBy(undefined, mockColumns);
      expect(groupBy).toBe("");
    });

    it("should reject invalid column names", () => {
      expect(() => validateGroupBy("invalid_column", mockColumns)).toThrow("Invalid column");
    });
  });
});
