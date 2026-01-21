"use client";

import * as React from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { FilterCondition, FilterGroup, FacetValue, FacetQueryResponse, QueryConfig } from "@/lib/db/types";
import { FilterMultiselect } from "./filter-multiselect";
import { isCategoricalColumn, getColumnTypeWithConfig, getOperatorsForColumnType } from "@/lib/column-metadata";
import { buildFacetQueryConfig } from "@/lib/query-config-utils";

interface FilterGroupBuilderProps {
  group: FilterGroup;
  availableColumns: { id: string; name: string }[];
  onUpdate: (group: FilterGroup) => void;
  level?: number;
  sourceTable: string;  // Required for fetching facets
  joins?: QueryConfig["joins"];  // JOIN configuration for accessing joined tables
  columnIdToRef?: Record<string, string>;  // Mapping from column IDs to original DB references
  filterColumnMap?: Map<string, string>;  // Map display column → filter column (e.g., parentBountyId → parentBountyName)
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
  { value: "NOT IN", label: "not in list" },
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
  facetsData,
  filterColumnMap,
  sourceTable,
}: {
  item: FilterCondition;
  index: number;
  availableColumns: { id: string; name: string }[];
  updateCondition: (index: number, updates: Partial<FilterCondition>) => void;
  removeItem: (index: number) => void;
  facetsData?: Record<string, FacetValue[]>;
  filterColumnMap?: Map<string, string>;
  sourceTable: string;
}) {
  // Resolve to filter column if mapped (e.g., parentBountyId → parentBountyName)
  const effectiveColumn = filterColumnMap?.get(item.column) || item.column;
  const isCategorical = isCategoricalColumn(effectiveColumn);
  const isIN = item.operator === 'IN' || item.operator === 'NOT IN';
  const isNullCheck = item.operator === 'IS NULL' || item.operator === 'IS NOT NULL';

  // Get column type using column-config.yaml for proper date detection
  const columnType = getColumnTypeWithConfig(sourceTable, effectiveColumn);
  const availableOperators = React.useMemo(() => {
    const allowedOps = getOperatorsForColumnType(columnType);
    return OPERATORS.filter(op => allowedOps.includes(op.value));
  }, [columnType]);

  return (
    <div className="flex gap-2 items-center p-2 border rounded bg-background">
      {/* Column Selection */}
      <Select
        value={item.column}
        onValueChange={(value) => {
          // When column changes, reset operator to first available for new column type
          // Use filterColumn if mapped for determining column type
          const newEffectiveColumn = filterColumnMap?.get(value) || value;
          const newColumnType = getColumnTypeWithConfig(sourceTable, newEffectiveColumn);
          const newAvailableOps = getOperatorsForColumnType(newColumnType);
          const currentOpAllowed = newAvailableOps.includes(item.operator);

          updateCondition(index, {
            column: value,
            // Reset operator if current operator not available for new column type
            operator: currentOpAllowed ? item.operator : newAvailableOps[0] as FilterCondition["operator"],
            // Reset value when changing columns
            value: null
          });
        }}
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
          {availableOperators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input - conditional rendering based on column type and operator */}
      {!isNullCheck && (
        <>
          {isCategorical && isIN ? (
            // Multiselect for categorical columns with IN/NOT IN operators
            <div className="flex-1">
              <FilterMultiselect
                values={Array.isArray(item.value) ? item.value : []}
                options={facetsData?.[item.column] || []}
                onChange={(newValues) => updateCondition(index, { value: newValues })}
                placeholder={`Select ${item.column}...`}
                searchPlaceholder={`Search ${item.column}...`}
              />
            </div>
          ) : columnType === 'date' ? (
            // DateInput for date columns
            <DateInput
              className="flex-1"
              value={item.value as string ?? ""}
              onChange={(newValue) => updateCondition(index, { value: newValue })}
            />
          ) : (
            // Free text input for non-categorical columns
            <Input
              className="flex-1"
              placeholder={
                item.operator === "IN" || item.operator === "NOT IN"
                  ? "value1, value2, ..."
                  : "value"
              }
              value={
                Array.isArray(item.value)
                  ? item.value.join(", ")
                  : item.value ?? ""
              }
              onChange={(e) => {
                const inputValue = e.target.value;
                let parsedValue: string | number | string[];

                if (item.operator === "IN" || item.operator === "NOT IN") {
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
        </>
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
    JSON.stringify(prevProps.availableColumns) === JSON.stringify(nextProps.availableColumns) &&
    JSON.stringify(prevProps.facetsData) === JSON.stringify(nextProps.facetsData) &&
    prevProps.filterColumnMap === nextProps.filterColumnMap &&
    prevProps.sourceTable === nextProps.sourceTable
  );
});

export const FilterGroupBuilder = React.memo(function FilterGroupBuilder({
  group,
  availableColumns,
  onUpdate,
  level = 0,
  sourceTable,
  joins,
  columnIdToRef,
  filterColumnMap,
}: FilterGroupBuilderProps) {
  // Extract all categorical columns from the filter group (recursively)
  // Uses filterColumnMap to check effective column type (e.g., parentBountyId → parentBountyName)
  const categoricalColumnsInGroup = React.useMemo(() => {
    const columns = new Set<string>();

    function extractColumns(g: FilterGroup) {
      g.conditions.forEach(condition => {
        if ('column' in condition) {
          // Check categorical using effective column (after filterColumnMap mapping)
          const effectiveCol = filterColumnMap?.get(condition.column) || condition.column;
          if (isCategoricalColumn(effectiveCol)) {
            columns.add(condition.column);  // Store display column for facet lookup
          }
        } else if ('conditions' in condition) {
          extractColumns(condition);
        }
      });
    }

    extractColumns(group);
    return Array.from(columns);
  }, [group, filterColumnMap]);

  // State for facets data
  const [facetsData, setFacetsData] = React.useState<Record<string, FacetValue[]>>({});

  // Fetch facets for categorical columns
  React.useEffect(() => {
    if (categoricalColumnsInGroup.length === 0) {
      setFacetsData({});
      return;
    }

    const controller = new AbortController();

    // Map display columns to filter columns (e.g., parentBountyId → parentBountyName)
    // These are the columns we actually fetch facets for
    const filterColumns = categoricalColumnsInGroup.map(col =>
      filterColumnMap?.get(col) || col
    );

    // Build facet config with proper alias resolution for joined columns
    const facetConfig = buildFacetQueryConfig({
      sourceTable,
      columns: filterColumns,
      joins,
      filters: group, // Use current filter group for accurate counts
      columnIdToRef,
    });

    fetch("/api/query/facets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(facetConfig),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          console.warn("Facet fetch failed");
          setFacetsData({});
          return;
        }
        const result: FacetQueryResponse = await response.json();

        // Map facet keys back from resolved columns to display columns
        // e.g., "b.name" → "parentBountyId" (the column shown in UI)
        // Also filter out null values (use IS NULL operator instead)
        const filterNulls = (values: FacetValue[]) =>
          values.filter(v => v.value !== null);

        // Build reverse mappings: DB ref → filterColumn → displayColumn
        const refToFilterCol = columnIdToRef
          ? Object.fromEntries(Object.entries(columnIdToRef).map(([alias, ref]) => [ref, alias]))
          : {};
        const filterToDisplay = filterColumnMap
          ? Object.fromEntries(Array.from(filterColumnMap.entries()).map(([display, filter]) => [filter, display]))
          : {};

        const mappedFacets: Record<string, FacetValue[]> = {};
        for (const [key, values] of Object.entries(result.facets)) {
          // key is a DB ref like "b.name" or alias like "category"
          // First resolve to filterColumn (alias)
          const filterCol = refToFilterCol[key] || key;
          // Then resolve to display column if mapped
          const displayCol = filterToDisplay[filterCol] || filterCol;
          mappedFacets[displayCol] = filterNulls(values);
        }
        setFacetsData(mappedFacets);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn("Error fetching facets:", err);
          setFacetsData({});
        }
      });

    return () => {
      controller.abort();
    };
  }, [categoricalColumnsInGroup, sourceTable, group, joins, columnIdToRef, filterColumnMap]);

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
                  sourceTable={sourceTable}
                  joins={joins}
                  columnIdToRef={columnIdToRef}
                  filterColumnMap={filterColumnMap}
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
                facetsData={facetsData}
                filterColumnMap={filterColumnMap}
                sourceTable={sourceTable}
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
    prevProps.sourceTable === nextProps.sourceTable &&
    JSON.stringify(prevProps.group) === JSON.stringify(nextProps.group) &&
    JSON.stringify(prevProps.availableColumns) === JSON.stringify(nextProps.availableColumns) &&
    JSON.stringify(prevProps.joins) === JSON.stringify(nextProps.joins) &&
    JSON.stringify(prevProps.columnIdToRef) === JSON.stringify(nextProps.columnIdToRef) &&
    prevProps.filterColumnMap === nextProps.filterColumnMap
  );
});
