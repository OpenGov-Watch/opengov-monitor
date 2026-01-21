/**
 * Column Metadata Tests
 *
 * Tests for column type detection and operator assignment based on column naming patterns.
 */

import { describe, it, expect } from "vitest";
import {
  getColumnType,
  isCategoricalColumn,
  getOperatorsForColumnType,
  ColumnType,
} from "../column-metadata";

describe("Column Metadata", () => {
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
      expect(isCategoricalColumn("created_at")).toBe(false);
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
    });

    describe("numeric columns", () => {
      it("returns numeric for DOT columns", () => {
        expect(getColumnType("DOT")).toBe("numeric");
        expect(getColumnType("DOT_value")).toBe("numeric");
      });

      it("returns numeric for USD columns", () => {
        expect(getColumnType("USD_amount")).toBe("numeric");
      });

      it("returns numeric for USDC columns", () => {
        expect(getColumnType("USDC_total")).toBe("numeric");
      });

      it("returns numeric for USDT columns", () => {
        expect(getColumnType("USDT_balance")).toBe("numeric");
      });

      it("returns numeric for amount columns", () => {
        expect(getColumnType("total_amount")).toBe("numeric");
      });

      it("returns numeric for count columns", () => {
        expect(getColumnType("vote_count")).toBe("numeric");
        expect(getColumnType("voteCount")).toBe("numeric");
      });

      it("returns numeric for id column", () => {
        expect(getColumnType("id")).toBe("numeric");
      });

      it("returns numeric for _id suffix columns", () => {
        expect(getColumnType("category_id")).toBe("numeric");
        expect(getColumnType("user_id")).toBe("numeric");
      });

      it("returns numeric for Id suffix columns", () => {
        expect(getColumnType("parentBountyId")).toBe("numeric");
        expect(getColumnType("referendumId")).toBe("numeric");
      });

      it("returns numeric for Index suffix columns", () => {
        expect(getColumnType("trackIndex")).toBe("numeric");
      });

      it("returns numeric for cycle column", () => {
        expect(getColumnType("cycle")).toBe("numeric");
      });

      it("returns numeric for rank column", () => {
        expect(getColumnType("rank")).toBe("numeric");
      });

      it("returns numeric for payment_id column", () => {
        expect(getColumnType("payment_id")).toBe("numeric");
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

      it("returns text for name columns", () => {
        expect(getColumnType("name")).toBe("text");
        expect(getColumnType("display_name")).toBe("text");
      });

      it("returns text for unknown columns", () => {
        expect(getColumnType("random_field")).toBe("text");
        expect(getColumnType("something_else")).toBe("text");
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

    it("returns text operators for text type", () => {
      const ops = getOperatorsForColumnType("text");
      expect(ops).toContain("=");
      expect(ops).toContain("!=");
      expect(ops).toContain("LIKE");
      expect(ops).toContain("IS NULL");
      expect(ops).toContain("IS NOT NULL");
      expect(ops).not.toContain(">");
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

    it("returns all operators for unknown type as fallback", () => {
      const ops = getOperatorsForColumnType("unknown" as ColumnType);
      expect(ops).toContain("=");
      expect(ops).toContain("LIKE");
      expect(ops).toContain("IN");
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

    it("parentBountyId is numeric, not categorical", () => {
      // parentBountyId should be numeric (ends with Id)
      expect(isCategoricalColumn("parentBountyId")).toBe(false);
      expect(getColumnType("parentBountyId")).toBe("numeric");
    });
  });

  describe("filterColumnMap pattern", () => {
    /**
     * The filterColumnMap feature allows a display column (e.g., "parentBountyId")
     * to use a different column (e.g., "parentBountyName") for filtering.
     *
     * Example usage in columnOverrides:
     *   parentBountyId: {
     *     header: "Parent",
     *     filterColumn: "parentBountyName",  // Use name column for filtering
     *     cell: ... // Display bounty name
     *   }
     *
     * This test documents the expected behavior when filterColumnMap is applied.
     */
    it("explains filterColumnMap: display column uses mapped column for type detection", () => {
      // Without filterColumnMap: parentBountyId is numeric (ID column)
      const displayColumn = "parentBountyId";
      expect(getColumnType(displayColumn)).toBe("numeric");
      expect(isCategoricalColumn(displayColumn)).toBe(false);

      // With filterColumnMap: parentBountyId maps to parentBountyName
      // The effective column for type checking is parentBountyName
      const filterColumn = "parentBountyName";
      expect(getColumnType(filterColumn)).toBe("categorical");
      expect(isCategoricalColumn(filterColumn)).toBe(true);

      // Result: UI shows "Parent" column, but uses categorical operators
      // (IN/NOT IN) and fetches facets using parentBountyName values
      const ops = getOperatorsForColumnType(getColumnType(filterColumn));
      expect(ops).toContain("IN");
      expect(ops).toContain("NOT IN");
    });

    it("category and subcategory are already categorical (no mapping needed)", () => {
      // These columns are directly categorical by name
      expect(isCategoricalColumn("category")).toBe(true);
      expect(isCategoricalColumn("subcategory")).toBe(true);
      expect(getColumnType("category")).toBe("categorical");
      expect(getColumnType("subcategory")).toBe("categorical");
    });
  });
});
