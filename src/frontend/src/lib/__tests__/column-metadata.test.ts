/**
 * Column Metadata Tests
 *
 * Tests for column type detection and operator assignment based on the
 * unified column configuration system.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  getColumnType,
  isCategoricalColumn,
  getOperatorsForColumnType,
  extractColumnName,
  extractTableName,
  ColumnType,
} from "../column-metadata";
import { __setConfigForTesting, type ColumnConfig } from "../column-renderer";

describe("Column Metadata", () => {
  beforeAll(() => {
    // Inject test configuration that mirrors the actual YAML config
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
            Rejected: "destructive",
            default: "outline",
          },
        },
      },
      tables: {
        referenda: {
          track: {
            displayName: "Track",
            type: "categorical",
            variants: { default: "outline" },
          },
        },
        all_spending: {
          type: {
            displayName: "Spending Type",
            type: "categorical",
            variants: { default: "outline" },
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
          match: "suffix",
          pattern: "_at",
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
          match: "substring",
          pattern: "date",
          caseInsensitive: true,
          config: { type: "date", format: "date" },
        },
        // Status/categorical patterns
        {
          match: "exact",
          pattern: "status",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "status_type",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "track",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "type",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "category",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "subcategory",
          caseInsensitive: true,
          config: { type: "categorical", variants: { default: "outline" } },
        },
        {
          match: "exact",
          pattern: "parentBountyName",
          config: { type: "categorical", variants: { default: "outline" } },
        },
        // Address patterns
        {
          match: "exact",
          pattern: "beneficiary",
          caseInsensitive: true,
          config: { type: "address", truncate: true },
        },
      ],
    };

    __setConfigForTesting(testConfig);
  });

  describe("extractColumnName", () => {
    it("extracts column name from table-prefixed name", () => {
      expect(extractColumnName("Referenda.track")).toBe("track");
    });

    it("extracts column name from snake_case table prefix", () => {
      expect(extractColumnName("all_spending.type")).toBe("type");
    });

    it("preserves dot-notation columns (tally.ayes)", () => {
      // "tally" is lowercase, so it's not treated as a table prefix
      expect(extractColumnName("tally.ayes")).toBe("tally.ayes");
    });

    it("returns original name when no prefix", () => {
      expect(extractColumnName("track")).toBe("track");
    });

    it("handles empty string", () => {
      expect(extractColumnName("")).toBe("");
    });
  });

  describe("extractTableName", () => {
    it("extracts table name from table-prefixed name", () => {
      expect(extractTableName("Referenda.track")).toBe("Referenda");
    });

    it("extracts table name from snake_case table prefix", () => {
      expect(extractTableName("all_spending.type")).toBe("all_spending");
    });

    it("returns empty for dot-notation columns (tally.ayes)", () => {
      // "tally" is lowercase, so it's not treated as a table prefix
      expect(extractTableName("tally.ayes")).toBe("");
    });

    it("returns empty string when no prefix", () => {
      expect(extractTableName("track")).toBe("");
    });
  });

  describe("isCategoricalColumn", () => {
    it("returns true for status column", () => {
      expect(isCategoricalColumn("status")).toBe(true);
    });

    it("returns true for status_type column", () => {
      expect(isCategoricalColumn("status_type")).toBe(true);
    });

    it("returns true for track column", () => {
      expect(isCategoricalColumn("track")).toBe(true);
    });

    it("returns true for type column", () => {
      expect(isCategoricalColumn("type")).toBe(true);
    });

    it("returns true for category column", () => {
      expect(isCategoricalColumn("category")).toBe(true);
    });

    it("returns true for subcategory column", () => {
      expect(isCategoricalColumn("subcategory")).toBe(true);
    });

    it("returns true for parentBountyName column", () => {
      expect(isCategoricalColumn("parentBountyName")).toBe(true);
    });

    it("returns false for non-categorical columns", () => {
      expect(isCategoricalColumn("id")).toBe(false);
      expect(isCategoricalColumn("amount")).toBe(false);
      expect(isCategoricalColumn("description")).toBe(false);
    });

    it("handles table-prefixed categorical columns", () => {
      expect(isCategoricalColumn("Referenda.track")).toBe(true);
      expect(isCategoricalColumn("all_spending.type")).toBe(true);
    });
  });

  describe("getColumnType", () => {
    describe("categorical columns", () => {
      it("returns categorical for status", () => {
        expect(getColumnType("status")).toBe("categorical");
      });

      it("returns categorical for track", () => {
        expect(getColumnType("track")).toBe("categorical");
      });

      it("returns categorical for category", () => {
        expect(getColumnType("category")).toBe("categorical");
      });

      it("returns categorical for parentBountyName", () => {
        expect(getColumnType("parentBountyName")).toBe("categorical");
      });

      it("returns categorical for table-prefixed track", () => {
        expect(getColumnType("Referenda.track")).toBe("categorical");
      });
    });

    describe("currency columns", () => {
      it("returns currency for DOT columns", () => {
        expect(getColumnType("DOT_latest")).toBe("currency");
        expect(getColumnType("DOT_value")).toBe("currency");
      });

      it("returns currency for USD columns", () => {
        expect(getColumnType("USD_amount")).toBe("currency");
      });

      it("returns currency for USDC columns", () => {
        expect(getColumnType("USDC_total")).toBe("currency");
      });

      it("returns currency for USDT columns", () => {
        expect(getColumnType("USDT_balance")).toBe("currency");
      });
    });

    describe("numeric columns", () => {
      it("returns numeric for tally.ayes", () => {
        expect(getColumnType("tally.ayes")).toBe("numeric");
      });

      it("returns numeric for tally.nays", () => {
        expect(getColumnType("tally.nays")).toBe("numeric");
      });
    });

    describe("date columns", () => {
      it("returns date for _time suffix columns", () => {
        expect(getColumnType("proposal_time")).toBe("date");
        expect(getColumnType("latest_status_change_time")).toBe("date");
      });

      it("returns date for _at suffix columns", () => {
        expect(getColumnType("created_at")).toBe("date");
        expect(getColumnType("updated_at")).toBe("date");
      });

      it("returns date for date substring columns", () => {
        expect(getColumnType("start_date")).toBe("date");
        expect(getColumnType("dateCreated")).toBe("date");
      });
    });

    describe("text columns", () => {
      it("returns text for description", () => {
        expect(getColumnType("description")).toBe("text");
      });

      it("returns text for notes", () => {
        expect(getColumnType("notes")).toBe("text");
      });

      it("returns text for unknown columns", () => {
        expect(getColumnType("random_field")).toBe("text");
        expect(getColumnType("something_else")).toBe("text");
      });
    });

    describe("address columns", () => {
      it("returns address for beneficiary", () => {
        expect(getColumnType("beneficiary")).toBe("address");
      });
    });
  });

  describe("getOperatorsForColumnType", () => {
    it("returns IN/NOT IN operators for categorical type", () => {
      const ops = getOperatorsForColumnType("categorical");
      expect(ops).toContain("IN");
      expect(ops).toContain("NOT IN");
      expect(ops).toContain("IS NULL");
      expect(ops).toContain("IS NOT NULL");
      expect(ops).not.toContain("LIKE");
      expect(ops).not.toContain(">");
    });

    it("returns comparison operators for numeric type", () => {
      const ops = getOperatorsForColumnType("numeric");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain(">");
      expect(ops).toContain("<");
      expect(ops).toContain(">=");
      expect(ops).toContain("<=");
      expect(ops).toContain("IS NULL");
      expect(ops).toContain("IS NOT NULL");
      expect(ops).not.toContain("LIKE");
      expect(ops).not.toContain("IN");
    });

    it("returns comparison operators for currency type", () => {
      const ops = getOperatorsForColumnType("currency");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain(">");
      expect(ops).toContain("<");
      expect(ops).not.toContain("LIKE");
      expect(ops).not.toContain("IN");
    });

    it("returns text operators for text type", () => {
      const ops = getOperatorsForColumnType("text");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain(">");
      expect(ops).toContain("<");
      expect(ops).toContain(">=");
      expect(ops).toContain("<=");
      expect(ops).toContain("LIKE");
      expect(ops).toContain("IS NULL");
      expect(ops).toContain("IS NOT NULL");
      expect(ops).not.toContain("IN");
    });

    it("returns comparison operators for date type", () => {
      const ops = getOperatorsForColumnType("date");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain(">");
      expect(ops).toContain("<");
      expect(ops).toContain(">=");
      expect(ops).toContain("<=");
      expect(ops).toContain("IS NULL");
      expect(ops).toContain("IS NOT NULL");
      expect(ops).not.toContain("LIKE");
      expect(ops).not.toContain("IN");
    });

    it("returns LIKE operator for address type", () => {
      const ops = getOperatorsForColumnType("address");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain("LIKE");
      expect(ops).not.toContain("IN");
    });

    it("returns LIKE operator for link type", () => {
      const ops = getOperatorsForColumnType("link");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain("LIKE");
      expect(ops).not.toContain("IN");
    });

    it("returns all operators for unknown type as fallback", () => {
      const ops = getOperatorsForColumnType("unknown" as ColumnType);
      expect(ops).toContain("=");
      expect(ops).toContain("LIKE");
      expect(ops).toContain(">");
    });
  });

  describe("Integration: parentBountyName categorical support", () => {
    it("parentBountyName is detected as categorical", () => {
      expect(isCategoricalColumn("parentBountyName")).toBe(true);
      expect(getColumnType("parentBountyName")).toBe("categorical");
    });

    it("parentBountyName gets IN/NOT IN operators", () => {
      const columnType = getColumnType("parentBountyName");
      const ops = getOperatorsForColumnType(columnType);
      expect(ops).toContain("IN");
      expect(ops).toContain("NOT IN");
    });
  });

  describe("Table-prefixed column support", () => {
    it("handles Referenda.track as categorical", () => {
      expect(isCategoricalColumn("Referenda.track")).toBe(true);
      expect(getColumnType("Referenda.track")).toBe("categorical");
    });

    it("handles table-prefixed currency columns", () => {
      expect(getColumnType("Referenda.DOT_latest")).toBe("currency");
    });

    it("handles table-prefixed date columns", () => {
      expect(getColumnType("Referenda.proposal_time")).toBe("date");
    });

    it("gets correct operators for table-prefixed categorical", () => {
      const columnType = getColumnType("Referenda.track");
      const ops = getOperatorsForColumnType(columnType);
      expect(ops).toContain("IN");
      expect(ops).toContain("NOT IN");
      expect(ops).not.toContain("LIKE");
    });
  });
});
