"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Check from "lucide-react/dist/esm/icons/check";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import { SortableColumnItem } from "./sortable-column-item";
import {
  loadColumnConfig,
  getColumnDisplayName,
} from "@/lib/column-renderer";
import type {
  QueryConfig,
  OrderByConfig,
  JoinConfig,
  FilterGroup,
  FilterCondition,
} from "@/lib/db/types";
import type { SchemaInfo, ColumnInfo } from "./types";
import { FilterGroupBuilder } from "@/components/data-table/filter-group-builder";
import {
  toUnifiedColumns,
  fromUnifiedColumns,
  getColumnId,
  type UnifiedColumn,
} from "@/lib/unified-column-utils";

interface QueryBuilderProps {
  initialConfig?: QueryConfig;
  onChange: (config: QueryConfig) => void;
}

/**
 * Ensures filters are in FilterGroup format for UI editing.
 * Memoizes conversion to avoid creating new objects on every render.
 */
const ensureFilterGroup = (() => {
  const cache = new WeakMap<FilterCondition[], FilterGroup>();

  return (filters: FilterCondition[] | FilterGroup): FilterGroup => {
    // Already a FilterGroup
    if (!Array.isArray(filters)) {
      return filters;
    }

    // Check cache for arrays
    if (cache.has(filters)) {
      return cache.get(filters)!;
    }

    // Convert legacy flat array to FilterGroup
    const group: FilterGroup = { operator: "AND", conditions: filters };
    cache.set(filters, group);
    return group;
  };
})();

const JOIN_TYPES: JoinConfig["type"][] = ["LEFT", "INNER", "RIGHT"];

const defaultConfig: QueryConfig = {
  sourceTable: "",
  columns: [],
  expressionColumns: [],
  joins: [],
  filters: [],
  groupBy: [],
  orderBy: [],
};

// Helper to recursively remove filter conditions referencing a specific table
function filterOutTableReferences(
  filters: FilterCondition[] | FilterGroup,
  tableName: string
): FilterCondition[] | FilterGroup {
  // Handle legacy flat array format
  if (Array.isArray(filters)) {
    return filters.filter((f) => !f.column.startsWith(`${tableName}.`));
  }

  // Handle FilterGroup format (recursive)
  const group = filters as FilterGroup;
  const filteredConditions = group.conditions
    .map((condition) => {
      if ('column' in condition) {
        // It's a FilterCondition - keep if it doesn't reference the table
        return !condition.column.startsWith(`${tableName}.`) ? condition : null;
      } else {
        // It's a nested FilterGroup - recurse
        const filtered = filterOutTableReferences(condition, tableName);
        // Only keep if it has conditions
        if (Array.isArray(filtered)) {
          return filtered.length > 0 ? { operator: "AND" as const, conditions: filtered } : null;
        }
        return (filtered as FilterGroup).conditions.length > 0 ? filtered : null;
      }
    })
    .filter((c): c is FilterCondition | FilterGroup => c !== null);

  return { operator: group.operator, conditions: filteredConditions };
}

// Helper to build SQL WHERE clause from FilterGroup (recursive)
function buildFilterSQL(filters: FilterCondition[] | FilterGroup): string {
  // Handle legacy flat array format
  if (Array.isArray(filters)) {
    if (filters.length === 0) return "";
    const conditions = filters.map((f) => {
      const colName = `"${f.column}"`;
      if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
        return `${colName} ${f.operator}`;
      }
      return `${colName} ${f.operator} '${f.value}'`;
    });
    return conditions.join(" AND ");
  }

  // Handle FilterGroup format (recursive)
  const group = filters as FilterGroup;
  if (!group.conditions || group.conditions.length === 0) return "";

  const conditions = group.conditions.map((condition) => {
    if ('column' in condition) {
      // It's a FilterCondition
      const colName = `"${condition.column}"`;
      if (condition.operator === "IS NULL" || condition.operator === "IS NOT NULL") {
        return `${colName} ${condition.operator}`;
      }
      return `${colName} ${condition.operator} '${condition.value}'`;
    } else {
      // It's a nested FilterGroup - recurse with parentheses
      const nested = buildFilterSQL(condition);
      return nested ? `(${nested})` : "";
    }
  }).filter(c => c !== "");

  return conditions.join(` ${group.operator} `);
}

