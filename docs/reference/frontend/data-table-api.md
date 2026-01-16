# DataTable API Reference

> **Status**: Stub - To be expanded with complete prop documentation

## Component Signature

```typescript
function DataTable<TData>(props: DataTableProps<TData>): JSX.Element
```

## Props

### Core Props

```typescript
interface DataTableProps<TData> {
  // Query configuration
  queryConfig: Omit<QueryConfig, "orderBy" | "filters">;
  tableName: string;

  // Display customization
  columnOverrides?: Record<string, Partial<ColumnDef<TData>>>;
  columnMapping?: Record<string, string>;

  // Features
  facetedFilters?: string[];
  editConfig?: DataTableEditConfig;
  isAuthenticated?: boolean;

  // View management
  defaultSorting?: SortingState;
  defaultViews?: SavedView[];

  // Footer
  footerCells?: FooterCell[];
  footerLabel?: string;

  // Mode flags
  compactMode?: boolean;
  dashboardMode?: boolean;

  // Dashboard-specific
  dashboardComponentId?: string;
  defaultFilters?: QueryConfig["filters"];

  // Toolbar control
  hideViewSelector?: boolean;
  toolbarCollapsible?: boolean;
  initialToolbarCollapsed?: boolean;
  toolbarCollapsed?: boolean;
  onToolbarCollapseChange?: (collapsed: boolean) => void;
}
```

### QueryConfig

See [QueryConfig Type Reference](#queryconfig-type) below.

### EditConfig

```typescript
interface DataTableEditConfig {
  editableColumns: {
    [columnId: string]: {
      type: "category-selector" | "text" | "checkbox";
      categories?: Category[];
      onUpdate: (id: number, value: any) => Promise<void>;
      placeholder?: string;
    };
  };
}
```

### SavedView

```typescript
interface SavedView {
  name: string;
  state: ViewState;
  isDefault: boolean;
}

interface ViewState {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  columnVisibility: VisibilityState;
  globalFilter: string;
  pagination: PaginationState;
}
```

## QueryConfig Type

```typescript
interface QueryConfig {
  sourceTable: string;
  columns: ColumnSelection[];
  expressionColumns?: ExpressionColumn[];
  joins?: JoinConfig[];
  filters: FilterCondition[];
  groupBy?: string[];
  orderBy?: OrderByConfig[];
  limit?: number;
}

interface ColumnSelection {
  column: string;
  alias?: string;
}

interface JoinConfig {
  type: "LEFT" | "INNER" | "RIGHT";
  table: string;
  alias?: string;
  on: {
    left: string;
    right: string;
  };
}

interface FilterCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL";
  value: string | number | string[] | null;
}

interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

interface OrderByConfig {
  column: string;
  direction: "ASC" | "DESC";
}
```

## Usage Examples

See [DataTable How-To Guide](../../howtos/data-table.md) for complete examples.

### Basic Usage

```typescript
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}
  defaultSorting={[{ id: "id", desc: true }]}
/>
```

### With Editing

```typescript
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  editConfig={editConfig}
  isAuthenticated={isAuthenticated}
/>
```

## Component Files

- `src/frontend/src/components/data-table/data-table.tsx` - Main component
- `src/frontend/src/hooks/use-view-state.ts` - View state management
- `src/frontend/src/lib/auto-columns.ts` - Column generation

## See Also

- [DataTable Specification](../../spec/frontend/data-table.md) - Architecture and design
- [DataTable How-To](../../howtos/data-table.md) - Practical examples
