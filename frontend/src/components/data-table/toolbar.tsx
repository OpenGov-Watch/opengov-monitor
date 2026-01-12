"use client";

import { Table } from "@tanstack/react-table";
import { X, Download, Save, FolderOpen, RotateCcw, LayoutGrid, LayoutList } from "lucide-react";

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
import type { ViewMode } from "./data-table";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onSaveView: () => void;
  onLoadView: () => void;
  onClearView: () => void;
  tableName: string;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  onSaveView,
  onLoadView,
  onClearView,
  tableName,
  viewMode,
  onViewModeChange,
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || globalFilter.length > 0;

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2 flex-wrap">
        {/* Global Search */}
        <Input
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 w-full sm:w-[250px]"
        />

        {/* Clear Filters */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* View Mode Toggle */}
        {viewMode && onViewModeChange && (
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("table")}
              className="h-8 rounded-r-none border-r"
              title="Table view"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("card")}
              className="h-8 rounded-l-none"
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="hidden md:flex items-center gap-2">
          {/* View State Management */}
          <Button variant="outline" size="sm" onClick={onSaveView} className="h-8">
            <Save className="mr-2 h-4 w-4" />
            Save View
          </Button>
          <Button variant="outline" size="sm" onClick={onLoadView} className="h-8">
            <FolderOpen className="mr-2 h-4 w-4" />
            Load View
          </Button>
          <Button variant="outline" size="sm" onClick={onClearView} className="h-8">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
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
