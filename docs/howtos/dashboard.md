# How to Create and Configure Dashboards

This guide covers creating custom dashboards with tables, charts, and text components using the visual QueryBuilder.

## Table of Contents
1. [Creating a Dashboard](#1-creating-a-dashboard)
2. [Adding a Data Table Component](#2-adding-a-data-table-component)
3. [Adding a Chart Component](#3-adding-a-chart-component)
4. [Building Queries with JOINs](#4-building-queries-with-joins)
5. [Adding Filters](#5-adding-filters)
6. [Layout and Positioning](#6-layout-and-positioning)
7. [Complete Example](#7-complete-example)

---

## 1. Creating a Dashboard

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

## 2. Adding a Data Table Component

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

### Table Features
- Auto-formatted columns (same patterns as DataTable)
- Sticky headers when scrolling
- Limited to 1000 rows per query
- Read-only (no sorting/filtering/pagination)

---

## 3. Adding a Chart Component

### Pie Chart
Display categorical data distribution.

```typescript
// Query: Count referenda by status
{
  sourceTable: "Referenda",
  columns: [
    { column: "status" }
  ],
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

### Bar Chart (Grouped or Stacked)
Compare multiple series across categories.

```typescript
// Query: Sum DOT by track and status
{
  sourceTable: "Referenda",
  columns: [
    { column: "track" },
    { column: "status" }
  ],
  expressionColumns: [
    { expression: "SUM(DOT_latest)", alias: "total_dot" }
  ],
  groupBy: ["track", "status"],
  orderBy: [{ column: "total_dot", direction: "DESC" }]
}

// Chart Configuration
{
  type: "bar_grouped",  // or "bar_stacked"
  colors: ["#22c55e", "#ef4444", "#f59e0b"],
  showLegend: true,
  showTooltip: true
}
```

### Line Chart
Show trends over time.

```typescript
// Query: Count proposals by month
{
  sourceTable: "Referenda",
  columns: [
    { column: "proposal_month" }  // Assumes preprocessed month column
  ],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" }
  ],
  groupBy: ["proposal_month"],
  orderBy: [{ column: "proposal_month", direction: "ASC" }]
}

// Chart Configuration
{
  showLegend: false,
  showTooltip: true
}
```

---

## 4. Building Queries with JOINs

The QueryBuilder automatically detects foreign key relationships.

### Example: Referenda with Categories
```typescript
// 1. Select source table: "Referenda"
// 2. Add JOIN:
//    - Table: Categories
//    - Alias: c
//    - ON clause auto-populated: Referenda.category_id = c.id
// 3. Select columns:
{
  sourceTable: "Referenda",
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: {
      left: "Referenda.category_id",
      right: "c.id"
    }
  }],
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "c.category", alias: "category" },
    { column: "c.subcategory", alias: "subcategory" }
  ]
}
```

### Example: Multiple JOINs
```typescript
// Child Bounties with Categories and Parent Bounties
{
  sourceTable: "Child Bounties",
  joins: [
    {
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: { left: "Child Bounties.category_id", right: "c.id" }
    },
    {
      type: "LEFT",
      table: "Bounties",
      alias: "b",
      on: { left: "Child Bounties.parentBountyId", right: "b.id" }
    }
  ],
  columns: [
    { column: "Child Bounties.title", alias: "child_bounty" },
    { column: "c.category", alias: "category" },
    { column: "b.title", alias: "parent_bounty" }
  ]
}
```

---

## 5. Adding Filters

Use the FilterGroupBuilder to add WHERE conditions.

### Simple Filter
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" }
]
```

### Multiple Conditions (AND)
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" },
  { column: "DOT_latest", operator: ">", value: "1000" }
]
```

### Complex Filter (AND/OR)
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "=", value: "Executed" },
    {
      operator: "OR",
      conditions: [
        { column: "track", operator: "=", value: "Root" },
        { column: "track", operator: "=", value: "Whitelisted Caller" }
      ]
    }
  ]
}
```

### Date Filters
```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

---

## 6. Layout and Positioning

### Grid System
- 12-column grid
- Units: columns (w) and rows (h)
- Position: x (horizontal), y (vertical)
- Row height: 80px

### Grid Configuration
```typescript
interface GridConfig {
  x: number;  // Column position (0-11)
  y: number;  // Row position (0+)
  w: number;  // Width in columns (1-12)
  h: number;  // Height in rows (1+)
}
```

### Common Layouts

**Full-width table:**
```typescript
{ x: 0, y: 0, w: 12, h: 4 }
```

**Two-column charts:**
```typescript
// Left chart
{ x: 0, y: 0, w: 6, h: 4 }
// Right chart
{ x: 6, y: 0, w: 6, h: 4 }
```

**Three-column layout:**
```typescript
// Left
{ x: 0, y: 0, w: 4, h: 4 }
// Center
{ x: 4, y: 0, w: 4, h: 4 }
// Right
{ x: 8, y: 0, w: 4, h: 4 }
```

**Stacked components:**
```typescript
// Top component
{ x: 0, y: 0, w: 12, h: 3 }
// Bottom component
{ x: 0, y: 3, w: 12, h: 4 }
```

### Drag and Resize (Edit Mode)
- Drag components to reposition
- Resize handles on corners/edges
- Layout auto-saves when changed

---

## 7. Complete Example

### Governance Overview Dashboard

**Component 1: Status Distribution (Pie Chart)**
```typescript
// Top-left, 6 columns wide
{
  type: "pie",
  query_config: {
    sourceTable: "Referenda",
    columns: [{ column: "status" }],
    expressionColumns: [
      { expression: "COUNT(*)", alias: "count" }
    ],
    groupBy: ["status"],
    orderBy: [{ column: "count", direction: "DESC" }]
  },
  chart_config: {
    labelColumn: "status",
    valueColumn: "count",
    colors: ["#22c55e", "#ef4444", "#3b82f6"],
    showLegend: true
  },
  grid_config: { x: 0, y: 0, w: 6, h: 4 }
}
```

**Component 2: Top Spenders (Bar Chart)**
```typescript
// Top-right, 6 columns wide
{
  type: "bar_grouped",
  query_config: {
    sourceTable: "all_spending",
    columns: [{ column: "type" }],
    expressionColumns: [
      { expression: "SUM(DOT_latest)", alias: "total_dot" }
    ],
    groupBy: ["type"],
    orderBy: [{ column: "total_dot", direction: "DESC" }],
    limit: 10
  },
  chart_config: {
    showLegend: false,
    showTooltip: true
  },
  grid_config: { x: 6, y: 0, w: 6, h: 4 }
}
```

**Component 3: Recent Proposals (Table)**
```typescript
// Bottom, full-width
{
  type: "table",
  query_config: {
    sourceTable: "Referenda",
    joins: [{
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: { left: "Referenda.category_id", right: "c.id" }
    }],
    columns: [
      { column: "id" },
      { column: "title" },
      { column: "status" },
      { column: "track" },
      { column: "DOT_latest" },
      { column: "c.category", alias: "category" }
    ],
    filters: [
      { column: "status", operator: "=", value: "Ongoing" }
    ],
    orderBy: [{ column: "id", direction: "DESC" }],
    limit: 20
  },
  chart_config: {},
  grid_config: { x: 0, y: 4, w: 12, h: 5 }
}
```

---

## Tips and Best Practices

### Query Performance
- Use `LIMIT` to restrict row count (max 1000)
- Add filters to reduce dataset size
- Index frequently filtered columns in database

### Chart Design
- Use consistent colors across charts
- Show legends for multi-series charts
- Keep axis labels readable
- Limit categories in pie charts (< 10)

### Layout
- Group related components together
- Use consistent heights for side-by-side components
- Leave space for scrolling in tall tables
- Test responsive behavior on mobile

### Data Updates
- Dashboard data is cached
- Refresh page to fetch latest data
- Consider adding "Last Updated" timestamp component

---

## See Also

- [Dashboard System Specification](../spec/frontend/dashboard.md) - Detailed architecture
- [QueryBuilder How-To](./query-builder.md) - Query building details
- [Dashboard API Reference](../reference/frontend/dashboard-api.md) - Component props
