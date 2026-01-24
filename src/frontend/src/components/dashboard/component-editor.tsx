"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Markdown from "react-markdown";
import Play from "lucide-react/dist/esm/icons/play";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { validateQueryConfig, hasInvalidQueryConfig } from "@/lib/query-config-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryBuilder } from "@/components/query-builder";
import {
  DashboardDataTable,
  DashboardPieChart,
  DashboardBarChart,
  DashboardLineChart,
  transformToPieData,
  transformToBarData,
  transformToLineData,
} from "@/components/charts";
import type {
  DashboardComponent,
  DashboardComponentType,
  QueryConfig,
  ChartConfig,
  GridConfig,
} from "@/lib/db/types";

interface ComponentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  component?: DashboardComponent | null;
  dashboardId: number;
  onSave: (component: {
    id?: number;
    dashboard_id: number;
    name: string;
    type: DashboardComponentType;
    query_config: QueryConfig;
    grid_config: GridConfig;
    chart_config: ChartConfig;
  }) => void;
}

const COMPONENT_TYPES: { value: DashboardComponentType; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "pie", label: "Pie Chart" },
  { value: "bar_grouped", label: "Bar Chart (Grouped)" },
  { value: "bar_stacked", label: "Bar Chart (Stacked)" },
  { value: "line", label: "Line Chart" },
  { value: "text", label: "Text (Markdown)" },
];

const defaultQueryConfig: QueryConfig = {
  sourceTable: "",
  columns: [],
  filters: [],
  groupBy: [],
  orderBy: [],
  limit: 1000,
};

const defaultGridConfig: GridConfig = {
  x: 0,
  y: 0,
  w: 6,
  h: 4,
};

const defaultChartConfig: ChartConfig = {
  showLegend: true,
  showTooltip: true,
};

