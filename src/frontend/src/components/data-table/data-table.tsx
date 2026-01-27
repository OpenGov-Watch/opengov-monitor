"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  ColumnDef,
  SortingState,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getGroupedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";
import { DataTableCard } from "./data-table-card";
import { ViewSelector } from "./view-selector";
import { useViewState, SavedView } from "@/hooks/use-view-state";
import { QueryConfig, QueryExecuteResponse, DataTableEditConfig, FacetQueryConfig, FacetQueryResponse } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";
import { getColumnKey, sortingStateToOrderBy, convertFiltersToQueryConfig } from "@/lib/query-config-utils";
import { cn } from "@/lib/utils";
import { loadColumnConfig, getColumnConfig, formatValue } from "@/lib/column-renderer";
import {
  processHierarchicalData,
  shouldShowRowBorder,
  type ProcessedHierarchicalData,
} from "./hierarchical-utils";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableProps<TData> {
  // orderBy is kept for fallback when sorting state is empty (hidden column sorting)
  queryConfig: Omit<QueryConfig, "filters">;
  tableName: string;
  editConfig?: DataTableEditConfig;
  isAuthenticated?: boolean;
  facetedFilters?: string[];
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnMapping?: Record<string, string>;
  defaultSorting?: SortingState;
  defaultViews?: SavedView[];
  footerCells?: FooterCell[];
  footerLabel?: string;
  compactMode?: boolean;

  // Dashboard mode configuration
  dashboardMode?: boolean;
  dashboardComponentId?: string;
  defaultFilters?: QueryConfig["filters"]; // Saved filters from component config

  // Feature visibility control
  hideViewSelector?: boolean;
  toolbarCollapsible?: boolean;
  initialToolbarCollapsed?: boolean;

  // Controlled toolbar collapse state (for dashboard integration)
  toolbarCollapsed?: boolean;
  onToolbarCollapseChange?: (collapsed: boolean) => void;

  // Export handler callbacks for external download buttons (dashboard integration)
  onExportCSV?: (handler: () => void) => void;
  onExportJSON?: (handler: () => void) => void;

  // Totals rows
  showPageTotals?: boolean;  // Show page-level totals row
  showGrandTotals?: boolean; // Show grand totals row (all data)

  // Hierarchical display
  hierarchicalDisplay?: boolean;  // Collapse repeated group values
  showGroupTotals?: boolean;      // Show subtotals for each group level
  groupByColumns?: string[];      // Ordered array of columns for grouping

  // Sorting control
  disableSorting?: boolean;       // Disable column header sorting (useful for hierarchical display)

  // Hidden columns (expression columns with hidden: true)
  hiddenColumns?: Set<string>;
}

