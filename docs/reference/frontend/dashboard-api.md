# Dashboard API Reference

> **Status**: Stub - To be expanded with complete prop documentation

## DashboardGrid Component

```typescript
function DashboardGrid(props: DashboardGridProps): JSX.Element
```

### Props

```typescript
interface DashboardGridProps {
  components: DashboardComponent[];
  editable?: boolean;
  highlightComponentId?: number | null;
  onLayoutChange?: (componentId: number, gridConfig: GridConfig) => void;
  onEditComponent?: (component: DashboardComponent) => void;
  onDuplicateComponent?: (component: DashboardComponent) => void;
  onDeleteComponent?: (componentId: number) => void;
  width?: number;
}
```

## DashboardComponent Type

```typescript
interface DashboardComponent {
  id: number;
  dashboard_id: number;
  type: DashboardComponentType;
  query_config: string;  // JSON string of QueryConfig
  chart_config: string;  // JSON string of ChartConfig
  grid_config: string;   // JSON string of GridConfig
}

type DashboardComponentType =
  | "table"
  | "pie"
  | "bar_stacked"
  | "bar_grouped"
  | "line"
  | "text";
```

## GridConfig

```typescript
interface GridConfig {
  x: number;  // Column position (0-11)
  y: number;  // Row position (0+)
  w: number;  // Width in columns (1-12)
  h: number;  // Height in rows (1+)
}
```

## ChartConfig

```typescript
interface ChartConfig {
  colors?: string[];
  labelColumn?: string;
  valueColumn?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  content?: string;  // For text components (Markdown)
}
```

## Grid Layout Constants

```typescript
const BREAKPOINTS = {
  lg: 800,
  md: 600,
  sm: 480,
  xs: 320,
  xxs: 0
};

const COLS = {
  lg: 12,
  md: 8,
  sm: 4,
  xs: 2,
  xxs: 1
};

const ROW_HEIGHT = 80;
```

## Usage Example

```typescript
<DashboardGrid
  components={components}
  editable={isEditMode}
  onLayoutChange={(componentId, gridConfig) => {
    // Save updated layout
  }}
  onEditComponent={(component) => {
    // Open edit dialog
  }}
  onDeleteComponent={(componentId) => {
    // Delete component
  }}
/>
```

## Component Files

- `src/frontend/src/components/dashboard/dashboard-grid.tsx` - Grid layout
- `src/frontend/src/components/dashboard/dashboard-component.tsx` - Component renderer
- `src/frontend/src/components/dashboard/component-editor.tsx` - Edit dialog

## See Also

- [Dashboard Specification](../../spec/frontend/dashboard.md) - Architecture and design
- [Dashboard How-To](../../howtos/dashboard.md) - Practical examples
- [QueryBuilder API](./query-builder-api.md) - Query configuration
