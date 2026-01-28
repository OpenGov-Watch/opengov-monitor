import { useMemo } from "react";
import { getColumnConfig } from "@/lib/column-renderer";
import {
  processHierarchicalData,
  type ProcessedHierarchicalData,
} from "../hierarchical-utils";

interface UseHierarchicalDataParams<TData> {
  hierarchicalDisplay?: boolean;
  groupByColumns?: string[];
  data: TData[];
  tableName: string;
  columnMapping?: Record<string, string>;
  configLoaded: boolean;
}

interface UseHierarchicalDataResult<TData> {
  normalizedGroupByColumns: string[] | null;
  hierarchicalData: ProcessedHierarchicalData<TData> | null;
}

/**
 * Hook to process data for hierarchical display with collapsed group values and subtotals.
 *
 * Includes normalization of groupByColumns to match data keys, since the backend returns
 * column names without table prefix (e.g., "category" not "all_spending.category").
 */
export function useHierarchicalData<TData>({
  hierarchicalDisplay,
  groupByColumns,
  data,
  tableName,
  columnMapping,
  configLoaded,
}: UseHierarchicalDataParams<TData>): UseHierarchicalDataResult<TData> {
  // Normalize groupByColumns to match data keys
  const normalizedGroupByColumns = useMemo(() => {
    if (!groupByColumns || !data || data.length === 0) return null;

    const firstRow = data[0] as Record<string, unknown>;
    const dataKeys = new Set(Object.keys(firstRow));

    // Try to match each groupBy column to an actual data key
    return groupByColumns.map(col => {
      // If the column exists in data as-is, use it
      if (dataKeys.has(col)) return col;

      // Try stripping table prefix (e.g., "all_spending.category" -> "category")
      const lastPart = col.split('.').pop() || col;
      if (dataKeys.has(lastPart)) return lastPart;

      // Fallback to original
      return col;
    });
  }, [groupByColumns, data]);

  // Process data for hierarchical display with collapsed group values and subtotals
  const hierarchicalData = useMemo<ProcessedHierarchicalData<TData> | null>(() => {
    if (!hierarchicalDisplay || !normalizedGroupByColumns || normalizedGroupByColumns.length < 2 || !data || data.length === 0 || !configLoaded) {
      return null;
    }

    // Identify currency columns for subtotal calculation
    const currencyColumns: string[] = [];
    const firstRow = data[0] as Record<string, unknown>;
    for (const col of Object.keys(firstRow)) {
      const sourceCol = columnMapping?.[col] || col;
      // Try multiple column name variations for pattern matching
      // 1. Full source column (e.g., "all_spending.DOT_latest")
      // 2. Just the column part without table prefix (e.g., "DOT_latest")
      const colWithoutTable = sourceCol.includes('.') ? sourceCol.split('.').pop()! : sourceCol;

      let config = getColumnConfig(tableName, sourceCol);
      if (config.type !== "currency" && colWithoutTable !== sourceCol) {
        config = getColumnConfig(tableName, colWithoutTable);
      }

      if (config.type === "currency") {
        currencyColumns.push(col);
      }
    }

    return processHierarchicalData(
      data as Record<string, unknown>[],
      normalizedGroupByColumns,
      currencyColumns
    ) as ProcessedHierarchicalData<TData>;
  }, [hierarchicalDisplay, normalizedGroupByColumns, data, tableName, columnMapping, configLoaded]);

  return { normalizedGroupByColumns, hierarchicalData };
}
