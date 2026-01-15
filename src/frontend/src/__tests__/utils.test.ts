/**
 * Utils Library Tests
 *
 * Tests for formatting utilities in lib/utils.ts
 */

import { describe, it, expect } from "vitest";
import { cn, formatNumber, formatCurrency, formatDate } from "../lib/utils";

describe("cn - class name merging", () => {
  it("merges multiple class names", () => {
    expect(cn("p-4", "m-2")).toBe("p-4 m-2");
  });

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("p-4", "p-8")).toBe("p-8");
  });

  it("filters out falsy values", () => {
    expect(cn("text-red-500", false, "font-bold")).toBe("text-red-500 font-bold");
  });

  it("handles conditional objects", () => {
    expect(cn({ hidden: true })).toBe("hidden");
    expect(cn({ hidden: false })).toBe("");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });
});

describe("formatNumber", () => {
  it("formats integers with thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats decimals with max 2 places", () => {
    expect(formatNumber(1234.5678)).toBe("1,234.57");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("returns dash for null", () => {
    expect(formatNumber(null)).toBe("-");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-5000)).toBe("-5,000");
  });

  it("rounds fractional amounts", () => {
    expect(formatNumber(1000000.999)).toBe("1,000,001");
  });
});

describe("formatCurrency", () => {
  it("formats as USD currency", () => {
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("rounds to no decimal places", () => {
    expect(formatCurrency(1234.99)).toBe("$1,235");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("returns dash for null", () => {
    expect(formatCurrency(null)).toBe("-");
  });

  it("formats negative numbers", () => {
    expect(formatCurrency(-5000)).toBe("-$5,000");
  });

  it("rounds 0.4 to $0", () => {
    expect(formatCurrency(0.4)).toBe("$0");
  });

  it("rounds 0.5 to $1", () => {
    expect(formatCurrency(0.5)).toBe("$1");
  });
});

describe("formatDate", () => {
  it("formats ISO date string to YYYY-MM-DD", () => {
    const result = formatDate("2024-01-15T12:00:00Z");
    expect(result).toBe("2024-01-15");
  });

  it("formats date-only string to YYYY-MM-DD", () => {
    const result = formatDate("2024-12-31");
    expect(result).toBe("2024-12-31");
  });

  it("returns dash for null", () => {
    expect(formatDate(null)).toBe("-");
  });

  it("returns dash for empty string", () => {
    expect(formatDate("")).toBe("-");
  });
});
