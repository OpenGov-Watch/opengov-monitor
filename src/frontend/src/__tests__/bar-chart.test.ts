/**
 * Bar Chart Transformation Tests
 *
 * Tests for data transformation in components/charts/bar-chart.tsx
 */

import { describe, it, expect } from "vitest";
import { transformToBarData } from "../components/charts/bar-chart";

describe("transformToBarData", () => {
  describe("standard transformation (no pivot)", () => {
    it("transforms data with multiple numeric value columns", () => {
      const data = [
        { quarter: "2024-Q1", usd: 1000, dot: 500 },
        { quarter: "2024-Q2", usd: 2000, dot: 800 },
      ];

      const result = transformToBarData(data, "quarter", ["usd", "dot"]);

      expect(result.data).toEqual([
        { name: "2024-Q1", usd: 1000, dot: 500 },
        { name: "2024-Q2", usd: 2000, dot: 800 },
      ]);
      expect(result.bars).toEqual([
        { dataKey: "usd", name: "usd" },
        { dataKey: "dot", name: "dot" },
      ]);
    });

    it("handles empty data", () => {
      const result = transformToBarData([], "quarter", ["usd"]);

      expect(result.data).toEqual([]);
      expect(result.bars).toEqual([]);
    });

    it("converts non-numeric values to 0", () => {
      const data = [{ quarter: "2024-Q1", usd: null, dot: undefined }];

      const result = transformToBarData(
        data as Record<string, unknown>[],
        "quarter",
        ["usd", "dot"]
      );

      expect(result.data[0].usd).toBe(0);
      expect(result.data[0].dot).toBe(0);
    });
  });

  describe("pivot transformation (categorical column detected)", () => {
    it("pivots data when categorical column is present", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 1000, category: "Development" },
        { quarter: "2024-Q1", sum_usd: 500, category: "Outreach" },
        { quarter: "2024-Q2", sum_usd: 2000, category: "Development" },
        { quarter: "2024-Q2", sum_usd: 800, category: "Outreach" },
      ];

      const result = transformToBarData(data, "quarter", [
        "sum_usd",
        "category",
      ]);

      expect(result.data).toEqual([
        { name: "2024-Q1", Development: 1000, Outreach: 500 },
        { name: "2024-Q2", Development: 2000, Outreach: 800 },
      ]);
      expect(result.bars).toEqual([
        { dataKey: "Development", name: "Development" },
        { dataKey: "Outreach", name: "Outreach" },
      ]);
    });

    it("sums values for duplicate label+series combinations", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 1000, category: "Development" },
        { quarter: "2024-Q1", sum_usd: 500, category: "Development" }, // duplicate
      ];

      const result = transformToBarData(data, "quarter", [
        "sum_usd",
        "category",
      ]);

      expect(result.data[0].Development).toBe(1500); // 1000 + 500
    });

    it("initializes missing series to 0", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 1000, category: "Development" },
        { quarter: "2024-Q2", sum_usd: 800, category: "Outreach" },
      ];

      const result = transformToBarData(data, "quarter", [
        "sum_usd",
        "category",
      ]);

      // Q1 should have Outreach: 0, Q2 should have Development: 0
      expect(result.data[0].Outreach).toBe(0);
      expect(result.data[1].Development).toBe(0);
    });

    it("sorts categories alphabetically for consistent colors", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 100, category: "Zebra" },
        { quarter: "2024-Q1", sum_usd: 200, category: "Alpha" },
        { quarter: "2024-Q1", sum_usd: 300, category: "Beta" },
      ];

      const result = transformToBarData(data, "quarter", [
        "sum_usd",
        "category",
      ]);

      // Bars should be sorted alphabetically for consistent colors with pie charts
      expect(result.bars.map((b) => b.dataKey)).toEqual([
        "Alpha",
        "Beta",
        "Zebra",
      ]);
    });

    it("handles Unknown category values", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 1000, category: null },
        { quarter: "2024-Q1", sum_usd: 500, category: "Development" },
      ];

      const result = transformToBarData(
        data as Record<string, unknown>[],
        "quarter",
        ["sum_usd", "category"]
      );

      expect(result.data[0].Unknown).toBe(1000);
      expect(result.data[0].Development).toBe(500);
    });

    it("sorts Unknown category last for consistency", () => {
      const data = [
        { quarter: "2024-Q1", sum_usd: 100, category: null },
        { quarter: "2024-Q1", sum_usd: 200, category: "Alpha" },
        { quarter: "2024-Q1", sum_usd: 300, category: "Zebra" },
      ];

      const result = transformToBarData(
        data as Record<string, unknown>[],
        "quarter",
        ["sum_usd", "category"]
      );

      // Unknown should always be sorted last
      expect(result.bars.map((b) => b.dataKey)).toEqual([
        "Alpha",
        "Zebra",
        "Unknown",
      ]);
    });

    it("does not pivot when categorical column has numeric strings", () => {
      const data = [
        { quarter: "2024-Q1", value1: 1000, value2: "500" },
        { quarter: "2024-Q2", value1: 2000, value2: "800" },
      ];

      const result = transformToBarData(data, "quarter", ["value1", "value2"]);

      // value2 is a numeric string, so no pivot - standard transformation
      expect(result.data[0].value1).toBe(1000);
      expect(result.data[0].value2).toBe(500); // converted to number
      expect(result.bars.length).toBe(2);
      expect(result.bars[0].dataKey).toBe("value1");
      expect(result.bars[1].dataKey).toBe("value2");
    });
  });
});
