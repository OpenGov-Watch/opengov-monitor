/**
 * Export Styles Tests
 *
 * Tests for shared style constants used in export vs interactive rendering modes.
 */

import { describe, it, expect } from "vitest";
import { TABLE_STYLES, LEGEND_STYLES, COLORS, calculateTableExportDimensions } from "../export-styles";

describe("Export Styles", () => {
  describe("TABLE_STYLES", () => {
    it("defines export styles for headers", () => {
      expect(TABLE_STYLES.header.export).toBeDefined();
      expect(TABLE_STYLES.header.export.fontSize).toBe("16px");
      expect(TABLE_STYLES.header.export.fontWeight).toBe(600);
      expect(TABLE_STYLES.header.export.padding).toBe("12px 16px");
    });

    it("defines interactive classes for headers", () => {
      expect(TABLE_STYLES.header.interactive).toBeDefined();
      expect(TABLE_STYLES.header.interactive).toContain("font-semibold");
      expect(TABLE_STYLES.header.interactive).toContain("bg-muted");
    });

    it("defines export styles for cells", () => {
      expect(TABLE_STYLES.cell.export).toBeDefined();
      expect(TABLE_STYLES.cell.export.fontSize).toBe("14px");
      expect(TABLE_STYLES.cell.export.padding).toBe("10px 16px");
    });

    it("defines interactive classes for cells", () => {
      expect(TABLE_STYLES.cell.interactive).toBeDefined();
      expect(TABLE_STYLES.cell.interactive).toContain("text-sm");
    });

    it("defines container styles for export", () => {
      expect(TABLE_STYLES.container.export).toBeDefined();
      expect(TABLE_STYLES.container.export.width).toBe("100%");
    });

    it("defines table styles for export", () => {
      expect(TABLE_STYLES.table.export).toBeDefined();
      expect(TABLE_STYLES.table.export.borderCollapse).toBe("collapse");
    });

    it("defines empty state styles", () => {
      expect(TABLE_STYLES.emptyState.export).toBeDefined();
      expect(TABLE_STYLES.emptyState.interactive).toBeDefined();
    });

    it("defines truncation note styles", () => {
      expect(TABLE_STYLES.truncationNote.export).toBeDefined();
      expect(TABLE_STYLES.truncationNote.interactive).toBeDefined();
    });
  });

  describe("LEGEND_STYLES", () => {
    it("defines export styles for list", () => {
      expect(LEGEND_STYLES.list.export).toBeDefined();
      expect(LEGEND_STYLES.list.export.margin).toBe(0);
      expect(LEGEND_STYLES.list.export.padding).toBe(0);
      expect(LEGEND_STYLES.list.export.listStyle).toBe("none");
    });

    it("defines interactive classes for list", () => {
      expect(LEGEND_STYLES.list.interactive).toBeDefined();
      expect(LEGEND_STYLES.list.interactive).toContain("flex");
      expect(LEGEND_STYLES.list.interactive).toContain("flex-wrap");
    });

    it("defines vertical and horizontal list variants", () => {
      expect(LEGEND_STYLES.listVertical.export.textAlign).toBe("left");
      expect(LEGEND_STYLES.listHorizontal.export.textAlign).toBe("center");
    });

    it("defines export styles for items", () => {
      expect(LEGEND_STYLES.item.export).toBeDefined();
      expect(LEGEND_STYLES.item.export.fontSize).toBe("18px");
      expect(LEGEND_STYLES.item.export.marginBottom).toBe("8px");
    });

    it("defines horizontal and vertical item export styles", () => {
      expect(LEGEND_STYLES.item.exportHorizontal.display).toBe("inline-block");
      expect(LEGEND_STYLES.item.exportVertical.display).toBe("block");
    });

    it("defines export styles for swatches", () => {
      expect(LEGEND_STYLES.swatch.export).toBeDefined();
      expect(LEGEND_STYLES.swatch.export.width).toBe("20px");
      expect(LEGEND_STYLES.swatch.export.height).toBe("20px");
      expect(LEGEND_STYLES.swatch.export.borderRadius).toBe("2px");
    });

    it("defines interactive classes for swatches", () => {
      expect(LEGEND_STYLES.swatch.interactive).toBeDefined();
      expect(LEGEND_STYLES.swatch.interactive).toContain("w-3");
      expect(LEGEND_STYLES.swatch.interactive).toContain("h-3");
    });

    it("defines export styles for labels", () => {
      expect(LEGEND_STYLES.label.export).toBeDefined();
      expect(LEGEND_STYLES.label.export.color).toBe("#737373");
      expect(LEGEND_STYLES.label.export.fontSize).toBe("18px");
    });

    it("defines interactive classes for labels", () => {
      expect(LEGEND_STYLES.label.interactive).toBeDefined();
      expect(LEGEND_STYLES.label.interactive).toContain("text-muted-foreground");
    });
  });

  describe("COLORS", () => {
    it("defines valid hex color values", () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      expect(COLORS.border).toMatch(hexPattern);
      expect(COLORS.headerBg).toMatch(hexPattern);
      expect(COLORS.cellBg).toMatch(hexPattern);
      expect(COLORS.text).toMatch(hexPattern);
      expect(COLORS.headerText).toMatch(hexPattern);
      expect(COLORS.mutedText).toMatch(/^#[0-9a-fA-F]{3,6}$/);
      expect(COLORS.legendText).toMatch(hexPattern);
    });

    it("defines expected color names", () => {
      expect(COLORS.border).toBeDefined();
      expect(COLORS.headerBg).toBeDefined();
      expect(COLORS.cellBg).toBeDefined();
      expect(COLORS.text).toBeDefined();
      expect(COLORS.headerText).toBeDefined();
      expect(COLORS.mutedText).toBeDefined();
      expect(COLORS.legendText).toBeDefined();
    });
  });

  describe("calculateTableExportDimensions", () => {
    const createMockData = (rowCount: number, columns: string[]) => {
      return Array.from({ length: rowCount }, (_, i) => {
        const row: Record<string, unknown> = {};
        columns.forEach((col) => {
          row[col] = `value_${i}_${col}`;
        });
        return row;
      });
    };

    it("calculates width based on column count", () => {
      const columns = ["a", "b", "c"];
      const data = createMockData(5, columns);
      const { width } = calculateTableExportDimensions(data, columns);

      // 3 columns × 150px + 48px padding = 498px
      expect(width).toBe(498);
    });

    it("calculates height based on row count", () => {
      const columns = ["a"];
      const data = createMockData(10, columns);
      const { height } = calculateTableExportDimensions(data, columns);

      // 60 (title) + 50 (header) + 10×40 (rows) + 48 (padding) = 558
      expect(height).toBe(558);
    });

    it("respects minimum width", () => {
      const columns = ["a"];
      const data = createMockData(1, columns);
      const { width } = calculateTableExportDimensions(data, columns);

      // 1 column × 150px + 48px = 198px, but min is 400px
      expect(width).toBe(400);
    });

    it("respects maximum width", () => {
      const columns = Array.from({ length: 20 }, (_, i) => `col_${i}`);
      const data = createMockData(1, columns);
      const { width } = calculateTableExportDimensions(data, columns);

      // 20 columns × 150px + 48px = 3048px, but max is 2400px
      expect(width).toBe(2400);
    });

    it("respects maximum height", () => {
      const columns = ["a"];
      const data = createMockData(100, columns);
      const { height } = calculateTableExportDimensions(data, columns, 100);

      // Would be 60 + 50 + 100×40 + 48 = 4158px, but max is 2000px
      expect(height).toBe(2000);
    });

    it("adds truncation note height when data exceeds maxRows", () => {
      const columns = ["a"];
      const data = createMockData(10, columns);

      const { height: heightNoTruncation } = calculateTableExportDimensions(data, columns, 10);
      const { height: heightWithTruncation } = calculateTableExportDimensions(data, columns, 5);

      // Truncated should include 30px for truncation note, but fewer rows
      // No truncation: 60 + 50 + 10×40 + 48 = 558
      // Truncation: 60 + 50 + 5×40 + 30 + 48 = 388
      expect(heightNoTruncation).toBe(558);
      expect(heightWithTruncation).toBe(388);
    });

    it("handles empty visible columns", () => {
      const data = createMockData(5, ["a"]);
      const { width } = calculateTableExportDimensions(data, []);

      // 0 columns, should use minimum width
      expect(width).toBe(400);
    });

    it("handles single row", () => {
      const columns = ["a", "b"];
      const data = createMockData(1, columns);
      const { height } = calculateTableExportDimensions(data, columns);

      // 60 + 50 + 1×40 + 48 = 198, but min is 200
      expect(height).toBe(200);
    });
  });
});
