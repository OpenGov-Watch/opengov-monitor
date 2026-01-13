import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { DataTableEditConfig } from "@/lib/db/types";
import {
  getColumnConfig,
  getBadgeVariant,
  formatValue,
  type ColumnRenderConfig
} from "@/lib/column-renderer";
import { Badge } from "@/components/ui/badge";
import {
  CategorySelector,
  ReadOnlyCategorySelector,
  EditableNotesCell,
  ReadOnlyNotesCell,
  EditableHideCheckbox,
  ReadOnlyHideCheckbox,
} from "@/components/data-table/editable-cells";
import { ExternalLink } from "lucide-react";

interface GenerateColumnsOptions<TData> {
  data: TData[];
  tableName: string;
  editConfig?: DataTableEditConfig;
  isAuthenticated?: boolean;
  facetedFilters?: string[];
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnMapping?: Record<string, string>;
}

export function generateColumns<TData>(
  options: GenerateColumnsOptions<TData>
): ColumnDef<TData>[] {
  const {
    data,
    tableName,
    editConfig,
    isAuthenticated = false,
    facetedFilters = [],
    columnOverrides = {},
    columnMapping = {},
  } = options;

  if (data.length === 0) return [];

  const columns = Object.keys(data[0] as object);
  const idField = editConfig?.idField || "id";

  return columns.map((columnName) => {
    // Get source column name for config lookup
    const sourceColumn = columnMapping[columnName] || columnName;
    const renderConfig: ColumnRenderConfig = getColumnConfig(tableName, sourceColumn);

    // Check if editable
    const editableConfig = editConfig?.editableColumns[columnName];
    const isEditable = isAuthenticated && !!editableConfig;

    // Check if this column should have a faceted filter
    const isFacetedFilter = facetedFilters?.includes(columnName) || false;

    // Handle dot-notation columns (e.g., "tally.ayes")
    // TanStack Table doesn't support dots in accessorKey, so use accessorFn instead
    const hasDotNotation = columnName.includes(".");
    const columnId = hasDotNotation ? columnName.replace(/\./g, "_") : columnName;

    // Base column definition
    const columnDef: ColumnDef<TData> = {
      id: columnId,
      ...(hasDotNotation
        ? { accessorFn: (row: any) => row[columnName] }
        : { accessorKey: columnName }),
      header: ({ column }) =>
        isFacetedFilter ? (
          <DataTableFacetedFilter column={column} title={formatColumnName(columnName)} />
        ) : (
          <DataTableColumnHeader column={column} title={formatColumnName(columnName)} />
        ),
      cell: ({ row }) => {
        // For dot-notation columns, get value directly from original
        const value = hasDotNotation ? (row.original as any)[columnName] : row.getValue(columnId);
        const rowId = (row.original as any)[idField];

        // Editable cell rendering
        if (isEditable && editableConfig) {
          switch (editableConfig.type) {
            case 'category-selector':
              return (
                <CategorySelector
                  categoryId={value as number}
                  categories={editableConfig.categories || []}
                  onChange={(newValue) => editableConfig.onUpdate(rowId, newValue)}
                />
              );
            case 'text':
              return (
                <EditableNotesCell
                  value={value as string}
                  onChange={(newValue) => editableConfig.onUpdate(rowId, newValue)}
                />
              );
            case 'checkbox':
              return (
                <EditableHideCheckbox
                  value={value as number}
                  onChange={(newValue) => editableConfig.onUpdate(rowId, newValue)}
                />
              );
          }
        }

        // Read-only rendering for auth-gated columns
        if (!isAuthenticated && editableConfig) {
          switch (editableConfig.type) {
            case 'category-selector':
              return (
                <ReadOnlyCategorySelector
                  categoryId={value as number}
                  categories={editableConfig.categories || []}
                />
              );
            case 'text':
              return <ReadOnlyNotesCell value={value as string} />;
            case 'checkbox':
              return <ReadOnlyHideCheckbox value={value as number} />;
          }
        }

        // Standard rendering via column config
        return renderCellValue(value, renderConfig, row.original as any);
      },
    };

    // Add faceted filter if configured
    if (isFacetedFilter) {
      columnDef.filterFn = (row, id, value) => {
        return value.includes(row.getValue(id));
      };
      columnDef.enableSorting = false;
    }

    // Apply column overrides
    if (columnOverrides[columnName]) {
      Object.assign(columnDef, columnOverrides[columnName]);
    }

    return columnDef;
  });
}

function formatColumnName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDot\b/gi, "DOT")
    .replace(/\bUsd\b/gi, "USD")
    .replace(/\bUsdc\b/gi, "USDC")
    .replace(/\bUsdt\b/gi, "USDT");
}

function renderCellValue(value: any, config: ColumnRenderConfig, row: any) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  switch (config.render) {
    case "badge":
      if (typeof value === "string") {
        const variant = getBadgeVariant(value, config);
        return <Badge variant={variant}>{value}</Badge>;
      }
      return value;

    case "link":
      if (typeof value === "string" || typeof value === "number") {
        let url: string;
        if (config.urlField && row[config.urlField]) {
          url = row[config.urlField];
        } else if (config.urlTemplate) {
          url = config.urlTemplate.replace("{value}", String(value));
        } else {
          url = String(value);
        }

        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      }
      return value;

    case "number":
      const formattedNumber = formatValue(value, config);
      if (config.color === "green") {
        return <div className="text-right"><span className="text-green-600">{formattedNumber}</span></div>;
      }
      if (config.color === "red") {
        return <div className="text-right"><span className="text-red-600">{formattedNumber}</span></div>;
      }
      return <div className="text-right">{formattedNumber}</div>;

    case "currency":
      return <div className="text-right">{formatValue(value, config)}</div>;

    case "date":
    case "address":
    case "text":
    default:
      return formatValue(value, config);
  }
}
