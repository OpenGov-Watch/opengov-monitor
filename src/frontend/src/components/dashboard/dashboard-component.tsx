"use client";

import React, { useState, useEffect, useMemo, lazy, Suspense, memo, useRef } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import ArrowRightLeft from "lucide-react/dist/esm/icons/arrow-right-left";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Copy from "lucide-react/dist/esm/icons/copy";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Download from "lucide-react/dist/esm/icons/download";
import { exportChartAsPNG, copyChartToClipboard } from "@/lib/chart-export";
import FileDown from "lucide-react/dist/esm/icons/file-down";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import transform functions directly to avoid bundling chart components
import { transformToPieData } from "@/components/charts/pie-chart";
import { transformToBarData } from "@/components/charts/bar-chart";
import { transformToLineData } from "@/components/charts/line-chart";

// Lazy load chart components for better bundle splitting
const DashboardPieChart = lazy(() => import("@/components/charts/pie-chart").then(m => ({ default: m.DashboardPieChart })));
const DashboardBarChart = lazy(() => import("@/components/charts/bar-chart").then(m => ({ default: m.DashboardBarChart })));
const DashboardLineChart = lazy(() => import("@/components/charts/line-chart").then(m => ({ default: m.DashboardLineChart })));

// Direct imports for export rendering (non-lazy for synchronous use)
import { DashboardPieChart as PieChartExport } from "@/components/charts/pie-chart";
import { DashboardBarChart as BarChartExport } from "@/components/charts/bar-chart";
import { DashboardLineChart as LineChartExport } from "@/components/charts/line-chart";
import { DataTable } from "@/components/data-table/data-table";
import { loadColumnConfig } from "@/lib/column-renderer";
import { getColumnKey, normalizeDataKeys, validateQueryConfig, hasInvalidQueryConfig } from "@/lib/query-config-utils";
import type {
  DashboardComponent as DashboardComponentType,
  QueryConfig,
  ChartConfig,
} from "@/lib/db/types";

interface ChartValidationResult {
  valid: boolean;
  error?: string;
  hint?: string;
}

function validatePieChartData(
  data: Record<string, unknown>[],
  labelColumn: string | undefined,
  valueColumn: string | undefined,
  queryColumns: QueryConfig["columns"]
): ChartValidationResult {
  // Check: Need at least 2 columns selected
  if (!queryColumns || queryColumns.length < 2) {
    return {
      valid: false,
      error: "Pie chart requires at least 2 columns",
      hint: "Select a category column (for labels) and a numeric column (for values). Use GROUP BY to aggregate values by category.",
    };
  }

  // Check: Label and value columns must be configured
  if (!labelColumn || !valueColumn) {
    return {
      valid: false,
      error: "Missing column configuration",
      hint: "Configure which column provides slice labels and which provides values.",
    };
  }

  // Check: Label and value columns must be different
  if (labelColumn === valueColumn) {
    return {
      valid: false,
      error: "Label and value columns cannot be the same",
      hint: "Select different columns: one for category labels and one for numeric values.",
    };
  }

  // Check: Too many unique values (pie chart becomes unreadable)
  const uniqueLabels = new Set(data.map((row) => row[labelColumn]));
  if (uniqueLabels.size > 50) {
    return {
      valid: false,
      error: `Too many categories (${uniqueLabels.size})`,
      hint: "Pie charts work best with fewer than 20 categories. Add a GROUP BY clause or filter your data.",
    };
  }

  return { valid: true };
}

function validateBarChartData(
  data: Record<string, unknown>[],
  labelColumn: string | undefined,
  valueColumns: string[],
  queryColumns: QueryConfig["columns"]
): ChartValidationResult {
  // Check: Need at least 2 columns
  if (!queryColumns || queryColumns.length < 2) {
    return {
      valid: false,
      error: "Bar chart requires at least 2 columns",
      hint: "Select one column for X-axis labels and at least one numeric column for bar values.",
    };
  }

  // Check: Need a label column
  if (!labelColumn) {
    return {
      valid: false,
      error: "Missing X-axis column",
      hint: "The first column will be used as X-axis labels. Ensure you have at least one column selected.",
    };
  }

  // Check: Need at least one value column
  if (!valueColumns || valueColumns.length === 0) {
    return {
      valid: false,
      error: "No value columns for bars",
      hint: "Select at least one numeric column in addition to the label column to create bars.",
    };
  }

  // Check: Too many data points (bar chart becomes unreadable)
  if (data.length > 100) {
    return {
      valid: false,
      error: `Too many data points (${data.length})`,
      hint: "Bar charts work best with fewer than 50 items. Add filters, GROUP BY, or increase aggregation.",
    };
  }

  return { valid: true };
}

