"use client";

import { useState, useEffect } from "react";
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
import { Plus, Trash2, Play, Code } from "lucide-react";
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
  const [showSql, setShowSql] = useState(false);
  const [generatedSql, setGeneratedSql] = useState<string>("");

  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Fetch schema on mount
  useEffect(() => {
    async function fetchSchema() {
      try {
        const response = await fetch("/api/query/schema");
        const data = await response.json();
        if (!response.ok) {
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
    fetchSchema();
  }, []);

  // Get columns for selected table
  const selectedTable = schema.find((t) => t.name === config.sourceTable);
  const availableColumns = selectedTable?.columns || [];

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

      setGeneratedSql(data.sql);
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
            {schema.map((table) => (
              <SelectItem key={table.name} value={table.name}>
                {table.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Column Selection */}
      {config.sourceTable && (
        <div className="space-y-2">
          <Label>Columns</Label>
          <div className="rounded-md border p-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {availableColumns.map((column) => {
                const isSelected = config.columns.some(
                  (c) => c.column === column.name
                );
                const selectedColumn = config.columns.find(
                  (c) => c.column === column.name
                );
                return (
                  <div
                    key={column.name}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`col-${column.name}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleColumn(column, checked === true)
                        }
                      />
                      <label
                        htmlFor={`col-${column.name}`}
                        className="text-sm cursor-pointer"
                      >
                        {column.name}
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({column.type})
                        </span>
                      </label>
                    </div>
                    {isSelected && (
                      <Select
                        value={selectedColumn?.aggregateFunction || "none"}
                        onValueChange={(v) =>
                          updateColumnAggregation(
                            column.name,
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
                          {col.name}
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
                    >
                      {col.column}
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
                          {col.column}
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

      {/* Preview Button and SQL */}
      {config.sourceTable && config.columns.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePreview}
              disabled={previewLoading}
            >
              <Play className="h-4 w-4 mr-2" />
              {previewLoading ? "Running..." : "Preview Results"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSql(!showSql)}
            >
              <Code className="h-4 w-4 mr-2" />
              {showSql ? "Hide SQL" : "Show SQL"}
            </Button>
          </div>

          {previewError && (
            <div className="text-sm text-red-500">{previewError}</div>
          )}

          {showSql && generatedSql && (
            <div className="rounded-md border bg-muted p-4">
              <pre className="text-xs overflow-x-auto">{generatedSql}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
