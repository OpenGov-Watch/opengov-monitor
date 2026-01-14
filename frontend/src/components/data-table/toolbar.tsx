"use client";

import { useState } from "react";
import { Table } from "@tanstack/react-table";
import { X, Download, RotateCcw, Table as TableIcon, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onClearView: () => void;
  tableName: string;
  viewMode?: "table" | "card";
  onViewModeChange?: (mode: "table" | "card") => void;
  compactMode?: boolean;
  toolbarCollapsible?: boolean;
  dashboardComponentId?: string;
  initialToolbarCollapsed?: boolean;
  toolbarCollapsed?: boolean;
  onToolbarCollapseChange?: (collapsed: boolean) => void;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  onClearView,
  tableName,
  viewMode = "table",
  onViewModeChange,
  compactMode = false,
  toolbarCollapsible = false,
  dashboardComponentId,
  initialToolbarCollapsed = false,
  toolbarCollapsed: controlledCollapsed,
  onToolbarCollapseChange,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || globalFilter.length > 0;

  // Collapse state management - use controlled state if provided
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (!toolbarCollapsible) return false;
    const key = dashboardComponentId
      ? `opengov-toolbar-collapsed-${tableName}-${dashboardComponentId}`
      : `opengov-toolbar-collapsed-${tableName}`;
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === "true" : initialToolbarCollapsed;
  });

  // Use controlled state if provided, otherwise use internal state
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    const newState = !isCollapsed;

    // If controlled, call the change handler
    if (onToolbarCollapseChange) {
      onToolbarCollapseChange(newState);
    } else {
      // Otherwise, update internal state and localStorage
      setInternalCollapsed(newState);
      const key = dashboardComponentId
        ? `opengov-toolbar-collapsed-${tableName}-${dashboardComponentId}`
        : `opengov-toolbar-collapsed-${tableName}`;
      localStorage.setItem(key, String(newState));
    }
  };

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
    <div
      className={cn(
        "flex items-center justify-between flex-wrap transition-all duration-200",
        compactMode ? "gap-1" : "gap-2"
      )}
      style={{ minHeight: "2.5rem" }}
    >
      {/* Collapsible Section */}
      {!isCollapsed && (
        <>
          <div
            className={cn(
              "flex flex-1 items-center min-w-0",
              compactMode ? "space-x-1" : "space-x-2"
            )}
          >
            {/* Global Search */}
            <Input
              placeholder="Search all columns..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className={cn(
                compactMode ? "h-7 w-full sm:w-[150px]" : "h-8 w-full sm:w-[250px]"
              )}
            />

            {/* Clear Filters */}
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  table.resetColumnFilters();
                  setGlobalFilter("");
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
        </>
      )}

      {/* Always Visible Section - only show if not controlled externally */}
      {!onToolbarCollapseChange && (
        <div
          className={cn(
            "flex items-center",
            compactMode ? "space-x-1" : "space-x-2",
            isCollapsed && "ml-auto"
          )}
        >
          {/* Collapse Toggle Button */}
          {toolbarCollapsible && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCollapse}
              className={cn(compactMode ? "h-7 w-7 p-0" : "h-8 w-8 p-0")}
              title={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Reset View Button */}
          {!compactMode && isFiltered && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearView}
              className="h-8 hidden md:flex"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">Reset View</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