function ChartValidationError({ error, hint }: { error: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4 gap-3">
      <AlertCircle className="h-8 w-8 text-amber-500" />
      <div>
        <p className="text-sm font-medium text-foreground">{error}</p>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{hint}</p>
        )}
      </div>
    </div>
  );
}

interface DashboardComponentProps {
  component: DashboardComponentType;
  editable?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}

export const DashboardComponent = memo(
  function DashboardComponent({
    component,
    editable = false,
    onEdit,
    onDuplicate,
    onMove,
    onDelete,
  }: DashboardComponentProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setConfigLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chartContentRef = useRef<HTMLDivElement>(null);

  // Table export handlers (set by DataTable component)
  const tableExportCSVRef = useRef<(() => void) | null>(null);
  const tableExportJSONRef = useRef<(() => void) | null>(null);

  // Memoize parsed configs to prevent refetch loops
  // Use component.id + string value to ensure stability across parent re-renders
  const queryConfig: QueryConfig = useMemo(
    () => JSON.parse(component.query_config),
    [component.id, component.query_config]
  );
  const chartConfig: ChartConfig = useMemo(
    () => (component.chart_config ? JSON.parse(component.chart_config) : {}),
    [component.id, component.chart_config]
  );

  // Table name for column config lookup
  const tableName = queryConfig.sourceTable || "";

  // Toolbar collapse state for table components
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(() => {
    if (component.type !== "table") return true;
    const key = `opengov-toolbar-collapsed-${tableName}-${component.id}`;
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored === "true" : true;
    } catch {
      return true; // Fallback for tests or when localStorage is unavailable
    }
  });

  const toggleToolbarCollapse = () => {
    const newState = !isToolbarCollapsed;
    setIsToolbarCollapsed(newState);
    const key = `opengov-toolbar-collapsed-${tableName}-${component.id}`;
    try {
      localStorage.setItem(key, String(newState));
    } catch {
      // Ignore localStorage errors in tests
    }
  };

  useEffect(() => {
    // Load column config (display names and render settings)
    loadColumnConfig().then(() => setConfigLoaded(true));
  }, []);

  // Stringify queryConfig for stable useEffect dependency
  const queryConfigString = useMemo(
    () => JSON.stringify(queryConfig),
    [queryConfig]
  );

  useEffect(() => {
    // Text and table components don't need data fetching (DataTable handles it internally)
    if (component.type === "text" || component.type === "table") {
      setLoading(false);
      return;
    }
    fetchData();
  }, [queryConfigString, component.type, component.id]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: component.query_config,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Query failed");
        return;
      }

      // Normalize data keys to match frontend expectations
      // SQLite returns "name" for "Categories.name" without alias, but frontend expects "Categories.name"
      const normalizedData = normalizeDataKeys(result.data, queryConfig.columns);
      setData(normalizedData);
    } catch (err) {
      setError("Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Memoize column mapping computation
  const columnMapping: Record<string, string> = useMemo(() => {
    const mapping: Record<string, string> = {};
    // Regular columns
    if (queryConfig.columns && Array.isArray(queryConfig.columns)) {
      for (const col of queryConfig.columns) {
        const key = getColumnKey(col);
        mapping[key] = col.column;
      }
    }
    // Expression columns with sourceColumn (for proper formatting lookup)
    if (queryConfig.expressionColumns && Array.isArray(queryConfig.expressionColumns)) {
      for (const expr of queryConfig.expressionColumns) {
        if (expr.sourceColumn) {
          mapping[expr.alias] = expr.sourceColumn;
        }
      }
    }
    return mapping;
  }, [queryConfig.columns, queryConfig.expressionColumns]);

  // Memoize column overrides for displayName support
  // This allows columns to have custom header text from displayName field
  // Also supports legacy alias with spaces (auto-sanitized by backend)
  const columnOverrides = useMemo(() => {
    const overrides: Record<string, { header: string }> = {};
    // Regular columns with displayName or alias containing spaces
    if (queryConfig.columns && Array.isArray(queryConfig.columns)) {
      for (const col of queryConfig.columns) {
        const key = getColumnKey(col);
        // Priority: displayName > alias (if it has spaces)
        if (col.displayName) {
          overrides[key] = { header: col.displayName };
        } else if (col.alias && /[^a-zA-Z0-9_]/.test(col.alias)) {
          // Alias has spaces or special chars - use it as display name
          // Backend will auto-sanitize for SQL, but we show original in UI
          overrides[key] = { header: col.alias };
        }
      }
    }
    // Expression columns with displayName or alias containing spaces
    if (queryConfig.expressionColumns && Array.isArray(queryConfig.expressionColumns)) {
      for (const expr of queryConfig.expressionColumns) {
        // For expressions, the key used by the table will be the sanitized alias
        const sanitizedAlias = expr.alias.replace(/[^a-zA-Z0-9_]/g, "_");
        if (expr.displayName) {
          overrides[sanitizedAlias] = { header: expr.displayName };
        } else if (/[^a-zA-Z0-9_]/.test(expr.alias)) {
          // Alias has spaces or special chars - use it as display name
          overrides[sanitizedAlias] = { header: expr.alias };
        }
      }
    }
    return overrides;
  }, [queryConfig.columns, queryConfig.expressionColumns]);

  // Compute hidden expression aliases
  const hiddenExpressionAliases = useMemo(() => {
    const hidden = new Set<string>();
    if (queryConfig.expressionColumns && Array.isArray(queryConfig.expressionColumns)) {
      for (const expr of queryConfig.expressionColumns) {
        if (expr.hidden) {
          const sanitizedAlias = expr.alias.replace(/[^a-zA-Z0-9_]/g, "_");
          hidden.add(sanitizedAlias);
        }
      }
    }
    return hidden;
  }, [queryConfig.expressionColumns]);

  // Memoize column identifiers
  const labelColumn = useMemo(
    () => chartConfig.labelColumn || (queryConfig.columns?.[0] && getColumnKey(queryConfig.columns[0])),
    [chartConfig.labelColumn, queryConfig.columns]
  );

  const valueColumn = useMemo(
    () => chartConfig.valueColumn || (queryConfig.columns?.[1] && getColumnKey(queryConfig.columns[1])),
    [chartConfig.valueColumn, queryConfig.columns]
  );

  const valueColumns = useMemo(
    () => (queryConfig.columns && Array.isArray(queryConfig.columns))
      ? queryConfig.columns
          .filter((c) => getColumnKey(c) !== labelColumn)
          .map((c) => getColumnKey(c))
      : [],
    [queryConfig.columns, labelColumn]
  );

  // Memoize chart data transformations
  // Only transform when we have valid data and required columns
  const pieChartData = useMemo(
    () => component.type === "pie" && labelColumn && valueColumn && Array.isArray(data) && data.length > 0
      ? transformToPieData(data, labelColumn, valueColumn)
      : [],
    [component.type, data, labelColumn, valueColumn]
  );

  const barChartData = useMemo(
    () => (component.type === "bar_stacked" || component.type === "bar_grouped") && Array.isArray(data) && data.length > 0
      ? transformToBarData(data, labelColumn, valueColumns, tableName)
      : { data: [], bars: [] },
    [component.type, data, labelColumn, valueColumns, tableName]
  );

  const lineChartData = useMemo(
    () => component.type === "line" && Array.isArray(data) && data.length > 0
      ? transformToLineData(data, labelColumn, valueColumns, tableName)
      : { data: [], lines: [] },
    [component.type, data, labelColumn, valueColumns, tableName]
  );

  // Generate a stable key that changes when filters change
  // This forces DataTable to remount and fetch fresh data with new filters
  const tableKey = useMemo(() => {
    if (component.type !== "table") return undefined;
    // Create a deterministic string from filters
    const filtersKey = JSON.stringify(queryConfig.filters || []);
    return `table-${component.id}-${filtersKey}`;
  }, [component.id, component.type, queryConfig.filters]);

  // Check if component is a chart type (for export buttons)
  const isChartType = ["pie", "bar_stacked", "bar_grouped", "line"].includes(component.type);

  // Create a render function for exporting charts with legend on right
  function getExportChartRenderer(): (() => React.ReactNode) | null {
    switch (component.type) {
      case "pie":
        if (!labelColumn || !valueColumn) return null;
        return () => (
          <PieChartExport
            data={pieChartData}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={false}
            colors={chartConfig.colors}
            tableName={tableName}
            valueColumn={valueColumn}
            columnMapping={columnMapping}
            legendPosition="right"
            isAnimationActive={false}
            exportMode={true}
          />
        );

      case "bar_stacked":
      case "bar_grouped":
        return () => (
          <BarChartExport
            data={barChartData.data}
            bars={barChartData.bars}
            stacked={component.type === "bar_stacked"}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={false}
            colors={chartConfig.colors}
            tableName={tableName}
            columnMapping={columnMapping}
            colorByRow={barChartData.colorByRow}
            legendPosition="right"
            isAnimationActive={false}
            valueColumnForConfig={barChartData.valueColumn}
            exportMode={true}
          />
        );

      case "line":
        return () => (
          <LineChartExport
            data={lineChartData.data}
            lines={lineChartData.lines}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={false}
            tableName={tableName}
            columnMapping={columnMapping}
            legendPosition="right"
            isAnimationActive={false}
            exportMode={true}
          />
        );

      default:
        return null;
    }
  }

  async function handleDownloadChart() {
    const renderChart = getExportChartRenderer();
    if (!renderChart) return;
    setIsExporting(true);
    try {
      const filename = `${component.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`;
      await exportChartAsPNG(renderChart, component.name, filename);
    } catch (error) {
      console.error("Failed to download chart:", error);
      alert("Failed to download chart. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleCopyChart() {
    const renderChart = getExportChartRenderer();
    if (!renderChart) return;
    setIsExporting(true);
    try {
      await copyChartToClipboard(renderChart, component.name);
    } catch (error) {
      console.error("Failed to copy chart:", error);
      alert("Failed to copy chart to clipboard. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function handleTableExport(format: "csv" | "json") {
    if (format === "csv" && tableExportCSVRef.current) {
      tableExportCSVRef.current();
    } else if (format === "json" && tableExportJSONRef.current) {
      tableExportJSONRef.current();
    }
  }

  function renderChart() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-destructive gap-2">
          <AlertCircle className="h-8 w-8" />
          <span className="text-sm">{error}</span>
        </div>
      );
    }

    // Text components don't need data
    if (component.type === "text") {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert h-full overflow-auto">
          {chartConfig.content ? (
            <Markdown>{chartConfig.content}</Markdown>
          ) : (
            <span className="text-muted-foreground">No content</span>
          )}
        </div>
      );
    }

    // Validate query config - show error if groupBy/orderBy reference missing columns
    const queryValidation = validateQueryConfig(queryConfig);
    if (hasInvalidQueryConfig(queryValidation)) {
      const parts: string[] = [];
      if (queryValidation.invalidGroupBy.length > 0) {
        parts.push(`GROUP BY: ${queryValidation.invalidGroupBy.join(", ")}`);
      }
      if (queryValidation.invalidOrderBy.length > 0) {
        parts.push(`ORDER BY: ${queryValidation.invalidOrderBy.map(o => o.column).join(", ")}`);
      }
      return (
        <ChartValidationError
          error="Invalid query configuration"
          hint={`References columns not in query: ${parts.join("; ")}. Edit to fix.`}
        />
      );
    }

    // Table components fetch their own data, so skip the empty data check
    if (component.type !== "table" && (!data || !Array.isArray(data) || data.length === 0)) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data available
        </div>
      );
    }

    switch (component.type) {
      case "table":
        return (
          <DataTable
            key={tableKey}
            queryConfig={queryConfig}
            tableName={tableName}
            columnMapping={columnMapping}
            columnOverrides={columnOverrides}
            hiddenColumns={hiddenExpressionAliases}
            dashboardMode={true}
            dashboardComponentId={String(component.id)}
            defaultFilters={queryConfig.filters}
            compactMode={true}
            toolbarCollapsed={isToolbarCollapsed}
            onToolbarCollapseChange={setIsToolbarCollapsed}
            onExportCSV={(handler) => { tableExportCSVRef.current = handler; }}
            onExportJSON={(handler) => { tableExportJSONRef.current = handler; }}
            showPageTotals={chartConfig.showPageTotals}
            showGrandTotals={chartConfig.showGrandTotals}
            hierarchicalDisplay={chartConfig.hierarchicalDisplay}
            showGroupTotals={chartConfig.showGroupTotals}
            groupByColumns={queryConfig.groupBy}
            disableSorting={chartConfig.disableSorting}
          />
        );

      case "pie": {
        const pieValidation = validatePieChartData(data, labelColumn, valueColumn, queryConfig.columns);
        if (!pieValidation.valid) {
          return <ChartValidationError error={pieValidation.error!} hint={pieValidation.hint} />;
        }
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>}>
            <DashboardPieChart
              data={pieChartData}
              showLegend={chartConfig.showLegend ?? true}
              showTooltip={chartConfig.showTooltip ?? true}
              colors={chartConfig.colors}
              tableName={tableName}
              valueColumn={valueColumn}
              columnMapping={columnMapping}
            />
          </Suspense>
        );
      }

      case "bar_stacked":
      case "bar_grouped": {
        const barValidation = validateBarChartData(data, labelColumn, valueColumns, queryConfig.columns);
        if (!barValidation.valid) {
          return <ChartValidationError error={barValidation.error!} hint={barValidation.hint} />;
        }
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>}>
            <DashboardBarChart
              data={barChartData.data}
              bars={barChartData.bars}
              stacked={component.type === "bar_stacked"}
              showLegend={chartConfig.showLegend ?? true}
              showTooltip={chartConfig.showTooltip ?? true}
              colors={chartConfig.colors}
              tableName={tableName}
              columnMapping={columnMapping}
              colorByRow={barChartData.colorByRow}
              valueColumnForConfig={barChartData.valueColumn}
            />
          </Suspense>
        );
      }

      case "line": {
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>}>
            <DashboardLineChart
              data={lineChartData.data}
              lines={lineChartData.lines}
              showLegend={chartConfig.showLegend ?? true}
              showTooltip={chartConfig.showTooltip ?? true}
              tableName={tableName}
              columnMapping={columnMapping}
            />
          </Suspense>
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Unknown component type
          </div>
        );
    }
  }

  return (
    <div className="h-full flex flex-col bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <h3 className="font-medium text-sm truncate">{component.name}</h3>
        <div className="flex items-center gap-1">
          {component.type === "table" && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Download table data"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleTableExport("csv")}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTableExport("json")}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Download as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={toggleToolbarCollapse}
                title={isToolbarCollapsed ? "Expand toolbar" : "Collapse toolbar"}
              >
                {isToolbarCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </Button>
            </>
          )}
          {component.type !== "text" && component.type !== "table" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={fetchData}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {isChartType && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopyChart}
                disabled={isExporting || loading}
                title="Copy chart to clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleDownloadChart}
                disabled={isExporting || loading}
                title="Download chart as PNG"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {editable && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDuplicate}
                title="Duplicate"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onMove}
                title="Move to another dashboard"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={chartContentRef} className={`flex-1 min-h-0 ${component.type === "table" ? "p-0 flex flex-col" : "p-3 overflow-auto"}`}>{renderChart()}</div>
    </div>
  );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if component data or config actually changed
    return (
      prevProps.component.id === nextProps.component.id &&
      prevProps.component.query_config === nextProps.component.query_config &&
      prevProps.component.chart_config === nextProps.component.chart_config &&
      prevProps.component.name === nextProps.component.name &&
      prevProps.component.type === nextProps.component.type &&
      prevProps.editable === nextProps.editable
    );
  }
);
