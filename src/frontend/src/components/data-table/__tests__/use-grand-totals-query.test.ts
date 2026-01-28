/**
 * Tests for useGrandTotalsQuery hook
 *
 * Key test areas:
 * - Currency column detection via getColumnConfig
 * - SUM aggregate queries for currency columns
 * - Abort on unmount
 * - Conditional fetching based on showGrandTotals and data presence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGrandTotalsQuery } from "../hooks/use-grand-totals-query";
import type { FilterCondition } from "@/lib/db/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock column-renderer module
vi.mock("@/lib/column-renderer", () => ({
  getColumnConfig: vi.fn((_tableName: string, col: string) => {
    // Return currency type for columns containing "DOT" or "USD"
    if (col.includes("DOT") || col.includes("USD")) {
      return { type: "currency", decimals: 2 };
    }
    return { type: "text" };
  }),
}));

describe("useGrandTotalsQuery", () => {
  const defaultParams = {
    showGrandTotals: true,
    configLoaded: true,
    data: [
      { id: 1, title: "Test", DOT_latest: 100, USD_latest: 750 },
      { id: 2, title: "Test 2", DOT_latest: 200, USD_latest: 1500 },
    ],
    tableName: "Referenda",
    sourceTable: "Referenda",
    filters: [],
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty object when showGrandTotals is false", () => {
    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        showGrandTotals: false,
      })
    );

    expect(result.current).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when config not loaded", () => {
    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        configLoaded: false,
      })
    );

    expect(result.current).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when data is empty", () => {
    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        data: [],
      })
    );

    expect(result.current).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when data is undefined", () => {
    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        data: undefined as unknown as typeof defaultParams.data,
      })
    );

    expect(result.current).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty object when no currency columns exist", () => {
    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        data: [
          { id: 1, title: "Test", status: "Executed" },
          { id: 2, title: "Test 2", status: "Pending" },
        ],
      })
    );

    expect(result.current).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches grand totals for currency columns", async () => {
    const mockTotals = { DOT_latest: 300, USD_latest: 2250 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [mockTotals] }),
    });

    const { result } = renderHook(() =>
      useGrandTotalsQuery(defaultParams)
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockTotals);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/query/execute",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      })
    );

    // Verify the query config includes SUM aggregates
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.sourceTable).toBe("Referenda");
    expect(body.columns).toEqual([
      { column: "DOT_latest", alias: "DOT_latest", aggregateFunction: "SUM" },
      { column: "USD_latest", alias: "USD_latest", aggregateFunction: "SUM" },
    ]);
    expect(body.limit).toBe(1);
  });

  it("uses columnMapping to resolve source columns", async () => {
    const mockTotals = { total_dot: 300 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [mockTotals] }),
    });

    const { result } = renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        data: [{ id: 1, total_dot: 100, title: "Test" }],
        columnMapping: { total_dot: "DOT_latest" }, // Maps display to source
      })
    );

    await waitFor(() => {
      expect(result.current).toEqual(mockTotals);
    });

    // Verify the query config uses mapped column names
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.columns).toEqual([
      { column: "DOT_latest", alias: "total_dot", aggregateFunction: "SUM" },
    ]);
  });

  it("includes joins in aggregate query", async () => {
    const mockTotals = { DOT_latest: 300 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [mockTotals] }),
    });

    const joins = [
      {
        type: "LEFT" as const,
        table: "Categories",
        alias: "c",
        on: { left: "Referenda.category_id", right: "c.id" },
      },
    ];

    renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        joins,
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.joins).toEqual(joins);
  });

  it("includes filters in aggregate query", async () => {
    const filters = [{ column: "status", operator: "=" as const, value: "Executed" }];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ DOT_latest: 100 }] }),
    });

    renderHook(() =>
      useGrandTotalsQuery({
        ...defaultParams,
        filters,
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.filters).toEqual(filters);
  });

  it("handles fetch errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useGrandTotalsQuery(defaultParams)
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to fetch grand totals:",
        expect.any(Error)
      );
    });

    // Should return empty object on error
    expect(result.current).toEqual({});

    consoleSpy.mockRestore();
  });

  it("ignores AbortError silently", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    renderHook(() =>
      useGrandTotalsQuery(defaultParams)
    );

    // Wait a bit for the promise to settle
    await new Promise((r) => setTimeout(r, 100));

    // AbortError should not trigger warning
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("refetches when filters change", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ DOT_latest: 100, USD_latest: 750 }] }),
    });

    const { rerender } = renderHook(
      ({ filters }) =>
        useGrandTotalsQuery({
          ...defaultParams,
          filters,
        }),
      { initialProps: { filters: [] as FilterCondition[] } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change filters
    const newFilters: FilterCondition[] = [{ column: "status", operator: "=", value: "Executed" }];
    rerender({ filters: newFilters });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("refetches when data changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ DOT_latest: 100, USD_latest: 750 }] }),
    });

    const { rerender } = renderHook(
      ({ data }) =>
        useGrandTotalsQuery({
          ...defaultParams,
          data,
        }),
      { initialProps: { data: defaultParams.data } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change data
    rerender({
      data: [
        ...defaultParams.data,
        { id: 3, title: "Test 3", DOT_latest: 300, USD_latest: 2250 },
      ],
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("handles empty response data gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const { result } = renderHook(() =>
      useGrandTotalsQuery(defaultParams)
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Should remain empty object when response has no data
    expect(result.current).toEqual({});
  });

  it("handles null response data gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: null }),
    });

    const { result } = renderHook(() =>
      useGrandTotalsQuery(defaultParams)
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Should remain empty object when response has null data
    expect(result.current).toEqual({});
  });
});
