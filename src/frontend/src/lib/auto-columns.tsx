import { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { DataTableFacetedFilter } from "@/components/data-table/faceted-filter";
import { DataTableEditConfig, FilterGroup } from "@/lib/db/types";
import {
  getColumnConfig,
  getColumnDisplayName,
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
  EditableCategoryCell,
  EditableSubcategoryCell,
  ReadOnlyCategoryCell,
  ReadOnlySubcategoryCell,
  findCategoryId,
} from "@/components/data-table/editable-cells";
import { TextLongCell } from "@/components/renderers/cell-renderers";

interface GenerateColumnsOptions<TData> {
  data: TData[];
  tableName: string;
  editConfig?: DataTableEditConfig;
  isAuthenticated?: boolean;
  facetedFilters?: string[];
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnMapping?: Record<string, string>;
  dashboardMode?: boolean;
  filterGroup?: FilterGroup;
  onFilterGroupChange?: (group: FilterGroup) => void;
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
    dashboardMode = false,
    filterGroup,
    onFilterGroupChange,
  } = options;

  if (data.length === 0) return [];

  const columns = Object.keys(data[0] as object);
  const idField = editConfig?.idField || "id";

  // Auto-detect category system: if all three columns exist, use split decoration
  const hasCategorySystem = columns.includes('category_id')
    && columns.includes('category')
    && columns.includes('subcategory');

  return columns.map((columnName) => {
    // Get source column name for config lookup
    const sourceColumn = columnMapping[columnName] || columnName;
    // Try stripping table prefix if initial config lookup returns "text" (default)
    // This handles columns like "all_spending.DOT_latest" -> "DOT_latest" for pattern matching
    const colWithoutTable = sourceColumn.includes('.') ? sourceColumn.split('.').pop()! : sourceColumn;
    let renderConfig: ColumnRenderConfig = getColumnConfig(tableName, sourceColumn);
    if (renderConfig.type === "text" && colWithoutTable !== sourceColumn) {
      renderConfig = getColumnConfig(tableName, colWithoutTable);
    }

    // Handle category system columns when auto-detected
    // Skip if page provides a custom columnOverride for category_id
    const hasCustomCategoryOverride = columnOverrides['category_id']?.cell !== undefined;
    if (hasCategorySystem && !hasCustomCategoryOverride) {
      const categoryEditConfig = editConfig?.editableColumns.category_id;

      // Hide category_id column
      if (columnName === 'category_id') {
        return {
          id: columnName,
          accessorKey: columnName,
          header: () => null,
          cell: () => null,
          enableHiding: true,
          meta: { autoHidden: true },
          // Start hidden
          enableColumnFilter: false,
          enableSorting: false,
        } as ColumnDef<TData>;
      }

      // Handle category column with split dropdown
      if (columnName === 'category') {
        const parentCatCol = categoryEditConfig?.parentCategoryColumn;
        const isFacetedFilter = facetedFilters?.includes(columnName) || false;

        return {
          id: columnName,
          accessorKey: columnName,
          header: ({ column }) => (
            <div className="flex items-center space-x-2">
              {isFacetedFilter && (
                <DataTableFacetedFilter
                  column={column}
                  title={getColumnDisplayName(tableName, columnName)}
                  filterGroup={filterGroup}
                  onFilterGroupChange={onFilterGroupChange}
                  columnName={columnName}
                />
              )}
              {!isFacetedFilter && (
                <DataTableColumnHeader column={column} title={getColumnDisplayName(tableName, columnName)} />
              )}
              {isFacetedFilter && column.getCanSort() && (
                <DataTableColumnHeader column={column} title="" />
              )}
            </div>
          ),
          ...(isFacetedFilter && {
            filterFn: (row: any, id: string, value: string[]) => value.includes(row.getValue(id)),
            enableSorting: false,
          }),
          cell: ({ row }) => {
            const value = row.getValue(columnName);
            const rowId = (row.original as any)[idField];
            const parentCategory = parentCatCol ? (row.original as any)[parentCatCol] : null;

            if (isAuthenticated && categoryEditConfig) {
              return (
                <EditableCategoryCell
                  value={value as string}
                  categories={categoryEditConfig.categories || []}
                  parentCategory={parentCategory}
                  onChange={(newCategory) => {
                    // When category changes, clear subcategory (pass null) to find first match for new category
                    const categoryId = findCategoryId(newCategory, null, categoryEditConfig.categories || []);
                    categoryEditConfig.onUpdate(rowId, categoryId);
                  }}
                />
              );
            } else {
              return <ReadOnlyCategoryCell value={value as string} parentCategory={parentCategory} />;
            }
          },
        } as ColumnDef<TData>;
      }

      // Handle subcategory column with split dropdown
      if (columnName === 'subcategory') {
        const parentCatCol = categoryEditConfig?.parentCategoryColumn;
        const parentSubcatCol = categoryEditConfig?.parentSubcategoryColumn;
        const isFacetedFilter = facetedFilters?.includes(columnName) || false;

        return {
          id: columnName,
          accessorKey: columnName,
          header: ({ column }) => (
            <div className="flex items-center space-x-2">
              {isFacetedFilter && (
                <DataTableFacetedFilter
                  column={column}
                  title={getColumnDisplayName(tableName, columnName)}
                  filterGroup={filterGroup}
                  onFilterGroupChange={onFilterGroupChange}
                  columnName={columnName}
                />
              )}
              {!isFacetedFilter && (
                <DataTableColumnHeader column={column} title={getColumnDisplayName(tableName, columnName)} />
              )}
              {isFacetedFilter && column.getCanSort() && (
                <DataTableColumnHeader column={column} title="" />
              )}
            </div>
          ),
          ...(isFacetedFilter && {
            filterFn: (row: any, id: string, value: string[]) => value.includes(row.getValue(id)),
            enableSorting: false,
          }),
          cell: ({ row }) => {
            const value = row.getValue(columnName);
            const rowId = (row.original as any)[idField];
            const category = (row.original as any)['category'];
            const parentCategory = parentCatCol ? (row.original as any)[parentCatCol] : null;
            const parentSubcategory = parentSubcatCol ? (row.original as any)[parentSubcatCol] : null;

            if (isAuthenticated && categoryEditConfig) {
              return (
                <EditableSubcategoryCell
                  value={value as string}
                  category={category as string}
                  categories={categoryEditConfig.categories || []}
                  parentCategory={parentCategory}
                  parentSubcategory={parentSubcategory}
                  onChange={(newSubcategory) => {
                    // Use effective category (selected or inherited from parent)
                    const effectiveCategory = category || parentCategory;
                    const categoryId = findCategoryId(effectiveCategory, newSubcategory, categoryEditConfig.categories || []);
                    categoryEditConfig.onUpdate(rowId, categoryId);
                  }}
                />
              );
            } else {
              return <ReadOnlySubcategoryCell value={value as string} parentSubcategory={parentSubcategory} />;
            }
          },
        } as ColumnDef<TData>;
      }
    }

    // Check if editable
    const editableConfig = editConfig?.editableColumns[columnName];
    const isEditable = isAuthenticated && !!editableConfig;

    // Check if this column should have a faceted filter
    const isFacetedFilter = facetedFilters?.includes(columnName) || false;

    // Check for filterColumn in columnOverrides (used for faceted filtering)
    const override = columnOverrides[columnName] as any;
    const filterColumnName = override?.filterColumn || columnName;
    const headerTitle = typeof override?.header === 'string' ? override.header : getColumnDisplayName(tableName, columnName);

    // Base column definition
    const columnDef: ColumnDef<TData> = {
      id: columnName,
      accessorKey: columnName,
      header: ({ column }) => (
        <div className="flex items-center space-x-2">
          {isFacetedFilter && (
            <DataTableFacetedFilter
              column={column}
              title={headerTitle}
              filterGroup={filterGroup}
              onFilterGroupChange={onFilterGroupChange}
              columnName={filterColumnName}
            />
          )}
          {!isFacetedFilter && (
            <DataTableColumnHeader column={column} title={headerTitle} />
          )}
          {isFacetedFilter && column.getCanSort() && (
            <DataTableColumnHeader column={column} title="" />
          )}
        </div>
      ),
      cell: ({ row }) => {
        const value = row.getValue(columnName);
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
        return renderCellValue(value, renderConfig, row.original as any, dashboardMode);
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
      const overridesCopy = { ...columnOverrides[columnName] };
      // Don't override the header function - we already extracted the title from it
      // and use it in our DataTableColumnHeader component
      if ('header' in overridesCopy && typeof overridesCopy.header === 'string') {
        delete (overridesCopy as any).header;
      }
      // Also remove filterColumn as it's already been processed
      if ('filterColumn' in overridesCopy) {
        delete (overridesCopy as any).filterColumn;
      }
      Object.assign(columnDef, overridesCopy);
    }

    return columnDef;
  });
}


function renderCellValue(value: any, config: ColumnRenderConfig, row: any, dashboardMode: boolean = false) {
  // Use renderAs for visual rendering, fall back to type
  const renderType = config.renderAs ?? config.type;

  // Helper to get text content for title attribute
  const getTextContent = (val: any): string => {
    if (val === null || val === undefined) return "-";
    if (typeof val === "string" || typeof val === "number") return String(val);
    return "";
  };

  // Helper to wrap content with dashboard overflow handling
  const wrapWithOverflow = (content: React.ReactNode, title?: string) => {
    if (!dashboardMode) return content;
    return (
      <div
        className="overflow-hidden text-ellipsis whitespace-nowrap"
        title={title || getTextContent(value)}
      >
        {content}
      </div>
    );
  };

  // Handle null/undefined based on column type (alignment is a visual concern)
  if (value === null || value === undefined) {
    const nullDisplay = <span className="text-muted-foreground">-</span>;

    // Right-align null values for currency and numeric columns
    if (renderType === "currency" || renderType === "numeric") {
      return wrapWithOverflow(
        <div className="text-right">{nullDisplay}</div>,
        "-"
      );
    }

    return wrapWithOverflow(nullDisplay, "-");
  }

  switch (renderType) {
    case "chip":
      // Badge/chip rendering (use with type: categorical for IN/NOT IN filtering)
      if (typeof value === "string") {
        const variant = getBadgeVariant(value, config);
        return wrapWithOverflow(<Badge variant={variant}>{value}</Badge>, value);
      }
      return wrapWithOverflow(value);

    case "categorical":
      // Categorical now renders as text by default (use renderAs: chip for Badge)
      const categoricalValue = formatValue(value, config);
      return wrapWithOverflow(categoricalValue, categoricalValue);

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

        return wrapWithOverflow(
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline text-blue-600"
          >
            {value}
          </a>,
          String(value)
        );
      }
      return wrapWithOverflow(value);

    case "numeric":
      const formattedNumber = formatValue(value, config);
      if (config.color === "green") {
        return wrapWithOverflow(
          <div className="text-right"><span className="text-green-600">{formattedNumber}</span></div>,
          formattedNumber
        );
      }
      if (config.color === "red") {
        return wrapWithOverflow(
          <div className="text-right"><span className="text-red-600">{formattedNumber}</span></div>,
          formattedNumber
        );
      }
      return wrapWithOverflow(
        <div className="text-right">{formattedNumber}</div>,
        formattedNumber
      );

    case "currency":
      const formattedCurrency = formatValue(value, config);
      return wrapWithOverflow(
        <div className="text-right">{formattedCurrency}</div>,
        formattedCurrency
      );

    case "text_long":
      return (
        <TextLongCell
          value={value as string | null}
          modalTitle={config.modalTitle}
          isJson={config.isJson}
        />
      );

    case "date":
    case "address":
    case "text":
    default:
      const formattedValue = formatValue(value, config);
      return wrapWithOverflow(formattedValue, formattedValue);
  }
}
