/**
 * Auto-columns Tests
 *
 * Tests for column generation including faceted filter support for category system columns.
 */

import { describe, it, expect, vi } from "vitest";
import { generateColumns } from "../auto-columns";

// Mock the column-renderer module
vi.mock("../column-renderer", () => ({
  getColumnConfig: () => ({ render: "text" }),
  getColumnDisplayName: (_tableName: string, columnName: string) => columnName,
  getBadgeVariant: () => "default",
  formatValue: (value: any) => String(value),
}));

describe("generateColumns", () => {
  describe("faceted filters with category system", () => {
    /**
     * REGRESSION TEST: Category and subcategory columns should support faceted filters
     * even when the category system is auto-detected.
     *
     * Previously, category/subcategory columns were handled by early-return logic
     * that didn't check facetedFilters, so dropdowns were never shown.
     */

    const mockDataWithCategorySystem = [
      {
        id: 1,
        name: "Test",
        category_id: 1,
        category: "Development",
        subcategory: "Tools",
        status: "Active",
      },
    ];

    it("includes faceted filter for category column when in facetedFilters", () => {
      const columns = generateColumns({
        data: mockDataWithCategorySystem,
        tableName: "test",
        facetedFilters: ["category"],
      });

      const categoryColumn = columns.find((c) => c.id === "category");
      expect(categoryColumn).toBeDefined();

      // Should have filterFn when faceted filter is enabled
      expect(categoryColumn?.filterFn).toBeDefined();

      // Should have sorting disabled for faceted filter columns
      expect(categoryColumn?.enableSorting).toBe(false);
    });

    it("includes faceted filter for subcategory column when in facetedFilters", () => {
      const columns = generateColumns({
        data: mockDataWithCategorySystem,
        tableName: "test",
        facetedFilters: ["subcategory"],
      });

      const subcategoryColumn = columns.find((c) => c.id === "subcategory");
      expect(subcategoryColumn).toBeDefined();

      // Should have filterFn when faceted filter is enabled
      expect(subcategoryColumn?.filterFn).toBeDefined();

      // Should have sorting disabled for faceted filter columns
      expect(subcategoryColumn?.enableSorting).toBe(false);
    });

    it("does not add filterFn when category is not in facetedFilters", () => {
      const columns = generateColumns({
        data: mockDataWithCategorySystem,
        tableName: "test",
        facetedFilters: ["status"], // category not included
      });

      const categoryColumn = columns.find((c) => c.id === "category");
      expect(categoryColumn).toBeDefined();

      // Should NOT have filterFn when not a faceted filter
      expect(categoryColumn?.filterFn).toBeUndefined();
    });

    it("supports multiple category system columns as faceted filters", () => {
      const columns = generateColumns({
        data: mockDataWithCategorySystem,
        tableName: "test",
        facetedFilters: ["status", "category", "subcategory"],
      });

      const statusColumn = columns.find((c) => c.id === "status");
      const categoryColumn = columns.find((c) => c.id === "category");
      const subcategoryColumn = columns.find((c) => c.id === "subcategory");

      // All three should have filterFn
      expect(statusColumn?.filterFn).toBeDefined();
      expect(categoryColumn?.filterFn).toBeDefined();
      expect(subcategoryColumn?.filterFn).toBeDefined();
    });
  });

  describe("faceted filters without category system", () => {
    const mockDataWithoutCategorySystem = [
      {
        id: 1,
        name: "Test",
        status: "Active",
        type: "Feature",
      },
    ];

    it("includes faceted filter for regular columns", () => {
      const columns = generateColumns({
        data: mockDataWithoutCategorySystem,
        tableName: "test",
        facetedFilters: ["status", "type"],
      });

      const statusColumn = columns.find((c) => c.id === "status");
      const typeColumn = columns.find((c) => c.id === "type");

      expect(statusColumn?.filterFn).toBeDefined();
      expect(typeColumn?.filterFn).toBeDefined();
    });
  });

  describe("category system auto-detection", () => {
    it("hides category_id column when category system is detected", () => {
      const columns = generateColumns({
        data: [
          {
            id: 1,
            category_id: 1,
            category: "Dev",
            subcategory: "Tools",
          },
        ],
        tableName: "test",
      });

      const categoryIdColumn = columns.find((c) => c.id === "category_id");
      expect(categoryIdColumn).toBeDefined();
      expect((categoryIdColumn?.meta as any)?.autoHidden).toBe(true);
    });

    it("does not hide category_id when category system is not complete", () => {
      const columns = generateColumns({
        data: [
          {
            id: 1,
            category_id: 1,
            // Missing category and subcategory columns
          },
        ],
        tableName: "test",
      });

      const categoryIdColumn = columns.find((c) => c.id === "category_id");
      expect(categoryIdColumn).toBeDefined();
      expect((categoryIdColumn?.meta as any)?.autoHidden).toBeUndefined();
    });
  });
});
