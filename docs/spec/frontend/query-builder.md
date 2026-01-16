# QueryBuilder Specification

This document specifies the QueryBuilder component - a visual SQL query builder for creating dashboard components.

## Overview

**Component**: `QueryBuilder`
**Location**: `components/query-builder/query-builder.tsx`
**Purpose**: Visual interface for building SQL queries without writing SQL
**Output**: `QueryConfig` object for API execution

## Architecture

### Component Structure

```
QueryBuilder
├── Table Selection
├── JOIN Configuration
│   ├── Table Selector
│   ├── Alias Input
│   └── ON Clause (auto-populated)
├── Column Selection
│   ├── Standard Columns (with aliases)
│   └── Expression Columns (computed)
├── Filter Builder
│   └── FilterGroupBuilder (AND/OR logic)
├── ORDER BY Configuration
└── Live Preview
```

## QueryConfig Output

The QueryBuilder produces a `QueryConfig` object:

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
```

## Workflow

The QueryBuilder follows a logical workflow order:

1. **Table Selection**
   - Choose source table from allowlist
   - Tables must be in API's `ALLOWED_SOURCES`

2. **JOIN Configuration** (optional)
   - Add LEFT, INNER, or RIGHT joins
   - Auto-populated ON conditions based on FK patterns
   - Optional table aliases for shorter column references

3. **Column Selection**
   - Pick columns from source and joined tables
   - Columns grouped by table name
   - Optionally add aliases for display names
   - Add expression columns for computed values

4. **Expression Columns** (optional)
   - Define computed columns: `column1 + column2`
   - Supports aggregate functions: COUNT, SUM, AVG, MIN, MAX
   - Used with GROUP BY for aggregations

5. **Filters** (optional)
   - WHERE clause conditions
   - Supports AND/OR logic via FilterGroupBuilder
   - Multiple operators: =, !=, >, <, >=, <=, LIKE, IS NULL, IS NOT NULL

6. **ORDER BY** (optional)
   - Sort results by one or more columns
   - ASC or DESC direction

7. **Preview**
   - Execute query and show results
   - Displays generated SQL
   - Limited to 1000 rows for dashboard queries

## JOIN System

### Auto-Detected Foreign Keys

The QueryBuilder automatically detects foreign key relationships based on naming patterns:

**Pattern 1: `{table}_id` columns**
```
category_id → joins to Categories.id
parent_bounty_id → joins to Bounties.id
```

**Pattern 2: `{table}Id` camelCase**
```
parentBountyId → joins to Bounties.id
referendumId → joins to Referenda.id
```

**Pattern 3: `{table}Index`**
```
referendumIndex → joins to Referenda.id
```

**Special case: Child Bounties**
```
Uses identifier as primary key (not id)
Joins TO Child Bounties use Child Bounties.identifier
```

### JOIN Configuration

```typescript
interface JoinConfig {
  type: "LEFT" | "INNER" | "RIGHT";
  table: string;
  alias?: string;
  on: {
    left: string;   // e.g., "Referenda.category_id"
    right: string;  // e.g., "Categories.id"
  };
}
```

### JOIN Examples

**Example 1: Single JOIN with auto-detection**
```typescript
{
  sourceTable: "Referenda",
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: {
      left: "Referenda.category_id",  // Auto-detected
      right: "c.id"
    }
  }],
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "c.category", alias: "category" }
  ]
}
```

**Example 2: Multiple JOINs**
```typescript
{
  sourceTable: "Child Bounties",
  joins: [
    {
      type: "LEFT",
      table: "Categories",
      alias: "c",
      on: {
        left: "Child Bounties.category_id",
        right: "c.id"
      }
    },
    {
      type: "LEFT",
      table: "Bounties",
      alias: "b",
      on: {
        left: "Child Bounties.parentBountyId",
        right: "b.id"
      }
    }
  ],
  columns: [
    { column: "Child Bounties.title" },
    { column: "c.name", alias: "category" },
    { column: "b.title", alias: "parent_bounty" }
  ]
}
```

## Column Selection

### Standard Columns

```typescript
interface ColumnSelection {
  column: string;      // Fully qualified: "table.column" or just "column"
  alias?: string;      // Display name
}
```

**Examples:**
```typescript
{ column: "id" }                              // Simple
{ column: "Referenda.title" }                 // Qualified
{ column: "c.category", alias: "category" }   // With alias
```

### Expression Columns

```typescript
interface ExpressionColumn {
  expression: string;   // SQL expression
  alias: string;        // Required for expressions
}
```

**Examples:**
```typescript
{ expression: "SUM(DOT_latest)", alias: "total_dot" }
{ expression: "COUNT(*)", alias: "count" }
{ expression: "AVG(USD_latest)", alias: "avg_usd" }
```

### Column Organization

In the UI, columns are grouped by table:
- Source table columns listed first
- Joined table columns grouped by table name
- Expression columns in separate section

## Filter System

Filters use the FilterGroupBuilder component for AND/OR logic.

### Filter Operators

```typescript
const FILTER_OPERATORS = [
  "=",           // equals
  "!=",          // not equals
  ">",           // greater than
  "<",           // less than
  ">=",          // greater than or equal
  "<=",          // less than or equal
  "LIKE",        // pattern matching
  "IS NULL",     // null check
  "IS NOT NULL", // not null check
] as const;
```

### Filter Examples

**Simple filter:**
```typescript
{
  column: "status",
  operator: "=",
  value: "Executed"
}
```

**Complex filter with AND/OR:**
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "=", value: "Executed" },
    {
      operator: "OR",
      conditions: [
        { column: "DOT_latest", operator: ">", value: "1000" },
        { column: "USD_latest", operator: ">", value: "10000" }
      ]
    }
  ]
}
```

