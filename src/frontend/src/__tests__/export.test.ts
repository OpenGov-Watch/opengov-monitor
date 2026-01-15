/**
 * Export Library Tests
 *
 * Tests for export utilities in lib/export.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exportToCSV,
  exportToJSON,
  generateCSVContent,
  generateJSONContent,
} from "../lib/export";

// Mock document methods for download tests
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

  vi.spyOn(document, "createElement").mockImplementation(
    () => mockAnchor as unknown as HTMLElement
  );
  vi.spyOn(document.body, "appendChild").mockImplementation(mockAppendChild);
  vi.spyOn(document.body, "removeChild").mockImplementation(mockRemoveChild);
});

describe("generateCSVContent", () => {
  it("returns empty string for empty data", () => {
    const result = generateCSVContent([]);

    expect(result).toBe("");
  });

  it("generates headers from object keys", () => {
    const data = [{ name: "Alice", age: 30 }];

    const result = generateCSVContent(data);

    expect(result).toContain("name,age");
  });

  it("generates data rows", () => {
    const data = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];

    const result = generateCSVContent(data);
    const lines = result.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("Alice,30");
    expect(lines[2]).toBe("Bob,25");
  });

  it("escapes values containing commas", () => {
    const data = [{ value: "Hello,World" }];

    const result = generateCSVContent(data);
    const lines = result.split("\n");

    expect(lines[1]).toBe('"Hello,World"');
  });

  it("escapes values containing quotes", () => {
    const data = [{ value: 'She said "hello"' }];

    const result = generateCSVContent(data);
    const lines = result.split("\n");

    expect(lines[1]).toBe('"She said ""hello"""');
  });

  it("escapes values containing newlines", () => {
    const data = [{ value: "Line1\nLine2" }];

    const result = generateCSVContent(data);

    expect(result).toContain('"Line1\nLine2"');
  });

  it("handles null values as empty string", () => {
    const data = [{ value: null }];

    const result = generateCSVContent(data as Record<string, unknown>[]);
    const lines = result.split("\n");

    expect(lines[1]).toBe("");
  });

  it("handles undefined values as empty string", () => {
    const data = [{ value: undefined }];

    const result = generateCSVContent(data as Record<string, unknown>[]);
    const lines = result.split("\n");

    expect(lines[1]).toBe("");
  });

  it("converts numbers to strings", () => {
    const data = [{ count: 42, price: 19.99 }];

    const result = generateCSVContent(data);
    const lines = result.split("\n");

    expect(lines[1]).toBe("42,19.99");
  });

  it("converts boolean to strings", () => {
    const data = [{ active: true, deleted: false }];

    const result = generateCSVContent(data);
    const lines = result.split("\n");

    expect(lines[1]).toBe("true,false");
  });

  it("handles mixed special characters", () => {
    const data = [{ value: 'Hello, "World"\nNew line' }];

    const result = generateCSVContent(data);

    // The result should contain the properly escaped value
    // We check the full content since splitting by \n would split the embedded newline too
    expect(result).toBe('value\n"Hello, ""World""\nNew line"');
  });
});

describe("generateJSONContent", () => {
  it("returns empty array string for empty data", () => {
    const result = generateJSONContent([]);

    expect(result).toBe("[]");
  });

  it("generates pretty-printed JSON with 2-space indentation", () => {
    const data = [{ name: "Alice" }];

    const result = generateJSONContent(data);

    expect(result).toBe('[\n  {\n    "name": "Alice"\n  }\n]');
  });

  it("handles nested objects", () => {
    const data = [{ nested: { deep: { value: 1 } } }];

    const result = generateJSONContent(data);
    const parsed = JSON.parse(result);

    expect(parsed[0].nested.deep.value).toBe(1);
  });

  it("handles arrays within objects", () => {
    const data = [{ items: [1, 2, 3] }];

    const result = generateJSONContent(data);
    const parsed = JSON.parse(result);

    expect(parsed[0].items).toEqual([1, 2, 3]);
  });

  it("handles null and undefined values", () => {
    const data = [{ nullValue: null, undefinedValue: undefined }];

    const result = generateJSONContent(data);
    const parsed = JSON.parse(result);

    expect(parsed[0].nullValue).toBeNull();
    expect(parsed[0].undefinedValue).toBeUndefined();
  });
});

describe("exportToCSV", () => {
  it("does nothing for empty data", () => {
    exportToCSV([], "test");

    expect(mockClick).not.toHaveBeenCalled();
  });

  it("triggers download with .csv extension", () => {
    const data = [{ name: "Alice", age: 30 }];

    exportToCSV(data, "test");

    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.csv");
  });

  it("appends and removes anchor element", () => {
    const data = [{ name: "Alice" }];

    exportToCSV(data, "test");

    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});

describe("exportToJSON", () => {
  it("triggers download with .json extension", () => {
    const data = [{ name: "Alice" }];

    exportToJSON(data, "test");

    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.json");
  });

  it("handles empty array", () => {
    exportToJSON([], "test");

    expect(mockClick).toHaveBeenCalled();
  });

  it("appends and removes anchor element", () => {
    const data = [{ name: "Alice" }];

    exportToJSON(data, "test");

    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});
