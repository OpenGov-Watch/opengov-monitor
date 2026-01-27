"use client";

import { memo } from "react";
import {
  BarChart as RechartsBarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getColumnConfig,
  getColumnDisplayName,
  formatValue,
  formatAbbreviated,
} from "@/lib/column-renderer";
import {
  DEFAULT_CHART_COLORS,
  buildCategoryColorMap,
} from "@/lib/chart-colors";
import { ChartLegend } from "./shared/chart-legend";

interface BarChartData {
  name: string;
  [key: string]: string | number;
}

interface DashboardBarChartProps {
  data: BarChartData[];
  bars: {
    dataKey: string;
    name?: string;
    color?: string;
  }[];
  stacked?: boolean;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  tableName?: string;
  columnMapping?: Record<string, string>;
  colorByRow?: boolean; // When true, color each bar by its row index instead of bar series index
  legendPosition?: "bottom" | "right";
  isAnimationActive?: boolean; // Set to false for export to disable animations
  valueColumnForConfig?: string; // Original value column name for Y-axis config lookup (used when data is pivoted)
  exportMode?: boolean; // When true, renders legend 50% larger for download/copy
}

// Memoized custom tooltip component with formatted values
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  label,
  tableName,
  columnMapping,
  valueColumnForConfig,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string; color: string }>;
  label?: string;
  tableName: string;
  columnMapping?: Record<string, string>;
  valueColumnForConfig?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm mb-2">{label}</p>
      {payload.map((entry, index) => {
        // For pivoted data, dataKey is a category name (e.g., "Outreach") not in columnMapping
        // Use valueColumnForConfig as fallback to get correct formatting
        const mappedColumn = columnMapping?.[entry.dataKey];
        const sourceColumn = mappedColumn ?? (valueColumnForConfig ? (columnMapping?.[valueColumnForConfig] ?? valueColumnForConfig) : entry.dataKey);
        const config = getColumnConfig(tableName, sourceColumn);
        const formatted = formatValue(entry.value, config);
        return (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{formatted}</span>
          </div>
        );
      })}
    </div>
  );
});

export const DashboardBarChart = memo(
  function DashboardBarChart({
    data,
    bars,
    stacked = false,
    colors = DEFAULT_CHART_COLORS,
    showLegend = true,
    showTooltip = true,
    showGrid = true,
    tableName = "",
    columnMapping,
    colorByRow = false,
    legendPosition = "bottom",
    isAnimationActive = true,
    valueColumnForConfig,
    exportMode = false,
  }: DashboardBarChartProps) {
    // Get config for Y-axis formatting
    // Use valueColumnForConfig if provided (for pivoted data), otherwise fall back to first bar's dataKey
    const configColumn = valueColumnForConfig ?? bars[0]?.dataKey;
    const sourceColumn = configColumn
      ? (columnMapping?.[configColumn] ?? configColumn)
      : null;
    const yAxisConfig = sourceColumn
      ? getColumnConfig(tableName, sourceColumn)
      : { type: "numeric" as const };

    // Y-axis tick formatter (abbreviated)
    const yAxisFormatter = (value: number) => formatAbbreviated(value, yAxisConfig);

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={200}
        initialDimension={{ width: 400, height: 200 }}
      >
        <RechartsBarChart data={data} margin={{ top: 20, right: 5, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: exportMode ? 16 : 14 }} />
          <YAxis tick={{ fontSize: exportMode ? 16 : 14 }} tickFormatter={yAxisFormatter} />
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tableName={tableName} columnMapping={columnMapping} valueColumnForConfig={valueColumnForConfig} />}
            />
          )}
          {showLegend && (
            <Legend
              layout={legendPosition === "right" ? "vertical" : "horizontal"}
              align={legendPosition === "right" ? "right" : "center"}
              verticalAlign={legendPosition === "right" ? "middle" : "bottom"}
              wrapperStyle={legendPosition === "right" ? { paddingLeft: "20px" } : { paddingTop: "10px" }}
              content={() => (
                <ChartLegend
                  items={bars.map((bar, index) => ({
                    label: bar.name || bar.dataKey,
                    color: bar.color || colors[index % colors.length],
                  }))}
                  exportMode={exportMode}
                  legendPosition={legendPosition}
                />
              )}
            />
          )}
          {bars.map((bar, index) => {
            // If colorByRow is enabled and we have a single bar series,
            // assign colors to each data point based on row index
            if (colorByRow && bars.length === 1) {
              return (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.name || bar.dataKey}
                  stackId={stacked ? "stack" : undefined}
                  isAnimationActive={isAnimationActive}
                >
                  {data.map((_, dataIndex) => (
                    <Cell key={`cell-${dataIndex}`} fill={colors[dataIndex % colors.length]} />
                  ))}
                </Bar>
              );
            }

            // Default behavior: color by bar series
            return (
              <Bar
                key={bar.dataKey}
                dataKey={bar.dataKey}
                name={bar.name || bar.dataKey}
                fill={bar.color || colors[index % colors.length]}
                stackId={stacked ? "stack" : undefined}
                isAnimationActive={isAnimationActive}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if data or config actually changed
    return (
      prevProps.data === nextProps.data &&
      prevProps.bars === nextProps.bars &&
      prevProps.stacked === nextProps.stacked &&
      prevProps.colors === nextProps.colors &&
      prevProps.showLegend === nextProps.showLegend &&
      prevProps.showTooltip === nextProps.showTooltip &&
      prevProps.showGrid === nextProps.showGrid &&
      prevProps.tableName === nextProps.tableName &&
      prevProps.columnMapping === nextProps.columnMapping &&
      prevProps.colorByRow === nextProps.colorByRow &&
      prevProps.legendPosition === nextProps.legendPosition &&
      prevProps.isAnimationActive === nextProps.isAnimationActive &&
      prevProps.valueColumnForConfig === nextProps.valueColumnForConfig &&
      prevProps.exportMode === nextProps.exportMode
    );
  }
);

export function transformToBarData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumns: string[],
  tableName?: string
): { data: BarChartData[]; bars: { dataKey: string; name: string; color?: string }[]; colorByRow?: boolean; valueColumn?: string } {
  if (data.length === 0) {
    return { data: [], bars: [] };
  }

  // Check if we need to pivot: look for a categorical column among valueColumns
  // A categorical column is one where the first non-null value is a non-numeric string
  const categoricalCol = valueColumns.find((col) => {
    // Check first few rows to find a non-null value
    for (const row of data.slice(0, 10)) {
      const val = row[col];
      if (val === null || val === undefined) continue;
      return typeof val === "string" && isNaN(Number(val));
    }
    return false;
  });
  const numericCols = valueColumns.filter((col) => col !== categoricalCol);

  // If we have a categorical column and at least one numeric column, pivot the data
  if (categoricalCol && numericCols.length > 0) {
    const pivoted = pivotBarData(data, labelColumn, numericCols[0], categoricalCol);
    return { ...pivoted, valueColumn: numericCols[0] };
  }

  // Standard transformation: each valueColumn becomes a bar series
  const barData = data.map((row) => {
    const item: BarChartData = {
      name: String(row[labelColumn] ?? "Unknown"),
    };
    for (const col of valueColumns) {
      item[col] = Number(row[col]) || 0;
    }
    return item;
  });

  const bars = valueColumns.map((col) => ({
    dataKey: col,
    name: tableName ? getColumnDisplayName(tableName, col) : col,
  }));

  // Enable colorByRow when we have a single value column (simple bar chart)
  // This ensures consistent colors with pie charts showing the same data
  const colorByRow = valueColumns.length === 1;

  return { data: barData, bars, colorByRow, valueColumn: valueColumns[0] };
}

