# QueryBuilder Advanced

Advanced QueryBuilder features: expressions, aggregates, complex filters, and patterns.

For basic usage (simple queries, JOINs, sorting), see [QueryBuilder Basics](./query-builder-basics.md).

## Using Expressions and Aggregates

### Count Rows by Category

Count referenda in each status:

1. **Source Table**: "Referenda"
2. **Select Column**: `status`
3. **Add Expression Column**: `COUNT(*)` with alias `count`
4. **Add GROUP BY**: Select `status`
5. **Add ORDER BY**: Order by `count` DESC

**Generated QueryConfig**:
```typescript
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
```

### Sum Values by Group

Total DOT spent per track:

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "track" }
  ],
  expressionColumns: [
    { expression: "SUM(DOT_latest)", alias: "total_dot" }
  ],
  groupBy: ["track"],
  orderBy: [{ column: "total_dot", direction: "DESC" }]
}
```

### Multiple Aggregates

Show count, sum, and average for each status:

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "status" }
  ],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" },
    { expression: "SUM(DOT_latest)", alias: "total_dot" },
    { expression: "AVG(DOT_latest)", alias: "avg_dot" }
  ],
  groupBy: ["status"],
  orderBy: [{ column: "total_dot", direction: "DESC" }]
}
```

---

## Adding Filters

### Simple Filter

Show only executed referenda:

```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" }
]
```

### Multiple Filters (AND)

Executed referenda with DOT > 1000:

```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" },
  { column: "DOT_latest", operator: ">", value: "1000" }
]
```

### OR Logic

Root OR Whitelisted Caller tracks:

```typescript
{
  operator: "OR",
  conditions: [
    { column: "track", operator: "=", value: "Root" },
    { column: "track", operator: "=", value: "Whitelisted Caller" }
  ]
}
```

### Complex AND/OR

Executed referenda in Root OR Whitelisted Caller tracks:

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

### Date Range

Proposals from 2025:

```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

### NULL Checks

Referenda without categories:

```typescript
filters: [
  { column: "category_id", operator: "IS NULL" }
]
```

---

## Multiple JOINs

Child bounties with their category and parent bounty:

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
    { column: "Child Bounties.title", alias: "child_title" },
    { column: "c.category", alias: "category" },
    { column: "b.title", alias: "parent_title" }
  ]
}
```

---

## Common Patterns

### Top N by Category

Top 5 proposals per category:

```typescript
{
  sourceTable: "Referenda",
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: { left: "Referenda.category_id", right: "c.id" }
  }],
  columns: [
    { column: "c.category", alias: "category" },
    { column: "title" },
    { column: "DOT_latest" }
  ],
  filters: [
    { column: "DOT_latest", operator: "IS NOT NULL" }
  ],
  orderBy: [
    { column: "DOT_latest", direction: "DESC" }
  ],
  limit: 5
}
```

### Time-based Aggregation

Monthly proposal counts (requires preprocessed date columns):

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "proposal_month" }  // YYYY-MM format
  ],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" }
  ],
  groupBy: ["proposal_month"],
  orderBy: [
    { column: "proposal_month", direction: "ASC" }
  ]
}
```

### Category Distribution

Spending breakdown by category:

```typescript
{
  sourceTable: "all_spending",
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: { left: "all_spending.category_id", right: "c.id" }
  }],
  columns: [
    { column: "c.category", alias: "category" }
  ],
  expressionColumns: [
    { expression: "SUM(DOT_latest)", alias: "total_dot" },
    { expression: "COUNT(*)", alias: "count" }
  ],
  groupBy: ["c.category"],
  orderBy: [
    { column: "total_dot", direction: "DESC" }
  ]
}
```

### Filtered Aggregation

Count executed proposals by track:

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "track" }
  ],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" }
  ],
  filters: [
    { column: "status", operator: "=", value: "Executed" }
  ],
  groupBy: ["track"],
  orderBy: [
    { column: "count", direction: "DESC" }
  ]
}
```

---

## Optimization Tips

**Performance**: Always use LIMIT to prevent large result sets. Add filters before aggregating to reduce the dataset. Avoid joining tables you don't need columns from.

**Aggregates**: Include all non-aggregated columns in GROUP BY. Use HAVING (via post-aggregation filters) to filter aggregated results. Consider creating views for frequently used aggregations.

**Complex Queries**: Build incrementally - start simple, test, then add complexity. Use Preview frequently to catch issues early. Check the generated SQL to understand query structure.

---

## See Also

- [QueryBuilder Basics](./query-builder-basics.md) - Getting started
- [QueryBuilder Specification](../spec/frontend/query-builder.md) - Architecture details
- [Dashboard How-To](./dashboard.md) - Using QueryBuilder in dashboards
- [Filtering How-To](./filters.md) - Advanced filtering patterns
