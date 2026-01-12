/**
 * CSV Parser Tests
 *
 * Tests for CSV parsing utilities used in bulk category imports.
 */

import { describe, it, expect } from "vitest";
import {
  parseCSV,
  parseReferendaCSV,
  parseChildBountiesCSV,
} from "../lib/csv-parser";

describe("CSV Parser", () => {
  describe("parseCSV", () => {
    it("parses simple CSV content", () => {
      const csv = `name,value
Alice,100
Bob,200`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: "Alice", value: "100" });
      expect(result[1]).toEqual({ name: "Bob", value: "200" });
    });

    it("handles quoted values with commas", () => {
      const csv = `name,description
Item,"Hello, World"`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe("Hello, World");
    });

    it("handles escaped quotes in quoted values", () => {
      const csv = `name,description
Item,"He said ""hello"""`;

      const result = parseCSV(csv);

      expect(result[0].description).toBe('He said "hello"');
    });

    it("handles Windows line endings (CRLF)", () => {
      const csv = "name,value\r\nAlice,100\r\nBob,200";

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
    });

    it("returns empty array for empty content", () => {
      expect(parseCSV("")).toEqual([]);
      expect(parseCSV("header")).toEqual([]);
    });

    it("skips empty lines", () => {
      const csv = `name,value
Alice,100

Bob,200`;

      const result = parseCSV(csv);

      expect(result).toHaveLength(2);
    });

    it("trims whitespace from values", () => {
      const csv = `name,value
  Alice  ,  100  `;

      const result = parseCSV(csv);

      expect(result[0]).toEqual({ name: "Alice", value: "100" });
    });
  });

  describe("parseReferendaCSV", () => {
    it("parses simplified format", () => {
      const csv = `id,category,subcategory,notes,hide_in_spends
1,Development,Core,Test note,0
2,Outreach,Marketing,,1`;

      const result = parseReferendaCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        category: "Development",
        subcategory: "Core",
        notes: "Test note",
        hide_in_spends: 0,
      });
      expect(result[1]).toEqual({
        id: 2,
        category: "Outreach",
        subcategory: "Marketing",
        notes: "",
        hide_in_spends: 1,
      });
    });

    it("parses exploration format with # column", () => {
      const csv = `#,Category,Subcategory,Notes
1,Development,Core,
2,Outreach,Marketing,Some note`;

      const result = parseReferendaCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].category).toBe("Development");
      expect(result[1].notes).toBe("Some note");
    });

    it("handles various hide_in_spends values", () => {
      const csv = `id,category,hide_in_spends
1,Dev,1
2,Dev,true
3,Dev,X
4,Dev,yes
5,Dev,0
6,Dev,false
7,Dev,`;

      const result = parseReferendaCSV(csv);

      expect(result[0].hide_in_spends).toBe(1);
      expect(result[1].hide_in_spends).toBe(1);
      expect(result[2].hide_in_spends).toBe(1);
      expect(result[3].hide_in_spends).toBe(1);
      expect(result[4].hide_in_spends).toBe(0);
      expect(result[5].hide_in_spends).toBe(0);
      expect(result[6].hide_in_spends).toBe(0);
    });

    it("filters out rows with invalid IDs", () => {
      const csv = `id,category
1,Dev
invalid,Outreach
3,Marketing`;

      const result = parseReferendaCSV(csv);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual([1, 3]);
    });

    it("handles exploration format with long hide column name", () => {
      const csv = `#,Category,"hide from income statement (represented via child bounties and/or via the balance sheet)"
1,Dev,X
2,Outreach,`;

      const result = parseReferendaCSV(csv);

      expect(result[0].hide_in_spends).toBe(1);
      expect(result[1].hide_in_spends).toBe(0);
    });
  });

  describe("parseChildBountiesCSV", () => {
    it("parses simplified format with identifier", () => {
      const csv = `identifier,category,subcategory,notes,hide_in_spends
1_23,Development,SDK,,0
2_45,Outreach,Content,Some notes,1`;

      const result = parseChildBountiesCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        identifier: "1_23",
        category: "Development",
        subcategory: "SDK",
        notes: "",
        hide_in_spends: 0,
      });
      expect(result[1]).toEqual({
        identifier: "2_45",
        category: "Outreach",
        subcategory: "Content",
        notes: "Some notes",
        hide_in_spends: 1,
      });
    });

    it("constructs identifier from parentBountyID and index", () => {
      const csv = `#,parentBountyID,Category,Subcategory
23,1,Development,SDK
45,2,Outreach,Content`;

      const result = parseChildBountiesCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe("1-23");
      expect(result[1].identifier).toBe("2-45");
    });

    it("handles various hide_in_spends values", () => {
      const csv = `identifier,category,hide_in_spends
1_1,Dev,1
1_2,Dev,true
1_3,Dev,X
1_4,Dev,yes
1_5,Dev,0`;

      const result = parseChildBountiesCSV(csv);

      expect(result[0].hide_in_spends).toBe(1);
      expect(result[1].hide_in_spends).toBe(1);
      expect(result[2].hide_in_spends).toBe(1);
      expect(result[3].hide_in_spends).toBe(1);
      expect(result[4].hide_in_spends).toBe(0);
    });

    it("filters out rows without identifier", () => {
      const csv = `identifier,category
1_23,Dev
,Outreach
2_45,Marketing`;

      const result = parseChildBountiesCSV(csv);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.identifier)).toEqual(["1_23", "2_45"]);
    });

    it("handles NOTE column name (uppercase)", () => {
      const csv = `identifier,Category,NOTE
1_23,Development,Test note`;

      const result = parseChildBountiesCSV(csv);

      expect(result[0].notes).toBe("Test note");
    });
  });
});
