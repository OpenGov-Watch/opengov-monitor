# Table Features (Backend API)

Advanced filtering, sorting, and grouping capabilities for table endpoints.

## Advanced Filter Types

Advanced filters allow Notion-like complex filtering with AND/OR combinations.

### FilterOperator

Supported operators:
- Comparison: `=`, `!=`, `>`, `<`, `>=`, `<=`
- Pattern matching: `LIKE`, `NOT LIKE`
- List operations: `IN`, `NOT IN`
- Null checks: `IS NULL`, `IS NOT NULL`
- Range: `BETWEEN`

### AdvancedFilterCondition

Individual filter condition:
- `column`: Column name to filter on
- `operator`: FilterOperator
- `value`: Filter value (type depends on operator)
  - Single value: string | number
  - Array: string[] (for IN/NOT IN)
  - Range: [number, number] | [string, string] (for BETWEEN)
  - Null: null (for IS NULL/IS NOT NULL)

### AdvancedFilterGroup

Group of conditions combined with AND/OR:
- `combinator`: "AND" | "OR"
- `conditions`: Array of AdvancedFilterCondition or nested AdvancedFilterGroup

**Nesting:** Filter groups can be nested up to 10 levels deep for complex logic.

**Example:**
```json
{
  "combinator": "AND",
  "conditions": [
    { "column": "status", "operator": "=", "value": "Executed" },
    {
      "combinator": "OR",
      "conditions": [
        { "column": "DOT_latest", "operator": ">", "value": 10000 },
        { "column": "category", "operator": "IN", "value": ["Infrastructure", "Marketing"] }
      ]
    }
  ]
}
```

---

## Multi-Column Sorting

### SortCondition

- `column`: Column name to sort by
- `direction`: "ASC" | "DESC"

**Multi-sort:** Array of SortCondition applies sorting in order (primary sort first).

**Example:**
```json
[
  { "column": "status", "direction": "ASC" },
  { "column": "DOT_latest", "direction": "DESC" }
]
```

---

## Grouping Configuration

### GroupConfig

- `column`: Column to group by
- `aggregations`: Optional array of aggregation functions
  - `column`: Column to aggregate
  - `function`: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX"
  - `alias`: Display name for aggregated column

**Example:**
```json
{
  "column": "category",
  "aggregations": [
    { "column": "*", "function": "COUNT", "alias": "count" },
    { "column": "DOT_latest", "function": "SUM", "alias": "total_dot" }
  ]
}
```

---

## API Query Parameters

All table endpoints support these query parameters:
- `filters`: JSON-encoded AdvancedFilterGroup
- `sorts`: JSON-encoded SortCondition[]
- `groupBy`: Column name to group by
- `limit`: Max rows to return (capped at 10,000)
- `offset`: Number of rows to skip

**Backward Compatibility:** All endpoints work without these parameters (returns all data).

---

## Table View State

Saved view configuration (frontend state, not persisted backend):
- `name`: View name
- `filters`: AdvancedFilterGroup (optional)
- `sorts`: SortCondition[] (optional)
- `grouping`: GroupConfig (optional)
- `columnVisibility`: Record<string, boolean> (optional)
- `pagination`: { pageIndex, pageSize } (optional)
