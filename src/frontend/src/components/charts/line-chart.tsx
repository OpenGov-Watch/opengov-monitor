"use client";

import { memo } from "react";
import {
  LineChart as RechartsLineChart,
  Line,
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

interface LineChartData {
  name: string;
  [key: string]: string | number;
}

interface DashboardLineChartProps {
  data: LineChartData[];
  lines: {
    dataKey: string;
    name?: string;
    color?: string;
  }[];
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  showDots?: boolean;
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

export const DashboardLineChart = memo(
  function DashboardLineChart({
    data,
    lines,
    colors = DEFAULT_COLORS,
    showLegend = true,
    showTooltip = true,
    showGrid = true,
    showDots = true,
    tableName = "",
    columnMapping,
  }: DashboardLineChartProps) {
    // Get config for first value column to determine Y-axis formatting
    const firstValueColumn = lines[0]?.dataKey;
    const sourceColumn = firstValueColumn
      ? (columnMapping?.[firstValueColumn] ?? firstValueColumn)
      : null;
    const yAxisConfig = sourceColumn
      ? getColumnConfig(tableName, sourceColumn)
      : { render: "number" as const };

    // Y-axis tick formatter (abbreviated)
    const yAxisFormatter = (value: number) => formatAbbreviated(value, yAxisConfig);

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={200}
        initialDimension={{ width: 400, height: 200 }}
      >
        <RechartsLineChart data={data}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={yAxisFormatter} />
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tableName={tableName} columnMapping={columnMapping} />}
            />
          )}
          {showLegend && <Legend />}
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.color || colors[index % colors.length]}
              dot={showDots}
              activeDot={{ r: 8 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if data or config actually changed
    return (
      prevProps.data === nextProps.data &&
      prevProps.lines === nextProps.lines &&
      prevProps.colors === nextProps.colors &&
      prevProps.showLegend === nextProps.showLegend &&
      prevProps.showTooltip === nextProps.showTooltip &&
      prevProps.showGrid === nextProps.showGrid &&
      prevProps.showDots === nextProps.showDots &&
      prevProps.tableName === nextProps.tableName &&
      prevProps.columnMapping === nextProps.columnMapping
    );
  }
);

export function transformToLineData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumns: string[],
  tableName?: string
): { data: LineChartData[]; lines: { dataKey: string; name: string }[] } {
  const lineData = data.map((row) => {
    const item: LineChartData = {
      name: String(row[labelColumn] ?? "Unknown"),
    };
    for (const col of valueColumns) {
      item[col] = Number(row[col]) || 0;
    }
    return item;
  });

  const lines = valueColumns.map((col) => ({
    dataKey: col,
    name: tableName ? getColumnDisplayName(tableName, col) : col,
  }));

  return { data: lineData, lines };
}
