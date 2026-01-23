/**
 * ComponentEditor Query Config Validation Tests
 *
 * Tests for detecting and auto-cleaning invalid query configuration entries
 * (groupBy, orderBy) that reference columns no longer in the component's query.
 *
 * REGRESSION TESTS:
 * - Invalid groupBy entries like "year_quarter" and "category" when only "all_spending.year_quarter" is selected
 * - Invalid orderBy entries referencing removed columns
 * - Auto-cleanup removes invalid entries on save
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentEditor } from "../components/dashboard/component-editor";
import type { DashboardComponent } from "@/lib/db/types";

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

// Mock ResizeObserver for dialog/radix components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("ComponentEditor Query Config Validation", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    dashboardId: 1,
    onSave: vi.fn(),
  };

  function createMockComponent(queryConfig: Record<string, unknown>): DashboardComponent {
    return {
      id: 1,
      dashboard_id: 1,
      name: "Test Component",
      type: "table",
      query_config: JSON.stringify({
        sourceTable: "all_spending",
        limit: 1000,
        filters: [],
        ...queryConfig,
      }),
      grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
      chart_config: JSON.stringify({}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Mock the schema API response
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        tables: [
          {
            name: "all_spending",
            columns: ["year_quarter", "category", "amount"],
          },
        ],
      }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Invalid GROUP BY detection", () => {
    it("detects groupBy entries referencing removed columns", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: ["category", "all_spending.year_quarter"], // category is invalid
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      // Should show GROUP BY section with invalid entry
      expect(screen.getByText("GROUP BY:")).toBeInTheDocument();
      expect(screen.getByText("category")).toBeInTheDocument();
    });

    it("detects groupBy entries with wrong column format (REGRESSION for Spend per Quarter)", async () => {
      // This is the exact issue from dashboard 2 "Spend per Quarter" component
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: ["year_quarter", "category", "all_spending.year_quarter"], // old format entries
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      // Should detect both invalid entries
      expect(screen.getByText("year_quarter")).toBeInTheDocument(); // wrong format
      expect(screen.getByText("category")).toBeInTheDocument(); // removed column
    });

    it("does not flag valid groupBy entries", async () => {
      const component = createMockComponent({
        columns: [
          { column: "all_spending.year_quarter" },
          { column: "all_spending.category" },
        ],
        groupBy: ["all_spending.year_quarter", "all_spending.category"],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Invalid ORDER BY detection", () => {
    it("detects orderBy entries referencing removed columns", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        orderBy: [{ column: "removed_column", direction: "ASC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      expect(screen.getByText("ORDER BY:")).toBeInTheDocument();
      expect(screen.getByText("removed_column")).toBeInTheDocument();
      expect(screen.getByText("(ASC)")).toBeInTheDocument();
    });

    it("does not flag valid orderBy entries", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        orderBy: [{ column: "all_spending.year_quarter", direction: "DESC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Combined validation", () => {
    it("shows both invalid groupBy and orderBy in the same alert", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: ["category"],
        orderBy: [{ column: "amount", direction: "DESC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      // Both sections should be present
      expect(screen.getByText("GROUP BY:")).toBeInTheDocument();
      expect(screen.getByText("ORDER BY:")).toBeInTheDocument();
    });
  });

  describe("Expression column validation", () => {
    it("validates groupBy against expression column aliases", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        expressionColumns: [{ expression: "SUM(amount)", alias: "total_amount" }],
        groupBy: ["all_spending.year_quarter", "total_amount"], // total_amount is valid (expression alias)
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });

    it("validates orderBy against expression column aliases", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        expressionColumns: [{ expression: "SUM(amount)", alias: "total_amount" }],
        orderBy: [{ column: "total_amount", direction: "DESC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Auto-cleanup on save", () => {
    it("removes all invalid groupBy and orderBy entries when saving", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: ["year_quarter", "category", "all_spending.year_quarter"],
        orderBy: [
          { column: "removed", direction: "ASC" },
          { column: "all_spending.year_quarter", direction: "DESC" },
        ],
      });

      render(<ComponentEditor component={component} {...defaultProps} onSave={onSave} />);

      // Wait for the warning to appear
      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      // Find and click the Update Component button
      const saveButton = screen.getByRole("button", { name: /Update Component/i });
      await user.click(saveButton);

      // Verify onSave was called with cleaned config
      expect(onSave).toHaveBeenCalledTimes(1);
      const savedConfig = onSave.mock.calls[0][0].query_config;

      // groupBy should only have the valid entry
      expect(savedConfig.groupBy).toEqual(["all_spending.year_quarter"]);

      // orderBy should only have the valid entry
      expect(savedConfig.orderBy).toEqual([
        { column: "all_spending.year_quarter", direction: "DESC" },
      ]);
    });

    it("preserves valid entries when cleaning invalid ones", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const component = createMockComponent({
        columns: [
          { column: "all_spending.year_quarter" },
          { column: "all_spending.amount" },
        ],
        groupBy: ["invalid_column", "all_spending.year_quarter"],
        orderBy: [{ column: "all_spending.amount", direction: "ASC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} onSave={onSave} />);

      await waitFor(() => {
        expect(screen.getByText(/Invalid query configuration/i)).toBeInTheDocument();
      });

      const saveButton = screen.getByRole("button", { name: /Update Component/i });
      await user.click(saveButton);

      const savedConfig = onSave.mock.calls[0][0].query_config;
      expect(savedConfig.groupBy).toEqual(["all_spending.year_quarter"]);
      expect(savedConfig.orderBy).toEqual([
        { column: "all_spending.amount", direction: "ASC" },
      ]);
    });
  });

  describe("No warning for valid config", () => {
    it("does not show warning when all config is valid", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: ["all_spending.year_quarter"],
        orderBy: [{ column: "all_spending.year_quarter", direction: "ASC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      // Give time for any potential warnings to appear
      await new Promise((r) => setTimeout(r, 100));

      expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
    });

    it("does not show warning when groupBy and orderBy are empty", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter" }],
        groupBy: [],
        orderBy: [],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await new Promise((r) => setTimeout(r, 100));

      expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
    });

    it("does not show warning for text components (no query validation)", async () => {
      const component: DashboardComponent = {
        id: 1,
        dashboard_id: 1,
        name: "Text Component",
        type: "text",
        query_config: JSON.stringify({}),
        grid_config: JSON.stringify({ x: 0, y: 0, w: 6, h: 4 }),
        chart_config: JSON.stringify({ content: "# Hello" }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      render(<ComponentEditor component={component} {...defaultProps} />);

      await new Promise((r) => setTimeout(r, 100));

      expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
    });
  });

  describe("Column alias validation", () => {
    it("validates groupBy against column aliases", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.year_quarter", alias: "quarter" }],
        groupBy: ["quarter"], // Using the alias
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });

    it("validates orderBy against column aliases", async () => {
      const component = createMockComponent({
        columns: [{ column: "all_spending.amount", alias: "total" }],
        orderBy: [{ column: "total", direction: "DESC" }],
      });

      render(<ComponentEditor component={component} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid query configuration/i)).not.toBeInTheDocument();
      });
    });
  });
});
