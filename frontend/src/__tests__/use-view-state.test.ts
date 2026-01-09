/**
 * useViewState Hook Tests
 *
 * Tests for the table state persistence hook that manages
 * sorting, filtering, visibility, and pagination state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewState } from "../hooks/use-view-state";

// Mock react-router
const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockLocation = { pathname: "/test" };

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
  useLocation: () => mockLocation,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useViewState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    mockSearchParams.delete("view");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns default empty state on mount", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      expect(result.current.sorting).toEqual([]);
      expect(result.current.columnFilters).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.globalFilter).toBe("");
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
    });

    it("loads state from URL query param if present", () => {
      const viewState = {
        sorting: [{ id: "name", desc: true }],
        columnFilters: [],
        columnVisibility: { id: false },
        globalFilter: "search",
        pagination: { pageIndex: 2, pageSize: 50 },
      };
      const encoded = btoa(JSON.stringify(viewState));
      mockSearchParams.set("view", encoded);

      const { result } = renderHook(() => useViewState("test-table"));

      // State should be loaded from URL
      expect(result.current.sorting).toEqual([{ id: "name", desc: true }]);
      expect(result.current.columnVisibility).toEqual({ id: false });
      expect(result.current.globalFilter).toBe("search");
      expect(result.current.pagination).toEqual({ pageIndex: 2, pageSize: 50 });
    });

    it("handles invalid URL param gracefully", () => {
      mockSearchParams.set("view", "invalid-base64!");

      const { result } = renderHook(() => useViewState("test-table"));

      // Should fall back to defaults
      expect(result.current.sorting).toEqual([]);
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
    });
  });

  describe("state setters", () => {
    it("updates sorting state", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setSorting([{ id: "date", desc: true }]);
      });

      expect(result.current.sorting).toEqual([{ id: "date", desc: true }]);
    });

    it("updates column filters", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setColumnFilters([{ id: "status", value: "active" }]);
      });

      expect(result.current.columnFilters).toEqual([{ id: "status", value: "active" }]);
    });

    it("updates column visibility", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setColumnVisibility({ id: false, name: true });
      });

      expect(result.current.columnVisibility).toEqual({ id: false, name: true });
    });

    it("updates global filter", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setGlobalFilter("search term");
      });

      expect(result.current.globalFilter).toBe("search term");
    });

    it("updates pagination", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setPagination({ pageIndex: 5, pageSize: 100 });
      });

      expect(result.current.pagination).toEqual({ pageIndex: 5, pageSize: 100 });
    });
  });

  describe("saveViewState", () => {
    it("saves state to localStorage", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setSorting([{ id: "name", desc: false }]);
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "opengov-view-test-table",
        expect.any(String)
      );

      // Verify the saved content
      const savedValue = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedValue);
      expect(parsed.sorting).toEqual([{ id: "name", desc: false }]);
    });

    it("updates URL with encoded state", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setGlobalFilter("test");
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\?view=/),
        { replace: true }
      );
    });
  });

  describe("loadViewState", () => {
    it("loads state from localStorage", () => {
      const viewState = {
        sorting: [{ id: "date", desc: true }],
        columnFilters: [{ id: "status", value: "pending" }],
        columnVisibility: { hidden: false },
        globalFilter: "loaded",
        pagination: { pageIndex: 1, pageSize: 25 },
      };
      localStorageMock.setItem("opengov-view-test-table", JSON.stringify(viewState));

      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.loadViewState();
      });

      expect(result.current.sorting).toEqual([{ id: "date", desc: true }]);
      expect(result.current.columnFilters).toEqual([{ id: "status", value: "pending" }]);
      expect(result.current.globalFilter).toBe("loaded");
      expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 25 });
    });

    it("handles missing localStorage entry gracefully", () => {
      const { result } = renderHook(() => useViewState("nonexistent-table"));

      act(() => {
        result.current.loadViewState();
      });

      // State should remain at defaults
      expect(result.current.sorting).toEqual([]);
    });

    it("handles invalid JSON in localStorage gracefully", () => {
      localStorageMock.setItem("opengov-view-test-table", "invalid json{");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.loadViewState();
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.current.sorting).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe("clearViewState", () => {
    it("removes entry from localStorage", () => {
      localStorageMock.setItem("opengov-view-test-table", "{}");

      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.clearViewState();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("opengov-view-test-table");
    });

    it("resets state to defaults", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setSorting([{ id: "name", desc: true }]);
        result.current.setGlobalFilter("search");
        result.current.setPagination({ pageIndex: 5, pageSize: 50 });
      });

      act(() => {
        result.current.clearViewState();
      });

      expect(result.current.sorting).toEqual([]);
      expect(result.current.columnFilters).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.globalFilter).toBe("");
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
    });

    it("clears URL params", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.clearViewState();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/test", { replace: true });
    });
  });

  describe("getSavedViews", () => {
    it("returns list of saved table names", () => {
      localStorageMock.setItem("opengov-view-referenda", "{}");
      localStorageMock.setItem("opengov-view-treasury", "{}");
      localStorageMock.setItem("other-key", "{}");

      const { result } = renderHook(() => useViewState("test-table"));

      const savedViews = result.current.getSavedViews();

      expect(savedViews).toContain("referenda");
      expect(savedViews).toContain("treasury");
      expect(savedViews).not.toContain("other-key");
    });

    it("returns empty array when no views saved", () => {
      localStorageMock.clear();

      const { result } = renderHook(() => useViewState("test-table"));

      const savedViews = result.current.getSavedViews();

      expect(savedViews).toEqual([]);
    });
  });
});
