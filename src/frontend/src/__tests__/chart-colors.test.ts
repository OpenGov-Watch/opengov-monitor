/**
 * Chart Colors Utility Tests
 *
 * Tests for deterministic color assignment in lib/chart-colors.ts
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHART_COLORS,
  getCategoryColorIndex,
  buildCategoryColorMap,
} from "../lib/chart-colors";

describe("getCategoryColorIndex", () => {
  it("returns same index for same category name", () => {
    const index1 = getCategoryColorIndex("Development", 10);
    const index2 = getCategoryColorIndex("Development", 10);
    expect(index1).toBe(index2);
  });

  it("returns different indices for different category names", () => {
    const index1 = getCategoryColorIndex("Development", 10);
    const index2 = getCategoryColorIndex("Outreach", 10);
    // These specific names should produce different indices
    expect(index1).not.toBe(index2);
  });

  it("returns index within palette bounds", () => {
    const testNames = ["Alpha", "Beta", "Gamma", "Development", "Outreach", "Unknown"];
    for (const name of testNames) {
      const index = getCategoryColorIndex(name, 10);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(10);
    }
  });

  it("handles empty string", () => {
    const index = getCategoryColorIndex("", 10);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(10);
  });

  it("handles unicode characters", () => {
    const index = getCategoryColorIndex("日本語", 10);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(10);
  });
});

describe("buildCategoryColorMap", () => {
  it("assigns colors to all categories", () => {
    const categories = ["Alpha", "Beta", "Gamma"];
    const colorMap = buildCategoryColorMap(categories);

    expect(Object.keys(colorMap)).toHaveLength(3);
    expect(colorMap.Alpha).toBeDefined();
    expect(colorMap.Beta).toBeDefined();
    expect(colorMap.Gamma).toBeDefined();
  });

  it("returns consistent colors for same categories across calls", () => {
    const categories = ["Development", "Outreach", "Research"];
    const colorMap1 = buildCategoryColorMap(categories);
    const colorMap2 = buildCategoryColorMap(categories);

    expect(colorMap1.Development).toBe(colorMap2.Development);
    expect(colorMap1.Outreach).toBe(colorMap2.Outreach);
    expect(colorMap1.Research).toBe(colorMap2.Research);
  });

  it("returns consistent colors regardless of category order", () => {
    const categories1 = ["Alpha", "Beta", "Gamma"];
    const categories2 = ["Gamma", "Alpha", "Beta"];

    const colorMap1 = buildCategoryColorMap(categories1);
    const colorMap2 = buildCategoryColorMap(categories2);

    // Same category should get same color regardless of input order
    expect(colorMap1.Alpha).toBe(colorMap2.Alpha);
    expect(colorMap1.Beta).toBe(colorMap2.Beta);
    expect(colorMap1.Gamma).toBe(colorMap2.Gamma);
  });

  it("assigns colors from provided palette", () => {
    const categories = ["A", "B"];
    const customPalette = ["#ff0000", "#00ff00", "#0000ff"];
    const colorMap = buildCategoryColorMap(categories, customPalette);

    expect(Object.values(colorMap).every((c) => customPalette.includes(c))).toBe(
      true
    );
  });

  it("handles collision by assigning next available color", () => {
    // With many categories, some will have hash collisions
    const categories = Array.from({ length: 15 }, (_, i) => `Category${i}`);
    const colorMap = buildCategoryColorMap(categories);

    // Should assign all categories a color
    expect(Object.keys(colorMap)).toHaveLength(15);

    // With more categories than colors, some colors will repeat
    const colorCounts = new Map<string, number>();
    for (const color of Object.values(colorMap)) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
    // With 15 categories and 10 colors, 5 colors should be used twice
    expect(colorCounts.size).toBe(10);
  });

  it("handles empty categories array", () => {
    const colorMap = buildCategoryColorMap([]);
    expect(colorMap).toEqual({});
  });

  it("uses DEFAULT_CHART_COLORS when no palette provided", () => {
    const categories = ["Test"];
    const colorMap = buildCategoryColorMap(categories);

    expect(DEFAULT_CHART_COLORS.includes(colorMap.Test)).toBe(true);
  });
});
