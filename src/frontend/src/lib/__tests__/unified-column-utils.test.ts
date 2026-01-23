/**
 * Unified Column Utils Tests
 *
 * Tests for conversion utilities that transform between unified column state
 * and API format (QueryConfig columns/expressionColumns).
 */

import { describe, it, expect } from "vitest";
import {
  toUnifiedColumns,
  fromUnifiedColumns,
  getColumnId,
  type UnifiedColumn,
} from "../unified-column-utils";
import type { ColumnSelection, ExpressionColumn } from "@/lib/db/types";

describe("getColumnId", () => {
  it("returns col: prefixed ID for regular columns", () => {
    const col: UnifiedColumn = {
      type: "regular",
      column: "all_spending.quarter",
    };
    expect(getColumnId(col)).toBe("col:all_spending.quarter");
  });

  it("returns expr: prefixed ID for expression columns", () => {
    const col: UnifiedColumn = {
      type: "expression",
      expression: "DOT_value * 10",
      alias: "total_value",
    };
    expect(getColumnId(col)).toBe("expr:total_value");
  });

  it("handles regular columns with aggregateFunction", () => {
    const col: UnifiedColumn = {
      type: "regular",
      column: "all_spending.DOT_value",
      aggregateFunction: "SUM",
    };
    expect(getColumnId(col)).toBe("col:all_spending.DOT_value");
  });

  it("handles regular columns with alias", () => {
    const col: UnifiedColumn = {
      type: "regular",
      column: "all_spending.DOT_value",
      alias: "total_dot",
    };
    expect(getColumnId(col)).toBe("col:all_spending.DOT_value");
  });
});

describe("toUnifiedColumns", () => {
  it("converts empty arrays", () => {
    const result = toUnifiedColumns([], []);
    expect(result).toEqual([]);
  });

  it("converts regular columns only", () => {
    const columns: ColumnSelection[] = [
      { column: "all_spending.quarter" },
      { column: "all_spending.DOT_value", aggregateFunction: "SUM" },
    ];
    const result = toUnifiedColumns(columns, []);
    expect(result).toEqual([
      { type: "regular", column: "all_spending.quarter" },
      {
        type: "regular",
        column: "all_spending.DOT_value",
        aggregateFunction: "SUM",
      },
    ]);
  });

  it("converts expression columns only", () => {
    const expressionColumns: ExpressionColumn[] = [
      { expression: "DOT_value * 10", alias: "total_value" },
      { expression: "USDC_component + USDT_component", alias: "stablecoins" },
    ];
    const result = toUnifiedColumns([], expressionColumns);
    expect(result).toEqual([
      { type: "expression", expression: "DOT_value * 10", alias: "total_value" },
      {
        type: "expression",
        expression: "USDC_component + USDT_component",
        alias: "stablecoins",
      },
    ]);
  });

  it("converts mixed columns and expressions", () => {
    const columns: ColumnSelection[] = [
      { column: "all_spending.quarter" },
      { column: "all_spending.category" },
    ];
    const expressionColumns: ExpressionColumn[] = [
      { expression: "DOT_value * 10", alias: "total_value" },
    ];
    const result = toUnifiedColumns(columns, expressionColumns);
    expect(result).toEqual([
      { type: "regular", column: "all_spending.quarter" },
      { type: "regular", column: "all_spending.category" },
      { type: "expression", expression: "DOT_value * 10", alias: "total_value" },
    ]);
  });

  it("preserves alias on regular columns", () => {
    const columns: ColumnSelection[] = [
      { column: "c.category", alias: "category" },
    ];
    const result = toUnifiedColumns(columns, []);
    expect(result).toEqual([
      { type: "regular", column: "c.category", alias: "category" },
    ]);
  });

  it("preserves aggregateFunction on regular columns", () => {
    const columns: ColumnSelection[] = [
      { column: "all_spending.DOT_value", aggregateFunction: "AVG" },
    ];
    const result = toUnifiedColumns(columns, []);
    expect(result).toEqual([
      {
        type: "regular",
        column: "all_spending.DOT_value",
        aggregateFunction: "AVG",
      },
    ]);
  });

  it("handles undefined expressionColumns", () => {
    const columns: ColumnSelection[] = [{ column: "all_spending.quarter" }];
    const result = toUnifiedColumns(columns, undefined);
    expect(result).toEqual([
      { type: "regular", column: "all_spending.quarter" },
    ]);
  });

  it("preserves all properties on regular columns", () => {
    const columns: ColumnSelection[] = [
      {
        column: "all_spending.DOT_value",
        alias: "total_dot",
        aggregateFunction: "SUM",
      },
    ];
    const result = toUnifiedColumns(columns, []);
    expect(result).toEqual([
      {
        type: "regular",
        column: "all_spending.DOT_value",
        alias: "total_dot",
        aggregateFunction: "SUM",
      },
    ]);
  });
});

