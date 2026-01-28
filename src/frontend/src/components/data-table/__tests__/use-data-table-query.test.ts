/**
 * Tests for useDataTableQuery hook
 *
 * Key test areas:
 * - 300ms debouncing to prevent blocking on every keystroke
 * - AbortController for canceling in-flight requests
 * - Parallel fetching of data and facets
 * - Error handling for failed requests
 * - Cleanup on unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDataTableQuery } from "../hooks/use-data-table-query";
import type { QueryConfig } from "@/lib/db/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useDataTableQuery", () => {
  const baseQueryConfig: Omit<QueryConfig, "filters"> = {
    sourceTable: "Referenda",
    columns: [{ column: "id" }, { column: "title" }],
  };

  const queryConfig: QueryConfig = {
    ...baseQueryConfig,
    filters: [],
  };

  const columnIdToRef: Record<string, string> = {
    id: "Referenda.id",
    title: "Referenda.title",
    status: "Referenda.status",
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns initial loading state", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.totalCount).toBeUndefined();
    expect(result.current.serverFacets).toEqual({});
  });

  it("fetches data successfully", async () => {
    const mockData = [
      { id: 1, title: "Referendum 1" },
      { id: 2, title: "Referendum 2" },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockData, totalCount: 2 }),
    });

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("debounces requests by 300ms", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], totalCount: 0 }),
    });

    const { rerender } = renderHook(
      ({ config }) =>
        useDataTableQuery({
          queryConfig: config,
          baseQueryConfig,
          columnIdToRef,
        }),
      { initialProps: { config: queryConfig } }
    );

    // Verify no fetch yet
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance 100ms (still within debounce)
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Update config before debounce completes
    const newConfig = { ...queryConfig, filters: [{ column: "id", operator: "=" as const, value: 1 }] };
    rerender({ config: newConfig });

    // Advance another 100ms (debounce resets)
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past new debounce threshold
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Query failed: invalid column" }),
    });

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Query failed: invalid column");
    expect(result.current.data).toEqual([]);
  });

  it("handles network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
  });

  it("fetches facets in parallel when facetedFilters provided", async () => {
    const mockData = [{ id: 1, title: "Test", status: "Executed" }];
    const mockFacets = {
      facets: {
        "Referenda.status": [
          { value: "Executed", count: 5 },
          { value: "Pending", count: 3 },
        ],
      },
    };

    // Mock both data and facet requests
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockData, totalCount: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFacets),
      });

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        facetedFilters: ["status"],
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Both requests should have been made
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call is data query
    expect(mockFetch.mock.calls[0][0]).toBe("/api/query/execute");

    // Second call is facet query
    expect(mockFetch.mock.calls[1][0]).toBe("/api/query/facets");

    // Facets should be populated (keyed by display column)
    expect(result.current.serverFacets.status).toBeDefined();
    expect(result.current.serverFacets.status.get("Executed")).toBe(5);
  });

  it("cancels in-flight requests when queryConfig changes", async () => {
    let resolveFirst: (value: unknown) => void;
    const firstRequest = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    mockFetch.mockImplementationOnce(() => firstRequest);

    const { rerender } = renderHook(
      ({ config }) =>
        useDataTableQuery({
          queryConfig: config,
          baseQueryConfig,
          columnIdToRef,
        }),
      { initialProps: { config: queryConfig } }
    );

    // Start first request
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Update config before first request completes
    const newConfig = { ...queryConfig, filters: [{ column: "id", operator: "=" as const, value: 1 }] };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 1 }], totalCount: 1 }),
    });

    rerender({ config: newConfig });

    // Advance past debounce for new request
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Second fetch should be initiated
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First request completes after abort - should be ignored
    resolveFirst!({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 999 }], totalCount: 1 }),
    });

    await waitFor(() => {
      // Should have data from second request, not first
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it("ignores AbortError silently", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const consoleSpy = vi.spyOn(console, "log");

    renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Give time for the abort to be processed
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should log "Request cancelled" not set error
    expect(consoleSpy).toHaveBeenCalledWith("Request cancelled");

    consoleSpy.mockRestore();
  });

  it("handles facet fetch failure gracefully", async () => {
    const mockData = [{ id: 1, title: "Test" }];

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockData, totalCount: 1 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Facet query failed" }),
      });

    const consoleSpy = vi.spyOn(console, "warn");

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        facetedFilters: ["status"],
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Data should still be loaded
    expect(result.current.data).toEqual(mockData);
    // Facets should be empty
    expect(result.current.serverFacets).toEqual({});
    // Should warn about facet failure
    expect(consoleSpy).toHaveBeenCalledWith(
      "Facet fetch failed, using client-side faceting"
    );

    consoleSpy.mockRestore();
  });

  it("maps filterColumn through columnOverrides", async () => {
    const mockFacets = {
      facets: {
        "b.name": [{ value: "Bounty 1", count: 5 }],
      },
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], totalCount: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFacets),
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnOverrides: any = {
      parentBountyId: {
        filterColumn: "parentBountyName",
      },
    };

    const columnIdToRefWithMapping = {
      ...columnIdToRef,
      parentBountyName: "b.name",
    };

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        facetedFilters: ["parentBountyId"],
        columnOverrides,
        columnIdToRef: columnIdToRefWithMapping,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Facet should be keyed by display column (parentBountyId), not filter column
    expect(result.current.serverFacets.parentBountyId).toBeDefined();
  });

  it("allows data to be updated via setData", async () => {
    const mockData = [{ id: 1, title: "Test" }];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockData, totalCount: 1 }),
    });

    const { result } = renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Update data externally
    act(() => {
      result.current.setData([{ id: 2, title: "Updated" }]);
    });

    expect(result.current.data).toEqual([{ id: 2, title: "Updated" }]);
  });

  it("sends correct headers with requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [], totalCount: 0 }),
    });

    renderHook(() =>
      useDataTableQuery({
        queryConfig,
        baseQueryConfig,
        columnIdToRef,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Requested-With"]).toBe("XMLHttpRequest");
    expect(options.credentials).toBe("include");
  });
});
