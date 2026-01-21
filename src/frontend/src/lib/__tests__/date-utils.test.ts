/**
 * Date Utilities Tests
 *
 * Tests for date parsing, validation, and partial date handling functions.
 */

import { describe, it, expect } from "vitest";
import {
  parsePartialDate,
  isValidPartialDate,
  formatPartialDateForDisplay,
  isPartialDate,
  getPartialDateRange,
  getNextBoundary,
  getPreviousBoundary,
} from "../date-utils";

describe("Date Utilities", () => {
  describe("parsePartialDate", () => {
    describe("full dates (YYYY-MM-DD)", () => {
      it("parses valid full date", () => {
        const result = parsePartialDate("2024-06-15");
        expect(result).toEqual({ year: 2024, month: 6, day: 15 });
      });

      it("parses date with single-digit month and day", () => {
        const result = parsePartialDate("2024-1-5");
        expect(result).toEqual({ year: 2024, month: 1, day: 5 });
      });

      it("rejects invalid day (0)", () => {
        expect(parsePartialDate("2024-06-00")).toBeNull();
      });

      it("rejects invalid day (32)", () => {
        expect(parsePartialDate("2024-06-32")).toBeNull();
      });

      it("rejects day beyond month length (Feb 30)", () => {
        expect(parsePartialDate("2024-02-30")).toBeNull();
      });

      it("accepts leap year Feb 29", () => {
        const result = parsePartialDate("2024-02-29");
        expect(result).toEqual({ year: 2024, month: 2, day: 29 });
      });

      it("rejects non-leap year Feb 29", () => {
        expect(parsePartialDate("2023-02-29")).toBeNull();
      });
    });

    describe("year-month (YYYY-MM)", () => {
      it("parses valid year-month", () => {
        const result = parsePartialDate("2024-06");
        expect(result).toEqual({ year: 2024, month: 6 });
        expect(result!.day).toBeUndefined();
      });

      it("parses year-month with single digit month", () => {
        const result = parsePartialDate("2024-1");
        expect(result).toEqual({ year: 2024, month: 1 });
      });

      it("rejects invalid month (0)", () => {
        expect(parsePartialDate("2024-00")).toBeNull();
      });

      it("rejects invalid month (13)", () => {
        expect(parsePartialDate("2024-13")).toBeNull();
      });
    });

    describe("year only (YYYY)", () => {
      it("parses valid year", () => {
        const result = parsePartialDate("2024");
        expect(result).toEqual({ year: 2024 });
        expect(result!.month).toBeUndefined();
        expect(result!.day).toBeUndefined();
      });

      it("rejects year below 1900", () => {
        expect(parsePartialDate("1899")).toBeNull();
      });

      it("rejects year above 2100", () => {
        expect(parsePartialDate("2101")).toBeNull();
      });

      it("accepts boundary years", () => {
        expect(parsePartialDate("1900")).toEqual({ year: 1900 });
        expect(parsePartialDate("2100")).toEqual({ year: 2100 });
      });
    });

    describe("invalid inputs", () => {
      it("returns null for empty string", () => {
        expect(parsePartialDate("")).toBeNull();
      });

      it("returns null for null", () => {
        expect(parsePartialDate(null as unknown as string)).toBeNull();
      });

      it("returns null for undefined", () => {
        expect(parsePartialDate(undefined as unknown as string)).toBeNull();
      });

      it("returns null for invalid format", () => {
        expect(parsePartialDate("not-a-date")).toBeNull();
        expect(parsePartialDate("2024/06/15")).toBeNull();
        expect(parsePartialDate("06-15-2024")).toBeNull();
      });

      it("returns null for partial numbers", () => {
        expect(parsePartialDate("202")).toBeNull();
        expect(parsePartialDate("20")).toBeNull();
      });
    });
  });

  describe("isValidPartialDate", () => {
    it("returns true for valid full date", () => {
      expect(isValidPartialDate("2024-06-15")).toBe(true);
    });

    it("returns true for valid year-month", () => {
      expect(isValidPartialDate("2024-06")).toBe(true);
    });

    it("returns true for valid year only", () => {
      expect(isValidPartialDate("2024")).toBe(true);
    });

    it("returns false for invalid date", () => {
      expect(isValidPartialDate("not-valid")).toBe(false);
      expect(isValidPartialDate("2024-13-01")).toBe(false);
      expect(isValidPartialDate("")).toBe(false);
    });
  });

  describe("formatPartialDateForDisplay", () => {
    it("formats full date as short format (Jan 15)", () => {
      const result = formatPartialDateForDisplay("2024-06-15");
      expect(result).toBe("Jun 15");
    });

    it("formats year-month as month year (Jun 2024)", () => {
      const result = formatPartialDateForDisplay("2024-06");
      expect(result).toBe("Jun 2024");
    });

    it("formats year only as year (2024)", () => {
      const result = formatPartialDateForDisplay("2024");
      expect(result).toBe("2024");
    });

    it("returns empty string for empty input", () => {
      expect(formatPartialDateForDisplay("")).toBe("");
    });

    it("handles ISO date strings", () => {
      const result = formatPartialDateForDisplay("2024-06-15T00:00:00.000Z");
      expect(result).toBe("Jun 15");
    });

    it("returns original value for invalid format", () => {
      expect(formatPartialDateForDisplay("invalid")).toBe("invalid");
    });
  });

  describe("isPartialDate", () => {
    it("returns true for year only", () => {
      expect(isPartialDate("2024")).toBe(true);
    });

    it("returns true for year-month", () => {
      expect(isPartialDate("2024-06")).toBe(true);
    });

    it("returns false for full date", () => {
      expect(isPartialDate("2024-06-15")).toBe(false);
    });

    it("returns false for invalid date", () => {
      expect(isPartialDate("invalid")).toBe(false);
    });
  });

  describe("getPartialDateRange", () => {
    it("returns same date for full date", () => {
      const result = getPartialDateRange("2024-06-15");
      expect(result).toEqual({
        start: "2024-06-15",
        end: "2024-06-15",
      });
    });

    it("returns month range for year-month", () => {
      const result = getPartialDateRange("2024-06");
      expect(result).toEqual({
        start: "2024-06-01",
        end: "2024-06-30",
      });
    });

    it("handles February correctly", () => {
      // Leap year
      const leap = getPartialDateRange("2024-02");
      expect(leap).toEqual({
        start: "2024-02-01",
        end: "2024-02-29",
      });

      // Non-leap year
      const nonLeap = getPartialDateRange("2023-02");
      expect(nonLeap).toEqual({
        start: "2023-02-01",
        end: "2023-02-28",
      });
    });

    it("returns year range for year only", () => {
      const result = getPartialDateRange("2024");
      expect(result).toEqual({
        start: "2024-01-01",
        end: "2024-12-31",
      });
    });

    it("returns null for invalid date", () => {
      expect(getPartialDateRange("invalid")).toBeNull();
    });
  });

  describe("getNextBoundary", () => {
    it("returns next day for full date", () => {
      expect(getNextBoundary("2024-06-15")).toBe("2024-06-16");
    });

    it("returns first day of next month for year-month", () => {
      expect(getNextBoundary("2024-06")).toBe("2024-07-01");
    });

    it("handles December correctly", () => {
      expect(getNextBoundary("2024-12")).toBe("2025-01-01");
    });

    it("returns first day of next year for year only", () => {
      expect(getNextBoundary("2024")).toBe("2025-01-01");
    });

    it("returns null for invalid date", () => {
      expect(getNextBoundary("invalid")).toBeNull();
    });

    it("handles end of month correctly", () => {
      expect(getNextBoundary("2024-01-31")).toBe("2024-02-01");
    });
  });

  describe("getPreviousBoundary", () => {
    it("returns previous day for full date", () => {
      expect(getPreviousBoundary("2024-06-15")).toBe("2024-06-14");
    });

    it("returns last day of previous month for year-month", () => {
      expect(getPreviousBoundary("2024-06")).toBe("2024-05-31");
    });

    it("handles January correctly", () => {
      expect(getPreviousBoundary("2024-01")).toBe("2023-12-31");
    });

    it("returns last day of previous year for year only", () => {
      expect(getPreviousBoundary("2024")).toBe("2023-12-31");
    });

    it("returns null for invalid date", () => {
      expect(getPreviousBoundary("invalid")).toBeNull();
    });

    it("handles first of month correctly", () => {
      expect(getPreviousBoundary("2024-02-01")).toBe("2024-01-31");
    });
  });

  describe("Use Cases", () => {
    describe("Partial date filter expansion", () => {
      it("year equals should become range filter", () => {
        // "2024" with "=" should filter >= '2024-01-01' AND < '2025-01-01'
        const range = getPartialDateRange("2024");
        const nextBoundary = getNextBoundary("2024");

        expect(range!.start).toBe("2024-01-01");
        expect(nextBoundary).toBe("2025-01-01");
      });

      it("year-month greater than should use next boundary", () => {
        // "2024-06" with ">" should filter >= '2024-07-01'
        const nextBoundary = getNextBoundary("2024-06");
        expect(nextBoundary).toBe("2024-07-01");
      });

      it("year-month less than should use previous boundary", () => {
        // "2024-06" with "<" should filter < '2024-06-01' (which is <= '2024-05-31')
        const range = getPartialDateRange("2024-06");
        expect(range!.start).toBe("2024-06-01");
      });
    });
  });
});
