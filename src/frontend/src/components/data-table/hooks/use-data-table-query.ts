import { useState, useEffect, useRef } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { QueryConfig, QueryExecuteResponse, FacetQueryConfig, FacetQueryResponse } from "@/lib/db/types";

interface UseDataTableQueryParams<TData> {
  queryConfig: QueryConfig;
  baseQueryConfig: Omit<QueryConfig, "filters">;
  facetedFilters?: string[];
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnIdToRef: Record<string, string>;
}

interface UseDataTableQueryResult<TData> {
  data: TData[];
  setData: React.Dispatch<React.SetStateAction<TData[]>>;
  loading: boolean;
  error: string | null;
  totalCount: number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serverFacets: Record<string, Map<any, number>>;
}

/**
 * Hook to handle data fetching with debouncing, abort control, and facets.
 *
 * Features:
 * - 300ms debounce to prevent blocking on every keystroke/change
 * - AbortController to cancel in-flight requests when new requests are made
 * - Parallel fetching of data and facets
 * - Proper cleanup on unmount
 */
export function useDataTableQuery<TData>({
  queryConfig,
  baseQueryConfig,
  facetedFilters,
  columnOverrides,
  columnIdToRef,
}: UseDataTableQueryParams<TData>): UseDataTableQueryResult<TData> {
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [serverFacets, setServerFacets] = useState<Record<string, Map<any, number>>>({});

  // AbortController ref to cancel in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Debounce fetch to prevent blocking on every keystroke/change
    // This allows the UI to remain responsive while user is actively editing
    const timeoutId = setTimeout(() => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const controller = new AbortController();
      abortControllerRef.current = controller;

      async function fetchData() {
        setLoading(true);
        setError(null);
        try {
          // Create data fetch promise
          const dataPromise = fetch("/api/query/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "include",
            body: JSON.stringify(queryConfig),
            signal: controller.signal,
          });

          // Create facet fetch promise if facetedFilters are defined
          let facetPromise: Promise<Response> | null = null;
          // Build mapping from display columns to filter columns using columnOverrides
          const filterColumnMap = new Map<string, string>();
          if (columnOverrides && facetedFilters) {
            for (const colId of facetedFilters) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const override = columnOverrides[colId] as any;
              if (override?.filterColumn) {
                filterColumnMap.set(colId, override.filterColumn);
              }
            }
          }
          if (facetedFilters && facetedFilters.length > 0) {
            // Resolve filter columns - use filterColumn from override if specified
            // Then resolve aliases to actual column references using columnIdToRef
            const resolvedFacetColumns = facetedFilters.map(col => {
              const filterCol = filterColumnMap.get(col) || col;
              // Resolve alias to actual column reference (e.g., parentBountyName -> b.name)
              return columnIdToRef[filterCol] || filterCol;
            });
            const facetConfig: FacetQueryConfig = {
              sourceTable: baseQueryConfig.sourceTable,
              columns: resolvedFacetColumns,
              joins: baseQueryConfig.joins,
              filters: queryConfig.filters, // Use filters from queryConfig (already computed)
            };
            facetPromise = fetch("/api/query/facets", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
              },
              credentials: "include",
              body: JSON.stringify(facetConfig),
              signal: controller.signal,
            });
          }

          // Wait for both requests to complete
          const [dataResponse, facetResponse] = await Promise.all([
            dataPromise,
            facetPromise || Promise.resolve(null),
          ]);

          // Process data response
          if (!dataResponse.ok) {
            const result = await dataResponse.json();
            throw new Error(result.error || "Query failed");
          }
          const dataResult: QueryExecuteResponse = await dataResponse.json();
          setData(dataResult.data as TData[]);
          setTotalCount(dataResult.totalCount);

          // Process facet response
          if (facetResponse && facetResponse.ok) {
            const facetResult: FacetQueryResponse = await facetResponse.json();
            // Build reverse mapping: columnRef -> displayColumn
            // Need to map from actual column ref (e.g., b.name) back to display column (e.g., parentBountyId)
            const refToDisplay = new Map<string, string>();
            if (facetedFilters) {
              for (const col of facetedFilters) {
                const filterCol = filterColumnMap.get(col) || col;
                const colRef = columnIdToRef[filterCol] || filterCol;
                refToDisplay.set(colRef, col);
              }
            }
            // Convert facet arrays to Map format expected by TanStack Table
            // Map keys back to display column names
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const facetMaps: Record<string, Map<any, number>> = {};
            for (const [column, values] of Object.entries(facetResult.facets)) {
              // Use display column name if this was a remapped filter column
              const displayCol = refToDisplay.get(column) || column;
              facetMaps[displayCol] = new Map(
                values.map(v => [v.value, v.count])
              );
            }
            setServerFacets(facetMaps);
          } else if (facetResponse && !facetResponse.ok) {
            console.warn("Facet fetch failed, using client-side faceting");
            setServerFacets({});
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // Ignore abort errors - these are expected when user changes filters rapidly
          if (err.name === 'AbortError') {
            console.log('Request cancelled');
            return;
          }
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }

      fetchData();

      // Cleanup: abort on unmount
      return () => {
        controller.abort();
      };
    }, 300); // 300ms debounce - balance between responsiveness and reducing blocking

    // Cleanup: cancel timeout and abort request
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [queryConfig, baseQueryConfig, facetedFilters, columnOverrides, columnIdToRef]);

  return {
    data,
    setData,
    loading,
    error,
    totalCount,
    serverFacets,
  };
}
