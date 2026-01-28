/**
 * Tests for TableView component
 *
 * Key test areas:
 * - Loading and error states with overlays
 * - Hierarchical vs standard display modes
 * - Subtotal rows in hierarchical mode
 * - Group boundaries with borders
 * - Empty state rendering
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { TableView } from "../components/table-view";
import type { ProcessedHierarchicalData } from "../hierarchical-utils";

// Mock column-renderer module
vi.mock("@/lib/column-renderer", () => ({
  getColumnConfig: vi.fn(() => ({ type: "text" })),
  formatValue: vi.fn((value: unknown) => String(value)),
}));

// Mock lucide-react icons
vi.mock("lucide-react/dist/esm/icons/loader-2", () => ({
  default: () => <div data-testid="loader-icon">Loading Icon</div>,
}));

vi.mock("lucide-react/dist/esm/icons/alert-circle", () => ({
  default: () => <div data-testid="alert-icon">Alert Icon</div>,
}));

interface TestData {
  id: number;
  title: string;
  status: string;
  amount: number;
}

const columnHelper = createColumnHelper<TestData>();

const testColumns: ColumnDef<TestData>[] = [
  columnHelper.accessor("id", { header: "ID" }),
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("amount", { header: "Amount" }),
];

const testData: TestData[] = [
  { id: 1, title: "Item 1", status: "Active", amount: 100 },
  { id: 2, title: "Item 2", status: "Active", amount: 200 },
  { id: 3, title: "Item 3", status: "Pending", amount: 300 },
];

// Wrapper component to use React Table hooks
function TestTableView({
  data = testData,
  loading = false,
  error = null,
  hierarchicalData = null,
  normalizedGroupByColumns = null,
  showGroupTotals = false,
  pageTotalsCells = [],
  grandTotalsCells = [],
  footerCells,
  footerLabel,
  dashboardMode = false,
}: {
  data?: TestData[];
  loading?: boolean;
  error?: string | null;
  hierarchicalData?: ProcessedHierarchicalData<TestData> | null;
  normalizedGroupByColumns?: string[] | null;
  showGroupTotals?: boolean;
  pageTotalsCells?: Array<{ columnId: string; value: string }>;
  grandTotalsCells?: Array<{ columnId: string; value: string }>;
  footerCells?: Array<{ columnId: string; value: string }>;
  footerLabel?: string;
  dashboardMode?: boolean;
}) {
  const table = useReactTable({
    data,
    columns: testColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TableView
      table={table}
      columns={testColumns}
      loading={loading}
      error={error}
      dashboardMode={dashboardMode}
      hierarchicalData={hierarchicalData}
      normalizedGroupByColumns={normalizedGroupByColumns}
      showGroupTotals={showGroupTotals}
      pageTotalsCells={pageTotalsCells}
      grandTotalsCells={grandTotalsCells}
      footerCells={footerCells}
      footerLabel={footerLabel}
      tableName="test"
    />
  );
}

describe("TableView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading overlay when loading", () => {
      render(<TestTableView loading={true} />);

      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("applies opacity to table body when loading", () => {
      const { container } = render(<TestTableView loading={true} />);

      // tbody is the second rowgroup (thead is first)
      const tbody = container.querySelector("tbody");
      expect(tbody).toHaveClass("opacity-30");
    });

    it("does not show loading overlay when not loading", () => {
      render(<TestTableView loading={false} />);

      expect(screen.queryByTestId("loader-icon")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error overlay with message", () => {
      render(<TestTableView error="Something went wrong" />);

      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
      expect(screen.getByText("Error: Something went wrong")).toBeInTheDocument();
    });

    it("does not show error overlay when no error", () => {
      render(<TestTableView error={null} />);

      expect(screen.queryByTestId("alert-icon")).not.toBeInTheDocument();
    });
  });

  describe("Standard Display Mode", () => {
    it("renders table headers", () => {
      render(<TestTableView />);

      expect(screen.getByText("ID")).toBeInTheDocument();
      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Amount")).toBeInTheDocument();
    });

    it("renders table rows", () => {
      render(<TestTableView />);

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("renders all data values", () => {
      render(<TestTableView />);

      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("300")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows no results message when data is empty", () => {
      render(<TestTableView data={[]} />);

      expect(screen.getByText("No results.")).toBeInTheDocument();
    });
  });

  describe("Hierarchical Display Mode", () => {
    const hierarchicalData: ProcessedHierarchicalData<TestData> = {
      rows: [
        {
          data: testData[0],
          meta: {
            visibleColumns: new Set(["status"]),
            isGroupStart: { status: true },
            groupRowIndex: 0,
          },
        },
        {
          data: testData[1],
          meta: {
            visibleColumns: new Set(),
            isGroupStart: {},
            groupRowIndex: 1,
          },
        },
        {
          data: testData[2],
          meta: {
            visibleColumns: new Set(["status"]),
            isGroupStart: { status: true },
            groupRowIndex: 0,
          },
        },
      ],
      subtotals: [
        {
          level: 0,
          groupColumn: "status",
          groupValue: "Active",
          groupPath: { status: "Active" },
          totals: { amount: 300 },
          rowCount: 2,
        },
      ],
      subtotalsAfterRow: new Map([
        [
          1,
          [
            {
              level: 0,
              groupColumn: "status",
              groupValue: "Active",
              groupPath: { status: "Active" },
              totals: { amount: 300 },
              rowCount: 2,
            },
          ],
        ],
      ]),
    };

    it("renders hierarchical data with suppressed columns", () => {
      render(
        <TestTableView
          hierarchicalData={hierarchicalData}
          normalizedGroupByColumns={["status"]}
        />
      );

      // All rows should be rendered
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("renders subtotal rows when showGroupTotals is true", () => {
      render(
        <TestTableView
          hierarchicalData={hierarchicalData}
          normalizedGroupByColumns={["status"]}
          showGroupTotals={true}
        />
      );

      // Should show "Active Subtotal" text
      expect(screen.getByText("Active Subtotal")).toBeInTheDocument();
    });

    it("does not render subtotal rows when showGroupTotals is false", () => {
      render(
        <TestTableView
          hierarchicalData={hierarchicalData}
          normalizedGroupByColumns={["status"]}
          showGroupTotals={false}
        />
      );

      // Should not show any subtotal text
      expect(screen.queryByText("Active Subtotal")).not.toBeInTheDocument();
    });
  });

  describe("Dashboard Mode", () => {
    it("applies dashboard-specific styling", () => {
      const { container } = render(<TestTableView dashboardMode={true} />);

      // Should have overflow-auto class in dashboard mode
      const wrapper = container.querySelector(".overflow-auto");
      expect(wrapper).toBeInTheDocument();
    });

    it("removes border in dashboard mode", () => {
      const { container } = render(<TestTableView dashboardMode={true} />);

      // Should not have rounded-md border class
      const wrapper = container.querySelector(".rounded-md.border");
      expect(wrapper).not.toBeInTheDocument();
    });
  });

  describe("Footer Integration", () => {
    it("passes footer props to FooterTotals", () => {
      render(
        <TestTableView
          pageTotalsCells={[{ columnId: "amount", value: "$600" }]}
          grandTotalsCells={[{ columnId: "amount", value: "$1000" }]}
        />
      );

      // Footer should be rendered (FooterTotals component)
      expect(screen.getByText("PAGE TOTAL")).toBeInTheDocument();
      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });

    it("passes legacy footerCells prop", () => {
      render(
        <TestTableView
          footerCells={[{ columnId: "amount", value: "$600" }]}
          footerLabel="CUSTOM TOTAL"
        />
      );

      expect(screen.getByText("CUSTOM TOTAL")).toBeInTheDocument();
    });
  });
});
