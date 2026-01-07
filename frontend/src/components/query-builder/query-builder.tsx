"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Plus, Trash2, Play } from "lucide-react";
import { SortableColumn } from "./sortable-column";
import {
  loadColumnConfig,
  getColumnDisplayName,
} from "@/lib/column-renderer";
import type {
  QueryConfig,
  ColumnSelection,
  FilterCondition,
  OrderByConfig,
} from "@/lib/db/types";
import type { SchemaInfo, ColumnInfo } from "./types";

interface QueryBuilderProps {
  initialConfig?: QueryConfig;
  onChange: (config: QueryConfig) => void;
  onPreview?: (results: unknown[], sql: string) => void;
}

const AGGREGATE_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX"] as const;
const FILTER_OPERATORS = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "IS NULL",
  "IS NOT NULL",
] as const;

const defaultConfig: QueryConfig = {
  sourceTable: "",
  columns: [],
  filters: [],
  groupBy: [],
  orderBy: [],
  limit: 1000,
};

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
    if (!config.sourceTable || config.columns.length === 0) return "";

    const selectParts = config.columns.map((col) => {
      const colName = `"${col.column}"`;
      if (col.aggregateFunction) {
        const alias = col.alias || `${col.aggregateFunction.toLowerCase()}_${col.column.replace(/[.\s]/g, "_")}`;
        return `${col.aggregateFunction}(${colName}) AS "${alias}"`;
      }
      return col.alias ? `${colName} AS "${col.alias}"` : colName;
    });

    const parts = [`SELECT ${selectParts.join(", ")}`, `FROM "${config.sourceTable}"`];

    if (config.filters && config.filters.length > 0) {
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

    parts.push(`LIMIT ${config.limit || 1000}`);

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
  const availableColumns = selectedTable?.columns || [];

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
    // Reset columns and filters when table changes
    updateConfig({
      sourceTable: tableName,
      columns: [],
      filters: [],
      groupBy: [],
      orderBy: [],
    });
  }

  function toggleColumn(column: ColumnInfo, checked: boolean) {
    if (checked) {
      updateConfig({
        columns: [...config.columns, { column: column.name }],
      });
    } else {
      updateConfig({
        columns: config.columns.filter((c) => c.column !== column.name),
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

  function addFilter() {
    if (availableColumns.length === 0) return;
    updateConfig({
      filters: [
        ...config.filters,
        { column: availableColumns[0].name, operator: "=", value: "" },
      ],
    });
  }

  function updateFilter(index: number, updates: Partial<FilterCondition>) {
    updateConfig({
      filters: config.filters.map((f, i) =>
        i === index ? { ...f, ...updates } : f
      ),
    });
  }

  function removeFilter(index: number) {
    updateConfig({
      filters: config.filters.filter((_, i) => i !== index),
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
    if (config.columns.length === 0) return;
    updateConfig({
      orderBy: [
        ...(config.orderBy || []),
        { column: config.columns[0].column, direction: "ASC" },
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
    if (config.columns.length === 0 || !config.sourceTable) {
      setPreviewError("Please select a table and at least one column");
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

      {/* Column Selection */}
      {config.sourceTable && (
        <div className="space-y-4">
          {/* Available Columns - checkbox list */}
          <div className="space-y-2">
            <Label>Available Columns</Label>
            <div className="rounded-md border p-4 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {availableColumns.map((column) => {
                  const isSelected = config.columns.some(
                    (c) => c.column === column.name
                  );
                  return (
                    <div key={column.name} className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${column.name}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleColumn(column, checked === true)
                        }
                      />
                      <label
                        htmlFor={`col-${column.name}`}
                        className="text-sm cursor-pointer truncate"
                        title={column.name}
                      >
                        {displayName(column.name)}
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({column.type})
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
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

      {/* Filters */}
      {config.sourceTable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Filters</Label>
            <Button variant="outline" size="sm" onClick={addFilter}>
              <Plus className="h-4 w-4 mr-1" /> Add Filter
            </Button>
          </div>
          {config.filters.length > 0 && (
            <div className="rounded-md border p-4 space-y-3">
              {config.filters.map((filter, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={filter.column}
                    onValueChange={(v) => updateFilter(index, { column: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {displayName(col.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={(v) =>
                      updateFilter(index, {
                        operator: v as FilterCondition["operator"],
                      })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPERATORS.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {filter.operator !== "IS NULL" &&
                    filter.operator !== "IS NOT NULL" && (
                      <Input
                        className="flex-1"
                        placeholder="Value"
                        value={filter.value?.toString() || ""}
                        onChange={(e) =>
                          updateFilter(index, { value: e.target.value })
                        }
                      />
                    )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilter(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
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
                      {config.columns.map((col) => (
                        <SelectItem key={col.column} value={col.column}>
                          {displayName(col.column)}
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

      {/* Limit */}
      {config.sourceTable && (
        <div className="space-y-2">
          <Label>Row Limit</Label>
          <Input
            type="number"
            className="w-32"
            value={config.limit || 1000}
            onChange={(e) =>
              updateConfig({ limit: parseInt(e.target.value) || 1000 })
            }
            min={1}
            max={10000}
          />
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
