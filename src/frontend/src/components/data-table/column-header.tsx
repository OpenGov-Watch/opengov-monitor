"use client";

import { Column } from "@tanstack/react-table";
import ArrowDown from "lucide-react/dist/esm/icons/arrow-down";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn("px-2", className)}>{title}</div>;
  }

  // Get the sort order index for multi-column sorting
  const sortIndex = column.getSortIndex();
  const isSorted = column.getIsSorted();

  // Cycle through: none -> asc -> desc -> none
  // With shift key: append to existing sorts (multi-column sort)
  const handleSort = (event: React.MouseEvent) => {
    const currentSort = column.getIsSorted();

    if (event.shiftKey) {
      // Multi-column sort: toggle this column without clearing others
      if (currentSort === false) {
        column.toggleSorting(false, true); // multi = true
      } else if (currentSort === "asc") {
        column.toggleSorting(true, true); // multi = true
      } else {
        column.clearSorting();
      }
    } else {
      // Single column sort: cycle through states
      if (currentSort === false) {
        column.toggleSorting(false); // Set to ascending
      } else if (currentSort === "asc") {
        column.toggleSorting(true); // Set to descending
      } else {
        column.clearSorting(); // Clear sorting
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-8 w-full justify-between px-2", className)}
      onClick={handleSort}
    >
      <span>{title}</span>
      <span className="flex items-center">
        {isSorted === "desc" ? (
          <ArrowDown className="h-4 w-4" />
        ) : isSorted === "asc" ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ChevronsUpDown className="h-4 w-4" />
        )}
        {/* Show sort order number for multi-column sorting */}
        {isSorted && sortIndex !== -1 && (
          <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
            {sortIndex + 1}
          </Badge>
        )}
      </span>
    </Button>
  );
}