export function ComponentEditor({
  open,
  onOpenChange,
  component,
  dashboardId,
  onSave,
}: ComponentEditorProps) {
  const [name, setName] = useState(component?.name || "");
  const [type, setType] = useState<DashboardComponentType>(
    component?.type || "table"
  );
  const [queryConfig, setQueryConfig] = useState<QueryConfig>(
    component ? JSON.parse(component.query_config) : defaultQueryConfig
  );
  const [chartConfig, setChartConfig] = useState<ChartConfig>(
    component?.chart_config
      ? JSON.parse(component.chart_config)
      : defaultChartConfig
  );
  const [gridConfig, setGridConfig] = useState<GridConfig>(
    component ? JSON.parse(component.grid_config) : defaultGridConfig
  );
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Detect invalid query configuration entries using shared validation
  const queryConfigValidation = useMemo(
    () => validateQueryConfig(queryConfig),
    [queryConfig.columns, queryConfig.expressionColumns, queryConfig.groupBy, queryConfig.orderBy]
  );

  const hasInvalidConfig = hasInvalidQueryConfig(queryConfigValidation);

  // Reset state when dialog opens or component changes
  useEffect(() => {
    if (open) {
      setName(component?.name || "");
      setType(component?.type || "table");
      setQueryConfig(
        component?.query_config
          ? JSON.parse(component.query_config)
          : defaultQueryConfig
      );
      setChartConfig(
        component?.chart_config
          ? JSON.parse(component.chart_config)
          : defaultChartConfig
      );
      setGridConfig(
        component?.grid_config
          ? JSON.parse(component.grid_config)
          : defaultGridConfig
      );
      setPreviewData([]);
      setPreviewError(null);
    }
  }, [open, component]);

  const handleQueryChange = useCallback((config: QueryConfig) => {
    setQueryConfig(config);
  }, []);

  const fetchPreview = useCallback(async () => {
    if (!queryConfig.sourceTable || queryConfig.columns.length === 0) {
      setPreviewError("Please select a table and at least one column");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const response = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...queryConfig, limit: 100 }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPreviewError(data.error || "Query failed");
        return;
      }

      setPreviewData(data.data);
    } catch (error) {
      setPreviewError("Failed to execute query");
      console.error(error);
    } finally {
      setPreviewLoading(false);
    }
  }, [queryConfig]);

  function handleSave() {
    if (!name.trim()) {
      return;
    }

    // Text components don't need query validation
    if (type !== "text" && (!queryConfig.sourceTable || queryConfig.columns.length === 0)) {
      return;
    }

    // Build the query config to save, removing invalid entries
    let queryConfigToSave = queryConfig;
    if (type !== "text" && hasInvalidConfig) {
      const invalidGroupBySet = new Set(queryConfigValidation.invalidGroupBy);
      const invalidOrderBySet = new Set(queryConfigValidation.invalidOrderBy.map(e => e.column));

      // Clean groupBy
      const cleanedGroupBy = (queryConfigToSave.groupBy || [])
        .filter(gb => !invalidGroupBySet.has(gb));

      // Clean orderBy
      const cleanedOrderBy = (queryConfigToSave.orderBy || [])
        .filter(ob => !invalidOrderBySet.has(ob.column));

      queryConfigToSave = {
        ...queryConfigToSave,
        groupBy: cleanedGroupBy,
        orderBy: cleanedOrderBy,
      };
    }

    onSave({
      id: component?.id,
      dashboard_id: dashboardId,
      name: name.trim(),
      type,
      query_config: type === "text" ? defaultQueryConfig : queryConfigToSave,
      grid_config: gridConfig,
      chart_config: chartConfig,
    });

    onOpenChange(false);
  }

  function renderPreview() {
    // Text components show markdown preview
    if (type === "text") {
      return (
        <div className="h-64 overflow-auto border rounded p-4 prose prose-lg max-w-none dark:prose-invert">
          {chartConfig.content ? (
            <Markdown>{chartConfig.content}</Markdown>
          ) : (
            <span className="text-muted-foreground">No content to preview</span>
          )}
        </div>
      );
    }

    if (previewData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No data to preview
        </div>
      );
    }

    const labelColumn = chartConfig.labelColumn || queryConfig.columns[0]?.column;
    const valueColumn = chartConfig.valueColumn || queryConfig.columns[1]?.column;
    const valueColumns = queryConfig.columns
      .filter((c) => c.column !== labelColumn)
      .map((c) => c.alias || c.column);

    switch (type) {
      case "table":
        return (
          <div className="h-64 overflow-auto border rounded">
            <DashboardDataTable data={previewData} maxRows={50} />
          </div>
        );

      case "pie":
        return (
          <div className="h-64">
            <DashboardPieChart
              data={transformToPieData(previewData, labelColumn, valueColumn)}
              showLegend={chartConfig.showLegend}
              showTooltip={chartConfig.showTooltip}
            />
          </div>
        );

      case "bar_stacked":
      case "bar_grouped": {
        const { data, bars } = transformToBarData(
          previewData,
          labelColumn,
          valueColumns
        );
        return (
          <div className="h-64">
            <DashboardBarChart
              data={data}
              bars={bars}
              stacked={type === "bar_stacked"}
              showLegend={chartConfig.showLegend}
              showTooltip={chartConfig.showTooltip}
            />
          </div>
        );
      }

      case "line": {
        const { data, lines } = transformToLineData(
          previewData,
          labelColumn,
          valueColumns
        );
        return (
          <div className="h-64">
            <DashboardLineChart
              data={data}
              lines={lines}
              showLegend={chartConfig.showLegend}
              showTooltip={chartConfig.showTooltip}
            />
          </div>
        );
      }

      default:
        return null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {component ? "Edit Component" : "Add Component"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invalid Configuration Warning */}
          {hasInvalidConfig && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Invalid query configuration detected</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  The following query elements reference columns that no longer exist in this component's query:
                </p>

                {queryConfigValidation.invalidGroupBy.length > 0 && (
                  <div className="mb-2">
                    <span className="font-medium">GROUP BY:</span>
                    <ul className="list-disc list-inside ml-2">
                      {queryConfigValidation.invalidGroupBy.map((entry, idx) => (
                        <li key={idx}><code className="bg-muted px-1 rounded">{entry}</code></li>
                      ))}
                    </ul>
                  </div>
                )}

                {queryConfigValidation.invalidOrderBy.length > 0 && (
                  <div className="mb-2">
                    <span className="font-medium">ORDER BY:</span>
                    <ul className="list-disc list-inside ml-2">
                      {queryConfigValidation.invalidOrderBy.map((entry, idx) => (
                        <li key={idx}>
                          <code className="bg-muted px-1 rounded">{entry.column}</code> ({entry.direction})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-sm mt-2">
                  These invalid entries will be automatically removed when you save this component.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Component Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter component name"
              />
            </div>
            <div className="space-y-2">
              <Label>Component Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as DashboardComponentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Text Editor for text type */}
          {type === "text" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Markdown Content</Label>
                <textarea
                  className="w-full min-h-[200px] rounded-md border p-3 font-mono text-sm resize-y bg-background"
                  value={chartConfig.content || ""}
                  onChange={(e) =>
                    setChartConfig({ ...chartConfig, content: e.target.value })
                  }
                  placeholder="# Heading&#10;&#10;Write your **markdown** content here..."
                />
              </div>

              {/* Display Options */}
              <div className="space-y-3">
                <Label>Display Options</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-border"
                    checked={chartConfig.showBorder !== false}
                    onCheckedChange={(checked) =>
                      setChartConfig({ ...chartConfig, showBorder: checked as boolean })
                    }
                  />
                  <Label htmlFor="show-border" className="font-normal cursor-pointer">
                    Show border
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="constrain-height"
                    checked={chartConfig.constrainHeight !== false}
                    onCheckedChange={(checked) =>
                      setChartConfig({ ...chartConfig, constrainHeight: checked as boolean })
                    }
                  />
                  <Label htmlFor="constrain-height" className="font-normal cursor-pointer">
                    Fixed height (scroll if content overflows)
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview</Label>
                {renderPreview()}
              </div>
            </div>
          )}

          {/* Query Builder for data types */}
          {type !== "text" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data Query</Label>
                <div className="rounded-md border p-4">
                  <QueryBuilder
                    initialConfig={queryConfig}
                    onChange={handleQueryChange}
                  />
                </div>
              </div>

              {/* Chart Config - show for chart types when columns are configured */}
              {type !== "table" && queryConfig.columns.length > 0 && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <Label>Chart Options</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Label Column</Label>
                      <Select
                        value={chartConfig.labelColumn || ""}
                        onValueChange={(v) =>
                          setChartConfig({ ...chartConfig, labelColumn: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select label column" />
                        </SelectTrigger>
                        <SelectContent>
                          {queryConfig.columns.map((col) => (
                            <SelectItem
                              key={col.column}
                              value={col.alias || col.column}
                            >
                              {col.alias || col.column}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {type === "pie" && (
                      <div className="space-y-2">
                        <Label className="text-sm">Value Column</Label>
                        <Select
                          value={chartConfig.valueColumn || ""}
                          onValueChange={(v) =>
                            setChartConfig({ ...chartConfig, valueColumn: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select value column" />
                          </SelectTrigger>
                          <SelectContent>
                            {queryConfig.columns.map((col) => (
                              <SelectItem
                                key={col.column}
                                value={col.alias || col.column}
                              >
                                {col.alias || col.column}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showLegend"
                        checked={chartConfig.showLegend ?? true}
                        onCheckedChange={(checked) =>
                          setChartConfig({
                            ...chartConfig,
                            showLegend: checked === true,
                          })
                        }
                      />
                      <label htmlFor="showLegend" className="text-sm">
                        Show Legend
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showTooltip"
                        checked={chartConfig.showTooltip ?? true}
                        onCheckedChange={(checked) =>
                          setChartConfig({
                            ...chartConfig,
                            showTooltip: checked === true,
                          })
                        }
                      />
                      <label htmlFor="showTooltip" className="text-sm">
                        Show Tooltip
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Table Options - show for table type when columns are configured */}
              {type === "table" && queryConfig.columns.length > 0 && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <Label>Table Options</Label>
                  <div className="flex flex-col gap-2">
                    {/* Page totals - hidden when groupBy is active */}
                    {!(queryConfig.groupBy && queryConfig.groupBy.length > 0) && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showPageTotals"
                          checked={chartConfig.showPageTotals ?? false}
                          onCheckedChange={(checked) =>
                            setChartConfig({ ...chartConfig, showPageTotals: checked === true })
                          }
                        />
                        <label htmlFor="showPageTotals" className="text-sm">
                          Show page totals (sums currency columns on current page)
                        </label>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="showGrandTotals"
                        checked={chartConfig.showGrandTotals ?? false}
                        onCheckedChange={(checked) =>
                          setChartConfig({ ...chartConfig, showGrandTotals: checked === true })
                        }
                      />
                      <label htmlFor="showGrandTotals" className="text-sm">
                        Show grand totals (sums currency columns across all data)
                      </label>
                    </div>
                    {/* Hierarchical display - only when 2+ groupBy columns */}
                    {queryConfig.groupBy && queryConfig.groupBy.length >= 2 && (
                      <>
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Checkbox
                            id="hierarchicalDisplay"
                            checked={chartConfig.hierarchicalDisplay ?? false}
                            onCheckedChange={(checked) =>
                              setChartConfig({
                                ...chartConfig,
                                hierarchicalDisplay: checked === true,
                                // Reset showGroupTotals when disabling hierarchical display
                                showGroupTotals: checked === true ? chartConfig.showGroupTotals : false,
                              })
                            }
                          />
                          <label htmlFor="hierarchicalDisplay" className="text-sm">
                            Hierarchical display (collapse repeated group values)
                          </label>
                        </div>
                        {/* Show group totals - only when hierarchical display is enabled */}
                        {chartConfig.hierarchicalDisplay && (
                          <div className="flex items-center gap-2 ml-6">
                            <Checkbox
                              id="showGroupTotals"
                              checked={chartConfig.showGroupTotals ?? false}
                              onCheckedChange={(checked) =>
                                setChartConfig({ ...chartConfig, showGroupTotals: checked === true })
                              }
                            />
                            <label htmlFor="showGroupTotals" className="text-sm">
                              Show group totals (subtotals for each group level)
                            </label>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Checkbox
                        id="disableSorting"
                        checked={chartConfig.disableSorting ?? false}
                        onCheckedChange={(checked) =>
                          setChartConfig({ ...chartConfig, disableSorting: checked === true })
                        }
                      />
                      <label htmlFor="disableSorting" className="text-sm">
                        Disable sorting (preserve ORDER BY from query)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Button and Results */}
              <div className="space-y-4 pt-4 border-t">
                {previewError && (
                  <div className="text-sm text-red-500">{previewError}</div>
                )}
                <Button
                  onClick={fetchPreview}
                  disabled={previewLoading || !queryConfig.sourceTable || queryConfig.columns.length === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {previewLoading ? "Loading..." : "Preview Results"}
                </Button>

                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Preview ({previewData.length} rows)</Label>
                    {renderPreview()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !name.trim() ||
                (type !== "text" && (!queryConfig.sourceTable || queryConfig.columns.length === 0))
              }
            >
              {component ? "Update" : "Add"} Component
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
