"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, RefreshCw, AlertCircle, Copy, ChevronDown, ChevronUp } from "lucide-react";

// Import transform functions directly to avoid bundling chart components
import { transformToPieData } from "@/components/charts/pie-chart";
import { transformToBarData } from "@/components/charts/bar-chart";
import { transformToLineData } from "@/components/charts/line-chart";

// Lazy load chart components for better bundle splitting
const DashboardPieChart = lazy(() => import("@/components/charts/pie-chart").then(m => ({ default: m.DashboardPieChart })));
const DashboardBarChart = lazy(() => import("@/components/charts/bar-chart").then(m => ({ default: m.DashboardBarChart })));
const DashboardLineChart = lazy(() => import("@/components/charts/line-chart").then(m => ({ default: m.DashboardLineChart })));
import { DataTable } from "@/components/data-table/data-table";
import { loadColumnConfig } from "@/lib/column-renderer";
import type {
  DashboardComponent as DashboardComponentType,
  QueryConfig,
  ChartConfig,
} from "@/lib/db/types";

interface DashboardComponentProps {
  component: DashboardComponentType;
  editable?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function DashboardComponent({
  component,
  editable = false,
  onEdit,
  onDuplicate,
  onDelete,
}: DashboardComponentProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setConfigLoaded] = useState(false);

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

  useEffect(() => {
    // Text and table components don't need data fetching (DataTable handles it internally)
    if (component.type === "text" || component.type === "table") {
      setLoading(false);
      return;
    }
    fetchData();
  }, [component.query_config, component.type]);

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

      setData(result.data);
    } catch (err) {
      setError("Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Helper to get the actual key name used in query results
  const getColumnKey = (col: { column: string; alias?: string; aggregateFunction?: string }) => {
    if (col.alias) return col.alias;
    if (col.aggregateFunction) {
      return `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
    }
    return col.column;
  };

  // Memoize column mapping computation
  const columnMapping: Record<string, string> = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const col of queryConfig.columns) {
      const key = getColumnKey(col);
      mapping[key] = col.column;
    }
    return mapping;
  }, [queryConfig.columns]);

  // Memoize column identifiers
  const labelColumn = useMemo(
    () => chartConfig.labelColumn || (queryConfig.columns[0] && getColumnKey(queryConfig.columns[0])),
    [chartConfig.labelColumn, queryConfig.columns]
  );

  const valueColumn = useMemo(
    () => chartConfig.valueColumn || (queryConfig.columns[1] && getColumnKey(queryConfig.columns[1])),
    [chartConfig.valueColumn, queryConfig.columns]
  );

  const valueColumns = useMemo(
    () => queryConfig.columns
      .filter((c) => getColumnKey(c) !== labelColumn)
      .map((c) => getColumnKey(c)),
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
            queryConfig={queryConfig}
            tableName={tableName}
            columnMapping={columnMapping}
            dashboardMode={true}
            dashboardComponentId={String(component.id)}
            defaultFilters={queryConfig.filters}
            compactMode={true}
            toolbarCollapsed={isToolbarCollapsed}
            onToolbarCollapseChange={setIsToolbarCollapsed}
          />
        );

      case "pie":
        if (!labelColumn || !valueColumn) {
          return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Configure label and value columns
            </div>
          );
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

      case "bar_stacked":
      case "bar_grouped": {
        return (
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading chart...</div>}>
            <DashboardBarChart
              data={barChartData.data}
              bars={barChartData.bars}
              stacked={component.type === "bar_stacked"}
              showLegend={chartConfig.showLegend ?? true}
              showTooltip={chartConfig.showTooltip ?? true}
              tableName={tableName}
              columnMapping={columnMapping}
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
      <div className="flex-1 p-3 min-h-0 overflow-auto">{renderChart()}</div>
    </div>
  );
}
