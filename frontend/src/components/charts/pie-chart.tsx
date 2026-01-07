"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PieChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface DashboardPieChartProps {
  data: PieChartData[];
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
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

export function DashboardPieChart({
  data,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
}: DashboardPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsPieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius="80%"
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) =>
            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
            />
          ))}
        </Pie>
        {showTooltip && <Tooltip />}
        {showLegend && <Legend />}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

export function transformToPieData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string
): PieChartData[] {
  return data.map((row) => ({
    name: String(row[labelColumn] ?? "Unknown"),
    value: Number(row[valueColumn]) || 0,
  }));
}
