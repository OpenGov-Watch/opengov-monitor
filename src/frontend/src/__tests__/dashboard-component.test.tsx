/**
 * DashboardComponent Tests
 *
 * Tests for the dashboard component rendering logic, collapse state management,
 * and data fetching behavior across different component types.
 *
 * REGRESSION TESTS:
 * - Table components must render even when parent data state is empty
 * - Chart components must show "No data available" when data is empty
 * - Text components must render without data fetching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DashboardComponent } from "../components/dashboard/dashboard-component";
import type { DashboardComponent as DashboardComponentType } from "@/lib/db/types";

// Mock fetch globally
global.fetch = vi.fn();

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

// Mock react-router
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
  useLocation: () => ({ pathname: "/test" }),
}));

describe("DashboardComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Type Rendering", () => {
    it("renders table component even when parent data state is empty (REGRESSION)", async () => {
      // This test catches the bug where table components showed "No data available"
      // because the empty data check ran before the table rendering logic

      const tableComponent: DashboardComponentType = {
        id: 1,
        dashboard_id: 1,
        name: "Test Table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }, { column: "sum_usd_latest" }],
        }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        chart_config: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock the API response with data
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { year_quarter: "2024-Q1", sum_usd_latest: 1000000 },
            { year_quarter: "2024-Q2", sum_usd_latest: 2000000 },
          ],
        }),
      });

      render(<DashboardComponent component={tableComponent} />);

      // Should NOT show "No data available" even though parent component's data state is empty
      await waitFor(() => {
        expect(screen.queryByText("No data available")).not.toBeInTheDocument();
      });

      // Table should render with its internally-fetched data
      await waitFor(() => {
        expect(screen.getByText("Test Table")).toBeInTheDocument();
      });
    });

    it("shows 'No data available' for chart components with empty data", async () => {
      const pieComponent: DashboardComponentType = {
        id: 2,
        dashboard_id: 1,
        name: "Test Pie Chart",
        type: "pie",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "category" }, { column: "amount" }],
        }),
        chart_config: JSON.stringify({
          labelColumn: "category",
          valueColumn: "amount",
        }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock empty data response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<DashboardComponent component={pieComponent} />);

      await waitFor(() => {
        expect(screen.getByText("No data available")).toBeInTheDocument();
      });
    });

    it("renders text component without data fetching", async () => {
      const textComponent: DashboardComponentType = {
        id: 3,
        dashboard_id: 1,
        name: "Test Text",
        type: "text",
        query_config: JSON.stringify({}),
        chart_config: JSON.stringify({
          content: "# Test Markdown\nThis is test content.",
        }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DashboardComponent component={textComponent} />);

      // Should render immediately without fetching
      expect(screen.getByText("Test Text")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText("Test Markdown")).toBeInTheDocument();
      });

      // Should not have called fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("shows error message when chart data fetch fails", async () => {
      const barComponent: DashboardComponentType = {
        id: 4,
        dashboard_id: 1,
        name: "Test Bar Chart",
        type: "bar_grouped",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "category" }, { column: "amount" }],
        }),
        chart_config: JSON.stringify({}),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock API error
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Database connection failed" }),
      });

      render(<DashboardComponent component={barComponent} />);

      await waitFor(() => {
        expect(screen.getByText("Database connection failed")).toBeInTheDocument();
      });
    });
  });

  describe("Toolbar Collapse State Management", () => {
    it("initializes collapse state from localStorage for table components", () => {
      const tableComponent: DashboardComponentType = {
        id: 5,
        dashboard_id: 1,
        name: "Test Table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Set collapsed state in localStorage
      localStorageMock.setItem("opengov-toolbar-collapsed-Treasury-5", "false");

      render(<DashboardComponent component={tableComponent} />);

      // Should have read from localStorage
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        "opengov-toolbar-collapsed-Treasury-5"
      );
    });

    it("defaults to collapsed for table components when no localStorage value", () => {
      const tableComponent: DashboardComponentType = {
        id: 6,
        dashboard_id: 1,
        name: "Test Table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DashboardComponent component={tableComponent} />);

      // Should show "Expand toolbar" button (collapsed state)
      expect(screen.getByTitle("Expand toolbar")).toBeInTheDocument();
    });

    it("persists collapse state to localStorage when toggled", async () => {
      const tableComponent: DashboardComponentType = {
        id: 7,
        dashboard_id: 1,
        name: "Test Table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { rerender } = render(<DashboardComponent component={tableComponent} />);

      // Find and click the collapse toggle button
      const toggleButton = screen.getByTitle("Expand toolbar");
      toggleButton.click();

      // Should have persisted to localStorage
      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          "opengov-toolbar-collapsed-Treasury-7",
          "false"
        );
      });

      // Re-render and verify state persisted
      rerender(<DashboardComponent component={tableComponent} />);
      expect(screen.getByTitle("Collapse toolbar")).toBeInTheDocument();
    });

    it("does not show collapse button for non-table components", () => {
      const pieComponent: DashboardComponentType = {
        id: 8,
        dashboard_id: 1,
        name: "Test Pie Chart",
        type: "pie",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "category" }, { column: "amount" }],
        }),
        chart_config: JSON.stringify({
          labelColumn: "category",
          valueColumn: "amount",
        }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<DashboardComponent component={pieComponent} />);

      // Should not show collapse/expand button
      expect(screen.queryByTitle("Expand toolbar")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Collapse toolbar")).not.toBeInTheDocument();
    });

    it("maintains independent collapse state per component instance", () => {
      // Two table components with same table name but different IDs
      const table1: DashboardComponentType = {
        id: 9,
        dashboard_id: 1,
        name: "Table 1",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const table2: DashboardComponentType = {
        id: 10,
        dashboard_id: 1,
        name: "Table 2",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Set different states in localStorage
      localStorageMock.setItem("opengov-toolbar-collapsed-Treasury-9", "true");
      localStorageMock.setItem("opengov-toolbar-collapsed-Treasury-10", "false");

      const { unmount } = render(<DashboardComponent component={table1} />);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        "opengov-toolbar-collapsed-Treasury-9"
      );

      unmount();

      render(<DashboardComponent component={table2} />);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        "opengov-toolbar-collapsed-Treasury-10"
      );
    });
  });

  describe("Editable Mode", () => {
    it("shows edit controls when editable is true", () => {
      const component: DashboardComponentType = {
        id: 11,
        dashboard_id: 1,
        name: "Test Component",
        type: "text",
        query_config: JSON.stringify({}),
        chart_config: JSON.stringify({ content: "Test" }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const onEdit = vi.fn();
      const onDuplicate = vi.fn();
      const onDelete = vi.fn();

      render(
        <DashboardComponent
          component={component}
          editable={true}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      );

      expect(screen.getByTitle("Edit")).toBeInTheDocument();
      expect(screen.getByTitle("Duplicate")).toBeInTheDocument();
      expect(screen.getByTitle("Delete")).toBeInTheDocument();
    });

    it("hides edit controls when editable is false", () => {
      const component: DashboardComponentType = {
        id: 12,
        dashboard_id: 1,
        name: "Test Component",
        type: "text",
        query_config: JSON.stringify({}),
        chart_config: JSON.stringify({ content: "Test" }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DashboardComponent component={component} editable={false} />);

      expect(screen.queryByTitle("Edit")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Duplicate")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    });
  });

  describe("Query Filters", () => {
    it("applies saved component filters to API requests", async () => {
      // This test verifies that filters saved in the component's query_config
      // are actually sent to the backend API
      const tableComponent: DashboardComponentType = {
        id: 100,
        dashboard_id: 1,
        name: "child bounty 17",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Child Bounties",
          columns: [
            { column: "identifier" },
            { column: "parentBountyId" },
            { column: "status" },
          ],
          filters: [
            { column: "parentBountyId", operator: "=", value: "17" }
          ],
          limit: 1000,
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock both column-config.yaml and the API response
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // column-config.yaml
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { identifier: "17_141", parentBountyId: 17, status: "Claimed" },
              { identifier: "17_140", parentBountyId: 17, status: "Claimed" },
            ],
          }),
        });

      render(<DashboardComponent component={tableComponent} />);

      // Wait for the API query fetch to be called
      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
        const apiCall = calls.find(call =>
          typeof call[0] === 'string' && call[0].includes("/api/query/execute")
        );
        expect(apiCall).toBeDefined();
      });

      // Find the fetch call to /api/query/execute
      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const fetchCall = fetchCalls.find(call =>
        typeof call[0] === 'string' && call[0].includes("/api/query/execute")
      );

      expect(fetchCall).toBeDefined();
      const requestBody = JSON.parse(fetchCall![1].body);

      // CRITICAL: The filters from query_config must be in the request
      expect(requestBody.filters).toBeDefined();
      expect(requestBody.filters).toHaveLength(1);
      expect(requestBody.filters[0]).toEqual({
        column: "parentBountyId",
        operator: "=",
        value: "17"
      });
    });

    it("does not override saved filters with empty URL view state", async () => {
      // This test verifies that URL view state (which typically has empty filters)
      // doesn't override the component's saved filters
      const tableComponent: DashboardComponentType = {
        id: 101,
        dashboard_id: 1,
        name: "filtered table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Referenda",
          columns: [
            { column: "id" },
            { column: "status" },
          ],
          filters: [
            { column: "status", operator: "=", value: "Executed" }
          ],
          limit: 100,
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock both column-config.yaml and the API response
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}), // column-config.yaml
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: 1, status: "Executed" },
            ],
          }),
        });

      render(<DashboardComponent component={tableComponent} />);

      // Wait for the API query fetch to be called
      await waitFor(() => {
        const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
        const apiCall = calls.find(call =>
          typeof call[0] === 'string' && call[0].includes("/api/query/execute")
        );
        expect(apiCall).toBeDefined();
      });

      // Find the fetch call to /api/query/execute
      const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const fetchCall = fetchCalls.find(call =>
        typeof call[0] === 'string' && call[0].includes("/api/query/execute")
      );

      expect(fetchCall).toBeDefined();
      const requestBody = JSON.parse(fetchCall![1].body);

      // Filters should still be present, not replaced with empty array
      expect(requestBody.filters).toBeDefined();
      expect(requestBody.filters.length).toBeGreaterThan(0);
    });
  });

  describe("Refresh Functionality", () => {
    it("shows refresh button for chart components", async () => {
      const pieComponent: DashboardComponentType = {
        id: 13,
        dashboard_id: 1,
        name: "Test Pie Chart",
        type: "pie",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "category" }, { column: "amount" }],
        }),
        chart_config: JSON.stringify({
          labelColumn: "category",
          valueColumn: "amount",
        }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      render(<DashboardComponent component={pieComponent} />);

      await waitFor(() => {
        expect(screen.getByTitle("Refresh")).toBeInTheDocument();
      });
    });

    it("does not show refresh button for table components", () => {
      const tableComponent: DashboardComponentType = {
        id: 14,
        dashboard_id: 1,
        name: "Test Table",
        type: "table",
        query_config: JSON.stringify({
          sourceTable: "Treasury",
          columns: [{ column: "year_quarter" }],
        }),
        chart_config: null,
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DashboardComponent component={tableComponent} />);

      expect(screen.queryByTitle("Refresh")).not.toBeInTheDocument();
    });

    it("does not show refresh button for text components", () => {
      const textComponent: DashboardComponentType = {
        id: 15,
        dashboard_id: 1,
        name: "Test Text",
        type: "text",
        query_config: JSON.stringify({}),
        chart_config: JSON.stringify({ content: "Test" }),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<DashboardComponent component={textComponent} />);

      expect(screen.queryByTitle("Refresh")).not.toBeInTheDocument();
    });
  });
});
