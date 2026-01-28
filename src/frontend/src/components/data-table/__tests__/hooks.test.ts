/**
 * DataTable Hooks Tests
 *
 * Tests for the extracted hooks from data-table.tsx:
 * - usePageTotals: calculates page-level totals for currency columns
 * - useHierarchicalData: processes data for hierarchical display
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTotals } from "../hooks/use-page-totals";
import { useHierarchicalData } from "../hooks/use-hierarchical-data";

// Mock column-renderer module
vi.mock("@/lib/column-renderer", () => ({
  getColumnConfig: vi.fn((_tableName: string, col: string) => {
    // Return currency type for columns containing "amount" or "DOT"
    if (col.includes("amount") || col.includes("DOT")) {
      return { type: "currency", decimals: 2 };
    }
    return { type: "text" };
  }),
  formatValue: vi.fn((value: number, config: { type: string }) => {
    if (config.type === "currency") {
      return `$${value.toFixed(2)}`;
    }
    return String(value);
  }),
}));

describe("usePageTotals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when showPageTotals is false", () => {
    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: false,
        data: [{ amount: 100 }],
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current).toEqual([]);
  });

  it("returns empty array when data is empty", () => {
    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data: [],
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current).toEqual([]);
  });

  it("returns empty array when config not loaded", () => {
    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data: [{ amount: 100 }],
        tableName: "test",
        configLoaded: false,
      })
    );

    expect(result.current).toEqual([]);
  });

  it("calculates totals for currency columns", () => {
    const data = [
      { amount: 100, name: "Item 1" },
      { amount: 200, name: "Item 2" },
      { amount: 300, name: "Item 3" },
    ];

    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].columnId).toBe("amount");
    expect(result.current[0].value).toBe("$600.00");
  });

  it("handles multiple currency columns", () => {
    const data = [
      { amount: 100, DOT_value: 50 },
      { amount: 200, DOT_value: 75 },
    ];

    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current).toHaveLength(2);
    const amountCell = result.current.find((c) => c.columnId === "amount");
    const dotCell = result.current.find((c) => c.columnId === "DOT_value");
    expect(amountCell?.value).toBe("$300.00");
    expect(dotCell?.value).toBe("$125.00");
  });

  it("uses columnMapping to resolve source columns", () => {
    const data = [{ total: 100 }, { total: 200 }];

    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data,
        tableName: "test",
        columnMapping: { total: "amount" }, // Maps 'total' display to 'amount' source
        configLoaded: true,
      })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].columnId).toBe("total");
  });

  it("handles null/undefined values in data", () => {
    const data = [
      { amount: 100 },
      { amount: null as unknown as number },
      { amount: 200 },
    ];

    const { result } = renderHook(() =>
      usePageTotals({
        showPageTotals: true,
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    // Should sum only numeric values (100 + 200 = 300)
    expect(result.current[0].value).toBe("$300.00");
  });
});

describe("useHierarchicalData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when hierarchicalDisplay is false", () => {
    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: false,
        groupByColumns: ["category", "subcategory"],
        data: [{ category: "A", subcategory: "B", amount: 100 }],
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current.hierarchicalData).toBeNull();
  });

  it("returns null when groupByColumns has fewer than 2 columns", () => {
    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: true,
        groupByColumns: ["category"],
        data: [{ category: "A", amount: 100 }],
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current.hierarchicalData).toBeNull();
  });

  it("returns null when data is empty", () => {
    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: true,
        groupByColumns: ["category", "subcategory"],
        data: [],
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current.hierarchicalData).toBeNull();
  });

  it("normalizes groupByColumns to match data keys", () => {
    const data = [{ category: "A", subcategory: "B" }];

    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: false,
        groupByColumns: ["table.category", "table.subcategory"],
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    // Should strip table prefix to match actual data keys
    expect(result.current.normalizedGroupByColumns).toEqual([
      "category",
      "subcategory",
    ]);
  });

  it("keeps column names that already match data keys", () => {
    const data = [{ category: "A", subcategory: "B" }];

    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: false,
        groupByColumns: ["category", "subcategory"],
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current.normalizedGroupByColumns).toEqual([
      "category",
      "subcategory",
    ]);
  });

  it("processes hierarchical data correctly", () => {
    const data = [
      { category: "A", subcategory: "X", amount: 100 },
      { category: "A", subcategory: "Y", amount: 200 },
      { category: "B", subcategory: "Z", amount: 300 },
    ];

    const { result } = renderHook(() =>
      useHierarchicalData({
        hierarchicalDisplay: true,
        groupByColumns: ["category", "subcategory"],
        data,
        tableName: "test",
        configLoaded: true,
      })
    );

    expect(result.current.hierarchicalData).not.toBeNull();
    expect(result.current.hierarchicalData!.rows).toHaveLength(3);
    // Subtotals: X, Y, A (category), Z, B (category) = 5 total
    expect(result.current.hierarchicalData!.subtotals.length).toBeGreaterThan(0);
  });
});
