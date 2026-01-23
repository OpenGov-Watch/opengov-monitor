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
  legendPosition?: "bottom" | "right";
  isAnimationActive?: boolean; // Set to false for export to disable animations
  exportMode?: boolean; // When true, renders legend 50% larger for download/copy
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
});

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
    legendPosition = "bottom",
    isAnimationActive = true,
    exportMode = false,
  }: DashboardLineChartProps) {
    // Get config for first value column to determine Y-axis formatting
    const firstValueColumn = lines[0]?.dataKey;
    const sourceColumn = firstValueColumn
      ? (columnMapping?.[firstValueColumn] ?? firstValueColumn)
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
        <RechartsLineChart data={data} margin={{ top: 20, right: 5, left: 0, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" />}
          <XAxis dataKey="name" tick={{ fontSize: exportMode ? 16 : 14 }} />
          <YAxis tick={{ fontSize: exportMode ? 16 : 14 }} tickFormatter={yAxisFormatter} />
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip tableName={tableName} columnMapping={columnMapping} />}
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
                  {lines.map((line, index) => (
                    <li
                      key={line.dataKey}
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
                          backgroundColor: line.color || colors[index % colors.length],
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
                        {line.name || line.dataKey}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
          {lines.map((line, index) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name || line.dataKey}
              stroke={line.color || colors[index % colors.length]}
              dot={showDots}
              activeDot={{ r: 8 }}
              isAnimationActive={isAnimationActive}
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
      prevProps.columnMapping === nextProps.columnMapping &&
      prevProps.legendPosition === nextProps.legendPosition &&
      prevProps.isAnimationActive === nextProps.isAnimationActive &&
      prevProps.exportMode === nextProps.exportMode
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
