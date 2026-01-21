"use client";

import * as React from "react";
import { Column } from "@tanstack/react-table";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FilterGroup, FilterCondition } from "@/lib/db/types";
import { formatPartialDateForDisplay } from "@/lib/date-utils";

interface DataTableDateFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  filterGroup?: FilterGroup;
  onFilterGroupChange?: (group: FilterGroup) => void;
  columnName?: string;
}

type DateOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

interface PendingCondition {
  operator: DateOperator;
  value: string;
}

const OPERATORS: { value: DateOperator; label: string }[] = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "after" },
  { value: "<", label: "before" },
  { value: ">=", label: "on or after" },
  { value: "<=", label: "on or before" },
];

function formatDateForDisplay(dateStr: string): string {
  return formatPartialDateForDisplay(dateStr);
}

function getOperatorSymbol(op: DateOperator): string {
  switch (op) {
    case "=": return "=";
    case "!=": return "≠";
    case ">": return ">";
    case "<": return "<";
    case ">=": return "≥";
    case "<=": return "≤";
  }
}

export function DataTableDateFilter<TData, TValue>({
  column: _column,
  title,
  filterGroup,
  onFilterGroupChange,
  columnName,
}: DataTableDateFilterProps<TData, TValue>) {
  // Note: _column is unused but kept for API consistency with other filter components
  // Read applied conditions from filterGroup
  const appliedConditions = React.useMemo((): PendingCondition[] => {
    if (!filterGroup || !columnName) return [];

    return filterGroup.conditions
      .filter((c): c is FilterCondition =>
        'column' in c &&
        c.column === columnName &&
        ['=', '!=', '>', '<', '>=', '<='].includes(c.operator)
      )
      .map(c => ({
        operator: c.operator as DateOperator,
        value: String(c.value),
      }));
  }, [filterGroup, columnName]);

  // Local state for pending conditions (not yet applied)
  const [pendingConditions, setPendingConditions] = React.useState<PendingCondition[]>(() =>
    appliedConditions.length > 0 ? appliedConditions : []
  );
  const [isOpen, setIsOpen] = React.useState(false);

  // Track previous isOpen to detect open transitions
  const wasOpenRef = React.useRef(false);

  // Sync pending conditions ONLY when popover opens (not when appliedConditions changes while open)
  // This prevents user input from being wiped out when filterGroup prop reference changes
  React.useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      setPendingConditions(
        appliedConditions.length > 0 ? appliedConditions : []
      );
    }
  }, [isOpen, appliedConditions]);

  const addCondition = () => {
    setPendingConditions(prev => [...prev, { operator: "=", value: "" }]);
  };

  const updateCondition = (index: number, updates: Partial<PendingCondition>) => {
    setPendingConditions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const removeCondition = (index: number) => {
    setPendingConditions(prev => prev.filter((_, i) => i !== index));
  };

  const handleApply = () => {
    if (!onFilterGroupChange || !columnName) {
      setIsOpen(false);
      return;
    }

    // Remove existing date conditions for this column
    const otherConditions = filterGroup?.conditions.filter(
      c => !('column' in c && c.column === columnName && ['=', '!=', '>', '<', '>=', '<='].includes(c.operator))
    ) || [];

    // Add new conditions (only those with values)
    const newConditions = pendingConditions
      .filter(c => c.value)
      .map(c => ({
        column: columnName,
        operator: c.operator,
        value: c.value,
      } as FilterCondition));

    const newFilterGroup = {
      operator: filterGroup?.operator || 'AND',
      conditions: [...otherConditions, ...newConditions],
    };

    onFilterGroupChange(newFilterGroup);
    setIsOpen(false);
  };

  const handleClear = () => {
    setPendingConditions([]);
  };

  const handleCancel = () => {
    setPendingConditions(
      appliedConditions.length > 0 ? appliedConditions : []
    );
    setIsOpen(false);
  };

  // Generate badge text
  const getBadgeText = (): string | null => {
    if (appliedConditions.length === 0) return null;

    if (appliedConditions.length === 1) {
      const c = appliedConditions[0];
      return `${getOperatorSymbol(c.operator)} ${formatDateForDisplay(c.value)}`;
    }

    // For range (2 conditions), try to show as range
    if (appliedConditions.length === 2) {
      const sorted = [...appliedConditions].sort((a, b) => {
        if ((a.operator === '>' || a.operator === '>=') && (b.operator === '<' || b.operator === '<=')) return -1;
        if ((b.operator === '>' || b.operator === '>=') && (a.operator === '<' || a.operator === '<=')) return 1;
        return 0;
      });

      const hasLower = sorted[0].operator === '>' || sorted[0].operator === '>=';
      const hasUpper = sorted[1]?.operator === '<' || sorted[1]?.operator === '<=';

      if (hasLower && hasUpper) {
        return `${formatDateForDisplay(sorted[0].value)} - ${formatDateForDisplay(sorted[1].value)}`;
      }
    }

    return `${appliedConditions.length} conditions`;
  };

  const badgeText = getBadgeText();

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
          {badgeText && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal text-xs"
              >
                {badgeText}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Filter by {title.toLowerCase()}</div>

          {/* Condition rows */}
          <div className="space-y-2">
            {pendingConditions.map((condition, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(index, { operator: value as DateOperator })}
                >
                  <SelectTrigger className="w-[110px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DateInput
                  className="flex-1 h-8"
                  value={condition.value}
                  onChange={(newValue) => updateCondition(index, { value: newValue })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add condition button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-8"
            onClick={addCondition}
          >
            <Plus className="h-4 w-4 mr-2" />
            {pendingConditions.length === 0 ? "Add date filter" : "Add another condition"}
          </Button>

          {/* Clear selection link */}
          {pendingConditions.length > 0 && (
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              Clear all
            </button>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
