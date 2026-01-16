"use client";

import { memo, useMemo } from "react";
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

// Memoized custom tooltip component with formatted values
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  tableName,
  valueColumn,
  columnMapping,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: PieChartData }>;
  tableName: string;
  valueColumn: string;
  columnMapping?: Record<string, string>;
  total: number;
}) {
  if (!active || !payload || !payload.length) return null;

  const entry = payload[0];
  const sourceColumn = columnMapping?.[valueColumn] ?? valueColumn;
  const config = getColumnConfig(tableName, sourceColumn);
  const formatted = formatValue(entry.value, config);
  const percent = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : "0.0";

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
});

export const DashboardPieChart = memo(
  function DashboardPieChart({
    data,
    colors = DEFAULT_COLORS,
    showLegend = true,
    showTooltip = true,
    tableName = "",
    valueColumn = "value",
    columnMapping,
  }: DashboardPieChartProps) {
    // Pre-compute total for tooltip percentage calculation
    const total = useMemo(
      () => data.reduce((sum, item) => sum + item.value, 0),
      [data]
    );

    return (
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={200}
        initialDimension={{ width: 400, height: 200 }}
      >
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
              content={<CustomTooltip tableName={tableName} valueColumn={valueColumn} columnMapping={columnMapping} total={total} />}
            />
          )}
          {showLegend && <Legend />}
        </RechartsPieChart>
      </ResponsiveContainer>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if data or config actually changed
    return (
      prevProps.data === nextProps.data &&
      prevProps.colors === nextProps.colors &&
      prevProps.showLegend === nextProps.showLegend &&
      prevProps.showTooltip === nextProps.showTooltip &&
      prevProps.tableName === nextProps.tableName &&
      prevProps.valueColumn === nextProps.valueColumn &&
      prevProps.columnMapping === nextProps.columnMapping
    );
  }
);

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
