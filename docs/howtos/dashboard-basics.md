# Dashboard Basics

Guide for creating custom dashboards with tables and charts.

For advanced features (complex charts, JOINs, filters), see [Dashboard Advanced](./dashboard-advanced.md).

## Creating a Dashboard

### Via UI
1. Navigate to `/dashboards`
2. Click "New Dashboard" button
3. Enter dashboard name and description
4. Click "Create"
5. You'll be redirected to edit mode

### Dashboard Metadata
```typescript
{
  name: string;           // Display name
  description?: string;   // Optional description
  is_public: boolean;     // Public or private
}
```

---

## Layout and Positioning

### Grid System

**12-column grid** with units in columns (w) and rows (h). Position is x (horizontal), y (vertical). Row height: 80px.

```typescript
interface GridConfig {
  x: number;  // Column position (0-11)
  y: number;  // Row position (0+)
  w: number;  // Width in columns (1-12)
  h: number;  // Height in rows (1+)
}
```

### Common Layouts

**Full-width**: `{ x: 0, y: 0, w: 12, h: 4 }`

**Two-column**: Left: `{ x: 0, y: 0, w: 6, h: 4 }`, Right: `{ x: 6, y: 0, w: 6, h: 4 }`

**Three-column**: Left: `{ x: 0, y: 0, w: 4, h: 4 }`, Center: `{ x: 4, y: 0, w: 4, h: 4 }`, Right: `{ x: 8, y: 0, w: 4, h: 4 }`

**Stacked**: Top: `{ x: 0, y: 0, w: 12, h: 3 }`, Bottom: `{ x: 0, y: 3, w: 12, h: 4 }`

**Edit Mode**: Drag components to reposition, resize handles on corners/edges, layout auto-saves when changed.

---

## Adding a Data Table Component

Data tables display query results in a simple HTML table.

### Steps
1. Click "Add Component" button
2. Select "Table" as component type
3. Use QueryBuilder to define data source
4. Configure display options
5. Save component

### Example: Simple Table
```typescript
// Query Configuration
{
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "status" },
    { column: "DOT_latest" }
  ],
  orderBy: [{ column: "id", direction: "DESC" }],
  limit: 10
}

// Component Configuration
{
  type: "table",
  query_config: {...},
  chart_config: {},
  grid_config: { x: 0, y: 0, w: 12, h: 4 }
}
```

**Table Features**: Auto-formatted columns, sticky headers when scrolling, limited to 1000 rows, read-only (no sorting/filtering/pagination)

---

## Adding a Chart Component

### Pie Chart

Display categorical data distribution:

```typescript
// Query: Count referenda by status
{
  sourceTable: "Referenda",
  columns: [{ column: "status" }],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" }
  ],
  groupBy: ["status"],
  orderBy: [{ column: "count", direction: "DESC" }]
}

// Chart Configuration
{
  labelColumn: "status",
  valueColumn: "count",
  colors: ["#22c55e", "#ef4444", "#3b82f6"],
  showLegend: true
}
```

---

## Tips and Best Practices

**Query Performance**: Use LIMIT (max 1000), add filters to reduce dataset

**Chart Design**: Use consistent colors across charts, show legends for multi-series, limit pie chart categories (< 10)

**Layout**: Group related components together, use consistent heights for side-by-side components

**Data Updates**: Dashboard data is cached. Refresh page to fetch latest data.

---

## Next Steps

- For bar charts, line charts, and complex queries, see [Dashboard Advanced](./dashboard-advanced.md)
- For query building details, see [QueryBuilder How-To](./query-builder.md)
- For architecture details, see [Dashboard Specification](../spec/frontend/dashboard.md)
