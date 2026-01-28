import { useState, useEffect } from "react";
import { QueryConfig } from "@/lib/db/types";
import { getColumnConfig } from "@/lib/column-renderer";

interface UseGrandTotalsQueryParams<TData> {
  showGrandTotals?: boolean;
  configLoaded: boolean;
  data: TData[];
  tableName: string;
  columnMapping?: Record<string, string>;
  sourceTable: string;
  joins?: QueryConfig["joins"];
  filters: QueryConfig["filters"];
}

/**
 * Hook to fetch aggregate sums for currency columns when showGrandTotals is enabled.
 *
 * This fetches a separate query with SUM aggregates for all currency columns,
 * which provides accurate totals across all matching rows (not just the current page).
 */
export function useGrandTotalsQuery<TData>({
  showGrandTotals,
  configLoaded,
  data,
  tableName,
  columnMapping,
  sourceTable,
  joins,
  filters,
}: UseGrandTotalsQueryParams<TData>): Record<string, number> {
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!showGrandTotals || !configLoaded || !data || data.length === 0) {
      setGrandTotals({});
      return;
    }

    // Find currency columns from current data
    const currencyColumns: string[] = [];
    const firstRow = data[0] as Record<string, unknown>;
    for (const col of Object.keys(firstRow)) {
      const sourceCol = columnMapping?.[col] || col;
      const config = getColumnConfig(tableName, sourceCol);
      if (config.type === "currency") {
        currencyColumns.push(col);
      }
    }

    if (currencyColumns.length === 0) {
      setGrandTotals({});
      return;
    }

    // Build aggregate query for currency columns
    const aggregateConfig: QueryConfig = {
      sourceTable,
      columns: currencyColumns.map(col => ({
        column: columnMapping?.[col] || col,
        alias: col,
        aggregateFunction: "SUM" as const,
      })),
      joins,
      filters,
      limit: 1,
    };

    const controller = new AbortController();

    fetch("/api/query/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      credentials: "include",
      body: JSON.stringify(aggregateConfig),
      signal: controller.signal,
    })
      .then(res => res.json())
      .then(result => {
        if (result.data?.[0]) {
          setGrandTotals(result.data[0] as Record<string, number>);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.warn("Failed to fetch grand totals:", err);
        }
      });

    return () => controller.abort();
  }, [showGrandTotals, filters, configLoaded, data, tableName, columnMapping, sourceTable, joins]);

  return grandTotals;
}
