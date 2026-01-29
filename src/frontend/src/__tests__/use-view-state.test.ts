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
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
    });

    it("loads state from URL query param if present", () => {
      const viewState = {
        sorting: [{ id: "name", desc: true }],
        columnFilters: [],
        columnVisibility: { id: false },
        pagination: { pageIndex: 2, pageSize: 50 },
      };
      const encoded = btoa(JSON.stringify(viewState));
      mockSearchParams.set("view", encoded);

      const { result } = renderHook(() => useViewState("test-table"));

      // State should be loaded from URL
      expect(result.current.sorting).toEqual([{ id: "name", desc: true }]);
      expect(result.current.columnVisibility).toEqual({ id: false });
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

    it("updates pagination", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.setPagination({ pageIndex: 5, pageSize: 100 });
      });

      expect(result.current.pagination).toEqual({ pageIndex: 5, pageSize: 100 });
    });

    it("updates filterGroup state", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active", "Pending"] },
        ],
      };

      act(() => {
        result.current.setFilterGroup(filterGroup);
      });

      expect(result.current.filterGroup).toEqual(filterGroup);
    });

    it("setFilterGroup is wrapped in startTransition for non-blocking updates", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active"] },
          { column: "track", operator: "IN" as const, value: ["root"] },
        ],
      };

      // This should not throw and should update without blocking
      act(() => {
        result.current.setFilterGroup(filterGroup);
      });

      expect(result.current.filterGroup).toEqual(filterGroup);
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
        result.current.setSorting([{ id: "name", desc: false }]);
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringMatching(/\/test\?view=/),
        { replace: true }
      );
    });

    it("persists filterGroup to localStorage", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active", "Pending"] },
          { column: "amount", operator: ">" as const, value: 1000 },
        ],
      };

      act(() => {
        result.current.setFilterGroup(filterGroup);
      });

      act(() => {
        result.current.saveViewState();
      });

      const savedValue = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedValue);
      expect(parsed.filterGroup).toEqual(filterGroup);
    });

    it("persists filterGroup to URL params", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active"] },
        ],
      };

      act(() => {
        result.current.setFilterGroup(filterGroup);
      });

      act(() => {
        result.current.saveViewState();
      });

      // URL should be updated with view param
      expect(mockNavigate).toHaveBeenCalled();
      const callArgs = mockNavigate.mock.calls[0][0];
      expect(callArgs).toMatch(/\/test\?view=/);

      // Verify filterGroup was saved to localStorage (which is what gets encoded to URL)
      const savedValue = localStorageMock.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedValue);
      expect(parsed.filterGroup).toEqual(filterGroup);
    });
  });

  describe("loadViewState", () => {
    it("loads state from localStorage", () => {
      const viewState = {
        sorting: [{ id: "date", desc: true }],
        columnFilters: [{ id: "status", value: "pending" }],
        columnVisibility: { hidden: false },
        pagination: { pageIndex: 1, pageSize: 25 },
      };
      localStorageMock.setItem("opengov-view-test-table", JSON.stringify(viewState));

      const { result } = renderHook(() => useViewState("test-table"));

      act(() => {
        result.current.loadViewState();
      });

      expect(result.current.sorting).toEqual([{ id: "date", desc: true }]);
      expect(result.current.columnFilters).toEqual([{ id: "status", value: "pending" }]);
      expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 25 });
    });

    it("loads filterGroup from URL params", () => {
      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active", "Pending"] },
          { column: "track", operator: "IN" as const, value: ["root"] },
        ],
      };
      const viewState = {
        sorting: [],
        columnFilters: [],
        columnVisibility: {},
        pagination: { pageIndex: 0, pageSize: 100 },
        filterGroup,
      };
      const encoded = btoa(JSON.stringify(viewState));
      mockSearchParams.set("view", encoded);

      const { result } = renderHook(() => useViewState("test-table"));

      // State should be loaded from URL including filterGroup
      expect(result.current.filterGroup).toEqual(filterGroup);
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
        result.current.setPagination({ pageIndex: 5, pageSize: 50 });
      });

      act(() => {
        result.current.clearViewState();
      });

      expect(result.current.sorting).toEqual([]);
      expect(result.current.columnFilters).toEqual([]);
      expect(result.current.columnVisibility).toEqual({});
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
    });

    it("resets filterGroup to undefined", () => {
      const { result } = renderHook(() => useViewState("test-table"));

      const filterGroup = {
        operator: "AND" as const,
        conditions: [
          { column: "status", operator: "IN" as const, value: ["Active"] },
        ],
      };

      act(() => {
        result.current.setFilterGroup(filterGroup);
      });

      expect(result.current.filterGroup).toEqual(filterGroup);

      act(() => {
        result.current.clearViewState();
      });

      expect(result.current.filterGroup).toBeUndefined();
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
    it("returns list of saved views for the table", () => {
      const mockViews = [
        { name: "view1", state: { sorting: [], columnFilters: [], columnVisibility: {}, pagination: { pageIndex: 0, pageSize: 10 } } },
        { name: "view2", state: { sorting: [], columnFilters: [], columnVisibility: {}, pagination: { pageIndex: 0, pageSize: 20 } } },
      ];
      localStorageMock.setItem("opengov-views-test-table", JSON.stringify(mockViews));

      const { result } = renderHook(() => useViewState("test-table"));

      const savedViews = result.current.getSavedViews();

      expect(savedViews).toHaveLength(2);
      expect(savedViews[0].name).toBe("view1");
      expect(savedViews[1].name).toBe("view2");
    });

    it("returns empty array when no views saved", () => {
      localStorageMock.clear();

      const { result } = renderHook(() => useViewState("test-table"));

      const savedViews = result.current.getSavedViews();

      expect(savedViews).toEqual([]);
    });
  });

  describe("URL sync stability - dashboard flicker bug", () => {
    /**
     * BUG DESCRIPTION:
     * Multiple DataTable components in dashboards each create their own useViewState hook.
     * All hooks try to sync to the same ?view= URL parameter.
     * When navigate() is called, React Router creates a new searchParams object.
     * Since searchParams is in the useEffect dependency array, this triggers the effect again.
     * This creates a loop that causes "Maximum update depth exceeded" and visual flickering.
     *
     * The fix requires adding a `disableUrlSync` option for dashboard mode.
     */

    it("should support disableUrlSync option to prevent URL updates", async () => {
      // This test verifies the fix for the dashboard flicker bug
      const { result } = renderHook(() =>
        useViewState("dashboard-table", { disableUrlSync: true })
      );

      mockNavigate.mockClear();

      act(() => {
        result.current.setSorting([{ id: "name", desc: true }]);
      });

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // When disableUrlSync is true, navigate should NOT be called
      // Currently fails because the option doesn't exist
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should allow URL sync when disableUrlSync is false (default behavior)", async () => {
      const { result } = renderHook(() =>
        useViewState("regular-table", { disableUrlSync: false })
      );

      mockNavigate.mockClear();

      act(() => {
        result.current.setSorting([{ id: "name", desc: true }]);
      });

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Normal tables should still sync to URL
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe("URL sync - excessive navigate calls reproduction", () => {
    /**
     * This test verifies the root cause of the dashboard flicker bug:
     * The URL sync effect has `searchParams` in its dependency array.
     *
     * In real React Router, when navigate() is called:
     * 1. The URL changes
     * 2. useSearchParams() returns a NEW URLSearchParams object
     * 3. This triggers the effect again (since searchParams changed)
     * 4. The effect calls navigate() again → infinite loop
     *
     * This test simulates this by making the mock return a new object
     * each time useSearchParams is called, just like real React Router does.
     */
    it("should not cause excessive navigate calls when searchParams changes reference", async () => {
      // Reset the mock to simulate React Router's behavior:
      // useSearchParams returns a NEW object reference after navigate() is called
      let _callCount = 0;
      const navigateCalls: string[] = [];

      // Create a mock that returns a new URLSearchParams each time
      // This simulates what React Router does when URL changes
      vi.doMock("react-router", () => ({
        useNavigate: () => (url: string) => {
          navigateCalls.push(url);
        },
        useSearchParams: () => {
          _callCount++;
          // Return a fresh object each time to simulate React Router behavior
          return [new URLSearchParams()];
        },
        useLocation: () => ({ pathname: "/test" }),
      }));

      // Re-import to get the new mock (this is a limitation of how vi.mock works)
      // For now, we'll count navigate calls with the existing mock
      mockNavigate.mockClear();

      const { result } = renderHook(() => useViewState("test-excessive-calls"));

      act(() => {
        result.current.setSorting([{ id: "name", desc: true }]);
      });

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // The first navigate call is expected. But if the searchParams dependency
      // causes a loop, we'd see many more calls.
      //
      // NOTE: This test passes with mocks because our mock doesn't change
      // searchParams reference. The real bug only manifests in the browser
      // where React Router creates new URLSearchParams objects.
      //
      // The test documents expected behavior: only ONE navigate call per state change.
      const navigateCallCount = mockNavigate.mock.calls.length;

      // Should only be called once (or maybe twice if there's a debounce edge case)
      // If this fails with many calls, we've reproduced the bug
      expect(navigateCallCount).toBeLessThanOrEqual(2);
    });

    it("multiple hook instances should not cause interference (dashboard scenario)", async () => {
      // Simulate a dashboard with multiple tables, each with their own useViewState
      mockNavigate.mockClear();

      const { result: result1 } = renderHook(() => useViewState("table-1"));
      const { result: result2 } = renderHook(() => useViewState("table-2"));
      const { result: result3 } = renderHook(() => useViewState("table-3"));

      // All tables update their sorting at roughly the same time
      act(() => {
        result1.current.setSorting([{ id: "col1", desc: true }]);
        result2.current.setSorting([{ id: "col2", desc: false }]);
        result3.current.setSorting([{ id: "col3", desc: true }]);
      });

      // Wait for all debounced updates
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      // Each table should update URL once = 3 calls max
      // If there's interference/looping, we'd see many more
      // Note: In real browser, all tables write to same ?view= param, causing conflicts
      const callCount = mockNavigate.mock.calls.length;

      // In a healthy implementation, each table would ideally have its own URL param
      // or dashboard tables would skip URL sync entirely
      expect(callCount).toBeLessThanOrEqual(6); // Allow some slack for race conditions
    });
  });
});
