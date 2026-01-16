"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
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
import type { FacetValue } from "@/lib/db/types";

interface FilterMultiselectProps {
  values: string[];              // Currently selected values
  options: FacetValue[];         // Available options with counts
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function FilterMultiselect({
  values,
  options,
  onChange,
  placeholder = "Select values...",
  searchPlaceholder = "Search...",
}: FilterMultiselectProps) {
  const appliedValues = React.useMemo(() => new Set(values), [values]);
  const [pendingValues, setPendingValues] = React.useState<Set<string>>(() => appliedValues);
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync pending values when popover opens
  React.useEffect(() => {
    if (isOpen) {
      setPendingValues(new Set(appliedValues));
    }
  }, [isOpen, appliedValues]);

  // Sort options alphabetically
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) =>
      String(a.value).localeCompare(String(b.value))
    );
  }, [options]);

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
    onChange(Array.from(pendingValues));
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
        <Button variant="outline" size="sm" className="h-8 gap-1">
          {appliedValues.size > 0 ? `${appliedValues.size} selected` : placeholder}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {sortedOptions.map(({ value, count }) => {
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
                    {count !== undefined && (
                      <span className="ml-auto font-mono text-xs text-muted-foreground text-right">
                        {count}
                      </span>
                    )}
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