// Helper to detect foreign key relationships based on column naming patterns
function detectJoinCondition(
  sourceTable: string,
  sourceColumns: ColumnInfo[],
  targetTable: string,
  targetColumns: ColumnInfo[]
): { left: string; right: string } | null {
  // Helper to check if column name matches table name (handles plural/singular)
  const columnMatchesTable = (columnName: string, tableName: string): boolean => {
    const colNorm = columnName.toLowerCase().replace(/_/g, '');
    const tableNorm = tableName.toLowerCase().replace(/ /g, '');

    // Exact match
    if (colNorm === `${tableNorm}id` || colNorm === `${tableNorm}index`) return true;

    // Try removing trailing 'ies' → 'y' (e.g., "Categories" → "category")
    if (tableNorm.endsWith('ies')) {
      const singular = tableNorm.slice(0, -3) + 'y';
      if (colNorm === `${singular}id` || colNorm === `${singular}index`) return true;
    }

    // Try removing trailing 's' for simple plurals (e.g., "Bounties" → "bountie" won't work, but "Items" → "item" will)
    if (tableNorm.endsWith('s') && !tableNorm.endsWith('ies')) {
      const singular = tableNorm.slice(0, -1);
      if (colNorm === `${singular}id` || colNorm === `${singular}index`) return true;
    }

    // Try removing trailing 'a' for singular (e.g., "referenda" → "referend")
    if (tableNorm.endsWith('a')) {
      const singular = tableNorm.slice(0, -1);
      if (colNorm === `${singular}id` || colNorm === `${singular}index` || colNorm.startsWith(singular)) return true;
    }

    return false;
  };

  // Strategy 1: Find FK column in source table that matches target table
  const fkColumn1 = sourceColumns.find(col => columnMatchesTable(col.name, targetTable));

  if (fkColumn1) {
    // Most tables use 'id' as PK, except Child Bounties uses 'identifier'
    const targetPK = targetTable === 'Child Bounties' ? 'identifier' : 'id';
    return {
      left: `${sourceTable}.${fkColumn1.name}`,
      right: `${targetTable}.${targetPK}`
    };
  }

  // Strategy 2: Check if target table references source table
  const fkColumn2 = targetColumns.find(col => columnMatchesTable(col.name, sourceTable));

  if (fkColumn2) {
    const sourcePK = sourceTable === 'Child Bounties' ? 'identifier' : 'id';
    return {
      left: `${sourceTable}.${sourcePK}`,
      right: `${targetTable}.${fkColumn2.name}`
    };
  }

  // No obvious FK relationship found
  return null;
}

