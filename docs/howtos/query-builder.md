# How to Use the QueryBuilder

This guide covers using the visual QueryBuilder to create SQL queries without writing SQL code.

## Table of Contents
1. [Basic Query](#1-basic-query)
2. [Adding JOINs](#2-adding-joins)
3. [Using Expressions and Aggregates](#3-using-expressions-and-aggregates)
4. [Adding Filters](#4-adding-filters)
5. [Sorting Results](#5-sorting-results)
6. [Preview and Debug](#6-preview-and-debug)
7. [Common Patterns](#7-common-patterns)

---

## 1. Basic Query

### Selecting Data from a Single Table

**Goal**: Show all referenda with their basic info.

1. **Select Source Table**: Choose "Referenda" from dropdown
2. **Pick Columns**: Check the columns you want:
   - `id`
   - `title`
   - `status`
   - `DOT_latest`
   - `proposal_time`
3. **Set Limit**: Enter `100` for row limit
4. **Click Preview**: See your results

**Generated QueryConfig**:
```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "status" },
    { column: "DOT_latest" },
    { column: "proposal_time" }
  ],
  limit: 100
}
```

---

## 2. Adding JOINs

### Joining Related Tables

**Goal**: Show referenda with their category names.

1. **Source Table**: "Referenda"
2. **Add JOIN**:
   - Click "Add JOIN" button
   - Table: "Categories"
   - Alias: "c" (optional, but recommended)
   - ON clause: Auto-filled as `Referenda.category_id = c.id`
3. **Select Columns** from both tables:
   - `Referenda.id`
   - `Referenda.title`
   - `c.category` (give it alias "category")
   - `c.subcategory` (give it alias "subcategory")

**Generated QueryConfig**:
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

### Multiple JOINs

**Goal**: Show child bounties with their category and parent bounty.

1. **Source Table**: "Child Bounties"
2. **Add First JOIN**:
   - Table: "Categories"
   - Alias: "c"
   - ON: `Child Bounties.category_id = c.id` (auto-filled)
3. **Add Second JOIN**:
   - Table: "Bounties"
   - Alias: "b"
   - ON: `Child Bounties.parentBountyId = b.id` (auto-filled)
4. **Select Columns**:
   - `Child Bounties.title` → alias "child_title"
   - `c.category` → alias "category"
   - `b.title` → alias "parent_title"

**Generated QueryConfig**:
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

## 3. Using Expressions and Aggregates

### Count Rows by Category

**Goal**: Count how many referenda in each status.

1. **Source Table**: "Referenda"
2. **Select Column**: `status`
3. **Add Expression Column**:
   - Expression: `COUNT(*)`
   - Alias: `count`
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

**Result**:
```
status      | count
------------|------
Executed    | 1234
Rejected    | 567
Ongoing     | 89
```

### Sum Values by Group

**Goal**: Total DOT spent per track.

1. **Source Table**: "Referenda"
2. **Select Column**: `track`
3. **Add Expression Column**:
   - Expression: `SUM(DOT_latest)`
   - Alias: `total_dot`
4. **Add GROUP BY**: Select `track`
5. **Add ORDER BY**: Order by `total_dot` DESC

**Generated QueryConfig**:
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

**Goal**: Show count, sum, and average for each status.

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

## 4. Adding Filters

### Simple Filter

**Goal**: Show only executed referenda.

1. **Add Filter**:
   - Column: `status`
   - Operator: `=`
   - Value: `Executed`

**Generated**:
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" }
]
```

### Multiple Filters (AND)

**Goal**: Executed referenda with DOT > 1000.

1. **Add First Filter**: `status = "Executed"`
2. **Add Second Filter**: `DOT_latest > 1000`
3. **Both are in same AND group** (default)

**Generated**:
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" },
  { column: "DOT_latest", operator: ">", value: "1000" }
]
```

### OR Logic

**Goal**: Root OR Whitelisted Caller tracks.

1. **Add Filter Group**: Set operator to "OR"
2. **Add First Condition**: `track = "Root"`
3. **Add Second Condition**: `track = "Whitelisted Caller"`

**Generated**:
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

**Goal**: Executed referenda in Root OR Whitelisted Caller tracks.

1. **Top-level**: AND group (default)
2. **Add Filter**: `status = "Executed"`
3. **Add OR Sub-group**:
   - `track = "Root"`
   - `track = "Whitelisted Caller"`

**Generated**:
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

**Goal**: Proposals from 2025.

```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

### NULL Checks

**Goal**: Referenda without categories.

```typescript
filters: [
  { column: "category_id", operator: "IS NULL" }
]
```

---

## 5. Sorting Results

### Single Column Sort

**Goal**: Newest referenda first.

- Column: `id`
- Direction: `DESC`

**Generated**:
```typescript
orderBy: [
  { column: "id", direction: "DESC" }
]
```

### Multiple Column Sort

**Goal**: Sort by status (ASC), then DOT (DESC).

1. **First**: `status` ASC
2. **Second**: `DOT_latest` DESC

**Generated**:
```typescript
orderBy: [
  { column: "status", direction: "ASC" },
  { column: "DOT_latest", direction: "DESC" }
]
```

### Sort by Computed Column

When using aggregates, sort by the alias:

```typescript
{
  expressionColumns: [
    { expression: "SUM(DOT_latest)", alias: "total_dot" }
  ],
  orderBy: [
    { column: "total_dot", direction: "DESC" }
  ]
}
```

---

## 6. Preview and Debug

### Using Preview

1. **Click "Preview" button**: Executes query and shows results
2. **Review SQL**: Check the generated SQL query
3. **Check Results**: Verify data looks correct
4. **Iterate**: Adjust columns/filters/sorting as needed

### Common Issues

**No results shown:**
- Check filters - might be too restrictive
- Verify JOIN conditions are correct
- Check if source table has data

**Error: "Invalid column":**
- Column name might be misspelled
- Missing table qualifier (use `table.column` format)
- Column might not exist in selected table

**Error: "Invalid join table":**
- Table must be in API allowlist
- Check table name spelling (case-sensitive)

**Aggregate without GROUP BY:**
- Add GROUP BY clause when using COUNT, SUM, AVG, MIN, MAX
- Include all non-aggregated columns in GROUP BY

---

## 7. Common Patterns

### Pattern: Top N by Category

**Goal**: Top 5 proposals per category.

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

### Pattern: Time-based Aggregation

**Goal**: Monthly proposal counts (requires preprocessed date columns).

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "proposal_month" }  // Assumes YYYY-MM format
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

### Pattern: Category Distribution

**Goal**: Spending breakdown by category.

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

### Pattern: Filtered Aggregation

**Goal**: Count executed proposals by track.

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

## Tips

### Performance
- Always use `LIMIT` to restrict rows
- Add filters to reduce dataset size
- Avoid joining unnecessary tables

### Column Aliases
- Use descriptive aliases for computed columns
- Alias joined columns to avoid conflicts
- Keep aliases short for readability

### JOINs
- LEFT JOIN when related data might be missing
- INNER JOIN when you only want matching rows
- Use table aliases (c, b, r) to shorten queries

### Debugging
- Start simple, add complexity gradually
- Use Preview frequently to validate changes
- Check generated SQL to understand what's happening
- Verify column names match database schema

---

## See Also

- [QueryBuilder Specification](../spec/frontend/query-builder.md) - Detailed architecture
- [Dashboard How-To](./dashboard.md) - Using QueryBuilder in dashboards
- [Filtering How-To](./filters.md) - Advanced filtering patterns
