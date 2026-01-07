"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [previewSql, setPreviewSql] = useState<string>("");
  const [step, setStep] = useState<"config" | "preview">("config");

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
      setPreviewSql("");
      setStep("config");
    }
  }, [open, component]);

  const handleQueryChange = useCallback((config: QueryConfig) => {
    setQueryConfig(config);
  }, []);

  const handlePreview = useCallback(
    (data: unknown[], sql: string) => {
      setPreviewData(data as Record<string, unknown>[]);
      setPreviewSql(sql);
      // Don't auto-switch to preview - let user see SQL in query builder first
    },
    []
  );

  function handleSave() {
    if (!name.trim() || !queryConfig.sourceTable || queryConfig.columns.length === 0) {
      return;
    }

    onSave({
      id: component?.id,
      dashboard_id: dashboardId,
      name: name.trim(),
      type,
      query_config: queryConfig,
      grid_config: gridConfig,
      chart_config: chartConfig,
    });

    onOpenChange(false);
  }

  function renderPreview() {
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

          {/* Query Builder */}
          {step === "config" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Data Query</Label>
                <div className="rounded-md border p-4">
                  <QueryBuilder
                    initialConfig={queryConfig}
                    onChange={handleQueryChange}
                    onPreview={handlePreview}
                  />
                </div>
              </div>

              {/* Show button to proceed to chart preview after running query */}
              {previewData.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => setStep("preview")}>
                    Continue to Chart Preview ({previewData.length} rows)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Preview</Label>
                <Button variant="outline" size="sm" onClick={() => setStep("config")}>
                  Back to Query
                </Button>
              </div>

              {/* Chart Config for non-table types */}
              {type !== "table" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Label Column</Label>
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
                      <Label>Value Column</Label>
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
              )}

              {/* Display Options */}
              {type !== "table" && (
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
              )}

              {renderPreview()}

              {/* SQL Display */}
              {previewSql && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    View SQL Query
                  </summary>
                  <div className="mt-2 rounded-md border bg-muted p-4">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{previewSql}</pre>
                  </div>
                </details>
              )}
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
                !queryConfig.sourceTable ||
                queryConfig.columns.length === 0
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