describe("fromUnifiedColumns", () => {
  it("returns empty arrays for empty input", () => {
    const result = fromUnifiedColumns([]);
    expect(result).toEqual({ columns: [], expressionColumns: [], columnOrder: [] });
  });

  it("extracts regular columns", () => {
    const unified: UnifiedColumn[] = [
      { type: "regular", column: "all_spending.quarter" },
      { type: "regular", column: "all_spending.category" },
    ];
    const result = fromUnifiedColumns(unified);
    expect(result.columns).toEqual([
      { column: "all_spending.quarter" },
      { column: "all_spending.category" },
    ]);
    expect(result.expressionColumns).toEqual([]);
  });

  it("extracts expression columns", () => {
    const unified: UnifiedColumn[] = [
      { type: "expression", expression: "DOT_value * 10", alias: "total_value" },
      {
        type: "expression",
        expression: "USDC_component + USDT_component",
        alias: "stablecoins",
      },
    ];
    const result = fromUnifiedColumns(unified);
    expect(result.columns).toEqual([]);
    expect(result.expressionColumns).toEqual([
      { expression: "DOT_value * 10", alias: "total_value" },
      { expression: "USDC_component + USDT_component", alias: "stablecoins" },
    ]);
  });

  it("preserves order of regular columns", () => {
    const unified: UnifiedColumn[] = [
      { type: "regular", column: "all_spending.quarter" },
      { type: "expression", expression: "DOT_value * 10", alias: "total" },
      { type: "regular", column: "all_spending.category" },
    ];
    const result = fromUnifiedColumns(unified);
    // Regular columns maintain their relative order
    expect(result.columns).toEqual([
      { column: "all_spending.quarter" },
      { column: "all_spending.category" },
    ]);
    expect(result.expressionColumns).toEqual([
      { expression: "DOT_value * 10", alias: "total" },
    ]);
  });

  it("preserves alias on regular columns", () => {
    const unified: UnifiedColumn[] = [
      { type: "regular", column: "c.category", alias: "category" },
    ];
    const result = fromUnifiedColumns(unified);
    expect(result.columns).toEqual([{ column: "c.category", alias: "category" }]);
  });

  it("preserves aggregateFunction on regular columns", () => {
    const unified: UnifiedColumn[] = [
      {
        type: "regular",
        column: "all_spending.DOT_value",
        aggregateFunction: "SUM",
      },
    ];
    const result = fromUnifiedColumns(unified);
    expect(result.columns).toEqual([
      { column: "all_spending.DOT_value", aggregateFunction: "SUM" },
    ]);
  });

  it("preserves all properties on regular columns", () => {
    const unified: UnifiedColumn[] = [
      {
        type: "regular",
        column: "all_spending.DOT_value",
        alias: "total_dot",
        aggregateFunction: "SUM",
      },
    ];
    const result = fromUnifiedColumns(unified);
    expect(result.columns).toEqual([
      {
        column: "all_spending.DOT_value",
        alias: "total_dot",
        aggregateFunction: "SUM",
      },
    ]);
  });
});

