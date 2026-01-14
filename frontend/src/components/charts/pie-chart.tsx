"use client";

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getColumnConfig,
  formatValue,
} from "@/lib/column-renderer";

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
  tableName?: string;
  valueColumn?: string;
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
  tableName,
  valueColumn,
  columnMapping,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: PieChartData }>;
  tableName: string;
  valueColumn: string;
  columnMapping?: Record<string, string>;
}) {
  if (!active || !payload || !payload.length) return null;

  const entry = payload[0];
  const sourceColumn = columnMapping?.[valueColumn] ?? valueColumn;
  const config = getColumnConfig(tableName, sourceColumn);
  const formatted = formatValue(entry.value, config);
  const percent = ((entry.payload.value / payload.reduce((sum, p) => sum + p.payload.value, 0)) * 100).toFixed(1);

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm">{entry.name}</p>
      <p className="text-sm">
        <span className="text-muted-foreground">Value: </span>
        <span className="font-medium">{formatted}</span>
      </p>
      <p className="text-sm text-muted-foreground">{percent}%</p>
    </div>
  );
}

export function DashboardPieChart({
  data,
  colors = DEFAULT_COLORS,
  showLegend = true,
  showTooltip = true,
  tableName = "",
  valueColumn = "value",
  columnMapping,
}: DashboardPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={200}>
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
        {showTooltip && (
          <Tooltip
            content={<CustomTooltip tableName={tableName} valueColumn={valueColumn} columnMapping={columnMapping} />}
          />
        )}
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