/**
 * Pivot data for stacked/grouped bar charts.
 * Transforms rows like:
 *   { quarter: "2024-Q1", value: 1000, category: "Dev" }
 *   { quarter: "2024-Q1", value: 500, category: "Ops" }
 * Into:
 *   { name: "2024-Q1", Dev: 1000, Ops: 500 }
 *
 * Categories are sorted by total value (descending) so biggest spenders appear
 * first in the legend and at the bottom of stacked bars. Colors are assigned
 * based on category name hash for consistency across data changes.
 */
function pivotBarData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string,
  seriesColumn: string,
  colors: string[] = DEFAULT_CHART_COLORS
): { data: BarChartData[]; bars: { dataKey: string; name: string; color: string }[] } {
  // Calculate totals per category while collecting unique series
  const seriesTotals = new Map<string, number>();
  for (const row of data) {
    const series = String(row[seriesColumn] ?? "Unknown");
    const value = Number(row[valueColumn]) || 0;
    seriesTotals.set(series, (seriesTotals.get(series) || 0) + value);
  }

  // Sort by total descending, with "Unknown" always last
  const seriesValues = Array.from(seriesTotals.keys()).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return (seriesTotals.get(b) || 0) - (seriesTotals.get(a) || 0);
  });

  // Build stable color map based on category names (not sort order)
  const colorMap = buildCategoryColorMap(seriesValues, colors);

  // Group data by label (e.g., quarter)
  const grouped = new Map<string, BarChartData>();
  for (const row of data) {
    const label = String(row[labelColumn] ?? "Unknown");
    const series = String(row[seriesColumn] ?? "Unknown");
    const value = Number(row[valueColumn]) || 0;

    if (!grouped.has(label)) {
      const item: BarChartData = { name: label };
      // Initialize all series to 0
      for (const s of seriesValues) {
        item[s] = 0;
      }
      grouped.set(label, item);
    }

    const item = grouped.get(label)!;
    item[series] = (Number(item[series]) || 0) + value;
  }

  const barData = Array.from(grouped.values());

  const bars = seriesValues.map((series) => ({
    dataKey: series,
    name: series,
    color: colorMap[series],
  }));

  return { data: barData, bars };
}
