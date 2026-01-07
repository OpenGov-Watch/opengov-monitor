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

export function DashboardBarChart({
  data,
  bars,
  stacked = false,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
}: DashboardBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        {showTooltip && <Tooltip />}
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
  valueColumns: string[]
): { data: BarChartData[]; bars: { dataKey: string; name: string }[] } {
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
    name: col,
  }));

  return { data: barData, bars };
}
