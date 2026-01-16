"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Play } from "lucide-react";
import { SortableColumn } from "./sortable-column";
import {
  loadColumnConfig,
  getColumnDisplayName,
} from "@/lib/column-renderer";
import type {
  QueryConfig,
  ColumnSelection,
  OrderByConfig,
  ExpressionColumn,
  JoinConfig,
} from "@/lib/db/types";
import type { SchemaInfo, ColumnInfo } from "./types";
import { FilterGroupBuilder } from "@/components/data-table/filter-group-builder";
import { filtersToGroup, groupToFilters } from "@/lib/query-config-utils";

interface QueryBuilderProps {
  initialConfig?: QueryConfig;
  onChange: (config: QueryConfig) => void;
  onPreview?: (results: unknown[], sql: string) => void;
}

const AGGREGATE_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX"] as const;
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
  onPreview,
}: QueryBuilderProps) {
  const [schema, setSchema] = useState<SchemaInfo>([]);
  const [config, setConfig] = useState<QueryConfig>(initialConfig || defaultConfig);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Generate SQL client-side as user builds query
  const generatedSql = useMemo(() => {
    const hasColumns = config.columns.length > 0;
    const hasExpressions = (config.expressionColumns?.length ?? 0) > 0;
    if (!config.sourceTable || (!hasColumns && !hasExpressions)) return "";

    const selectParts: string[] = [];

    // Regular columns
    for (const col of config.columns) {
      const colName = `"${col.column}"`;
      if (col.aggregateFunction) {
        const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
        selectParts.push(`${col.aggregateFunction}(${colName}) AS "${alias}"`);
      } else {
        selectParts.push(col.alias ? `${colName} AS "${col.alias}"` : colName);
      }
    }

    // Expression columns
    for (const expr of config.expressionColumns || []) {
      if (expr.expression && expr.alias) {
        selectParts.push(`(${expr.expression}) AS "${expr.alias}"`);
      }
    }

    const parts = [`SELECT ${selectParts.join(", ")}`, `FROM "${config.sourceTable}"`];

    // JOIN clauses
    if (config.joins && config.joins.length > 0) {
      for (const join of config.joins) {
        const tableExpr = join.alias ? `"${join.table}" AS "${join.alias}"` : `"${join.table}"`;
        parts.push(`${join.type} JOIN ${tableExpr} ON ${join.on.left} = ${join.on.right}`);
      }
    }

    if (config.filters && Array.isArray(config.filters) && config.filters.length > 0) {
      const conditions = config.filters.map((f) => {
        const colName = `"${f.column}"`;
        if (f.operator === "IS NULL" || f.operator === "IS NOT NULL") {
          return `${colName} ${f.operator}`;
        }
        return `${colName} ${f.operator} '${f.value}'`;
      });
      parts.push(`WHERE ${conditions.join(" AND ")}`);
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

  // Helper to get display name for current table
  const displayName = useCallback(
    (columnName: string) => getColumnDisplayName(config.sourceTable, columnName),
    [config.sourceTable]
  );

  // Update parent when config changes
  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  function updateConfig(updates: Partial<QueryConfig>) {
    setConfig((prev) => ({ ...prev, ...updates }));
  }

  function handleTableChange(tableName: string) {
    // Reset columns, joins, and filters when table changes
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
      updateConfig({
        columns: [...config.columns, { column: column.fullName }],
      });
    } else {
      updateConfig({
        columns: config.columns.filter((c) => c.column !== column.fullName),
      });
    }
  }

  function toggleAllColumnsFromTable(columns: (ColumnInfo & { fullName: string })[], selectAll: boolean) {
    if (selectAll) {
      // Add all columns from this table that aren't already selected
      const newColumns = columns.filter(
        col => !config.columns.some(c => c.column === col.fullName)
      ).map(col => ({ column: col.fullName }));

      updateConfig({
        columns: [...config.columns, ...newColumns],
      });
    } else {
      // Remove all columns from this table
      const columnNamesToRemove = new Set(columns.map(col => col.fullName));
      updateConfig({
        columns: config.columns.filter((c) => !columnNamesToRemove.has(c.column)),
      });
    }
  }

  function updateColumnAggregation(
    columnName: string,
    aggregateFunction: ColumnSelection["aggregateFunction"] | undefined
  ) {
    updateConfig({
      columns: config.columns.map((c) =>
        c.column === columnName ? { ...c, aggregateFunction } : c
      ),
    });
  }

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

    updateConfig({
      joins: [
        ...(config.joins || []),
        {
          type: "LEFT",
          table: firstTable.name,
          on: detectedCondition || { left: "", right: "" }, // fallback to empty if no FK found
        },
      ],
    });
  }

  function updateJoin(index: number, updates: Partial<JoinConfig>) {
    const updatedJoins = [...(config.joins || [])];
    const currentJoin = updatedJoins[index];

    // If table is being changed, auto-detect join condition
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
        }
      }
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

    // Remove filters referencing the deleted table
    const updatedFilters = Array.isArray(config.filters)
      ? config.filters.filter((f) => !f.column.startsWith(`${tableName}.`))
      : config.filters;

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
    if (availableColumns.length === 0) return;
    updateConfig({
      orderBy: [
        ...(config.orderBy || []),
        { column: availableColumns[0].fullName, direction: "ASC" },
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
    const newExpr: ExpressionColumn = {
      expression: "",
      alias: `expr_${(config.expressionColumns?.length ?? 0) + 1}`,
    };
    updateConfig({
      expressionColumns: [...(config.expressionColumns || []), newExpr],
    });
  }

  function updateExpressionColumn(index: number, updates: Partial<ExpressionColumn>) {
    updateConfig({
      expressionColumns: config.expressionColumns?.map((e, i) =>
        i === index ? { ...e, ...updates } : e
      ),
    });
  }

  function removeExpressionColumn(index: number) {
    updateConfig({
      expressionColumns: config.expressionColumns?.filter((_, i) => i !== index),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = config.columns.findIndex((c) => c.column === active.id);
      const newIndex = config.columns.findIndex((c) => c.column === over.id);
      updateConfig({
        columns: arrayMove(config.columns, oldIndex, newIndex),
      });
    }
  }

  async function handlePreview() {
    const hasColumns = config.columns.length > 0;
    const hasExpressions = (config.expressionColumns?.length ?? 0) > 0;
    if ((!hasColumns && !hasExpressions) || !config.sourceTable) {
      setPreviewError("Please select a table and at least one column or expression");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, limit: 100 }), // Limit preview to 100 rows
      });

      const data = await response.json();

      if (!response.ok) {
        setPreviewError(data.error || "Query failed");
        return;
      }

      onPreview?.(data.data, data.sql);
    } catch (error) {
      setPreviewError("Failed to execute query");
      console.error(error);
    } finally {
      setPreviewLoading(false);
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

                    {/* Auto-detected join condition (read-only) */}
                    <span className="text-xs text-muted-foreground flex-1">
                      ON {join.on.left || '?'} = {join.on.right || '?'}
                    </span>

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

          {/* Selected Columns - sortable list */}
          {config.columns.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Columns (drag to reorder)</Label>
              <div className="rounded-md border p-4">
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={config.columns.map((c) => c.column)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {config.columns.map((col) => (
                        <SortableColumn key={col.column} id={col.column}>
                          <div className="flex items-center justify-between gap-4 flex-1">
                            <span className="text-sm" title={col.column}>
                              {displayName(col.column)}
                            </span>
                            <Select
                              value={col.aggregateFunction || "none"}
                              onValueChange={(v) =>
                                updateColumnAggregation(
                                  col.column,
                                  v === "none" ? undefined : (v as ColumnSelection["aggregateFunction"])
                                )
                              }
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue placeholder="Aggregate" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Raw</SelectItem>
                                {AGGREGATE_FUNCTIONS.map((fn) => (
                                  <SelectItem key={fn} value={fn}>
                                    {fn}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </SortableColumn>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calculated Columns (Expression Columns) */}
      {config.sourceTable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Calculated Columns</Label>
            <Button variant="outline" size="sm" onClick={addExpressionColumn}>
              <Plus className="h-4 w-4 mr-1" /> Add Expression
            </Button>
          </div>
          {(config.expressionColumns?.length ?? 0) > 0 && (
            <div className="rounded-md border p-4 space-y-4">
              {config.expressionColumns?.map((expr, index) => (
                <div key={index} className="space-y-2 p-3 border rounded bg-muted/20">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Alias (column name)</Label>
                      <Input
                        value={expr.alias}
                        onChange={(e) => updateExpressionColumn(index, {
                          alias: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_")
                        })}
                        placeholder="my_calculated_column"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExpressionColumn(index)}
                      className="mt-5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Expression</Label>
                    <Textarea
                      value={expr.expression}
                      onChange={(e) => updateExpressionColumn(index, { expression: e.target.value })}
                      placeholder="DOT_latest * 10"
                      className="font-mono text-sm min-h-[60px]"
                    />
                  </div>

                  {/* Available columns hint */}
                  <div className="text-xs text-muted-foreground">
                    Available columns: {availableColumns.slice(0, 5).map(c => c.name).join(", ")}
                    {availableColumns.length > 5 && `, ... (+${availableColumns.length - 5} more)`}
                  </div>
                </div>
              ))}
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
          {availableColumns.length > 0 && (
            <div className="rounded-md border p-4">
              <FilterGroupBuilder
                group={filtersToGroup(
                  Array.isArray(config.filters) ? config.filters : []
                )}
                availableColumns={availableColumns.map(col => ({
                  id: col.fullName,
                  name: col.fullName
                }))}
                onUpdate={(group) => {
                  updateConfig({ filters: groupToFilters(group) });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Group By */}
      {config.sourceTable && config.columns.some((c) => c.aggregateFunction) && (
        <div className="space-y-2">
          <Label>Group By</Label>
          <div className="rounded-md border p-4">
            <div className="flex flex-wrap gap-4">
              {config.columns
                .filter((c) => !c.aggregateFunction)
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
            </div>
          </div>
        </div>
      )}

      {/* Order By */}
      {config.sourceTable && config.columns.length > 0 && (
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
                      {availableColumns.map((col) => (
                        <SelectItem key={col.fullName} value={col.fullName}>
                          {col.fullName}
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
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Generated SQL</Label>
            <div className="rounded-md border bg-muted p-4">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{generatedSql}</pre>
            </div>
          </div>

          {previewError && (
            <div className="text-sm text-red-500">{previewError}</div>
          )}

          <Button
            onClick={handlePreview}
            disabled={previewLoading}
          >
            <Play className="h-4 w-4 mr-2" />
            {previewLoading ? "Running..." : "Preview Results"}
          </Button>
        </div>
      )}
    </div>
  );
}