describe("Round-trip: toUnifiedColumns -> fromUnifiedColumns", () => {
  it("round-trips regular columns without data loss", () => {
    const originalColumns: ColumnSelection[] = [
      { column: "all_spending.quarter" },
      { column: "all_spending.DOT_value", aggregateFunction: "SUM" },
      { column: "c.category", alias: "category" },
    ];
    const originalExpressions: ExpressionColumn[] = [];

    const unified = toUnifiedColumns(originalColumns, originalExpressions);
    const result = fromUnifiedColumns(unified);

    expect(result.columns).toEqual(originalColumns);
    expect(result.expressionColumns).toEqual(originalExpressions);
  });

  it("round-trips expression columns without data loss", () => {
    const originalColumns: ColumnSelection[] = [];
    const originalExpressions: ExpressionColumn[] = [
      { expression: "DOT_value * 10", alias: "total_value" },
      { expression: "USDC_component + USDT_component", alias: "stablecoins" },
    ];

    const unified = toUnifiedColumns(originalColumns, originalExpressions);
    const result = fromUnifiedColumns(unified);

    expect(result.columns).toEqual(originalColumns);
    expect(result.expressionColumns).toEqual(originalExpressions);
  });

  it("round-trips mixed columns and expressions", () => {
    const originalColumns: ColumnSelection[] = [
      { column: "all_spending.quarter" },
      { column: "all_spending.DOT_value", aggregateFunction: "SUM" },
    ];
    const originalExpressions: ExpressionColumn[] = [
      { expression: "DOT_value * 10", alias: "total_value" },
    ];

    const unified = toUnifiedColumns(originalColumns, originalExpressions);
    const result = fromUnifiedColumns(unified);

    expect(result.columns).toEqual(originalColumns);
    expect(result.expressionColumns).toEqual(originalExpressions);
  });

  it("round-trips empty arrays", () => {
    const originalColumns: ColumnSelection[] = [];
    const originalExpressions: ExpressionColumn[] = [];

    const unified = toUnifiedColumns(originalColumns, originalExpressions);
    const result = fromUnifiedColumns(unified);

    expect(result.columns).toEqual([]);
    expect(result.expressionColumns).toEqual([]);
  });

  it("round-trips columns with all properties", () => {
    const originalColumns: ColumnSelection[] = [
      {
        column: "all_spending.DOT_value",
        alias: "total_dot",
        aggregateFunction: "SUM",
      },
    ];
    const originalExpressions: ExpressionColumn[] = [];

    const unified = toUnifiedColumns(originalColumns, originalExpressions);
    const result = fromUnifiedColumns(unified);

    expect(result.columns).toEqual(originalColumns);
  });
});

describe("Unified column display order preservation", () => {
  it("maintains insertion order in unified array", () => {
    const columns: ColumnSelection[] = [
      { column: "col_a" },
      { column: "col_b" },
    ];
    const expressions: ExpressionColumn[] = [
      { expression: "expr_1", alias: "e1" },
      { expression: "expr_2", alias: "e2" },
    ];

    const unified = toUnifiedColumns(columns, expressions);

    // Regular columns come first, then expressions (in original order)
    expect(unified[0]).toEqual({ type: "regular", column: "col_a" });
    expect(unified[1]).toEqual({ type: "regular", column: "col_b" });
    expect(unified[2]).toEqual({
      type: "expression",
      expression: "expr_1",
      alias: "e1",
    });
    expect(unified[3]).toEqual({
      type: "expression",
      expression: "expr_2",
      alias: "e2",
    });
  });
});

describe("getExpressionColumnAliases helper", () => {
  // Note: This helper is used to get aliases of expression columns for use in filters/group by/order by
  it("extracts aliases from unified columns", () => {
    const unified: UnifiedColumn[] = [
      { type: "regular", column: "all_spending.quarter" },
      { type: "expression", expression: "DOT_value * 10", alias: "total_value" },
      { type: "regular", column: "all_spending.category" },
      { type: "expression", expression: "USDC + USDT", alias: "stablecoins" },
    ];

    const aliases = unified
      .filter((col): col is UnifiedColumn & { type: "expression" } => col.type === "expression")
      .map((col) => col.alias);

    expect(aliases).toEqual(["total_value", "stablecoins"]);
  });
});

