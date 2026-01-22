/**
 * Column Renderer Tests
 *
 * Tests for pattern-based column configuration system that auto-detects
 * currency, date, categorical, and address columns based on naming patterns.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getColumnConfig,
  formatValue,
  getBadgeVariant,
  __setConfigForTesting,
  type ColumnConfig,
} from "../column-renderer";

describe("Column Renderer with Pattern Detection", () => {
  beforeAll(() => {
    // Inject test configuration directly instead of loading from YAML
    const testConfig: ColumnConfig = {
      columns: {
        DOT_latest: {
          displayName: "DOT Value",
          type: "currency",
          currency: "DOT",
          decimals: 0,
        },
        status: {
          type: "categorical",
          variants: {
            Executed: "success",
            Approved: "success",
            Paid: "success",
            Rejected: "destructive",
            Cancelled: "destructive",
            Expired: "destructive",
            default: "outline",
          },
        },
      },
      tables: {
        all_spending: {
          type: {
            displayName: "Spending Type",
            type: "categorical",
            variants: {
              "Direct Spend": "default",
              "Bounty Child": "secondary",
              Claim: "outline",
              default: "outline",
            },
          },
        },
      },
      patterns: [
        // Currency patterns
        {
          match: "prefix",
          pattern: "DOT_",
          config: { type: "currency", currency: "DOT", decimals: 0 },
        },
        {
          match: "prefix",
          pattern: "USD_",
          config: { type: "currency", currency: "USD", decimals: 0 },
        },
        {
          match: "prefix",
          pattern: "USDC_",
          config: { type: "currency", currency: "USDC", decimals: 0 },
        },
        {
          match: "prefix",
          pattern: "USDT_",
          config: { type: "currency", currency: "USDT", decimals: 0 },
        },
        // Tally patterns
        {
          match: "suffix",
          pattern: ".ayes",
          caseInsensitive: true,
          config: { type: "numeric", color: "green", decimals: 0 },
        },
        {
          match: "suffix",
          pattern: ".nays",
          caseInsensitive: true,
          config: { type: "numeric", color: "red", decimals: 0 },
        },
        // Date patterns
        {
          match: "substring",
          pattern: "_time",
          caseInsensitive: true,
          config: { type: "date", format: "date" },
        },
        {
          match: "substring",
          pattern: "_date",
          caseInsensitive: true,
          config: { type: "date", format: "date" },
        },
        {
          match: "exact",
          pattern: "createdat",
          caseInsensitive: true,
          config: { type: "date", format: "date" },
        },
        // Status patterns
        {
          match: "exact",
          pattern: "status",
          caseInsensitive: true,
          config: {
            type: "categorical",
            variants: {
              Executed: "success",
              Approved: "success",
              Paid: "success",
              Rejected: "destructive",
              Cancelled: "destructive",
              Expired: "destructive",
              default: "outline",
            },
          },
        },
        {
          match: "suffix",
          pattern: "_status",
          caseInsensitive: true,
          config: {
            type: "categorical",
            variants: {
              Executed: "success",
              Approved: "success",
              Paid: "success",
              Rejected: "destructive",
              Cancelled: "destructive",
              Expired: "destructive",
              default: "outline",
            },
          },
        },
        // Address patterns
        {
          match: "exact",
          pattern: "beneficiary",
          caseInsensitive: true,
          config: { type: "address", truncate: true },
        },
        {
          match: "exact",
          pattern: "address",
          caseInsensitive: true,
          config: { type: "address", truncate: true },
        },
        {
          match: "exact",
          pattern: "who",
          caseInsensitive: true,
          config: { type: "address", truncate: true },
        },
        {
          match: "suffix",
          pattern: "_address",
          caseInsensitive: true,
          config: { type: "address", truncate: true },
        },
      ],
    };

    __setConfigForTesting(testConfig);
  });

  describe("getColumnConfig precedence", () => {
    it("prioritizes table-specific config over patterns", () => {
      const config = getColumnConfig("all_spending", "type");
      expect(config.type).toBe("categorical");
      // This is defined in tables.all_spending.type in YAML
    });

    it("prioritizes global columns over patterns", () => {
      const config = getColumnConfig("Referenda", "DOT_latest");
      expect(config.displayName).toBe("DOT Value");
      // This is defined in columns.DOT_latest with displayName
    });

    it("uses pattern when no explicit config exists", () => {
      const config = getColumnConfig("", "DOT_something_new");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("DOT");
      expect(config.decimals).toBe(0);
    });

    it("uses default text when no pattern matches", () => {
      const config = getColumnConfig("", "unknown_field_name");
      expect(config.type).toBe("text");
    });
  });

  describe("Currency patterns - prefix matching", () => {
    it("detects DOT_ columns", () => {
      const config = getColumnConfig("", "DOT_new_field");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("DOT");
      expect(config.decimals).toBe(0);
    });

    it("detects USD_ columns", () => {
      const config = getColumnConfig("", "USD_value");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("USD");
      expect(config.decimals).toBe(0);
    });

    it("detects USDC_ columns", () => {
      const config = getColumnConfig("", "USDC_amount");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("USDC");
      expect(config.decimals).toBe(0);
    });

    it("detects USDT_ columns", () => {
      const config = getColumnConfig("", "USDT_total");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("USDT");
      expect(config.decimals).toBe(0);
    });

    it("does not match columns without currency prefix", () => {
      const config = getColumnConfig("", "total_amount");
      expect(config.type).not.toBe("currency");
    });

    it("is case-sensitive by default", () => {
      // dot_value should NOT match DOT_ pattern (case-sensitive)
      const config = getColumnConfig("", "dot_value");
      expect(config.type).toBe("text");
    });
  });

  describe("Tally patterns - suffix matching", () => {
    it("detects .ayes suffix with green color", () => {
      const config = getColumnConfig("", "tally.ayes");
      expect(config.type).toBe("numeric");
      expect(config.color).toBe("green");
      expect(config.decimals).toBe(0);
    });

    it("detects .nays suffix with red color", () => {
      const config = getColumnConfig("", "tally.nays");
      expect(config.type).toBe("numeric");
      expect(config.color).toBe("red");
      expect(config.decimals).toBe(0);
    });

    it("matches suffix pattern regardless of prefix", () => {
      const config = getColumnConfig("", "something.ayes");
      expect(config.type).toBe("numeric");
      expect(config.color).toBe("green");
    });

    it("is case-insensitive for tally patterns", () => {
      const config = getColumnConfig("", "tally.AYES");
      expect(config.type).toBe("numeric");
      expect(config.color).toBe("green");
    });
  });

  describe("Date patterns - substring matching", () => {
    it("detects _time substring", () => {
      const config = getColumnConfig("", "proposal_time");
      expect(config.type).toBe("date");
      expect(config.format).toBe("date");
    });

    it("detects _date substring", () => {
      const config = getColumnConfig("", "start_date");
      expect(config.type).toBe("date");
    });

    it("detects createdat exact match", () => {
      const config = getColumnConfig("", "createdat");
      expect(config.type).toBe("date");
    });

    it("matches substring anywhere in column name", () => {
      const config = getColumnConfig("", "latest_time_value");
      expect(config.type).toBe("date");
    });

    it("is case-insensitive for date patterns", () => {
      const config = getColumnConfig("", "proposal_TIME");
      expect(config.type).toBe("date");
    });

    it("does not match partial words", () => {
      // "timer" contains "time" but not "_time"
      const config = getColumnConfig("", "timer");
      expect(config.type).toBe("text");
    });
  });

  describe("Status patterns - exact and suffix matching", () => {
    it("detects exact status column", () => {
      const config = getColumnConfig("", "status");
      expect(config.type).toBe("categorical");
      expect(config.variants).toBeDefined();
      expect(config.variants?.["Executed"]).toBe("success");
      expect(config.variants?.["Rejected"]).toBe("destructive");
    });

    it("detects _status suffix columns", () => {
      const config = getColumnConfig("", "proposal_status");
      expect(config.type).toBe("categorical");
    });

    it("is case-insensitive for status patterns", () => {
      const config = getColumnConfig("", "STATUS");
      expect(config.type).toBe("categorical");
    });

    it("matches _status suffix", () => {
      const config = getColumnConfig("", "latest_status");
      expect(config.type).toBe("categorical");
    });
  });

  describe("Address patterns - exact and suffix matching", () => {
    it("detects beneficiary column", () => {
      const config = getColumnConfig("", "beneficiary");
      expect(config.type).toBe("address");
      expect(config.truncate).toBe(true);
    });

    it("detects address column", () => {
      const config = getColumnConfig("", "address");
      expect(config.type).toBe("address");
      expect(config.truncate).toBe(true);
    });

    it("detects who column", () => {
      const config = getColumnConfig("", "who");
      expect(config.type).toBe("address");
      expect(config.truncate).toBe(true);
    });

    it("detects _address suffix columns", () => {
      const config = getColumnConfig("", "wallet_address");
      expect(config.type).toBe("address");
      expect(config.truncate).toBe(true);
    });

    it("is case-insensitive for address patterns", () => {
      const config = getColumnConfig("", "BENEFICIARY");
      expect(config.type).toBe("address");
    });
  });

  describe("formatValue with pattern-detected configs", () => {
    it("formats currency values from pattern", () => {
      const config = getColumnConfig("", "DOT_new");
      const result = formatValue(1500, config);
      expect(result).toBe("1,500 DOT");
    });

    it("formats USD currency values", () => {
      const config = getColumnConfig("", "USD_amount");
      const result = formatValue(2500, config);
      expect(result).toBe("2,500 USD");
    });

    it("formats USDC with 0 decimals", () => {
      const config = getColumnConfig("", "USDC_balance");
      const result = formatValue(100.5, config);
      expect(result).toBe("101 USDC");
    });

    it("formats date values from pattern", () => {
      const config = getColumnConfig("", "submission_time");
      const result = formatValue("2024-01-15", config);
      expect(result).toBe("2024-01-15");
    });

    it("formats number values with commas", () => {
      const config = getColumnConfig("", "tally.ayes");
      const result = formatValue(1234, config);
      expect(result).toBe("1,234");
    });

    it("returns dash for null values", () => {
      const config = getColumnConfig("", "DOT_value");
      const result = formatValue(null, config);
      expect(result).toBe("-");
    });

    it("returns dash for undefined values", () => {
      const config = getColumnConfig("", "USD_amount");
      const result = formatValue(undefined, config);
      expect(result).toBe("-");
    });
  });

  describe("getBadgeVariant with status patterns", () => {
    it("returns success variant for Executed", () => {
      const config = getColumnConfig("", "status");
      const variant = getBadgeVariant("Executed", config);
      expect(variant).toBe("success");
    });

    it("returns destructive variant for Rejected", () => {
      const config = getColumnConfig("", "status");
      const variant = getBadgeVariant("Rejected", config);
      expect(variant).toBe("destructive");
    });

    it("returns default variant for unknown values", () => {
      const config = getColumnConfig("", "status");
      const variant = getBadgeVariant("Unknown", config);
      expect(variant).toBe("outline");
    });
  });

  describe("Pattern ordering and precedence", () => {
    it("returns first matching pattern when multiple could match", () => {
      // "status" could match both exact "status" and potentially other patterns
      // but exact should come first in YAML order
      const config = getColumnConfig("", "status");
      expect(config.type).toBe("categorical");
    });

    it("prefix patterns are evaluated in order", () => {
      // All DOT_ patterns should match before other patterns
      const config = getColumnConfig("", "DOT_test");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("DOT");
    });
  });

  describe("Edge cases", () => {
    it("handles empty string column name", () => {
      const config = getColumnConfig("", "");
      expect(config.type).toBe("text");
    });

    it("handles special characters in column names", () => {
      const config = getColumnConfig("", "column-with-dashes");
      expect(config.type).toBe("text");
    });

    it("handles very long column names", () => {
      const config = getColumnConfig("", "DOT_" + "a".repeat(100));
      expect(config.type).toBe("currency");
    });

    it("handles column names with dots (dot-notation)", () => {
      const config = getColumnConfig("", "tally.ayes");
      expect(config.type).toBe("numeric");
      expect(config.color).toBe("green");
    });
  });

  describe("Integration with existing YAML config", () => {
    it("explicit DOT_latest config takes precedence over pattern", () => {
      const config = getColumnConfig("", "DOT_latest");
      // YAML has explicit config with displayName
      expect(config.displayName).toBe("DOT Value");
      expect(config.type).toBe("currency");
    });

    it("explicit status config takes precedence over pattern", () => {
      const config = getColumnConfig("", "status");
      // YAML has explicit config in columns.status
      expect(config.type).toBe("categorical");
    });

    it("new DOT columns still use pattern", () => {
      const config = getColumnConfig("", "DOT_future_field");
      expect(config.type).toBe("currency");
      expect(config.currency).toBe("DOT");
    });
  });

  describe("Fallback behavior", () => {
    it("defaults to text type for unknown patterns", () => {
      const config = getColumnConfig("", "completely_random_name");
      expect(config.type).toBe("text");
    });

    it("handles columns with numbers", () => {
      const config = getColumnConfig("", "DOT_123");
      expect(config.type).toBe("currency");
    });

    it("handles columns with mixed case", () => {
      const config = getColumnConfig("", "DOT_MixedCase");
      expect(config.type).toBe("currency");
    });
  });
});
