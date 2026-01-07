"use client";

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

export function DashboardLineChart({
  data,
  lines,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
  showDots = true,
}: DashboardLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        {showTooltip && <Tooltip />}
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
}

export function transformToLineData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumns: string[]
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
    name: col,
  }));

  return { data: lineData, lines };
}
