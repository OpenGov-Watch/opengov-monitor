"use client";

import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, RefreshCw, AlertCircle } from "lucide-react";
import {
  DashboardPieChart,
  DashboardBarChart,
  DashboardLineChart,
  DashboardDataTable,
  transformToPieData,
  transformToBarData,
  transformToLineData,
} from "@/components/charts";
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
  onDelete?: () => void;
}

export function DashboardComponent({
  component,
  editable = false,
  onEdit,
  onDelete,
}: DashboardComponentProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setConfigLoaded] = useState(false);

  const queryConfig: QueryConfig = JSON.parse(component.query_config);
  const chartConfig: ChartConfig = component.chart_config
    ? JSON.parse(component.chart_config)
    : {};

  // Table name for column config lookup
  const tableName = queryConfig.sourceTable || "";

  useEffect(() => {
    // Load column config (display names and render settings)
    loadColumnConfig().then(() => setConfigLoaded(true));
  }, []);

  useEffect(() => {
    // Text components don't need data fetching
    if (component.type === "text") {
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

    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data available
        </div>
      );
    }

    // Helper to get the actual key name used in query results
    const getColumnKey = (col: { column: string; alias?: string; aggregateFunction?: string }) => {
      if (col.alias) return col.alias;
      if (col.aggregateFunction) {
        return `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
      }
      return col.column;
    };

    const labelColumn =
      chartConfig.labelColumn || (queryConfig.columns[0] && getColumnKey(queryConfig.columns[0]));
    const valueColumn =
      chartConfig.valueColumn || (queryConfig.columns[1] && getColumnKey(queryConfig.columns[1]));
    const valueColumns = queryConfig.columns
      .filter((c) => getColumnKey(c) !== labelColumn)
      .map((c) => getColumnKey(c));

    switch (component.type) {
      case "table":
        return <DashboardDataTable data={data} tableName={tableName} />;

      case "pie":
        if (!labelColumn || !valueColumn) {
          return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Configure label and value columns
            </div>
          );
        }
        return (
          <DashboardPieChart
            data={transformToPieData(data, labelColumn, valueColumn)}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={chartConfig.showTooltip ?? true}
            colors={chartConfig.colors}
            tableName={tableName}
            valueColumn={valueColumn}
          />
        );

      case "bar_stacked":
      case "bar_grouped": {
        const { data: barData, bars } = transformToBarData(
          data,
          labelColumn,
          valueColumns,
          tableName
        );
        return (
          <DashboardBarChart
            data={barData}
            bars={bars}
            stacked={component.type === "bar_stacked"}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={chartConfig.showTooltip ?? true}
            tableName={tableName}
          />
        );
      }

      case "line": {
        const { data: lineData, lines } = transformToLineData(
          data,
          labelColumn,
          valueColumns,
          tableName
        );
        return (
          <DashboardLineChart
            data={lineData}
            lines={lines}
            showLegend={chartConfig.showLegend ?? true}
            showTooltip={chartConfig.showTooltip ?? true}
            tableName={tableName}
          />
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
          {component.type !== "text" && (
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
      <div className="flex-1 p-3 min-h-0">{renderChart()}</div>
    </div>
  );
}
