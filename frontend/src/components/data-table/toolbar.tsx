"use client";

import { Table } from "@tanstack/react-table";
import { X, Download, Save, FolderOpen, RotateCcw } from "lucide-react";

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

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  onSaveView: () => void;
  onLoadView: () => void;
  onClearView: () => void;
  tableName: string;
}

export function DataTableToolbar<TData>({
  table,
  globalFilter,
  setGlobalFilter,
  onSaveView,
  onLoadView,
  onClearView,
  tableName,
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
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {/* Global Search */}
        <Input
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 w-[250px]"
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

      <div className="flex items-center space-x-2">
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

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="mr-2 h-4 w-4" />
              Export
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
