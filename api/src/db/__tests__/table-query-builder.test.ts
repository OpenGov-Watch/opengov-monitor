/**
 * Table Query Builder Tests
 *
 * Tests for the parseTableQueryParams function and parameter parsing.
 */

import { describe, it, expect } from "vitest";
import { parseTableQueryParams } from "../table-query-builder.js";
import type { AdvancedFilterGroup, SortCondition } from "../types.js";

describe("Table Query Builder", () => {
  describe("parseTableQueryParams", () => {
    it("should parse valid filters parameter", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "=", value: "Executed" },
        ],
      };

      const params = {
        filters: JSON.stringify(filters),
      };

      const result = parseTableQueryParams(params);
      expect(result.filters).toEqual(filters);
    });

    it("should parse valid sorts parameter", () => {
      const sorts: SortCondition[] = [
        { column: "DOT_latest", direction: "DESC" },
        { column: "status", direction: "ASC" },
      ];

      const params = {
        sorts: JSON.stringify(sorts),
      };

      const result = parseTableQueryParams(params);
      expect(result.sorts).toEqual(sorts);
    });

    it("should parse groupBy parameter", () => {
      const params = {
        groupBy: "category",
      };

      const result = parseTableQueryParams(params);
      expect(result.groupBy).toBe("category");
    });

    it("should parse limit parameter", () => {
      const params = {
        limit: "100",
      };

      const result = parseTableQueryParams(params);
      expect(result.limit).toBe(100);
    });

    it("should parse offset parameter", () => {
      const params = {
        offset: "50",
      };

      const result = parseTableQueryParams(params);
      expect(result.offset).toBe(50);
    });

    it("should parse all parameters together", () => {
      const filters: AdvancedFilterGroup = {
        combinator: "AND",
        conditions: [
          { column: "status", operator: "=", value: "Executed" },
        ],
      };

      const sorts: SortCondition[] = [
        { column: "DOT_latest", direction: "DESC" },
      ];

      const params = {
        filters: JSON.stringify(filters),
        sorts: JSON.stringify(sorts),
        groupBy: "category",
        limit: "100",
        offset: "0",
      };

      const result = parseTableQueryParams(params);
      expect(result.filters).toEqual(filters);
      expect(result.sorts).toEqual(sorts);
      expect(result.groupBy).toBe("category");
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
    });

    it("should handle empty parameters", () => {
      const result = parseTableQueryParams({});
      expect(result).toEqual({});
    });

    it("should reject invalid JSON in filters", () => {
      const params = {
        filters: "invalid json",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Failed to parse filters");
    });

    it("should reject invalid filter structure", () => {
      const params = {
        filters: JSON.stringify({ invalid: "structure" }),
      };

      expect(() => parseTableQueryParams(params)).toThrow("Invalid filter format");
    });

    it("should reject invalid JSON in sorts", () => {
      const params = {
        sorts: "invalid json",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Failed to parse sorts");
    });

    it("should reject non-array sorts", () => {
      const params = {
        sorts: JSON.stringify({ column: "status", direction: "ASC" }),
      };

      expect(() => parseTableQueryParams(params)).toThrow("Sorts must be an array");
    });

    it("should reject invalid limit value", () => {
      const params = {
        limit: "invalid",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Invalid limit value");
    });

    it("should reject negative limit", () => {
      const params = {
        limit: "-10",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Invalid limit value");
    });

    it("should reject invalid offset value", () => {
      const params = {
        offset: "invalid",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Invalid offset value");
    });

    it("should reject negative offset", () => {
      const params = {
        offset: "-5",
      };

      expect(() => parseTableQueryParams(params)).toThrow("Invalid offset value");
    });
  });
});
