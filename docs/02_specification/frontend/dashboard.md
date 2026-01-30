# Dashboard Specification

Technical specifications for dashboard components and grid configuration.

## Database Schema

### Dashboard Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key (auto-increment) |
| name | TEXT | Dashboard name |
| description | TEXT | Optional description |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

### Dashboard Component Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key (auto-increment) |
| dashboard_id | INTEGER | Foreign key to Dashboard |
| name | TEXT | Component name |
| type | TEXT | Component type |
| query_config | JSON | Query configuration |
| grid_config | JSON | Grid position and size |
| chart_config | JSON | Chart-specific settings |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Last update timestamp |

## Component Types

| Type | Description |
|------|-------------|
| `table` | Simple HTML table for query results |
| `pie` | Proportional data with label/value columns |
| `bar_stacked` | Stacked bar chart |
| `bar_grouped` | Grouped bar chart |
| `line` | Trend line chart |
| `text` | Markdown content |
| `metric` | Single value display |

## Grid Configuration

```typescript
interface GridConfig {
  x: number;      // Column position (0-11)
  y: number;      // Row position
  w: number;      // Width in columns (1-12)
  h: number;      // Height in rows
  minW?: number;  // Minimum width
  minH?: number;  // Minimum height
}
```

### Grid Constraints

| Property | Value |
|----------|-------|
| Columns | 12 |
| Row height | Variable (based on content) |
| Min component width | 2 columns |
| Min component height | 2 rows |

## Chart Configuration

### Pie Chart

```typescript
interface PieChartConfig {
  labelColumn: string;
  valueColumn: string;
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
}
```

### Bar Chart

```typescript
interface BarChartConfig {
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  orientation?: "horizontal" | "vertical";
}
```

### Line Chart

```typescript
interface LineChartConfig {
  colors?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
  showDots?: boolean;
}
```

### Text Component

```typescript
interface TextConfig {
  content: string;  // Markdown content
}
```

### Metric Component

```typescript
interface MetricConfig {
  value?: string | number;  // Manual value (if no query)
  prefix?: string;          // e.g., "$"
  suffix?: string;          // e.g., "DOT"
  valueColumn?: string;     // Column to display from query result
}
```

## Row Limits

| Context | Limit |
|---------|-------|
| Dashboard table components | 1,000 rows |
| Chart data points | 1,000 rows |

## See Also

- [Dashboard Requirements](../../01_requirements/frontend/dashboard.md) - User capabilities
- [Dashboard API Reference](../../03_design/frontend/dashboard-api.md) - Component props
- [Data Models](../data-models.md) - Database tables section
- [UI Constants](./ui-constants.md) - Row limits