describe("columnOrder support", () => {
  describe("fromUnifiedColumns generates columnOrder", () => {
    it("generates correct columnOrder for regular columns", () => {
      const unified: UnifiedColumn[] = [
        { type: "regular", column: "col_a" },
        { type: "regular", column: "col_b" },
      ];
      const result = fromUnifiedColumns(unified);
      expect(result.columnOrder).toEqual(["col:col_a", "col:col_b"]);
    });

    it("generates correct columnOrder for expression columns", () => {
      const unified: UnifiedColumn[] = [
        { type: "expression", expression: "a + b", alias: "sum_ab" },
        { type: "expression", expression: "c * d", alias: "prod_cd" },
      ];
      const result = fromUnifiedColumns(unified);
      expect(result.columnOrder).toEqual(["expr:sum_ab", "expr:prod_cd"]);
    });

    it("generates correct columnOrder for interleaved columns", () => {
      const unified: UnifiedColumn[] = [
        { type: "expression", expression: "a + b", alias: "sum_ab" },
        { type: "regular", column: "col_a" },
        { type: "expression", expression: "c * d", alias: "prod_cd" },
        { type: "regular", column: "col_b" },
      ];
      const result = fromUnifiedColumns(unified);
      expect(result.columnOrder).toEqual([
        "expr:sum_ab",
        "col:col_a",
        "expr:prod_cd",
        "col:col_b",
      ]);
    });
  });

  describe("toUnifiedColumns respects columnOrder", () => {
    it("reorders columns based on columnOrder", () => {
      const columns: ColumnSelection[] = [
        { column: "col_a" },
        { column: "col_b" },
      ];
      const expressions: ExpressionColumn[] = [
        { expression: "a + b", alias: "sum_ab" },
      ];
      const columnOrder = ["expr:sum_ab", "col:col_a", "col:col_b"];

      const result = toUnifiedColumns(columns, expressions, columnOrder);

      expect(result).toEqual([
        { type: "expression", expression: "a + b", alias: "sum_ab" },
        { type: "regular", column: "col_a" },
        { type: "regular", column: "col_b" },
      ]);
    });

    it("puts expression first when columnOrder specifies", () => {
      const columns: ColumnSelection[] = [{ column: "col_a" }];
      const expressions: ExpressionColumn[] = [
        { expression: "x * 10", alias: "scaled" },
      ];
      const columnOrder = ["expr:scaled", "col:col_a"];

      const result = toUnifiedColumns(columns, expressions, columnOrder);

      expect(result[0].type).toBe("expression");
      expect(result[1].type).toBe("regular");
    });

    it("falls back to default order when columnOrder is undefined", () => {
      const columns: ColumnSelection[] = [{ column: "col_a" }];
      const expressions: ExpressionColumn[] = [
        { expression: "x * 10", alias: "scaled" },
      ];

      const result = toUnifiedColumns(columns, expressions, undefined);

      // Default: regular columns first, then expressions
      expect(result[0].type).toBe("regular");
      expect(result[1].type).toBe("expression");
    });

    it("falls back to default order when columnOrder is empty", () => {
      const columns: ColumnSelection[] = [{ column: "col_a" }];
      const expressions: ExpressionColumn[] = [
        { expression: "x * 10", alias: "scaled" },
      ];

      const result = toUnifiedColumns(columns, expressions, []);

      // Default: regular columns first, then expressions
      expect(result[0].type).toBe("regular");
      expect(result[1].type).toBe("expression");
    });

    it("handles columns not in columnOrder (backward compatibility)", () => {
      const columns: ColumnSelection[] = [
        { column: "col_a" },
        { column: "col_b" },
      ];
      const expressions: ExpressionColumn[] = [
        { expression: "a + b", alias: "sum_ab" },
      ];
      // Only includes col_a and sum_ab, not col_b
      const columnOrder = ["expr:sum_ab", "col:col_a"];

      const result = toUnifiedColumns(columns, expressions, columnOrder);

      // col_b should be appended at the end
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ type: "expression", expression: "a + b", alias: "sum_ab" });
      expect(result[1]).toEqual({ type: "regular", column: "col_a" });
      expect(result[2]).toEqual({ type: "regular", column: "col_b" });
    });
  });

  describe("Round-trip with columnOrder", () => {
    it("preserves interleaved order through round-trip", () => {
      // Start with interleaved unified columns
      const originalUnified: UnifiedColumn[] = [
        { type: "expression", expression: "a + b", alias: "sum_ab" },
        { type: "regular", column: "col_a" },
        { type: "expression", expression: "c * d", alias: "prod_cd" },
        { type: "regular", column: "col_b" },
      ];

      // Convert to API format
      const { columns, expressionColumns, columnOrder } = fromUnifiedColumns(originalUnified);

      // Convert back to unified format using columnOrder
      const restoredUnified = toUnifiedColumns(columns, expressionColumns, columnOrder);

      // Should preserve the original interleaved order
      expect(restoredUnified).toEqual(originalUnified);
    });

    it("preserves expression-first order through round-trip", () => {
      const originalUnified: UnifiedColumn[] = [
        { type: "expression", expression: "DOT * 10", alias: "scaled_dot" },
        { type: "regular", column: "category" },
        { type: "regular", column: "subcategory" },
      ];

      const { columns, expressionColumns, columnOrder } = fromUnifiedColumns(originalUnified);
      const restoredUnified = toUnifiedColumns(columns, expressionColumns, columnOrder);

      expect(restoredUnified).toEqual(originalUnified);
    });
  });
});
