/**
 * Tests for FooterTotals component
 *
 * Key test areas:
 * - Page totals row rendering
 * - Grand totals row rendering
 * - Legacy footerCells compatibility
 * - Empty state (no footer when no content)
 * - Column matching for values
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { FooterTotals } from "../components/footer-totals";
import type { FooterCell } from "../data-table";

interface TestData {
  id: number;
  title: string;
  amount: number;
  total: number;
}

const columnHelper = createColumnHelper<TestData>();

const testColumns: ColumnDef<TestData>[] = [
  columnHelper.accessor("id", { header: "ID" }),
  columnHelper.accessor("title", { header: "Title" }),
  columnHelper.accessor("amount", { header: "Amount" }),
  columnHelper.accessor("total", { header: "Total" }),
];

const testData: TestData[] = [
  { id: 1, title: "Item 1", amount: 100, total: 100 },
  { id: 2, title: "Item 2", amount: 200, total: 300 },
];

// Wrapper to provide column context from React Table
function TestFooterTotals({
  pageTotalsCells = [],
  grandTotalsCells = [],
  footerCells,
  footerLabel,
}: {
  pageTotalsCells?: FooterCell[];
  grandTotalsCells?: FooterCell[];
  footerCells?: FooterCell[];
  footerLabel?: string;
}) {
  const table = useReactTable({
    data: testData,
    columns: testColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const visibleColumns = table.getVisibleLeafColumns();

  return (
    <table>
      <FooterTotals
        visibleColumns={visibleColumns}
        pageTotalsCells={pageTotalsCells}
        grandTotalsCells={grandTotalsCells}
        footerCells={footerCells}
        footerLabel={footerLabel}
      />
    </table>
  );
}

describe("FooterTotals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Empty State", () => {
    it("returns null when no footer content", () => {
      const { container } = render(<TestFooterTotals />);

      // Should not render any tfoot
      expect(container.querySelector("tfoot")).not.toBeInTheDocument();
    });

    it("returns null when all arrays are empty", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[]}
          grandTotalsCells={[]}
          footerCells={[]}
        />
      );

      expect(container.querySelector("tfoot")).not.toBeInTheDocument();
    });
  });

  describe("Page Totals Row", () => {
    it("renders page totals row with label", () => {
      render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      expect(screen.getByText("PAGE TOTAL")).toBeInTheDocument();
    });

    it("renders page total values in correct columns", () => {
      render(
        <TestFooterTotals
          pageTotalsCells={[
            { columnId: "amount", value: "$300" },
            { columnId: "total", value: "$400" },
          ]}
        />
      );

      expect(screen.getByText("$300")).toBeInTheDocument();
      expect(screen.getByText("$400")).toBeInTheDocument();
    });

    it("applies text-right class to value cells", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      // Find cells with text-right class
      const rightAlignedCells = container.querySelectorAll(".text-right");
      expect(rightAlignedCells.length).toBeGreaterThan(0);
    });

    it("applies lighter background to page totals row", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      const row = container.querySelector("tr.bg-muted\\/50");
      expect(row).toBeInTheDocument();
    });
  });

  describe("Grand Totals Row", () => {
    it("renders grand totals row with label", () => {
      render(
        <TestFooterTotals
          grandTotalsCells={[{ columnId: "amount", value: "$1000" }]}
        />
      );

      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });

    it("renders grand total values in correct columns", () => {
      render(
        <TestFooterTotals
          grandTotalsCells={[
            { columnId: "amount", value: "$1000" },
            { columnId: "total", value: "$2000" },
          ]}
        />
      );

      expect(screen.getByText("$1000")).toBeInTheDocument();
      expect(screen.getByText("$2000")).toBeInTheDocument();
    });

    it("applies more prominent background to grand totals row", () => {
      const { container } = render(
        <TestFooterTotals
          grandTotalsCells={[{ columnId: "amount", value: "$1000" }]}
        />
      );

      const row = container.querySelector("tr.bg-muted\\/70");
      expect(row).toBeInTheDocument();
    });
  });

  describe("Both Page and Grand Totals", () => {
    it("renders both rows when both are provided", () => {
      render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
          grandTotalsCells={[{ columnId: "amount", value: "$1000" }]}
        />
      );

      expect(screen.getByText("PAGE TOTAL")).toBeInTheDocument();
      expect(screen.getByText("TOTAL")).toBeInTheDocument();
    });

    it("shows page totals before grand totals", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
          grandTotalsCells={[{ columnId: "amount", value: "$1000" }]}
        />
      );

      const rows = container.querySelectorAll("tfoot tr");
      expect(rows).toHaveLength(2);

      // First row should be page totals (lighter background)
      expect(rows[0]).toHaveClass("bg-muted/50");

      // Second row should be grand totals (darker background)
      expect(rows[1]).toHaveClass("bg-muted/70");
    });
  });

  describe("Legacy footerCells Compatibility", () => {
    it("renders legacy footer row with default label", () => {
      render(
        <TestFooterTotals
          footerCells={[{ columnId: "amount", value: "$500" }]}
        />
      );

      expect(screen.getByText("GRAND TOTAL")).toBeInTheDocument();
    });

    it("renders legacy footer row with custom label", () => {
      render(
        <TestFooterTotals
          footerCells={[{ columnId: "amount", value: "$500" }]}
          footerLabel="CUSTOM LABEL"
        />
      );

      expect(screen.getByText("CUSTOM LABEL")).toBeInTheDocument();
    });

    it("renders legacy footer values in correct columns", () => {
      render(
        <TestFooterTotals
          footerCells={[
            { columnId: "amount", value: "$500" },
            { columnId: "total", value: "$750" },
          ]}
        />
      );

      expect(screen.getByText("$500")).toBeInTheDocument();
      expect(screen.getByText("$750")).toBeInTheDocument();
    });

    it("applies font-bold to first cell", () => {
      const { container } = render(
        <TestFooterTotals
          footerCells={[{ columnId: "amount", value: "$500" }]}
        />
      );

      const boldCell = container.querySelector("td.font-bold");
      expect(boldCell).toBeInTheDocument();
    });
  });

  describe("All Three Footer Types Together", () => {
    it("renders all three rows in correct order", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$100" }]}
          grandTotalsCells={[{ columnId: "amount", value: "$200" }]}
          footerCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      const rows = container.querySelectorAll("tfoot tr");
      expect(rows).toHaveLength(3);

      // Page totals first
      expect(rows[0]).toHaveClass("bg-muted/50");

      // Grand totals second
      expect(rows[1]).toHaveClass("bg-muted/70");

      // Legacy footer last
      expect(rows[2]).toHaveClass("bg-muted/50");
      expect(rows[2]).toHaveClass("font-medium");
    });
  });

  describe("Column Matching", () => {
    it("renders empty cell for unmatched columns", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      // Should have 4 cells (id, title, amount, total)
      const cells = container.querySelectorAll("tfoot td");
      expect(cells).toHaveLength(4);

      // First cell is label
      expect(cells[0].textContent).toBe("PAGE TOTAL");

      // Title cell should be empty
      expect(cells[1].textContent).toBe("");

      // Amount cell has value
      expect(cells[2].textContent).toBe("$300");

      // Total cell should be empty (no matching footerCell)
      expect(cells[3].textContent).toBe("");
    });
  });

  describe("Sticky Footer", () => {
    it("applies sticky bottom class to footer", () => {
      const { container } = render(
        <TestFooterTotals
          pageTotalsCells={[{ columnId: "amount", value: "$300" }]}
        />
      );

      const tfoot = container.querySelector("tfoot");
      expect(tfoot).toHaveClass("sticky");
      expect(tfoot).toHaveClass("bottom-0");
    });
  });
});
