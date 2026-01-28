"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  ExpandedState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getGroupedRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { DataTablePagination } from "./pagination";
import { CardView, TableView } from "./components";
import { usePageTotals, useHierarchicalData, useDataTableQuery, useGrandTotalsQuery } from "./hooks";
import { DataTableToolbar } from "./toolbar";
import { ViewSelector } from "./view-selector";
import { useViewState, SavedView } from "@/hooks/use-view-state";
import { QueryConfig, DataTableEditConfig } from "@/lib/db/types";
import { generateColumns } from "@/lib/auto-columns";
import { getColumnKey, sortingStateToOrderBy, convertFiltersToQueryConfig } from "@/lib/query-config-utils";
import { cn } from "@/lib/utils";
import { loadColumnConfig, getColumnConfig, formatValue } from "@/lib/column-renderer";

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

  // DATA FETCHING
  const { data, setData, loading, error, totalCount, serverFacets } = useDataTableQuery<TData>({
    queryConfig,
    baseQueryConfig,
    facetedFilters,
    columnOverrides,
    columnIdToRef,
  });

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
  const grandTotals = useGrandTotalsQuery({
    showGrandTotals,
    configLoaded,
    data,
    tableName,
    columnMapping,
    sourceTable: baseQueryConfig.sourceTable,
    joins: baseQueryConfig.joins,
    filters: queryConfig.filters,
  });

  // PAGE TOTALS CALCULATION
  const pageTotalsCells = usePageTotals({
    showPageTotals,
    data,
    tableName,
    columnMapping,
    configLoaded,
  });

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
  const { normalizedGroupByColumns, hierarchicalData } = useHierarchicalData({
    hierarchicalDisplay,
    groupByColumns,
    data,
    tableName,
    columnMapping,
    configLoaded,
  });

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
        <CardView
          rows={table.getRowModel().rows}
          loading={loading}
          error={error}
        />
      ) : (
        <TableView
          table={table}
          columns={columns}
          loading={loading}
          error={error}
          dashboardMode={dashboardMode}
          hierarchicalData={hierarchicalData}
          normalizedGroupByColumns={normalizedGroupByColumns}
          showGroupTotals={showGroupTotals}
          pageTotalsCells={pageTotalsCells}
          grandTotalsCells={grandTotalsCells}
          footerCells={footerCells}
          footerLabel={footerLabel}
          tableName={tableName}
          columnMapping={columnMapping}
        />
      )}

      <DataTablePagination table={table} compactMode={compactMode} />
    </div>
  );
}
