/**
 * SimpleTable Component Tests
 *
 * Tests for the unified table component used for both interactive display
 * and PNG export rendering.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimpleTable } from "../simple-table";

// Mock the column-renderer module
vi.mock("@/lib/column-renderer", () => ({
  getColumnConfig: (_tableName: string, columnName: string) => {
    // Return currency config for DOT_ columns
    if (columnName.startsWith("DOT_")) {
      return { type: "currency", currency: "DOT", decimals: 0 };
    }
    // Return numeric config for columns containing "amount" or "total"
    if (columnName.includes("amount") || columnName.includes("total")) {
      return { type: "numeric", decimals: 2 };
    }
    // Return date config for date columns
    if (columnName.includes("date")) {
      return { type: "date" };
    }
    return { type: "text" };
  },
  getColumnDisplayName: (_tableName: string, columnName: string) => {
    // Match real implementation: title case with DOT/USD handling
    return columnName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bDot\b/gi, "DOT");
  },
  formatValue: (value: unknown, config: { type?: string; currency?: string; decimals?: number }) => {
    if (value === null || value === undefined) return "-";
    if (config.type === "currency") {
      return `${Number(value).toLocaleString()} ${config.currency || "DOT"}`;
    }
    if (config.type === "numeric") {
      return Number(value).toLocaleString();
    }
    return String(value);
  },
}));

describe("SimpleTable", () => {
  const mockData = [
    { id: 1, name: "Item A", DOT_value: 1000, status: "Active" },
    { id: 2, name: "Item B", DOT_value: 2500, status: "Pending" },
    { id: 3, name: "Item C", DOT_value: 500, status: "Completed" },
  ];

  describe("Basic rendering", () => {
    it("renders table with all columns from data", () => {
      render(<SimpleTable data={mockData} />);

      // Check headers
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("DOT Value")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();

      // Check data
      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.getByText("Item B")).toBeInTheDocument();
      expect(screen.getByText("Item C")).toBeInTheDocument();
    });

    it("renders empty state when data is empty", () => {
      render(<SimpleTable data={[]} />);

      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("applies value formatting from column config", () => {
      render(<SimpleTable data={mockData} />);

      // Currency values should be formatted with DOT suffix
      expect(screen.getByText("1,000 DOT")).toBeInTheDocument();
      expect(screen.getByText("2,500 DOT")).toBeInTheDocument();
      expect(screen.getByText("500 DOT")).toBeInTheDocument();
    });
  });

  describe("Column filtering", () => {
    it("filters hidden columns", () => {
      const hiddenColumns = new Set(["id", "status"]);
      render(<SimpleTable data={mockData} hiddenColumns={hiddenColumns} />);

      // Should show name and DOT_value
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("DOT Value")).toBeInTheDocument();

      // Should not show id and status
      expect(screen.queryByText("Id")).not.toBeInTheDocument();
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
    });

    it("uses explicit columns when provided", () => {
      render(<SimpleTable data={mockData} columns={["name", "status"]} />);

      // Should only show name and status
      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();

      // Should not show id and DOT_value
      expect(screen.queryByText("Id")).not.toBeInTheDocument();
      expect(screen.queryByText("DOT Value")).not.toBeInTheDocument();
    });
  });

  describe("Column overrides", () => {
    it("uses custom header from columnOverrides", () => {
      const overrides = {
        name: { header: "Item Name" },
        DOT_value: { header: "Value (DOT)" },
      };
      render(<SimpleTable data={mockData} columnOverrides={overrides} />);

      expect(screen.getByText("Item Name")).toBeInTheDocument();
      expect(screen.getByText("Value (DOT)")).toBeInTheDocument();
    });
  });

  describe("Row limiting", () => {
    const largeData = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
    }));

    it("limits rows to maxRows", () => {
      render(<SimpleTable data={largeData} maxRows={10} />);

      // Should show first 10 items
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 10")).toBeInTheDocument();

      // Should not show items beyond maxRows
      expect(screen.queryByText("Item 11")).not.toBeInTheDocument();
    });

    it("shows truncation notice when data exceeds maxRows", () => {
      render(<SimpleTable data={largeData} maxRows={10} />);

      expect(screen.getByText("Showing 10 of 100 rows")).toBeInTheDocument();
    });

    it("does not show truncation notice when data fits", () => {
      render(<SimpleTable data={mockData} maxRows={50} />);

      expect(screen.queryByText(/Showing \d+ of \d+ rows/)).not.toBeInTheDocument();
    });

    it("uses default maxRows of 50", () => {
      render(<SimpleTable data={largeData} />);

      expect(screen.getByText("Showing 50 of 100 rows")).toBeInTheDocument();
    });
  });

  describe("Interactive mode (default)", () => {
    it("uses Tailwind classes for table", () => {
      const { container } = render(<SimpleTable data={mockData} />);

      const table = container.querySelector("table");
      expect(table?.className).toContain("border-collapse");
      expect(table?.className).toContain("border");
    });

    it("uses Tailwind classes for headers", () => {
      const { container } = render(<SimpleTable data={mockData} />);

      const headers = container.querySelectorAll("th");
      headers.forEach((header) => {
        expect(header.className).toContain("font-semibold");
        expect(header.className).toContain("bg-muted");
      });
    });

    it("uses Tailwind classes for cells", () => {
      const { container } = render(<SimpleTable data={mockData} />);

      const cells = container.querySelectorAll("td");
      cells.forEach((cell) => {
        expect(cell.className).toContain("text-sm");
        expect(cell.className).toContain("border-b");
      });
    });
  });

  describe("Export mode", () => {
    it("uses inline styles for table", () => {
      const { container } = render(
        <SimpleTable data={mockData} exportMode={true} />
      );

      const table = container.querySelector("table");
      expect(table).toHaveStyle({
        borderCollapse: "collapse",
        width: "100%",
        backgroundColor: "#ffffff",
      });
    });

    it("uses inline styles for headers", () => {
      const { container } = render(
        <SimpleTable data={mockData} exportMode={true} />
      );

      const headers = container.querySelectorAll("th");
      headers.forEach((header) => {
        expect(header).toHaveStyle({
          fontSize: "16px",
          fontWeight: "600",
          padding: "12px 16px",
          backgroundColor: "#f9fafb",
        });
      });
    });

    it("uses inline styles for cells", () => {
      const { container } = render(
        <SimpleTable data={mockData} exportMode={true} />
      );

      const cells = container.querySelectorAll("td");
      cells.forEach((cell) => {
        expect(cell).toHaveStyle({
          fontSize: "14px",
          padding: "10px 16px",
          color: "#374151",
        });
      });
    });

    it("applies right alignment to currency columns in export mode", () => {
      const { container } = render(
        <SimpleTable data={mockData} exportMode={true} />
      );

      // Find the DOT_value header (4th column, 0-indexed as 2)
      const headers = container.querySelectorAll("th");
      const dotValueHeader = Array.from(headers).find(
        (h) => h.textContent === "DOT Value"
      );
      expect(dotValueHeader).toHaveStyle({ textAlign: "right" });
    });

    it("applies right alignment to currency columns in interactive mode", () => {
      const { container } = render(<SimpleTable data={mockData} />);

      const headers = container.querySelectorAll("th");
      const dotValueHeader = Array.from(headers).find(
        (h) => h.textContent === "DOT Value"
      );
      expect(dotValueHeader?.className).toContain("text-right");
    });
  });

  describe("Column mapping", () => {
    it("uses columnMapping to resolve source column for config lookup", () => {
      const dataWithAlias = [{ value: 1000 }];
      render(
        <SimpleTable
          data={dataWithAlias}
          columnMapping={{ value: "DOT_value" }}
        />
      );

      // The value should be formatted as currency because it maps to DOT_value
      expect(screen.getByText("1,000 DOT")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles null values", () => {
      const dataWithNull = [{ id: 1, name: null, status: "Active" }];
      render(<SimpleTable data={dataWithNull} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("handles undefined values", () => {
      const dataWithUndefined = [{ id: 1, status: "Active" }];
      render(<SimpleTable data={dataWithUndefined} columns={["id", "name", "status"]} />);

      expect(screen.getByText("-")).toBeInTheDocument();
    });

    it("handles single row", () => {
      render(<SimpleTable data={[mockData[0]]} />);

      expect(screen.getByText("Item A")).toBeInTheDocument();
      expect(screen.queryByText("Item B")).not.toBeInTheDocument();
    });

    it("handles single column", () => {
      render(<SimpleTable data={mockData} columns={["name"]} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.queryByText("Status")).not.toBeInTheDocument();
    });
  });
});
