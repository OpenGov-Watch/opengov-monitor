"use client";

import { Table } from "@tanstack/react-table";
import { X, Download, RotateCcw, Table as TableIcon, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableColumnVisibility } from "./column-visibility";
import { exportToCSV, exportToJSON } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  onClearView: () => void;
  tableName: string;
  viewMode?: "table" | "card";
  onViewModeChange?: (mode: "table" | "card") => void;
  compactMode?: boolean;
}

export function DataTableToolbar<TData>({
  table,
  onClearView,
  tableName,
  viewMode = "table",
  onViewModeChange,
  compactMode = false,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const handleExportCSV = () => {
    const data = table
      .getFilteredRowModel()
      .rows.map((row) => row.original as Record<string, unknown>);
    exportToCSV(data, tableName);
  };

  const handleExportJSON = () => {
    const data = table.getFilteredRowModel().rows.map((row) => row.original);
    exportToJSON(data, tableName);
  };

  return (
    <div className={cn(
      "flex items-center justify-between flex-wrap",
      compactMode ? "gap-1" : "gap-2"
    )}>
      <div className={cn(
        "flex flex-1 items-center min-w-0",
        compactMode ? "space-x-1" : "space-x-2"
      )}>
        {/* Clear Filters */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
            }}
            className={cn("px-2 lg:px-3", compactMode ? "h-7" : "h-8")}
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div
        className={cn(
          "flex items-center flex-shrink-0",
          compactMode ? "space-x-1" : "space-x-2"
        )}
      >
        {/* View Mode Toggle */}
        {onViewModeChange && (
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("table")}
              className={cn(
                "px-3 rounded-r-none",
                compactMode ? "h-7" : "h-8",
                viewMode === "table" && "bg-secondary"
              )}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("card")}
              className={cn(
                "px-3 rounded-l-none",
                compactMode ? "h-7" : "h-8",
                viewMode === "card" && "bg-secondary"
              )}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!compactMode && (
          <div className="hidden md:flex items-center space-x-2">
            {/* Reset View */}
            <Button variant="outline" size="sm" onClick={onClearView} className="h-8">
              <RotateCcw className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">Reset</span>
            </Button>
          </div>
        )}

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={compactMode ? "h-7" : "h-8"}
            >
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleExportCSV}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON}>
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Column Visibility */}
        <DataTableColumnVisibility table={table} />
      </div>
    </div>
  );
}
