"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
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

import { Loader2, AlertCircle } from "lucide-react";

import { DataTablePagination } from "./pagination";
import { DataTableToolbar } from "./toolbar";
import { DataTableCard } from "./data-table-card";
import { ViewSelector } from "./view-selector";
import { useViewState, SavedView } from "@/hooks/use-view-state";
import { QueryConfig, QueryExecuteResponse, DataTableEditConfig, FacetQueryConfig, FacetQueryResponse } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";
import { sortingStateToOrderBy, convertFiltersToQueryConfig } from "@/lib/query-config-utils";
import { cn } from "@/lib/utils";
import { loadColumnConfig } from "@/lib/column-renderer";

export interface FooterCell {
  columnId: string;
  value: React.ReactNode;
}

interface DataTableProps<TData> {
  queryConfig: Omit<QueryConfig, "orderBy" | "filters">;
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
}: DataTableProps<TData>) {
  // Apply defaults based on dashboardMode
  const hideViewSelector = hideViewSelectorProp ?? dashboardMode;
  const toolbarCollapsible = toolbarCollapsibleProp ?? dashboardMode;
  const initialToolbarCollapsed = initialToolbarCollapsedProp ?? dashboardMode;
  // VIEW STATE MANAGEMENT (moved before queryConfig to access sorting/filtering)
  const viewState = useViewState(tableName, { defaultSorting, defaultViews });

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

  // Pass through the original setters without any wrapping
  const setSorting = setViewSorting;
  const setColumnFilters = setViewColumnFilters;
  const clearViewState = clearView;

  // BUILD COMPLETE QUERY CONFIG
  // Merge base config with dynamic sorting/filtering/pagination state
  const queryConfig = useMemo<QueryConfig>(() => {
    const viewStateFilters = convertFiltersToQueryConfig(columnFilters, filterGroup);

    // Merge default filters with view state filters
    // If view state has filters, use them; otherwise fall back to default filters
    const mergedFilters = (Array.isArray(viewStateFilters) && viewStateFilters.length > 0) ||
                          (viewStateFilters && 'conditions' in viewStateFilters && viewStateFilters.conditions.length > 0)
      ? viewStateFilters
      : (defaultFilters || []);

    return {
      ...baseQueryConfig,
      orderBy: sortingStateToOrderBy(sorting),
      filters: mergedFilters,
      groupBy: groupBy ? [groupBy] : baseQueryConfig.groupBy,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
    };
  }, [baseQueryConfig, sorting, columnFilters, filterGroup, groupBy, pagination, defaultFilters]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // Create data fetch promise
        const dataPromise = fetch("/api/query/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(queryConfig),
        });

        // Create facet fetch promise if facetedFilters are defined
        let facetPromise: Promise<Response> | null = null;
        if (facetedFilters && facetedFilters.length > 0) {
          const facetConfig: FacetQueryConfig = {
            sourceTable: baseQueryConfig.sourceTable,
            columns: facetedFilters,
            joins: baseQueryConfig.joins,
            filters: convertFiltersToQueryConfig(columnFilters, filterGroup),
          };
          facetPromise = fetch("/api/query/facets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(facetConfig),
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
          // Convert facet arrays to Map format expected by TanStack Table
          const facetMaps: Record<string, Map<any, number>> = {};
          for (const [column, values] of Object.entries(facetResult.facets)) {
            facetMaps[column] = new Map(
              values.map(v => [v.value, v.count])
            );
          }
          setServerFacets(facetMaps);
        } else if (facetResponse && !facetResponse.ok) {
          console.warn("Facet fetch failed, using client-side faceting");
          setServerFacets({});
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [queryConfig, facetedFilters, columnFilters, baseQueryConfig]);

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

  // COLUMN GENERATION
  const columns = useMemo(() => {
    if (data.length === 0 || !configLoaded) return [];

    return generateColumns({
      data,
      tableName,
      editConfig: editConfigWithRefresh,
      isAuthenticated,
      facetedFilters,
      columnOverrides,
      columnMapping,
    });
  }, [
    data,
    tableName,
    editConfigWithRefresh,
    isAuthenticated,
    facetedFilters,
    columnOverrides,
    columnMapping,
    configLoaded,
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
    data,
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
    <div className="flex flex-col flex-1 min-h-0 gap-4">
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
        <div className="flex-1 min-h-0 rounded-md border relative">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[calc(0.5rem-1px)]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {error && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-[calc(0.5rem-1px)]">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          <Table wrapperClassName="h-full">
            <TableHeader className="relative z-20 bg-background">
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
            {footerCells && footerCells.length > 0 && (
              <TableFooter>
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
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      <DataTablePagination table={table} compactMode={compactMode} />
    </div>
  );
}
