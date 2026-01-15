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

interface DataTableFacetedFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column.getFacetedUniqueValues();
  const filterValue = column.getFilterValue() as string[];
  const appliedValues = React.useMemo(() => new Set(filterValue), [filterValue?.join(',')]);

  // Local state for pending selections (not yet applied)
  const [pendingValues, setPendingValues] = React.useState<Set<string>>(() => new Set(filterValue));
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync pending values when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setPendingValues(new Set(appliedValues));
    }
  }, [isOpen]);

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
    const filterValues = Array.from(pendingValues);
    column.setFilterValue(filterValues.length ? filterValues : undefined);
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
