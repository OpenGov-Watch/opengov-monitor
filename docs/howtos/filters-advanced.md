# Filtering Advanced

Advanced filters using QueryBuilder with AND/OR logic, nested conditions, and complex patterns.

For basic filtering (faceted filters, global search), see [Filtering Basics](./filters-basics.md).

## Advanced Filters (QueryBuilder)

Complex filter builder with AND/OR logic for custom queries in dashboards.

### Filter Operators by Column Type

**Categorical** (`status`, `track`, `category`, etc.):
- `IN` - Value in list (multiselect dropdown with search and counts)
- `NOT IN` - Value not in list
- `IS NULL` / `IS NOT NULL` - Check for NULL

**Numeric** (DOT, USD, IDs):
- `=`, `!=`, `>`, `<`, `>=`, `<=` - Comparisons
- `IS NULL` / `IS NOT NULL`

**Text** (`title`, `description`, `notes`):
- `=`, `!=` - Exact match
- `>`, `<`, `>=`, `<=` - Lexicographic comparisons
- `LIKE` - Pattern match (use `%` wildcards)
- `IS NULL` / `IS NOT NULL`

**Date** (`*_time`, `*_at`, `*date*`):
- `=`, `!=`, `>`, `<`, `>=`, `<=` - Date comparisons
- `IS NULL` / `IS NOT NULL`

---

## Categorical Column Multiselect

For categorical columns, the filter builder provides enhanced multiselect dropdown with `IN`/`NOT IN` operators:

**Features**: Dropdown shows all values with counts, search functionality, select multiple values, apply/cancel pattern

**Example - Filter by Multiple Statuses**:
1. Add condition, Column: `status`, Operator: `in list`
2. Click multiselect dropdown, check "Executed", "Ongoing", "Confirmed"
3. Click "Apply"

Shows rows where status is any of the selected values (OR logic).

---

## Simple Filter

Show only executed proposals:

```typescript
filters: [
  { column: "status", operator: "IN", value: ["Executed"] }
]
```

---

## AND Logic (Default)

Executed proposals with DOT > 1000:

```typescript
filters: [
  { column: "status", operator: "IN", value: ["Executed"] },
  { column: "DOT_latest", operator: ">", value: "1000" }
]
```

Shows rows where BOTH conditions are true.

---

## OR Logic

Root track OR Whitelisted Caller track:

```typescript
{
  operator: "OR",
  conditions: [
    { column: "track", operator: "IN", value: ["Root"] },
    { column: "track", operator: "IN", value: ["Whitelisted Caller"] }
  ]
}
```

**Alternative**: Use single `IN` condition with both values in multiselect.

---

## Nested AND/OR

Executed proposals in Root OR Whitelisted Caller tracks:

```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "IN", value: ["Executed"] },
    { column: "track", operator: "IN", value: ["Root", "Whitelisted Caller"] }
  ]
}
```

**SQL equivalent**:
```sql
WHERE status IN ('Executed')
  AND track IN ('Root', 'Whitelisted Caller')
```

---

## Common Patterns

### Date Range
```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

### Numeric Range
```typescript
filters: [
  { column: "DOT_latest", operator: ">=", value: "1000" },
  { column: "DOT_latest", operator: "<=", value: "10000" }
]
```

### Text Pattern
```typescript
filters: [
  { column: "title", operator: "LIKE", value: "%treasury%" }
]
```

### Exclude Nulls
```typescript
filters: [
  { column: "category_id", operator: "IS NOT NULL" }
]
```

### Multiple Exclusions
```typescript
filters: [
  { column: "status", operator: "NOT IN", value: ["Rejected", "Cancelled"] }
]
```

---

## Nested Filters in Dashboards

Dashboard filters support nested AND/OR logic with full persistence to database.

**Creating Complex Logic**:
1. Click "Add Condition" for simple filter
2. Click "Add Group" for nested group
3. Toggle between AND/OR at each level
4. Build queries like: `(status = 'Active' AND amount > 1000) OR (priority = 'High')`

**Example - Multi-Level Filter**:
```typescript
{
  operator: 'AND',
  conditions: [
    { column: 'status', operator: 'IN', value: ['Active'] },
    {
      operator: 'OR',
      conditions: [
        { column: 'amount', operator: '>', value: 1000 },
        { column: 'priority', operator: 'IN', value: ['High'] }
      ]
    }
  ]
}
```

**Generates SQL**:
```sql
WHERE status IN ('Active') AND (amount > 1000 OR priority IN ('High'))
```

---

## Dashboard Filter Combinations

Fully customizable AND/OR logic.

**Example**: High-value proposals in specific tracks, excluding rejected.

```typescript
{
  operator: "AND",
  conditions: [
    { column: "DOT_latest", operator: ">", value: "10000" },
    { column: "status", operator: "NOT IN", value: ["Rejected"] },
    { column: "track", operator: "IN", value: ["Root", "Treasurer"] }
  ]
}
```

---

## Advanced Filter Strategy

**Use Advanced Filters**: Complex AND/OR logic, saved queries (dashboards), multiple conditions on same column, numeric ranges, pattern matching, NULL checks

**Combine Approaches**: Start with faceted filters for common categories, add global search for quick text lookup, build advanced filters for complex saved views

---

## Performance

**Advanced Filters**: Server-side execution, use indexes, avoid excessive nesting (< 3 levels)

---

## Troubleshooting

**Advanced filter returns no results**: Check operator (= vs LIKE for text), verify value format (dates, numbers), preview query, check AND/OR logic

**Filter combinations too restrictive**: Verify AND/OR logic, check if values exist in the dataset

---

## See Also

- [Filtering Basics](./filters-basics.md) - Getting started
- [Filters Specification](../01_requirements/frontend/filters.md) - Technical details
- [QueryBuilder How-To](./query-builder.md) - Building complex queries
- [Dashboard How-To](./dashboard.md) - Using filters in dashboards
