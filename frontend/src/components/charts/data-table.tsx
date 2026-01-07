"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DynamicCell } from "@/components/renderers";
import {
  getColumnConfig,
  getColumnDisplayName,
  type ColumnRenderConfig,
} from "@/lib/column-renderer";

interface DashboardDataTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
  tableName?: string;
  // Legacy prop for backwards compatibility
  displayName?: (col: string) => string;
}

export function DashboardDataTable({
  data,
  maxRows = 100,
  tableName = "",
  displayName,
}: DashboardDataTableProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No data available
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);

  // Get config for each column
  const columnConfigs: Record<string, ColumnRenderConfig> = {};
  for (const col of columns) {
    columnConfigs[col] = getColumnConfig(tableName, col);
  }

  // Get display name using legacy prop or new function
  const getDisplayName = (col: string) => {
    if (displayName) return displayName(col);
    return getColumnDisplayName(tableName, col);
  };

  // Determine if column should be right-aligned
  const isRightAligned = (config: ColumnRenderConfig) =>
    config.render === "currency" || config.render === "number";

  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => {
              const config = columnConfigs[col];
              return (
                <TableHead
                  key={col}
                  className={`whitespace-nowrap ${isRightAligned(config) ? "text-right" : ""}`}
                  title={col}
                >
                  {getDisplayName(col)}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((col) => {
                const config = columnConfigs[col];
                return (
                  <TableCell
                    key={col}
                    className={`whitespace-nowrap ${isRightAligned(config) ? "text-right" : ""}`}
                  >
                    <DynamicCell value={row[col]} config={config} row={row} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {data.length > maxRows && (
        <div className="p-2 text-center text-xs text-muted-foreground">
          Showing {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}