export function QueryBuilder({
  initialConfig,
  onChange,
}: QueryBuilderProps) {
  const [schema, setSchema] = useState<SchemaInfo>([]);
  const [config, setConfig] = useState<QueryConfig>(initialConfig || defaultConfig);
  const [loading, setLoading] = useState(true);
  const [editingJoinIndices, setEditingJoinIndices] = useState<Set<number>>(new Set());

  // Unified column state for drag-and-drop reordering
  const [unifiedColumns, setUnifiedColumns] = useState<UnifiedColumn[]>(() =>
    toUnifiedColumns(initialConfig?.columns || [], initialConfig?.expressionColumns, initialConfig?.columnOrder)
  );

  // Track if we're in the middle of an initialConfig sync to prevent loops
  const isInitialSyncRef = useRef(false);
  const prevInitialConfigRef = useRef(initialConfig);

  // Sync unified columns when config changes externally (e.g., loading saved config)
  // Only run when initialConfig actually changes (not on every render)
  useEffect(() => {
    if (initialConfig && initialConfig !== prevInitialConfigRef.current) {
      isInitialSyncRef.current = true;
      prevInitialConfigRef.current = initialConfig;
      setUnifiedColumns(toUnifiedColumns(initialConfig.columns || [], initialConfig.expressionColumns, initialConfig.columnOrder));
      // Reset the flag after a microtask to allow the state update to complete
      Promise.resolve().then(() => {
        isInitialSyncRef.current = false;
      });
    }
  }, [initialConfig]);

  // Sync config when unified columns change (but not during initial sync)
  useEffect(() => {
    if (isInitialSyncRef.current) return;
    const { columns, expressionColumns, columnOrder } = fromUnifiedColumns(unifiedColumns);
    setConfig((prev) => ({
      ...prev,
      columns,
      expressionColumns,
      columnOrder,
    }));
  }, [unifiedColumns]);

  // Generate SQL client-side as user builds query
  // Uses unified column order for SELECT clause
  const generatedSql = useMemo(() => {
    if (!config.sourceTable || unifiedColumns.length === 0) return "";

    const selectParts: string[] = [];

    // Process unified columns in display order
    for (const col of unifiedColumns) {
      if (col.type === "regular") {
        const colName = `"${col.column}"`;
        if (col.aggregateFunction) {
          const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
          selectParts.push(`${col.aggregateFunction}(${colName}) AS "${alias}"`);
        } else {
          selectParts.push(col.alias ? `${colName} AS "${col.alias}"` : colName);
        }
      } else {
        // Expression column
        if (col.expression && col.alias) {
          if (col.aggregateFunction) {
            selectParts.push(`${col.aggregateFunction}((${col.expression})) AS "${col.alias}"`);
          } else {
            selectParts.push(`(${col.expression}) AS "${col.alias}"`);
          }
        }
      }
    }

    if (selectParts.length === 0) return "";

    const parts = [`SELECT ${selectParts.join(", ")}`, `FROM "${config.sourceTable}"`];

    // JOIN clauses
    if (config.joins && config.joins.length > 0) {
      for (const join of config.joins) {
        const tableExpr = join.alias ? `"${join.table}" AS "${join.alias}"` : `"${join.table}"`;
        parts.push(`${join.type} JOIN ${tableExpr} ON ${join.on.left} = ${join.on.right}`);
      }
    }

    // WHERE clause - supports both flat arrays and nested FilterGroups
    if (config.filters) {
      const whereClause = buildFilterSQL(config.filters);
      if (whereClause) {
        parts.push(`WHERE ${whereClause}`);
      }
    }

    if (config.groupBy && config.groupBy.length > 0) {
      parts.push(`GROUP BY ${config.groupBy.map((c) => `"${c}"`).join(", ")}`);
    }

    if (config.orderBy && config.orderBy.length > 0) {
      const orderParts = config.orderBy.map((o) => `"${o.column}" ${o.direction}`);
      parts.push(`ORDER BY ${orderParts.join(", ")}`);
    }

    parts.push(`LIMIT 1000`);

    return parts.join("\n");
  }, [config]);

  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [, setColumnNamesLoaded] = useState(false);

  // Fetch schema and column config on mount
  useEffect(() => {
    async function fetchSchemaAndConfig() {
      try {
        // Load both schema and column config in parallel
        const [schemaResponse] = await Promise.all([
          fetch("/api/query/schema"),
          loadColumnConfig(),
        ]);
        setColumnNamesLoaded(true);

        const data = await schemaResponse.json();
        if (!schemaResponse.ok) {
          setSchemaError(data.error || "Failed to load schema");
          return;
        }
        if (!Array.isArray(data)) {
          setSchemaError("Invalid schema response");
          return;
        }
        setSchema(data);
      } catch (error) {
        console.error("Failed to fetch schema:", error);
        setSchemaError("Failed to connect to API");
      } finally {
        setLoading(false);
      }
    }
    fetchSchemaAndConfig();
  }, []);

  // Get columns for selected table
  const selectedTable = schema.find((t) => t.name === config.sourceTable);

  // Build available columns from source table + joined tables
  const availableColumns = useMemo(() => {
    type ColumnWithTable = ColumnInfo & { tableSource: string; fullName: string };
    const columns: ColumnWithTable[] = [];

    // Add source table columns
    if (selectedTable) {
      selectedTable.columns.forEach(col => {
        columns.push({
          ...col,
          tableSource: config.sourceTable,
          fullName: `${config.sourceTable}.${col.name}`,
        });
      });
    }

    // Add joined table columns
    config.joins?.forEach(join => {
      const joinedTable = schema.find(t => t.name === join.table);
      if (joinedTable) {
        const tableRef = join.alias || join.table;
        joinedTable.columns.forEach(col => {
          columns.push({
            ...col,
            tableSource: tableRef,
            fullName: `${tableRef}.${col.name}`,
          });
        });
      }
    });

    return columns;
  }, [selectedTable, config.sourceTable, config.joins, schema]);

  // Extended list of columns including expression column aliases (for filters, group by, order by)
  const availableColumnsWithExpressions = useMemo(() => {
    const exprColumns = unifiedColumns
      .filter((c): c is UnifiedColumn & { type: "expression" } => c.type === "expression")
      .filter((c) => c.alias) // Only include those with aliases
      .map((c) => ({
        name: c.alias,
        fullName: c.alias,
        type: "expression" as const,
        tableSource: "expression",
        isExpression: true,
      }));

    return [
      ...availableColumns.map((c) => ({ ...c, isExpression: false })),
      ...exprColumns,
    ];
  }, [availableColumns, unifiedColumns]);

  // Helper to get display name for current table
  const displayName = useCallback(
    (columnName: string) => getColumnDisplayName(config.sourceTable, columnName),
    [config.sourceTable]
  );

  // Update parent when config changes
  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  const updateConfig = useCallback((updates: Partial<QueryConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleFilterUpdate = useCallback((group: FilterGroup) => {
    updateConfig({ filters: group });
  }, [updateConfig]);

  function handleTableChange(tableName: string) {
    // Reset columns, joins, and filters when table changes
    setUnifiedColumns([]);
    updateConfig({
      sourceTable: tableName,
      columns: [],
      expressionColumns: [],
      joins: [],
      filters: [],
      groupBy: [],
      orderBy: [],
    });
  }

  function toggleColumn(column: ColumnInfo & { fullName: string }, checked: boolean) {
    if (checked) {
      // Add column via unified state
      setUnifiedColumns((prev) => [
        ...prev,
        { type: "regular", column: column.fullName },
      ]);
    } else {
      // Remove column via unified state
      setUnifiedColumns((prev) =>
        prev.filter((c) => !(c.type === "regular" && c.column === column.fullName))
      );
    }
  }

  function toggleAllColumnsFromTable(columns: (ColumnInfo & { fullName: string })[], selectAll: boolean) {
    if (selectAll) {
      // Add all columns from this table that aren't already selected
      const existingCols = new Set(
        unifiedColumns
          .filter((c): c is UnifiedColumn & { type: "regular" } => c.type === "regular")
          .map((c) => c.column)
      );
      const newColumns: UnifiedColumn[] = columns
        .filter((col) => !existingCols.has(col.fullName))
        .map((col) => ({ type: "regular", column: col.fullName }));

      setUnifiedColumns((prev) => [...prev, ...newColumns]);
    } else {
      // Remove all columns from this table
      const columnNamesToRemove = new Set(columns.map((col) => col.fullName));
      setUnifiedColumns((prev) =>
        prev.filter((c) => !(c.type === "regular" && columnNamesToRemove.has(c.column)))
      );
    }
  }

  // Update a unified column (used by SortableColumnItem)
  const updateUnifiedColumn = useCallback((id: string, updates: Partial<UnifiedColumn>) => {
    setUnifiedColumns((prev) =>
      prev.map((col) => {
        if (getColumnId(col) === id) {
          return { ...col, ...updates } as UnifiedColumn;
        }
        return col;
      })
    );
  }, []);

  function addJoin() {
    if (schema.length === 0) return;
    const firstTable = schema.find(t => t.name !== config.sourceTable);
    if (!firstTable) return;

    // Detect join condition automatically
    const sourceColumns = selectedTable?.columns || [];
    const targetColumns = firstTable.columns;
    const detectedCondition = detectJoinCondition(
      config.sourceTable,
      sourceColumns,
      firstTable.name,
      targetColumns
    );

    const newJoinIndex = config.joins?.length || 0;

    updateConfig({
      joins: [
        ...(config.joins || []),
        {
          type: "LEFT",
          table: firstTable.name,
          on: detectedCondition || { left: "", right: "" }, // fallback to empty if no FK found
          isManual: !detectedCondition, // Mark as manual if auto-detection failed
        },
      ],
    });

    // Auto-enter edit mode if detection failed
    if (!detectedCondition) {
      setEditingJoinIndices(prev => new Set([...prev, newJoinIndex]));
    }
  }

  function updateJoin(index: number, updates: Partial<JoinConfig>) {
    const updatedJoins = [...(config.joins || [])];
    const currentJoin = updatedJoins[index];

    // If table is being changed, auto-detect join condition and reset isManual
    if (updates.table && updates.table !== currentJoin.table) {
      const sourceColumns = selectedTable?.columns || [];
      const targetTable = schema.find(t => t.name === updates.table);
      if (targetTable) {
        const detectedCondition = detectJoinCondition(
          config.sourceTable,
          sourceColumns,
          updates.table,
          targetTable.columns
        );

        if (detectedCondition) {
          updates.on = detectedCondition; // auto-fill the condition
          updates.isManual = false; // reset manual flag since we auto-detected
          // Exit edit mode since we auto-detected
          setEditingJoinIndices(prev => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        } else {
          // No auto-detection, enter edit mode
          updates.on = { left: "", right: "" };
          updates.isManual = true;
          setEditingJoinIndices(prev => new Set([...prev, index]));
        }
      }
      // Clear alias when table changes
      updates.alias = undefined;
    }

    // If alias is being changed, update right side of condition if it referenced old alias
    if (updates.alias !== undefined && updates.alias !== currentJoin.alias) {
      const oldRef = currentJoin.alias || currentJoin.table;
      const newRef = updates.alias || currentJoin.table;
      if (currentJoin.on.right.startsWith(`${oldRef}.`)) {
        const columnName = currentJoin.on.right.substring(oldRef.length + 1);
        updates.on = {
          left: currentJoin.on.left,
          right: `${newRef}.${columnName}`,
        };
      }
    }

    // If condition is being manually updated, set isManual flag
    if (updates.on && !updates.hasOwnProperty('isManual')) {
      updates.isManual = true;
    }

    updatedJoins[index] = { ...currentJoin, ...updates };
    updateConfig({ joins: updatedJoins });
  }

  function removeJoin(index: number) {
    const removedJoin = config.joins?.[index];
    if (!removedJoin) return;

    // Get the table name (use alias if present, otherwise use table name)
    const tableName = removedJoin.alias || removedJoin.table;

    // Remove columns from the deleted joined table
    const updatedColumns = config.columns.filter(
      (c) => !c.column.startsWith(`${tableName}.`)
    );

    // Remove filters referencing the deleted table (handles both array and FilterGroup)
    const updatedFilters = filterOutTableReferences(config.filters, tableName);

    // Remove order by clauses referencing the deleted table
    const updatedOrderBy = config.orderBy?.filter(
      (o) => !o.column.startsWith(`${tableName}.`)
    );

    // Remove group by clauses referencing the deleted table
    const updatedGroupBy = config.groupBy?.filter(
      (g) => !g.startsWith(`${tableName}.`)
    );

    updateConfig({
      joins: config.joins?.filter((_, i) => i !== index),
      columns: updatedColumns,
      filters: updatedFilters,
      orderBy: updatedOrderBy,
      groupBy: updatedGroupBy,
    });
  }

  function toggleGroupBy(column: string, checked: boolean) {
    if (checked) {
      updateConfig({
        groupBy: [...(config.groupBy || []), column],
      });
    } else {
      updateConfig({
        groupBy: config.groupBy?.filter((c) => c !== column),
      });
    }
  }

  function addOrderBy() {
    if (availableColumnsWithExpressions.length === 0) return;
    updateConfig({
      orderBy: [
        ...(config.orderBy || []),
        { column: availableColumnsWithExpressions[0].fullName, direction: "ASC" },
      ],
    });
  }

  function updateOrderBy(index: number, updates: Partial<OrderByConfig>) {
    updateConfig({
      orderBy: config.orderBy?.map((o, i) =>
        i === index ? { ...o, ...updates } : o
      ),
    });
  }

  function removeOrderBy(index: number) {
    updateConfig({
      orderBy: config.orderBy?.filter((_, i) => i !== index),
    });
  }

  // Expression column handlers
  function addExpressionColumn() {
    const exprCount = unifiedColumns.filter((c) => c.type === "expression").length;
    const newExpr: UnifiedColumn = {
      type: "expression",
      expression: "",
      alias: `expr_${exprCount + 1}`,
    };
    setUnifiedColumns((prev) => [...prev, newExpr]);
  }

  function removeExpressionColumn(alias: string) {
    setUnifiedColumns((prev) =>
      prev.filter((c) => !(c.type === "expression" && c.alias === alias))
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = unifiedColumns.findIndex((c) => getColumnId(c) === active.id);
      const newIndex = unifiedColumns.findIndex((c) => getColumnId(c) === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setUnifiedColumns((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  }

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading schema...</div>;
  }

  if (schemaError) {
    return (
      <div className="p-4 text-red-500">
        <p className="font-medium">Error loading schema</p>
        <p className="text-sm mt-1">{schemaError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table Selection */}
      <div className="space-y-2">
        <Label>Source Table</Label>
        <Select value={config.sourceTable} onValueChange={handleTableChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a table" />
          </SelectTrigger>
          <SelectContent>
            {[...schema]
              .sort((a, b) => {
                // Put all_spending first
                if (a.name === "all_spending") return -1;
                if (b.name === "all_spending") return 1;
                return a.name.localeCompare(b.name);
              })
              .map((table) => (
              <SelectItem key={table.name} value={table.name}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* JOINs */}
      {config.sourceTable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Joins</Label>
            <Button variant="outline" size="sm" onClick={addJoin}>
              <Plus className="h-4 w-4 mr-1" /> Add Join
            </Button>
          </div>
          {(config.joins?.length ?? 0) > 0 && (
            <div className="rounded-md border p-4 space-y-4">
              {config.joins?.map((join, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded bg-muted/20">
                    {/* Join Type */}
                    <Select
                      value={join.type}
                      onValueChange={(v) => updateJoin(index, { type: v as JoinConfig["type"] })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOIN_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <span className="text-sm text-muted-foreground">JOIN</span>

                    {/* Table */}
                    <Select
                      value={join.table}
                      onValueChange={(v) => updateJoin(index, { table: v })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {schema
                          .filter(t => t.name !== config.sourceTable)
                          .map((table) => (
                            <SelectItem key={table.name} value={table.name}>
                              {table.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {/* Alias (optional) */}
                    <Input
                      className="w-20"
                      placeholder="alias"
                      value={join.alias || ""}
                      onChange={(e) => updateJoin(index, { alias: e.target.value || undefined })}
                    />

                    {/* Join condition - editable */}
                    {editingJoinIndices.has(index) ? (
                      // Edit mode: two dropdowns
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-xs text-muted-foreground">ON</span>
                        <Select
                          value={join.on.left || ""}
                          onValueChange={(v) => {
                            updateJoin(index, {
                              on: { left: v, right: join.on.right },
                              isManual: true,
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                            <SelectValue placeholder="left column" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Source table columns */}
                            {selectedTable?.columns.map((col) => (
                              <SelectItem key={`${config.sourceTable}.${col.name}`} value={`${config.sourceTable}.${col.name}`}>
                                {col.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">=</span>
                        <Select
                          value={join.on.right || ""}
                          onValueChange={(v) => {
                            updateJoin(index, {
                              on: { left: join.on.left, right: v },
                              isManual: true,
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                            <SelectValue placeholder="right column" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Target table columns (use alias if set) */}
                            {(() => {
                              const targetTable = schema.find(t => t.name === join.table);
                              const tableRef = join.alias || join.table;
                              return targetTable?.columns.map((col) => (
                                <SelectItem key={`${tableRef}.${col.name}`} value={`${tableRef}.${col.name}`}>
                                  {col.name}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingJoinIndices(prev => {
                              const next = new Set(prev);
                              next.delete(index);
                              return next;
                            });
                          }}
                          title="Done editing"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      // Compact mode: show condition with edit button
                      <div className="flex items-center gap-1 flex-1">
                        <span title={join.isManual ? "Manually configured" : "Auto-detected"}>
                          {join.isManual ? (
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          ) : (
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                        <span className={`text-xs flex-1 ${(!join.on.left || !join.on.right) ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          ON {join.on.left || '?'} = {join.on.right || '?'}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingJoinIndices(prev => new Set([...prev, index]));
                          }}
                          title="Edit join condition"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeJoin(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Column Selection */}
      {config.sourceTable && (
        <div className="space-y-4">
          {/* Available Columns - checkbox list grouped by table */}
          <div className="space-y-2">
            <Label>Available Columns</Label>
            <div className="rounded-md border p-4 max-h-48 overflow-y-auto space-y-4">
              {(() => {
                // Group columns by table
                const columnsByTable = new Map<string, typeof availableColumns>();
                availableColumns.forEach(col => {
                  const existing = columnsByTable.get(col.tableSource) || [];
                  columnsByTable.set(col.tableSource, [...existing, col]);
                });

                return Array.from(columnsByTable.entries()).map(([tableName, columns]) => {
                  const allSelected = columns.every(col =>
                    config.columns.some(c => c.column === col.fullName)
                  );
                  const someSelected = columns.some(col =>
                    config.columns.some(c => c.column === col.fullName)
                  );

                  return (
                  <div key={tableName}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {tableName}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAllColumnsFromTable(columns, !allSelected)}
                        className="text-xs text-primary hover:underline"
                      >
                        {allSelected ? "Deselect All" : someSelected ? "Select All" : "Select All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {columns.map((column) => {
                        const isSelected = config.columns.some(
                          (c) => c.column === column.fullName
                        );
                        return (
                          <div key={column.fullName} className="flex items-center gap-2">
                            <Checkbox
                              id={`col-${column.fullName}`}
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                toggleColumn(column, checked === true)
                              }
                            />
                            <label
                              htmlFor={`col-${column.fullName}`}
                              className="text-sm cursor-pointer truncate"
                              title={column.fullName}
                            >
                              {column.name}
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({column.type})
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Columns - unified sortable list with both regular and expression columns */}
          {unifiedColumns.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Columns</Label>
                <Button variant="outline" size="sm" onClick={addExpressionColumn}>
                  <Plus className="h-4 w-4 mr-1" /> Add Expression
                </Button>
              </div>
              <div className="rounded-md border p-4">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={unifiedColumns.map((c) => getColumnId(c))}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {unifiedColumns.map((col) => (
                        <SortableColumnItem
                          key={getColumnId(col)}
                          column={col}
                          displayName={col.type === "regular" ? displayName(col.column) : col.alias}
                          onUpdate={(updates) => updateUnifiedColumn(getColumnId(col), updates)}
                          onRemove={
                          col.type === "expression"
                            ? () => removeExpressionColumn(col.alias)
                            : () => setUnifiedColumns((prev) =>
                                prev.filter((c) => !(c.type === "regular" && c.column === col.column))
                              )
                        }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {/* Show Add Expression button when no columns selected yet */}
          {unifiedColumns.length === 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addExpressionColumn}>
                <Plus className="h-4 w-4 mr-1" /> Add Expression
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {config.sourceTable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filters</Label>
          </div>
          {availableColumnsWithExpressions.length > 0 && (
            <div className="rounded-md border p-4">
              <FilterGroupBuilder
                group={ensureFilterGroup(config.filters)}
                availableColumns={availableColumnsWithExpressions.map(col => ({
                  id: col.fullName,
                  name: col.isExpression ? `${col.fullName} (expression)` : col.fullName
                }))}
                onUpdate={handleFilterUpdate}
                sourceTable={config.sourceTable}
              />
            </div>
          )}
        </div>
      )}

      {/* Group By */}
      {config.sourceTable && unifiedColumns.some((c) => c.aggregateFunction) && (
        <div className="space-y-2">
          <Label>Group By</Label>
          <div className="rounded-md border p-4">
            <div className="flex flex-wrap gap-4">
              {/* Regular columns without aggregate functions */}
              {unifiedColumns
                .filter((c): c is UnifiedColumn & { type: "regular" } => c.type === "regular" && !c.aggregateFunction)
                .map((col) => (
                  <div key={col.column} className="flex items-center gap-2">
                    <Checkbox
                      id={`groupby-${col.column}`}
                      checked={config.groupBy?.includes(col.column)}
                      onCheckedChange={(checked) =>
                        toggleGroupBy(col.column, checked === true)
                      }
                    />
                    <label
                      htmlFor={`groupby-${col.column}`}
                      className="text-sm cursor-pointer"
                      title={col.column}
                    >
                      {displayName(col.column)}
                    </label>
                  </div>
                ))}
              {/* Expression columns */}
              {unifiedColumns
                .filter((c): c is UnifiedColumn & { type: "expression" } => c.type === "expression" && !!c.alias)
                .map((col) => (
                  <div key={`expr-${col.alias}`} className="flex items-center gap-2">
                    <Checkbox
                      id={`groupby-expr-${col.alias}`}
                      checked={config.groupBy?.includes(col.alias)}
                      onCheckedChange={(checked) =>
                        toggleGroupBy(col.alias, checked === true)
                      }
                    />
                    <label
                      htmlFor={`groupby-expr-${col.alias}`}
                      className="text-sm cursor-pointer text-muted-foreground"
                      title={`Expression: ${col.expression}`}
                    >
                      {col.alias}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Order By */}
      {config.sourceTable && unifiedColumns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Order By</Label>
            <Button variant="outline" size="sm" onClick={addOrderBy}>
              <Plus className="h-4 w-4 mr-1" /> Add Sort
            </Button>
          </div>
          {(config.orderBy?.length ?? 0) > 0 && (
            <div className="rounded-md border p-4 space-y-3">
              {config.orderBy?.map((order, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={order.column}
                    onValueChange={(v) => updateOrderBy(index, { column: v })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumnsWithExpressions.map((col) => (
                        <SelectItem key={col.fullName} value={col.fullName}>
                          {col.isExpression ? `${col.fullName} (expression)` : col.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={order.direction}
                    onValueChange={(v) =>
                      updateOrderBy(index, {
                        direction: v as OrderByConfig["direction"],
                      })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASC">Ascending</SelectItem>
                      <SelectItem value="DESC">Descending</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOrderBy(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SQL Display - always visible when query is being built */}
      {generatedSql && (
        <div className="space-y-2 pt-4 border-t">
          <Label className="text-muted-foreground">Generated SQL</Label>
          <div className="rounded-md border bg-muted p-4">
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{generatedSql}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
