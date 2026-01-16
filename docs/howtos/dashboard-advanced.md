# Dashboard Advanced

Advanced dashboard features: complex charts, JOINs, filters, and real-world examples.

For basic usage (creating dashboards, simple tables, pie charts), see [Dashboard Basics](./dashboard-basics.md).

## Advanced Chart Types

### Bar Chart (Grouped or Stacked)

Compare multiple series across categories:

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

Show trends over time:

```typescript
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
```

---

## Building Queries with JOINs

The QueryBuilder automatically detects foreign key relationships.

### Example: Referenda with Categories
```typescript
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

## Adding Filters

Use the FilterGroupBuilder to add WHERE conditions.

**Simple Filter:**
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" }
]
```

**Multiple Conditions (AND):**
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" },
  { column: "DOT_latest", operator: ">", value: "1000" }
]
```

**Complex Filter (AND/OR):**
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

**Date Filters:**
```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

---

## Complete Example: Governance Overview Dashboard

### Component 1: Status Distribution (Pie Chart)
```typescript
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

### Component 2: Top Spenders (Bar Chart)
```typescript
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

### Component 3: Recent Proposals (Table)
```typescript
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

## Advanced Tips

**Query Performance**: Index frequently filtered columns, avoid joining unnecessary tables, use LIMIT to prevent large result sets

**Chart Design**: Keep axis labels readable, test responsive behavior, consider adding "Last Updated" timestamp component

**Layout**: Leave space for scrolling in tall tables, test different screen sizes

---

## See Also

- [Dashboard Basics](./dashboard-basics.md) - Getting started
- [Dashboard Specification](../01_requirements/frontend/dashboard.md) - Architecture details
- [QueryBuilder How-To](./query-builder.md) - Query building details
- [Table Systems Reference](../03_design/frontend/table-systems.md) - Table architecture
