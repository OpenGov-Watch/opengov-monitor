"use client";

import { Table } from "@tanstack/react-table";
import { X, Download, Save, FolderOpen, RotateCcw, Table as TableIcon, LayoutGrid } from "lucide-react";

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
  onSaveView: () => void;
  onLoadView: () => void;
  onClearView: () => void;
  tableName: string;
  viewMode?: "table" | "card";
  onViewModeChange?: (mode: "table" | "card") => void;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  onSaveView,
  onLoadView,
  onClearView,
  tableName,
  viewMode = "table",
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
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex flex-1 items-center space-x-2 min-w-0">
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

      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* View Mode Toggle */}
        {onViewModeChange && (
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("table")}
              className={cn("h-8 px-3 rounded-r-none", viewMode === "table" && "bg-secondary")}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("card")}
              className={cn("h-8 px-3 rounded-l-none", viewMode === "card" && "bg-secondary")}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="hidden md:flex items-center space-x-2">
          {/* View State Management */}
          <Button variant="outline" size="sm" onClick={onSaveView} className="h-8">
            <Save className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline">Save View</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onLoadView} className="h-8">
            <FolderOpen className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline">Load View</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onClearView} className="h-8">
            <RotateCcw className="mr-2 h-4 w-4" />
            <span className="hidden lg:inline">Reset</span>
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
