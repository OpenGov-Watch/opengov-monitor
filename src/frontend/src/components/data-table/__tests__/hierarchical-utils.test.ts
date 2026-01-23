import { describe, it, expect } from "vitest";
import {
  processHierarchicalData,
  shouldShowRowBorder,
} from "../hierarchical-utils";

describe("processHierarchicalData", () => {
  describe("basic functionality", () => {
    it("returns null-like result for empty data", () => {
      const result = processHierarchicalData([], ["category"], ["amount"]);
      expect(result.rows).toHaveLength(0);
      expect(result.subtotals).toHaveLength(0);
    });

    it("returns null-like result for empty groupByColumns", () => {
      const data = [{ category: "A", amount: 100 }];
      const result = processHierarchicalData(data, [], ["amount"]);
      expect(result.rows).toHaveLength(1);
      expect(result.subtotals).toHaveLength(0);
    });
  });

  describe("two-level grouping", () => {
    const data = [
      { category: "Business Dev", subcategory: "DevRel", amount: 100 },
      { category: "Business Dev", subcategory: "Games", amount: 200 },
      { category: "Business Dev", subcategory: "GovTech", amount: 300 },
      { category: "Marketing", subcategory: "Events", amount: 150 },
      { category: "Marketing", subcategory: "Content", amount: 250 },
    ];

    it("identifies visible columns correctly", () => {
      const result = processHierarchicalData(
        data,
        ["category", "subcategory"],
        ["amount"]
      );

      // First row of "Business Dev" should show both columns
      expect(result.rows[0].meta.visibleColumns.has("category")).toBe(true);
      expect(result.rows[0].meta.visibleColumns.has("subcategory")).toBe(true);

      // Second row of "Business Dev" should only show subcategory
      expect(result.rows[1].meta.visibleColumns.has("category")).toBe(false);
      expect(result.rows[1].meta.visibleColumns.has("subcategory")).toBe(true);

      // Third row of "Business Dev" should only show subcategory
      expect(result.rows[2].meta.visibleColumns.has("category")).toBe(false);
      expect(result.rows[2].meta.visibleColumns.has("subcategory")).toBe(true);

      // First row of "Marketing" should show both (new category)
      expect(result.rows[3].meta.visibleColumns.has("category")).toBe(true);
      expect(result.rows[3].meta.visibleColumns.has("subcategory")).toBe(true);
    });

    it("identifies group starts correctly", () => {
      const result = processHierarchicalData(
        data,
        ["category", "subcategory"],
        ["amount"]
      );

      // First row is start of both levels
      expect(result.rows[0].meta.isGroupStart["category"]).toBe(true);
      expect(result.rows[0].meta.isGroupStart["subcategory"]).toBe(true);

      // Second row is only start of subcategory level
      expect(result.rows[1].meta.isGroupStart["category"]).toBeUndefined();
      expect(result.rows[1].meta.isGroupStart["subcategory"]).toBe(true);

      // Fourth row (Marketing) is start of both levels
      expect(result.rows[3].meta.isGroupStart["category"]).toBe(true);
      expect(result.rows[3].meta.isGroupStart["subcategory"]).toBe(true);
    });

    it("calculates subtotals correctly", () => {
      const result = processHierarchicalData(
        data,
        ["category", "subcategory"],
        ["amount"]
      );

      // Subtotals are emitted when ANY group level changes:
      // Row 0 (DevRel): first row, no subtotals yet
      // Row 1 (Games): subcategory changes -> subtotal for DevRel
      // Row 2 (GovTech): subcategory changes -> subtotal for Games
      // Row 3 (Marketing/Events): category changes -> subtotal for GovTech + subtotal for Business Dev
      // Row 4 (Content): subcategory changes -> subtotal for Events
      // End: final subtotals for Content + Marketing
      // Total: 7 subtotals (5 subcategory + 2 category)
      expect(result.subtotals.length).toBe(7);

      // Check the category-level subtotal for Business Dev (should be 600)
      const bizDevCategorySubtotal = result.subtotals.find(
        (s) => s.level === 0 && s.groupValue === "Business Dev"
      );
      expect(bizDevCategorySubtotal).toBeDefined();
      expect(bizDevCategorySubtotal!.totals.amount).toBe(600);

      // Check Marketing category subtotal (should be 400)
      const marketingCategorySubtotal = result.subtotals.find(
        (s) => s.level === 0 && s.groupValue === "Marketing"
      );
      expect(marketingCategorySubtotal).toBeDefined();
      expect(marketingCategorySubtotal!.totals.amount).toBe(400);

      // Check individual subcategory subtotals
      const devRelSubtotal = result.subtotals.find(
        (s) => s.level === 1 && s.groupValue === "DevRel"
      );
      expect(devRelSubtotal).toBeDefined();
      expect(devRelSubtotal!.totals.amount).toBe(100);
    });

    it("places subtotals after correct rows", () => {
      const result = processHierarchicalData(
        data,
        ["category", "subcategory"],
        ["amount"]
      );

      // After row 0 (DevRel), subtotal emitted when row 1 (Games) starts
      const subtotalsAfterRow0 = result.subtotalsAfterRow.get(0);
      expect(subtotalsAfterRow0).toBeDefined();
      expect(subtotalsAfterRow0!.length).toBe(1); // DevRel subcategory subtotal

      // After row 1 (Games), subtotal emitted when row 2 (GovTech) starts
      const subtotalsAfterRow1 = result.subtotalsAfterRow.get(1);
      expect(subtotalsAfterRow1).toBeDefined();
      expect(subtotalsAfterRow1!.length).toBe(1); // Games subcategory subtotal

      // After row 2 (GovTech), subtotals emitted when row 3 (Marketing) starts
      const subtotalsAfterRow2 = result.subtotalsAfterRow.get(2);
      expect(subtotalsAfterRow2).toBeDefined();
      // 2 subtotals: GovTech subcategory + Business Dev category
      expect(subtotalsAfterRow2!.length).toBe(2);

      // After row 3 (Events), subtotal emitted when row 4 (Content) starts
      const subtotalsAfterRow3 = result.subtotalsAfterRow.get(3);
      expect(subtotalsAfterRow3).toBeDefined();
      expect(subtotalsAfterRow3!.length).toBe(1); // Events subcategory subtotal

      // After the last row (index 4), final subtotals
      const subtotalsAfterRow4 = result.subtotalsAfterRow.get(4);
      expect(subtotalsAfterRow4).toBeDefined();
      // 2 subtotals: Content subcategory + Marketing category
      expect(subtotalsAfterRow4!.length).toBe(2);
    });
  });

  describe("three-level grouping", () => {
    const data = [
      { region: "NA", category: "Tech", item: "Widget", amount: 100 },
      { region: "NA", category: "Tech", item: "Gadget", amount: 200 },
      { region: "NA", category: "Finance", item: "Tool", amount: 150 },
      { region: "EU", category: "Tech", item: "Widget", amount: 300 },
    ];

    it("handles three levels of grouping", () => {
      const result = processHierarchicalData(
        data,
        ["region", "category", "item"],
        ["amount"]
      );

      // First row shows all columns
      expect(result.rows[0].meta.visibleColumns.size).toBe(3);

      // Second row only shows item (same region, same category)
      expect(result.rows[1].meta.visibleColumns.has("region")).toBe(false);
      expect(result.rows[1].meta.visibleColumns.has("category")).toBe(false);
      expect(result.rows[1].meta.visibleColumns.has("item")).toBe(true);

      // Third row shows category and item (same region, new category)
      expect(result.rows[2].meta.visibleColumns.has("region")).toBe(false);
      expect(result.rows[2].meta.visibleColumns.has("category")).toBe(true);
      expect(result.rows[2].meta.visibleColumns.has("item")).toBe(true);

      // Fourth row shows all (new region)
      expect(result.rows[3].meta.visibleColumns.size).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("handles data with same values throughout", () => {
      const data = [
        { category: "A", amount: 100 },
        { category: "A", amount: 200 },
        { category: "A", amount: 300 },
      ];

      const result = processHierarchicalData(
        data,
        ["category"],
        ["amount"]
      );

      // Only first row should show category
      expect(result.rows[0].meta.visibleColumns.has("category")).toBe(true);
      expect(result.rows[1].meta.visibleColumns.has("category")).toBe(false);
      expect(result.rows[2].meta.visibleColumns.has("category")).toBe(false);

      // Should have one subtotal at the end with sum 600
      expect(result.subtotals.length).toBe(1);
      expect(result.subtotals[0].totals.amount).toBe(600);
    });

    it("handles null/undefined group values", () => {
      const data = [
        { category: null, subcategory: "A", amount: 100 },
        { category: null, subcategory: "B", amount: 200 },
        { category: "X", subcategory: "C", amount: 300 },
      ];

      const result = processHierarchicalData(
        data,
        ["category", "subcategory"],
        ["amount"]
      );

      // null category should be treated as a group
      expect(result.rows[0].meta.visibleColumns.has("category")).toBe(true);
      expect(result.rows[1].meta.visibleColumns.has("category")).toBe(false);
      expect(result.rows[2].meta.visibleColumns.has("category")).toBe(true); // New category "X"
    });

    it("handles no currency columns", () => {
      const data = [
        { category: "A", name: "Item 1" },
        { category: "A", name: "Item 2" },
      ];

      const result = processHierarchicalData(data, ["category"], []);

      // Should still work, just with empty totals
      expect(result.subtotals.length).toBe(1);
      expect(Object.keys(result.subtotals[0].totals)).toHaveLength(0);
    });
  });
});

describe("shouldShowRowBorder", () => {
  it("returns true when outermost group column changed", () => {
    const meta = {
      visibleColumns: new Set(["category", "subcategory"]),
      isGroupStart: { category: true, subcategory: true },
      groupRowIndex: 0,
    };

    expect(shouldShowRowBorder(meta, ["category", "subcategory"])).toBe(true);
  });

  it("returns false when only inner group column changed", () => {
    const meta = {
      visibleColumns: new Set(["subcategory"]),
      isGroupStart: { subcategory: true },
      groupRowIndex: 0,
    };

    expect(shouldShowRowBorder(meta, ["category", "subcategory"])).toBe(false);
  });

  it("returns false when no group columns changed", () => {
    const meta = {
      visibleColumns: new Set<string>(),
      isGroupStart: {},
      groupRowIndex: 5,
    };

    expect(shouldShowRowBorder(meta, ["category", "subcategory"])).toBe(false);
  });

  it("returns false for empty groupByColumns", () => {
    const meta = {
      visibleColumns: new Set<string>(),
      isGroupStart: {},
      groupRowIndex: 0,
    };

    expect(shouldShowRowBorder(meta, [])).toBe(false);
  });
});
