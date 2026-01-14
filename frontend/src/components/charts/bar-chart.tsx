"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
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
}

const DEFAULT_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#0088fe",
  "#00c49f",
  "#ffbb28",
  "#ff8080",
  "#a4de6c",
  "#d0ed57",
];

// Custom tooltip component with formatted values
function CustomTooltip({
  active,
  payload,
  label,
  tableName,
  columnMapping,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string; color: string }>;
  label?: string;
  tableName: string;
  columnMapping?: Record<string, string>;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm mb-2">{label}</p>
      {payload.map((entry, index) => {
        const sourceColumn = columnMapping?.[entry.dataKey] ?? entry.dataKey;
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
}

export function DashboardBarChart({
  data,
  bars,
  stacked = false,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  tableName = "",
  columnMapping,
}: DashboardBarChartProps) {
  // Get config for first value column to determine Y-axis formatting
  const firstValueColumn = bars[0]?.dataKey;
  const sourceColumn = firstValueColumn
    ? (columnMapping?.[firstValueColumn] ?? firstValueColumn)
    : null;
  const yAxisConfig = sourceColumn
    ? getColumnConfig(tableName, sourceColumn)
    : { render: "number" as const };

  // Y-axis tick formatter (abbreviated)
  const yAxisFormatter = (value: number) => formatAbbreviated(value, yAxisConfig);

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
      <RechartsBarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
        {showTooltip && (
          <Tooltip
            content={<CustomTooltip tableName={tableName} columnMapping={columnMapping} />}
          />
        )}
        {showLegend && <Legend />}
        {bars.map((bar, index) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            name={bar.name || bar.dataKey}
            fill={bar.color || colors[index % colors.length]}
            stackId={stacked ? "stack" : undefined}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

export function transformToBarData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumns: string[],
  tableName?: string
): { data: BarChartData[]; bars: { dataKey: string; name: string }[] } {
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
    return pivotBarData(data, labelColumn, numericCols[0], categoricalCol);
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

  return { data: barData, bars };
}

/**
 * Pivot data for stacked/grouped bar charts.
 * Transforms rows like:
 *   { quarter: "2024-Q1", value: 1000, category: "Dev" }
 *   { quarter: "2024-Q1", value: 500, category: "Ops" }
 * Into:
 *   { name: "2024-Q1", Dev: 1000, Ops: 500 }
 */
function pivotBarData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string,
  seriesColumn: string
): { data: BarChartData[]; bars: { dataKey: string; name: string }[] } {
  // Get unique series values (categories) in order of appearance
  const seriesValues: string[] = [];
  const seenSeries = new Set<string>();
  for (const row of data) {
    const series = String(row[seriesColumn] ?? "Unknown");
    if (!seenSeries.has(series)) {
      seenSeries.add(series);
      seriesValues.push(series);
    }
  }

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
  }));

  return { data: barData, bars };
}
