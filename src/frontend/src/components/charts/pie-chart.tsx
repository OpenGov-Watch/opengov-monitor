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
import {
  DEFAULT_CHART_COLORS,
  buildCategoryColorMap,
} from "@/lib/chart-colors";

interface PieChartData {
  name: string;
  value: number;
  fill?: string;
  [key: string]: string | number | undefined;
}

interface DashboardPieChartProps {
  data: PieChartData[];
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  tableName?: string;
  valueColumn?: string;
  columnMapping?: Record<string, string>;
  legendPosition?: "bottom" | "right";
  isAnimationActive?: boolean; // Set to false for export to disable animations
  exportMode?: boolean; // When true, renders legend 50% larger for download/copy
}

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
    colors = DEFAULT_CHART_COLORS,
    showLegend = true,
    showTooltip = true,
    tableName = "",
    valueColumn = "value",
    columnMapping,
    legendPosition = "bottom",
    isAnimationActive = true,
    exportMode = false,
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
            startAngle={90}
            endAngle={-270}
            labelLine={false}
            outerRadius="80%"
            fill="#8884d8"
            dataKey="value"
            label={({ cx, cy, midAngle = 0, innerRadius, outerRadius, percent }) => {
              const RADIAN = Math.PI / 180;
              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
              const x = cx + radius * Math.cos(-midAngle * RADIAN);
              const y = cy + radius * Math.sin(-midAngle * RADIAN);
              const percentage = (percent ?? 0) * 100;
              // Hide label if slice is too small
              if (percentage < 5) return null;
              return (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={exportMode ? 14 : 12}
                  fontWeight={500}
                  fill="#ffffff"
                >
                  {`${percentage.toFixed(0)}%`}
                </text>
              );
            }}
            isAnimationActive={isAnimationActive}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill || colors[index % colors.length]}
              />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tableName={tableName} valueColumn={valueColumn} columnMapping={columnMapping} total={total} />}
            />
          )}
          {showLegend && (
            <Legend
              layout={legendPosition === "right" ? "vertical" : "horizontal"}
              align={legendPosition === "right" ? "right" : "center"}
              verticalAlign={legendPosition === "right" ? "middle" : "bottom"}
              wrapperStyle={legendPosition === "right" ? { paddingLeft: "20px" } : { paddingTop: "10px" }}
              content={() => (
                <ul
                  className={exportMode ? undefined : `flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm ${legendPosition === "right" ? "flex-col" : ""}`}
                  style={exportMode ? {
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    textAlign: legendPosition === "right" ? "left" : "center",
                  } : undefined}
                >
                  {data.map((item, index) => (
                    <li
                      key={index}
                      className={exportMode ? undefined : "flex items-center gap-1.5"}
                      style={exportMode ? {
                        display: legendPosition === "right" ? "block" : "inline-block",
                        marginRight: legendPosition === "right" ? 0 : "24px",
                        marginBottom: "8px",
                        fontSize: "18px",
                        lineHeight: "24px",
                        whiteSpace: "nowrap",
                      } : undefined}
                    >
                      <span
                        className={exportMode ? undefined : "block flex-shrink-0 rounded-sm w-3 h-3"}
                        style={{
                          backgroundColor: item.fill || colors[index % colors.length],
                          ...(exportMode ? {
                            display: "inline-block",
                            width: "20px",
                            height: "20px",
                            borderRadius: "2px",
                            marginRight: "8px",
                            verticalAlign: "top",
                          } : {}),
                        }}
                      />
                      <span
                        className={exportMode ? undefined : "text-muted-foreground"}
                        style={exportMode ? {
                          color: "#737373",
                          display: "inline-block",
                          verticalAlign: "top",
                          fontSize: "18px",
                          lineHeight: 1,
                          height: "20px",
                          marginTop: "-8px",
                        } : undefined}
                      >
                        {item.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
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
      prevProps.columnMapping === nextProps.columnMapping &&
      prevProps.legendPosition === nextProps.legendPosition &&
      prevProps.isAnimationActive === nextProps.isAnimationActive &&
      prevProps.exportMode === nextProps.exportMode
    );
  }
);

/**
 * Transform data for pie charts.
 *
 * Slices are sorted by value (descending) so biggest slices appear first.
 * Colors are assigned based on category name hash for consistency across
 * data changes - same category always gets the same color.
 */
export function transformToPieData(
  data: Record<string, unknown>[],
  labelColumn: string,
  valueColumn: string,
  colors: string[] = DEFAULT_CHART_COLORS
): PieChartData[] {
  // Transform data
  const items = data.map((row) => ({
    name: String(row[labelColumn] ?? "Unknown"),
    value: Number(row[valueColumn]) || 0,
  }));

  // Sort by value descending, "Unknown" always last
  items.sort((a, b) => {
    if (a.name === "Unknown") return 1;
    if (b.name === "Unknown") return -1;
    return b.value - a.value;
  });

  // Build stable color map based on category names (not sort order)
  const categoryNames = items.map((item) => item.name);
  const colorMap = buildCategoryColorMap(categoryNames, colors);

  // Add fill property to each item
  return items.map((item) => ({
    ...item,
    fill: colorMap[item.name],
  }));
}
