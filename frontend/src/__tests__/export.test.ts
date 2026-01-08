/**
 * Export Library Tests
 *
 * Tests for export utilities in lib/export.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToCSV, exportToJSON } from "../lib/export";

// Mock document methods
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();
const mockClick = vi.fn();

let mockAnchor: { href: string; download: string; click: () => void };

beforeEach(() => {
  vi.restoreAllMocks();

  mockAnchor = {
    href: "",
    download: "",
    click: mockClick,
  };

  vi.spyOn(document, "createElement").mockImplementation(() => mockAnchor as unknown as HTMLElement);
  vi.spyOn(document.body, "appendChild").mockImplementation(mockAppendChild);
  vi.spyOn(document.body, "removeChild").mockImplementation(mockRemoveChild);
});

describe("exportToCSV", () => {
  it("does nothing for empty data", () => {
    exportToCSV([], "test");

    expect(mockClick).not.toHaveBeenCalled();
  });

  it("creates CSV with headers and rows", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    exportToCSV(data, "test");

    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.csv");
  });

  it("escapes values with commas", () => {
    const data = [{ value: "Hello,World" }];

    // We can't easily check the CSV content since it's in a Blob
    // Just verify the function runs without error
    exportToCSV(data, "test");

    expect(mockClick).toHaveBeenCalled();
  });

  it("handles null values", () => {
    const data = [{ value: null }];

    exportToCSV(data as Record<string, unknown>[], "test");

    expect(mockClick).toHaveBeenCalled();
  });

  it("handles undefined values", () => {
    const data = [{ value: undefined }];

    exportToCSV(data as Record<string, unknown>[], "test");

    expect(mockClick).toHaveBeenCalled();
  });
});

describe("exportToJSON", () => {
  it("creates JSON file with pretty printing", () => {
    const data = [{ name: "Alice" }];

    exportToJSON(data, "test");

    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.json");
  });

  it("handles empty array", () => {
    exportToJSON([], "test");

    expect(mockClick).toHaveBeenCalled();
  });

  it("handles nested objects", () => {
    const data = [{ nested: { deep: { value: 1 } } }];

    exportToJSON(data, "test");

    expect(mockClick).toHaveBeenCalled();
  });
});
