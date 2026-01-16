"use client";

import * as React from "react";
import { Table } from "@tanstack/react-table";
import { X, Download, RotateCcw, Table as TableIcon, LayoutGrid, ChevronDown, ChevronUp, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTableColumnVisibility } from "./column-visibility";
import { SortComposer } from "./sort-composer";
import { FilterGroupBuilder } from "./filter-group-builder";
import { exportToCSV, exportToJSON } from "@/lib/export";
import { FilterGroup } from "@/lib/db/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Dialog content with local state for advanced filters
function AdvancedFiltersDialogContent({
  filterGroup,
  availableColumns,
  onApply,
  sourceTable,
}: {
  filterGroup?: FilterGroup;
  availableColumns: { id: string; name: string }[];
  onApply: (group: FilterGroup | undefined) => void;
  sourceTable: string;
}) {
  // Local state - changes don't trigger queries until Apply is clicked
  const [localGroup, setLocalGroup] = React.useState<FilterGroup>(
    filterGroup || { operator: "AND", conditions: [] }
  );
  const [isApplying, setIsApplying] = React.useState(false);

  // Reset local state when dialog opens (filterGroup prop changes)
  React.useEffect(() => {
    setLocalGroup(filterGroup || { operator: "AND", conditions: [] });
  }, [filterGroup]);

  const handleApply = () => {
    // Prevent spam clicking
    if (isApplying) return;
    setIsApplying(true);

    // Wrap state update in startTransition to prevent blocking
    React.startTransition(() => {
      onApply(localGroup.conditions.length > 0 ? localGroup : undefined);

      // Re-enable button after a delay
      setTimeout(() => setIsApplying(false), 500);
    });
  };

  const handleClear = () => {
    // Prevent spam clicking
    if (isApplying) return;
    setIsApplying(true);

    const emptyGroup: FilterGroup = { operator: "AND", conditions: [] };
    setLocalGroup(emptyGroup);
    // Wrap state update in startTransition to prevent blocking
    React.startTransition(() => {
      onApply(undefined);

      // Re-enable button after a delay
      setTimeout(() => setIsApplying(false), 500);
    });
  };

  return (
    <>
      <FilterGroupBuilder
        group={localGroup}
        availableColumns={availableColumns}
        onUpdate={setLocalGroup}
        sourceTable={sourceTable}
      />
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={isApplying}
        >
          Clear All
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleApply}
          disabled={isApplying}
        >
          Apply Filters
        </Button>
      </div>
    </>
  );
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  onClearView: () => void;
  tableName: string;
  sourceTable: string;  // Required for categorical filter dropdowns
  viewMode?: "table" | "card";
  onViewModeChange?: (mode: "table" | "card") => void;
  compactMode?: boolean;
  toolbarCollapsible?: boolean;
  dashboardComponentId?: string;
  initialToolbarCollapsed?: boolean;
  toolbarCollapsed?: boolean;
  onToolbarCollapseChange?: (collapsed: boolean) => void;
  groupBy?: string;
  onGroupByChange?: (columnId: string | undefined) => void;
  filterGroup?: FilterGroup;
  onFilterGroupChange?: (group: FilterGroup | undefined) => void;
}

export function DataTableToolbar<TData>({
  table,
  onClearView,
  tableName,
  sourceTable,
  viewMode = "table",
  onViewModeChange,
  compactMode = false,
  toolbarCollapsible = false,
  dashboardComponentId,
  initialToolbarCollapsed = false,
  toolbarCollapsed: controlledCollapsed,
  onToolbarCollapseChange,
  groupBy,
  onGroupByChange,
  filterGroup,
  onFilterGroupChange,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // Collapse state management - use controlled state if provided
  const [internalCollapsed, setInternalCollapsed] = React.useState(() => {
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

  // Memoize available columns to prevent recreation on every render
  // This prevents 50-100ms blocking when interacting with filters/dialogs
  const filterableColumns = React.useMemo(
    () => table
      .getAllColumns()
      .filter((col) => col.getCanFilter())
      .map((col) => ({
        id: col.id,
        name: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
      })),
    [table.getAllColumns().length] // Only recompute if column count changes
  );

  const sortableColumns = React.useMemo(
    () => table
      .getAllColumns()
      .filter((col) => col.getCanSort())
      .map((col) => ({
        id: col.id,
        name: typeof col.columnDef.header === "string" ? col.columnDef.header : col.id,
      })),
    [table.getAllColumns().length] // Only recompute if column count changes
  );

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
              "flex flex-1 items-center min-w-0 flex-wrap",
              compactMode ? "gap-1" : "gap-2"
            )}
          >
            {/* Advanced Filters Dialog */}
            {onFilterGroupChange && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(compactMode ? "h-7 w-7 p-0" : "h-8 w-8 p-0", "relative")}
                    title="Advanced Filters"
                  >
                    <Filter className="h-4 w-4" />
                    {filterGroup && filterGroup.conditions.length > 0 && (
                      <span className="absolute -top-1 -right-1 rounded-full bg-primary w-4 h-4 text-[10px] text-primary-foreground flex items-center justify-center">
                        {filterGroup.conditions.length}
                      </span>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Advanced Filters</DialogTitle>
                    <DialogDescription>
                      Create complex filters with AND/OR logic. Nest filter groups for advanced queries.
                    </DialogDescription>
                  </DialogHeader>
                  <AdvancedFiltersDialogContent
                    filterGroup={filterGroup}
                    availableColumns={filterableColumns}
                    onApply={onFilterGroupChange}
                    sourceTable={sourceTable}
                  />
                </DialogContent>
              </Dialog>
            )}

            {/* Multi-Sort Composer */}
            <SortComposer
              sorting={table.getState().sorting}
              setSorting={table.setSorting}
              availableColumns={sortableColumns}
            />

            {/* Reset View */}
            {!compactMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearView}
                className="h-8"
                title="Reset view"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}

            {/* Group By Dropdown */}
            {onGroupByChange && (
              <Select
                value={groupBy || "none"}
                onValueChange={(value) => onGroupByChange(value === "none" ? undefined : value)}
              >
                <SelectTrigger className={cn("w-[150px]", compactMode ? "h-7" : "h-8")}>
                  <SelectValue placeholder="Group by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {table.getAllColumns()
                    .filter((col) =>
                      col.getCanSort() && // Only sortable columns can be grouped
                      col.id !== "actions" && // Exclude action columns
                      col.id !== "select" // Exclude select columns
                    )
                    .map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {typeof col.columnDef.header === "string"
                          ? col.columnDef.header
                          : col.id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div
            className={cn(
              "flex items-center flex-shrink-0 flex-wrap",
              compactMode ? "gap-1" : "gap-2"
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

        {/* Clear Filters */}
        {isFiltered && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              table.resetColumnFilters();
            }}
            className={cn(compactMode ? "h-7" : "h-8")}
            title="Clear filters"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={compactMode ? "h-7" : "h-8"}
              title="Export data"
            >
              <Download className="h-4 w-4" />
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
        </div>
      )}
    </div>
  );
}
