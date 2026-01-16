"use client";

import * as React from "react";
import { Column } from "@tanstack/react-table";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { FilterGroup, FilterCondition } from "@/lib/db/types";

interface DataTableFacetedFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  // New props for unified filter state
  filterGroup?: FilterGroup;
  onFilterGroupChange?: (group: FilterGroup) => void;
  columnName?: string; // e.g., "status", "track"
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  filterGroup,
  onFilterGroupChange,
  columnName,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column.getFacetedUniqueValues();

  // Read applied values from filterGroup (fallback to column.getFilterValue() for backward compat)
  const appliedValues = React.useMemo(() => {
    if (filterGroup && columnName) {
      // New path: read from filterGroup
      const conditions = filterGroup.conditions.filter(
        (c): c is FilterCondition =>
          'column' in c && c.column === columnName && c.operator === 'IN'
      );
      const values = conditions.flatMap(c => Array.isArray(c.value) ? c.value : []);
      return new Set(values.map(String));
    }
    // Legacy path: read from TanStack Table
    const filterValue = column.getFilterValue() as string[] | undefined;
    return new Set(filterValue || []);
  }, [filterGroup, columnName, column]);

  // Local state for pending selections (not yet applied)
  const [pendingValues, setPendingValues] = React.useState<Set<string>>(() => appliedValues);
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync pending values when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setPendingValues(new Set(appliedValues));
    }
  }, [isOpen, appliedValues]);

  // Sort facet values alphabetically
  const sortedFacets = React.useMemo(() => {
    return Array.from(facets.entries()).sort((a, b) =>
      String(a[0]).localeCompare(String(b[0]))
    );
  }, [facets]);

  const handleSelect = (value: string) => {
    const newPendingValues = new Set(pendingValues);
    if (newPendingValues.has(value)) {
      newPendingValues.delete(value);
    } else {
      newPendingValues.add(value);
    }
    setPendingValues(newPendingValues);
  };

  const handleApply = () => {
    if (onFilterGroupChange && columnName) {
      // New path: write to filterGroup
      // Remove existing conditions for this column with IN operator
      const newConditions = filterGroup?.conditions.filter(
        c => !('column' in c && c.column === columnName && c.operator === 'IN')
      ) || [];

      // Add new condition if values were selected
      if (pendingValues.size > 0) {
        newConditions.push({
          column: columnName,
          operator: 'IN',
          value: Array.from(pendingValues)
        });
      }

      onFilterGroupChange({
        operator: filterGroup?.operator || 'AND',
        conditions: newConditions
      });
    } else {
      // Legacy path: write to TanStack Table
      const filterValues = Array.from(pendingValues);
      column.setFilterValue(filterValues.length ? filterValues : undefined);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setPendingValues(new Set());
  };

  const handleCancel = () => {
    setPendingValues(new Set(appliedValues));
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 gap-1"
        >
          <span>{title}</span>
          <ChevronDown className="h-4 w-4" />
          {appliedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal"
              >
                {appliedValues.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${title.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {sortedFacets.map(([value, count]) => {
                const isSelected = pendingValues.has(String(value));
                return (
                  <CommandItem
                    key={String(value)}
                    onSelect={() => handleSelect(String(value))}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span>{String(value)}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground text-right">
                      {count}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {pendingValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleClear}
                    className="justify-center text-center"
                  >
                    Clear selection
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex gap-2 p-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