export function DataTable<TData>({
  queryConfig: baseQueryConfig,
  tableName,
  editConfig,
  isAuthenticated,
  facetedFilters,
  columnOverrides,
  columnMapping,
  defaultSorting,
  defaultViews,
  footerCells,
  footerLabel,
  compactMode = false,
  dashboardMode = false,
  dashboardComponentId,
  defaultFilters,
  hideViewSelector: hideViewSelectorProp,
  toolbarCollapsible: toolbarCollapsibleProp,
  initialToolbarCollapsed: initialToolbarCollapsedProp,
  toolbarCollapsed,
  onToolbarCollapseChange,
  onExportCSV,
  onExportJSON,
  showPageTotals,
  showGrandTotals,
  hierarchicalDisplay,
  showGroupTotals,
  groupByColumns,
  disableSorting = false,
  hiddenColumns,
}: DataTableProps<TData>) {
  // Apply defaults based on dashboardMode
  const hideViewSelector = hideViewSelectorProp ?? dashboardMode;
  const toolbarCollapsible = toolbarCollapsibleProp ?? dashboardMode;
  const initialToolbarCollapsed = initialToolbarCollapsedProp ?? dashboardMode;
  // VIEW STATE MANAGEMENT (moved before queryConfig to access sorting/filtering)
  // disableUrlSync prevents multiple dashboard tables from fighting over the same ?view= URL param
  const viewState = useViewState(tableName, { defaultSorting, defaultViews, disableUrlSync: dashboardMode });

  const {
    sorting,
    setSorting: setViewSorting,
    columnFilters,
    setColumnFilters: setViewColumnFilters,
    columnVisibility,
    setColumnVisibility,
    pagination,
    setPagination,
    filterGroup,
    setFilterGroup,
    groupBy,
    setGroupBy,
    currentViewName,
    getSavedViews,
    saveView,
    loadView,
    deleteView,
    clearViewState: clearView,
  } = viewState;

  // COLUMN CONFIG LOADING
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    loadColumnConfig().then(() => setConfigLoaded(true));
  }, []);

  // DATA FETCHING
  const [data, setData] = useState<TData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);
  const [serverFacets, setServerFacets] = useState<Record<string, Map<any, number>>>({});
  const [grandTotals, setGrandTotals] = useState<Record<string, number>>({});

  // AbortController ref to cancel in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Pass through the original setters without any wrapping
  const setSorting = setViewSorting;
  const setColumnFilters = setViewColumnFilters;
  const clearViewState = clearView;

  // Build mapping from column result keys to original column references
  // Uses the same pattern as Dashboard for consistency
  // This allows sortingStateToOrderBy to resolve joined columns correctly
  const columnIdToRef = useMemo(() => {
    const mapping: Record<string, string> = {};
    if (baseQueryConfig?.columns && Array.isArray(baseQueryConfig.columns)) {
      for (const col of baseQueryConfig.columns) {
        const key = getColumnKey(col);
        mapping[key] = col.column;
      }
    }
    return mapping;
  }, [baseQueryConfig]);

  // Build mapping from display columns to filter columns (from columnOverrides)
  // This allows Advanced Filters to show "Parent" but filter by "parentBountyName"
  const filterColumnMap = useMemo(() => {
    const map = new Map<string, string>();
    if (columnOverrides) {
      for (const [colId, override] of Object.entries(columnOverrides)) {
        if ((override as any).filterColumn) {
          map.set(colId, (override as any).filterColumn);
        }
      }
    }
    return map;
  }, [columnOverrides]);

  // BUILD COMPLETE QUERY CONFIG
  // Merge base config with dynamic sorting/filtering/pagination state
  const queryConfig = useMemo<QueryConfig>(() => {
    const viewStateFilters = convertFiltersToQueryConfig(columnFilters, filterGroup, columnIdToRef, filterColumnMap);

    // Merge default filters with view state filters
    // If view state has filters, use them; otherwise fall back to default filters
    const mergedFilters = (Array.isArray(viewStateFilters) && viewStateFilters.length > 0) ||
                          (viewStateFilters && 'conditions' in viewStateFilters && viewStateFilters.conditions.length > 0)
      ? viewStateFilters
      : (defaultFilters || []);

    // Convert user sorting state to orderBy format
    const userSorting = sortingStateToOrderBy(sorting, baseQueryConfig, columnIdToRef);
    // If user has sorting, use it; otherwise fall back to saved orderBy from queryConfig
    const mergedOrderBy = userSorting.length > 0 ? userSorting : (baseQueryConfig.orderBy || []);

    return {
      ...baseQueryConfig,
      orderBy: mergedOrderBy,
      filters: mergedFilters,
      groupBy: groupBy ? [groupBy] : baseQueryConfig.groupBy,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    };
  }, [baseQueryConfig, sorting, columnFilters, filterGroup, groupBy, pagination, defaultFilters, columnIdToRef, filterColumnMap]);

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
  }, [queryConfig, baseQueryConfig]); // Removed facetedFilters and columnFilters - they're already in queryConfig

  // Wrap editConfig to update local data optimistically
  const editConfigWithRefresh = useMemo(() => {
    if (!editConfig) return undefined;

    const wrappedConfig: DataTableEditConfig = {
      ...editConfig,
      editableColumns: {}
    };

    // Wrap each column's onUpdate to update local data
    Object.keys(editConfig.editableColumns).forEach(columnName => {
      const columnConfig = editConfig.editableColumns[columnName];
      wrappedConfig.editableColumns[columnName] = {
        ...columnConfig,
        onUpdate: async (id: any, value: any) => {
          await columnConfig.onUpdate(id, value);

          // Optimistically update local data
          setData(prevData => {
            const idField = editConfig.idField || 'id';
            const rowIndex = prevData.findIndex((row: any) => row[idField] === id);
            if (rowIndex === -1) return prevData;

            const newData = [...prevData];
            const updatedRow = { ...newData[rowIndex] } as any;

            // Handle category_id updates specially - update category and subcategory strings
            if (columnName === 'category_id' && value !== null) {
              const categories = columnConfig.type === 'category-selector'
                ? columnConfig.categories
                : [];
              const categoryRecord = categories?.find((c: any) => c.id === value);
              if (categoryRecord) {
                updatedRow['category_id'] = value;
                updatedRow['category'] = categoryRecord.category;
                updatedRow['subcategory'] = categoryRecord.subcategory;
              }
            } else if (columnName === 'category_id' && value === null) {
              // Clear category fields
              updatedRow['category_id'] = null;
              updatedRow['category'] = null;
              updatedRow['subcategory'] = null;
            } else {
              // For other columns, just update the value
              updatedRow[columnName] = value;
            }

            newData[rowIndex] = updatedRow as TData;
            return newData;
          });
        }
      };
    });

    return wrappedConfig;
  }, [editConfig]);

  // GRAND TOTALS FETCHING
  // Fetch aggregate sums for currency columns when showGrandTotals is enabled
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
      sourceTable: baseQueryConfig.sourceTable,
      columns: currencyColumns.map(col => ({
        column: columnMapping?.[col] || col,
        alias: col,
        aggregateFunction: "SUM" as const,
      })),
      joins: baseQueryConfig.joins,
      filters: queryConfig.filters,
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
  }, [showGrandTotals, queryConfig.filters, configLoaded, data, tableName, columnMapping, baseQueryConfig.sourceTable, baseQueryConfig.joins]);

  // PAGE TOTALS CALCULATION
  // Calculate page-level totals for currency columns from current page data
  const pageTotalsCells = useMemo<FooterCell[]>(() => {
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

  // GRAND TOTALS CELLS
  // Format grand totals for display
  const grandTotalsCells = useMemo<FooterCell[]>(() => {
    if (!showGrandTotals || Object.keys(grandTotals).length === 0 || !configLoaded) return [];

    const cells: FooterCell[] = [];
    for (const [col, value] of Object.entries(grandTotals)) {
      const sourceCol = columnMapping?.[col] || col;
      const config = getColumnConfig(tableName, sourceCol);
      cells.push({
        columnId: col,
        value: formatValue(value, config),
      });
    }

    return cells;
  }, [showGrandTotals, grandTotals, tableName, columnMapping, configLoaded]);

  // HIERARCHICAL DISPLAY PROCESSING
  // Normalize groupByColumns to match data keys
  // Backend returns column names without table prefix (e.g., "category" not "all_spending.category")
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

  // COLUMN GENERATION
  // Schema-based dependency to prevent regeneration on every data fetch
  // Only regenerate when column structure changes, not when values change
  const dataSchemaKey = data && data.length > 0 && data[0]
    ? Object.keys(data[0] as Record<string, unknown>).sort().join(',')
    : '';
  const dataSchema = useMemo(() => dataSchemaKey, [dataSchemaKey]);

  const columns = useMemo(() => {
    if (!data || data.length === 0 || !configLoaded) return [];

    return generateColumns({
      data,
      tableName,
      editConfig: editConfigWithRefresh,
      isAuthenticated,
      facetedFilters,
      columnOverrides,
      columnMapping,
      dashboardMode,
      filterGroup,
      onFilterGroupChange: setFilterGroup,
      hiddenColumns,
    });
  }, [
    dataSchema, // Changed from 'data' to 'dataSchema' to prevent regeneration on value changes
    tableName,
    editConfigWithRefresh,
    isAuthenticated,
    facetedFilters,
    columnOverrides,
    columnMapping,
    configLoaded,
    dashboardMode,
    filterGroup,
    setFilterGroup,
    hiddenColumns,
  ]);

  // VIEW MODE STATE
  const [viewMode, setViewMode] = React.useState<"table" | "card">(() => {
    if (compactMode) return "table"; // Force table in compact mode
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;
    const stored = localStorage.getItem(`${tableName}-view-mode`);
    return stored
      ? (stored as "table" | "card")
      : isMobile
        ? "card"
        : "table";
  });

  // Persist view mode preference (not in compact mode)
  React.useEffect(() => {
    if (!compactMode) {
      localStorage.setItem(`${tableName}-view-mode`, viewMode);
    }
  }, [viewMode, tableName, compactMode]);

  // GROUPING STATE
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  // REACT TABLE INSTANCE
  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
      grouping: groupBy ? [groupBy] : [],
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onExpandedChange: setExpanded,
    enableSorting: !disableSorting,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    // getSortedRowModel removed - sorting now server-side via orderBy
    // getFilteredRowModel removed - filtering now server-side via filters
    // getPaginationRowModel removed - pagination now server-side via limit/offset
    manualPagination: true,  // Enable server-side pagination
    rowCount: totalCount ?? 0,  // Total rows from server
    pageCount: totalCount !== undefined
      ? Math.ceil(totalCount / pagination.pageSize)
      : -1,  // -1 means unknown (loading state)
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: (table: any, columnId: string) => {
      // Use server-provided facets if available, otherwise fall back to client-side
      return () => {
        if (serverFacets[columnId]) {
          return serverFacets[columnId];
        }
        // Fall back to default client-side faceting
        const defaultFn = getFacetedUniqueValues();
        return defaultFn(table, columnId)();
      };
    },
  });

  // RENDER
  return (
    <div className={cn(
      "flex flex-col flex-1 min-h-0",
      dashboardMode ? "gap-2 p-3" : "gap-4"
    )}>
      {!hideViewSelector && (
        <ViewSelector
          views={getSavedViews()}
          currentViewName={currentViewName}
          onSelectView={loadView}
          onSaveView={saveView}
          onDeleteView={deleteView}
        />
      )}
      <DataTableToolbar
        table={table}
        onClearView={clearViewState}
        tableName={tableName}
        sourceTable={baseQueryConfig.sourceTable}
        viewMode={viewMode}
        onViewModeChange={compactMode ? undefined : setViewMode}
        compactMode={compactMode}
        toolbarCollapsible={toolbarCollapsible}
        dashboardComponentId={dashboardComponentId}
        initialToolbarCollapsed={initialToolbarCollapsed}
        toolbarCollapsed={toolbarCollapsed}
        onToolbarCollapseChange={onToolbarCollapseChange}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        filterGroup={filterGroup}
        onFilterGroupChange={setFilterGroup}
        joins={baseQueryConfig.joins}
        columnIdToRef={columnIdToRef}
        filterColumnMap={filterColumnMap}
        queryConfigColumns={baseQueryConfig.columns?.map(col => ({
          id: getColumnKey(col),
          name: col.alias || col.column,
        }))}
        onExportCSV={onExportCSV}
        onExportJSON={onExportJSON}
        fullQueryConfig={queryConfig}
      />

      {viewMode === "card" ? (
        // Card view - mobile-optimized
        <div className="flex-1 min-h-0 overflow-auto relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          <div className={cn(loading && "opacity-30")}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <DataTableCard key={row.id} row={row} />
              ))
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                No results.
              </div>
            )}
          </div>
        </div>
      ) : (
        // Table view - desktop
        <div className={cn(
          "flex-1 min-h-0 relative",
          !dashboardMode && "rounded-md border",
          dashboardMode && "overflow-auto"
        )}>
          {/* Loading Overlay */}
          {loading && (
            <div className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10", !dashboardMode && "rounded-[calc(0.5rem-1px)]")}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10", !dashboardMode && "rounded-[calc(0.5rem-1px)]")}>
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          <Table wrapperClassName="h-full">
            <TableHeader className="relative z-20 bg-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className={cn(loading && "opacity-30")}>
              {table.getRowModel().rows?.length ? (
                hierarchicalData ? (
                  // Hierarchical display mode
                  <>
                    {table.getRowModel().rows.map((row, rowIndex) => {
                      const meta = hierarchicalData.rows[rowIndex]?.meta;
                      // Filter out subtotals with only 1 row - they're redundant
                      const subtotalsAfter = showGroupTotals
                        ? (hierarchicalData.subtotalsAfterRow.get(rowIndex) || [])
                            .filter(st => st.rowCount > 1)
                        : [];
                      const showBorder = meta && normalizedGroupByColumns
                        ? shouldShowRowBorder(meta, normalizedGroupByColumns)
                        : false;

                      return (
                        <React.Fragment key={row.id}>
                          <TableRow
                            className={cn(
                              row.getIsGrouped() && "bg-muted/50 font-medium",
                              row.depth > 0 && "pl-8",
                              // Add top border only for first row of outermost group
                              showBorder && rowIndex > 0 && "border-t-2 border-border"
                            )}
                          >
                            {row.getVisibleCells().map((cell) => {
                              const columnId = cell.column.id;
                              const isGroupColumn = normalizedGroupByColumns?.includes(columnId);
                              const shouldSuppress = isGroupColumn && meta && !meta.visibleColumns.has(columnId);

                              return (
                                <TableCell
                                  key={cell.id}
                                  style={{
                                    paddingLeft: row.depth > 0 ? `${row.depth * 2}rem` : undefined,
                                  }}
                                >
                                  {shouldSuppress ? (
                                    // Suppressed group column - render empty
                                    ""
                                  ) : cell.getIsGrouped() ? (
                                    // Render group cell with expand/collapse button
                                    <button
                                      onClick={row.getToggleExpandedHandler()}
                                      className="flex items-center gap-2 font-medium"
                                    >
                                      {row.getIsExpanded() ? "▼" : "►"}
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}{" "}
                                      ({row.subRows.length})
                                    </button>
                                  ) : cell.getIsAggregated() ? (
                                    // Render aggregated cell
                                    flexRender(
                                      cell.column.columnDef.aggregatedCell ??
                                        cell.column.columnDef.cell,
                                      cell.getContext()
                                    )
                                  ) : cell.getIsPlaceholder() ? null : (
                                    // Render normal cell
                                    flexRender(
                                      cell.column.columnDef.cell,
                                      cell.getContext()
                                    )
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                          {/* Render subtotal rows after this data row */}
                          {subtotalsAfter.map((subtotal, stIndex) => {
                            // Background color based on level (deeper = lighter)
                            // Uses theme-aware muted color with varying opacity
                            const bgClass = subtotal.level === 0
                              ? "bg-muted/70"
                              : subtotal.level === 1
                                ? "bg-muted/50"
                                : "bg-muted/30";

                            return (
                              <TableRow
                                key={`subtotal-${rowIndex}-${stIndex}`}
                                className={cn("font-medium", bgClass)}
                              >
                                {table.getVisibleLeafColumns().map((column) => {
                                  const isGroupColumn = normalizedGroupByColumns?.includes(column.id);
                                  const groupColIndex = normalizedGroupByColumns?.indexOf(column.id) ?? -1;

                                  // For group columns: show value or "Subtotal" label
                                  if (isGroupColumn && groupColIndex >= 0) {
                                    if (groupColIndex < subtotal.level) {
                                      // Higher-level group column - show empty (inherited)
                                      return <TableCell key={column.id} />;
                                    } else if (groupColIndex === subtotal.level) {
                                      // This is the subtotal's level - show "<group value> Subtotal"
                                      return (
                                        <TableCell key={column.id} className="font-bold">
                                          {String(subtotal.groupValue)} Subtotal
                                        </TableCell>
                                      );
                                    } else {
                                      // Lower-level group column - show empty
                                      return <TableCell key={column.id} />;
                                    }
                                  }

                                  // For value columns: show subtotal value if currency
                                  const subtotalValue = subtotal.totals[column.id];
                                  if (subtotalValue !== undefined) {
                                    const sourceCol = columnMapping?.[column.id] || column.id;
                                    const colWithoutTable = sourceCol.includes('.') ? sourceCol.split('.').pop()! : sourceCol;
                                    let config = getColumnConfig(tableName, sourceCol);
                                    if (config.type === "text" && colWithoutTable !== sourceCol) {
                                      config = getColumnConfig(tableName, colWithoutTable);
                                    }
                                    return (
                                      <TableCell key={column.id} className="text-right">
                                        {formatValue(subtotalValue, config)}
                                      </TableCell>
                                    );
                                  }

                                  return <TableCell key={column.id} />;
                                })}
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </>
                ) : (
                  // Standard display mode
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        row.getIsGrouped() && "bg-muted/50 font-medium",
                        row.depth > 0 && "pl-8"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          style={{
                            paddingLeft: row.depth > 0 ? `${row.depth * 2}rem` : undefined,
                          }}
                        >
                          {cell.getIsGrouped() ? (
                            // Render group cell with expand/collapse button
                            <button
                              onClick={row.getToggleExpandedHandler()}
                              className="flex items-center gap-2 font-medium"
                            >
                              {row.getIsExpanded() ? "▼" : "►"}
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}{" "}
                              ({row.subRows.length})
                            </button>
                          ) : cell.getIsAggregated() ? (
                            // Render aggregated cell
                            flexRender(
                              cell.column.columnDef.aggregatedCell ??
                                cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          ) : cell.getIsPlaceholder() ? null : (
                            // Render normal cell
                            flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {/* Footer rows: Page Totals, Grand Totals, or legacy footerCells */}
            {(pageTotalsCells.length > 0 || grandTotalsCells.length > 0 || (footerCells && footerCells.length > 0)) && (
              <TableFooter className="sticky bottom-0">
                {/* Page Totals Row - lighter background */}
                {pageTotalsCells.length > 0 && (
                  <TableRow className="bg-muted/50">
                    {table.getVisibleLeafColumns().map((column, index) => {
                      const cell = pageTotalsCells.find(
                        (fc) => fc.columnId === column.id
                      );
                      const hasValue = cell?.value !== undefined;
                      return (
                        <TableCell
                          key={column.id}
                          className={cn("whitespace-nowrap", hasValue && "text-right")}
                        >
                          {index === 0
                            ? "PAGE TOTAL"
                            : cell?.value ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )}
                {/* Grand Totals Row - more prominent background */}
                {grandTotalsCells.length > 0 && (
                  <TableRow className="bg-muted/70">
                    {table.getVisibleLeafColumns().map((column, index) => {
                      const cell = grandTotalsCells.find(
                        (fc) => fc.columnId === column.id
                      );
                      const hasValue = cell?.value !== undefined;
                      return (
                        <TableCell
                          key={column.id}
                          className={cn("whitespace-nowrap", hasValue && "text-right")}
                        >
                          {index === 0
                            ? "TOTAL"
                            : cell?.value ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )}
                {/* Legacy footerCells prop (backwards compatibility) */}
                {footerCells && footerCells.length > 0 && (
                  <TableRow className="bg-muted/50 font-medium">
                    {table.getVisibleLeafColumns().map((column, index) => {
                      const footerCell = footerCells.find(
                        (fc) => fc.columnId === column.id
                      );
                      const hasFooterValue = footerCell?.value !== undefined;
                      return (
                        <TableCell
                          key={column.id}
                          className={
                            index === 0
                              ? "font-bold"
                              : hasFooterValue
                                ? "text-right"
                                : ""
                          }
                        >
                          {index === 0
                            ? footerLabel || "GRAND TOTAL"
                            : footerCell?.value ?? ""}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                )}
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      <DataTablePagination table={table} compactMode={compactMode} />
    </div>
  );
}
