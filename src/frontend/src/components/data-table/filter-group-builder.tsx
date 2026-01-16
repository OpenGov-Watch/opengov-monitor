"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCondition, FilterGroup } from "@/lib/db/types";

interface FilterGroupBuilderProps {
  group: FilterGroup;
  availableColumns: { id: string; name: string }[];
  onUpdate: (group: FilterGroup) => void;
  level?: number;
}

const OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater than or equal" },
  { value: "<=", label: "less than or equal" },
  { value: "LIKE", label: "contains" },
  { value: "IN", label: "in list" },
  { value: "IS NULL", label: "is null" },
  { value: "IS NOT NULL", label: "is not null" },
] as const;

function isFilterGroup(item: FilterCondition | FilterGroup): item is FilterGroup {
  return 'operator' in item && 'conditions' in item && (item.operator === 'AND' || item.operator === 'OR');
}

// Memoized condition row to prevent ALL conditions from re-rendering when one is added
const FilterConditionRow = React.memo(function FilterConditionRow({
  item,
  index,
  availableColumns,
  updateCondition,
  removeItem,
}: {
  item: FilterCondition;
  index: number;
  availableColumns: { id: string; name: string }[];
  updateCondition: (index: number, updates: Partial<FilterCondition>) => void;
  removeItem: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 items-center p-2 border rounded bg-background">
      {/* Column Selection */}
      <Select
        value={item.column}
        onValueChange={(value) => updateCondition(index, { column: value })}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {availableColumns.map((col) => (
            <SelectItem key={col.id} value={col.id}>
              {col.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator Selection */}
      <Select
        value={item.operator}
        onValueChange={(value) =>
          updateCondition(index, {
            operator: value as FilterCondition["operator"],
          })
        }
      >
        <SelectTrigger className="w-48">
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

      {/* Value Input (only for operators that need a value) */}
      {item.operator !== "IS NULL" && item.operator !== "IS NOT NULL" && (
        <Input
          className="flex-1"
          placeholder={
            item.operator === "IN" ? "value1, value2, ..." : "value"
          }
          value={
            Array.isArray(item.value)
              ? item.value.join(", ")
              : item.value ?? ""
          }
          onChange={(e) => {
            const inputValue = e.target.value;
            let parsedValue: string | number | string[];

            if (item.operator === "IN") {
              // Parse comma-separated list
              parsedValue = inputValue
                .split(",")
                .map((v) => v.trim())
                .filter((v) => v !== "");
            } else {
              // Try to parse as number, otherwise keep as string
              const num = Number(inputValue);
              parsedValue = isNaN(num) ? inputValue : num;
            }

            updateCondition(index, { value: parsedValue });
          }}
        />
      )}

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => removeItem(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if this specific condition changed
  return (
    prevProps.index === nextProps.index &&
    JSON.stringify(prevProps.item) === JSON.stringify(nextProps.item) &&
    prevProps.updateCondition === nextProps.updateCondition &&
    prevProps.removeItem === nextProps.removeItem &&
    JSON.stringify(prevProps.availableColumns) === JSON.stringify(nextProps.availableColumns)
  );
});

export const FilterGroupBuilder = React.memo(function FilterGroupBuilder({
  group,
  availableColumns,
  onUpdate,
  level = 0,
}: FilterGroupBuilderProps) {
  // Wrap all handlers in useCallback to prevent child re-renders
  const addCondition = React.useCallback(() => {
    const newCondition: FilterCondition = {
      column: availableColumns[0]?.id || "",
      operator: "=",
      value: "",
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  }, [group, availableColumns, onUpdate]);

  const addGroup = React.useCallback(() => {
    const newGroup: FilterGroup = {
      operator: "AND",
      conditions: [],
    };
    onUpdate({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  }, [group, onUpdate]);

  const removeItem = React.useCallback((index: number) => {
    onUpdate({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  }, [group, onUpdate]);

  const updateCondition = React.useCallback((index: number, updates: Partial<FilterCondition>) => {
    const updated = [...group.conditions];
    const condition = updated[index] as FilterCondition;
    updated[index] = { ...condition, ...updates };
    onUpdate({ ...group, conditions: updated });
  }, [group, onUpdate]);

  const updateNestedGroup = React.useCallback((index: number, updatedGroup: FilterGroup) => {
    const updated = [...group.conditions];
    updated[index] = updatedGroup;
    onUpdate({ ...group, conditions: updated });
  }, [group, onUpdate]);

  const toggleOperator = React.useCallback(() => {
    onUpdate({
      ...group,
      operator: group.operator === "AND" ? "OR" : "AND",
    });
  }, [group, onUpdate]);

  const marginLeft = level * 24; // 24px indentation per level

  return (
    <div
      className="space-y-2"
      style={{ marginLeft: level > 0 ? `${marginLeft}px` : undefined }}
    >
      {/* Group Header */}
      {level > 0 && (
        <div className="flex items-center gap-2 p-2 border rounded bg-muted/20">
          <Label className="text-sm font-semibold">Nested Group</Label>
        </div>
      )}

      {/* Operator Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Combine with:</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleOperator}
          className="h-7"
        >
          {group.operator}
        </Button>
      </div>

      {/* Conditions and Nested Groups */}
      {group.conditions.map((item, index) => (
        <div key={index} className="flex gap-2 items-start">
          {/* Condition Number/Connector */}
          {index > 0 && (
            <div className="flex-shrink-0 w-12 text-xs text-muted-foreground text-center pt-2">
              {group.operator}
            </div>
          )}
          {index === 0 && <div className="flex-shrink-0 w-12" />}

          {/* Condition or Nested Group */}
          <div className="flex-1 min-w-0">
            {isFilterGroup(item) ? (
              /* Nested Group */
              <div className="border rounded p-3 bg-card">
                <FilterGroupBuilder
                  group={item}
                  availableColumns={availableColumns}
                  onUpdate={(updatedGroup) => updateNestedGroup(index, updatedGroup)}
                  level={level + 1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="mt-2"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Group
                </Button>
              </div>
            ) : (
              /* Filter Condition */
              <FilterConditionRow
                item={item}
                index={index}
                availableColumns={availableColumns}
                updateCondition={updateCondition}
                removeItem={removeItem}
              />
            )}
          </div>
        </div>
      ))}

      {/* Add Condition/Group Buttons */}
      <div className="flex gap-2 ml-12">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>

      {/* Empty State */}
      {group.conditions.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          No filters. Click "Add Condition" to start building your filter.
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for deep equality on group and availableColumns
  // Only re-render if these actually changed
  return (
    prevProps.level === nextProps.level &&
    prevProps.onUpdate === nextProps.onUpdate &&
    JSON.stringify(prevProps.group) === JSON.stringify(nextProps.group) &&
    JSON.stringify(prevProps.availableColumns) === JSON.stringify(nextProps.availableColumns)
  );
});