## Aggregate Functions

When using aggregate functions (COUNT, SUM, AVG, MIN, MAX), GROUP BY is required:

```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "status" }
  ],
  expressionColumns: [
    { expression: "COUNT(*)", alias: "count" },
    { expression: "SUM(DOT_latest)", alias: "total_dot" }
  ],
  groupBy: ["status"],
  orderBy: [{ column: "count", direction: "DESC" }]
}
```

## ORDER BY

```typescript
interface OrderByConfig {
  column: string;              // Column name or alias
  direction: "ASC" | "DESC";
}
```

**Examples:**
```typescript
orderBy: [
  { column: "id", direction: "DESC" },
  { column: "proposal_time", direction: "ASC" }
]
```

## Limitations

- **Row Limit**: Dashboard queries are limited to 1000 rows
- **Table Allowlist**: Only tables in API's `ALLOWED_SOURCES` can be queried
- **Security**: Queries are validated and sanitized by the API
- **No Subqueries**: Subqueries are not supported
- **No UNION**: UNION operations are not supported

## Live Preview

The preview feature:
- Executes the current query via POST `/api/query/execute`
- Displays results in a simple table
- Shows the generated SQL for debugging
- Limited to 1000 rows
- Helps validate queries before saving

## Integration

The QueryBuilder is primarily used in:
- **Dashboard ComponentEditor**: Create/edit dashboard components
- **Custom Query Pages**: Any page needing dynamic query building

## Key Files

```
frontend/src/components/query-builder/
├── query-builder.tsx        # Main component
├── sortable-column.tsx      # Drag-and-drop column ordering
└── types.ts                 # TypeScript interfaces
```

## See Also

- [QueryBuilder How-To Guide](../../howtos/query-builder.md) - Practical examples
- [Dashboard System](./dashboard.md) - Primary use case for QueryBuilder
- [Filtering Systems](./filters.md) - Filter builder details
- [QueryBuilder API Reference](../../reference/frontend/query-builder-api.md) - Props and callbacks
