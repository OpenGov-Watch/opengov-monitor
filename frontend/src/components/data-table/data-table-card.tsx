import { Row } from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DataTableCardProps<TData> {
  row: Row<TData>;
  primaryFields: string[];
  secondaryFields?: string[];
}

export function DataTableCard<TData>({
  row,
  primaryFields,
  secondaryFields = [],
}: DataTableCardProps<TData>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const allCells = row.getVisibleCells();

  // Get cell value helper
  const getCellValue = (columnId: string) => {
    const cell = allCells.find((c) => c.column.id === columnId);
    if (!cell) return null;

    const value = cell.getValue();

    // Handle different value types
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Get column header
  const getColumnHeader = (columnId: string) => {
    const cell = allCells.find((c) => c.column.id === columnId);
    if (!cell) return columnId;

    const header = cell.column.columnDef.header;
    if (typeof header === "string") return header;
    return columnId;
  };

  // Primary fields to show
  const primaryData = primaryFields.map((fieldId) => ({
    id: fieldId,
    label: getColumnHeader(fieldId),
    value: getCellValue(fieldId),
  }));

  // Secondary fields (shown when expanded)
  const secondaryData = isExpanded
    ? allCells
        .filter((cell) => !primaryFields.includes(cell.column.id))
        .map((cell) => ({
          id: cell.column.id,
          label: getColumnHeader(cell.column.id),
          value: getCellValue(cell.column.id),
        }))
    : [];

  return (
    <Card
      className={cn(
        "mb-3 cursor-pointer transition-shadow hover:shadow-md",
        isExpanded && "shadow-md"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        {/* Primary Fields */}
        <div className="space-y-2">
          {primaryData.map((field) => (
            <div key={field.id} className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">
                {field.label}
              </span>
              <span className="text-sm font-medium mt-0.5">
                {field.value || "—"}
              </span>
            </div>
          ))}
        </div>

        {/* Expand/Collapse Button */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {isExpanded ? "Hide details" : "Show details"}
          </span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Secondary Fields (Expanded) */}
        {isExpanded && secondaryData.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {secondaryData.map((field) => (
              <div key={field.id} className="flex justify-between items-start gap-2">
                <span className="text-xs text-muted-foreground font-medium flex-shrink-0">
                  {field.label}:
                </span>
                <span className="text-xs text-right break-words">
                  {field.value || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
