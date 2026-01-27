/**
 * ChartLegend Component Tests
 *
 * Tests for the unified legend component used by pie, bar, and line charts.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartLegend } from "../chart-legend";

describe("ChartLegend", () => {
  const mockItems = [
    { label: "Category A", color: "#ff0000" },
    { label: "Category B", color: "#00ff00" },
    { label: "Category C", color: "#0000ff" },
  ];

  describe("Basic rendering", () => {
    it("renders all items", () => {
      render(<ChartLegend items={mockItems} />);

      expect(screen.getByText("Category A")).toBeInTheDocument();
      expect(screen.getByText("Category B")).toBeInTheDocument();
      expect(screen.getByText("Category C")).toBeInTheDocument();
    });

    it("renders empty list when items is empty", () => {
      const { container } = render(<ChartLegend items={[]} />);

      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list?.children.length).toBe(0);
    });

    it("renders color swatches with correct background colors", () => {
      const { container } = render(<ChartLegend items={mockItems} />);

      const swatches = container.querySelectorAll("li > span:first-child");
      expect(swatches[0]).toHaveStyle({ backgroundColor: "#ff0000" });
      expect(swatches[1]).toHaveStyle({ backgroundColor: "#00ff00" });
      expect(swatches[2]).toHaveStyle({ backgroundColor: "#0000ff" });
    });
  });

  describe("Interactive mode (default)", () => {
    it("uses Tailwind classes for list", () => {
      const { container } = render(<ChartLegend items={mockItems} />);

      const list = container.querySelector("ul");
      expect(list?.className).toContain("flex");
      expect(list?.className).toContain("flex-wrap");
    });

    it("uses Tailwind classes for items", () => {
      const { container } = render(<ChartLegend items={mockItems} />);

      const items = container.querySelectorAll("li");
      items.forEach((item) => {
        expect(item.className).toContain("flex");
        expect(item.className).toContain("items-center");
      });
    });

    it("uses Tailwind classes for labels", () => {
      const { container } = render(<ChartLegend items={mockItems} />);

      const labels = container.querySelectorAll("li > span:last-child");
      labels.forEach((label) => {
        expect(label.className).toContain("text-muted-foreground");
      });
    });
  });

  describe("Export mode", () => {
    it("uses inline styles for list", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} />
      );

      const list = container.querySelector("ul");
      expect(list).toHaveStyle({ margin: "0", padding: "0", listStyle: "none" });
    });

    it("uses inline styles for items", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} />
      );

      const items = container.querySelectorAll("li");
      items.forEach((item) => {
        expect(item).toHaveStyle({ fontSize: "18px", marginBottom: "8px" });
      });
    });

    it("uses inline styles for swatches", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} />
      );

      const swatches = container.querySelectorAll("li > span:first-child");
      swatches.forEach((swatch) => {
        expect(swatch).toHaveStyle({ width: "20px", height: "20px", borderRadius: "2px" });
      });
    });

    it("uses inline styles for labels", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} />
      );

      const labels = container.querySelectorAll("li > span:last-child");
      labels.forEach((label) => {
        expect(label).toHaveStyle({ color: "#737373", fontSize: "18px" });
      });
    });
  });

  describe("Legend position", () => {
    it("uses horizontal layout for bottom position (default)", () => {
      const { container } = render(<ChartLegend items={mockItems} />);

      const list = container.querySelector("ul");
      // In interactive mode, bottom position should not have flex-col
      expect(list?.className).not.toContain("flex-col");
    });

    it("uses vertical layout for right position in interactive mode", () => {
      const { container } = render(
        <ChartLegend items={mockItems} legendPosition="right" />
      );

      const list = container.querySelector("ul");
      expect(list?.className).toContain("flex-col");
    });

    it("applies horizontal alignment in export mode for bottom position", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} legendPosition="bottom" />
      );

      const list = container.querySelector("ul");
      expect(list).toHaveStyle({ textAlign: "center" });

      const items = container.querySelectorAll("li");
      items.forEach((item) => {
        expect(item).toHaveStyle({ display: "inline-block" });
      });
    });

    it("applies vertical alignment in export mode for right position", () => {
      const { container } = render(
        <ChartLegend items={mockItems} exportMode={true} legendPosition="right" />
      );

      const list = container.querySelector("ul");
      expect(list).toHaveStyle({ textAlign: "left" });

      const items = container.querySelectorAll("li");
      items.forEach((item) => {
        expect(item).toHaveStyle({ display: "block" });
      });
    });
  });

  describe("Edge cases", () => {
    it("handles single item", () => {
      render(<ChartLegend items={[{ label: "Only One", color: "#abc123" }]} />);

      expect(screen.getByText("Only One")).toBeInTheDocument();
    });

    it("handles items with special characters in labels", () => {
      const specialItems = [
        { label: "Category & Subcategory", color: "#ff0000" },
        { label: "Value <100>", color: "#00ff00" },
        { label: 'Name "Quoted"', color: "#0000ff" },
      ];

      render(<ChartLegend items={specialItems} />);

      expect(screen.getByText("Category & Subcategory")).toBeInTheDocument();
      expect(screen.getByText("Value <100>")).toBeInTheDocument();
      expect(screen.getByText('Name "Quoted"')).toBeInTheDocument();
    });

    it("handles long labels", () => {
      const longLabel = "This is a very long category label that might need to wrap or truncate";
      render(<ChartLegend items={[{ label: longLabel, color: "#ff0000" }]} />);

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });
  });
});
