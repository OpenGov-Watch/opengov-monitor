import { useMemo } from "react";
import { getColumnConfig, formatValue } from "@/lib/column-renderer";
import type { FooterCell } from "../data-table";

interface UsePageTotalsParams<TData> {
  showPageTotals?: boolean;
  data: TData[];
  tableName: string;
  columnMapping?: Record<string, string>;
  configLoaded: boolean;
}

/**
 * Hook to calculate page-level totals for currency columns from current page data.
 */
export function usePageTotals<TData>({
  showPageTotals,
  data,
  tableName,
  columnMapping,
  configLoaded,
}: UsePageTotalsParams<TData>): FooterCell[] {
  return useMemo<FooterCell[]>(() => {
    if (!showPageTotals || !data || data.length === 0 || !configLoaded) return [];

    const cells: FooterCell[] = [];
    const firstRow = data[0] as Record<string, unknown>;

    for (const col of Object.keys(firstRow)) {
      const sourceCol = columnMapping?.[col] || col;
      const config = getColumnConfig(tableName, sourceCol);
      if (config.type === "currency") {
        // Sum all values in this column
        const sum = (data as Record<string, unknown>[]).reduce((acc, row) => {
          const value = row[col];
          return acc + (typeof value === "number" ? value : 0);
        }, 0);
        cells.push({
          columnId: col,
          value: formatValue(sum, config),
        });
      }
    }

    return cells;
  }, [showPageTotals, data, tableName, columnMapping, configLoaded]);
}
