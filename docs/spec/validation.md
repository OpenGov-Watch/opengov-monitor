# Validation Rules

API input validation and error responses. Use for testing.

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (creates resource) |
| 400 | Validation failure |
| 401 | Authentication required |
| 404 | Resource not found |
| 429 | Rate limited |
| 500 | Server error |

## Error Response Format

```json
{ "error": "Human-readable message" }
```

---

## Dashboard Endpoints

### POST /api/dashboards

| Field | Required | Error |
|-------|----------|-------|
| `name` | Yes, non-empty | `"Name is required"` |
| `description` | No | - |

### PUT /api/dashboards

| Field | Required | Error |
|-------|----------|-------|
| `id` | Yes | `"ID is required"` |
| `name` | Yes, non-empty | `"Name is required"` |

### DELETE /api/dashboards

| Param | Required | Error |
|-------|----------|-------|
| `id` (query) | Yes | `"ID is required"` |

### GET /api/dashboards?id={id}

Returns 404 `"Dashboard not found"` if ID doesn't exist.

---

## Dashboard Component Endpoints

### GET /api/dashboards/components

Requires `dashboard_id` or `id` query param → 400 `"dashboard_id or id is required"`

Returns 404 `"Component not found"` if ID doesn't exist.

### POST /api/dashboards/components

| Field | Required | Error |
|-------|----------|-------|
| `dashboard_id` | Yes | `"dashboard_id is required"` |
| `name` | Yes | `"name is required"` |
| `type` | Yes | `"type is required"` |
| `query_config` | Yes (unless type=text) | `"query_config is required"` |
| `grid_config` | Yes | `"grid_config is required"` |

### PUT /api/dashboards/components

**Full update:** requires `id`, `name`, `type`, `query_config` (unless text), `grid_config`

**Grid-only:** requires `id`, `grid_only: true`, `grid_config`

Error: `"name, type, query_config (for non-text), and grid_config are required"`

---

## Query Builder

### POST /api/query/execute

| Field | Validation | Error |
|-------|------------|-------|
| `sourceTable` | Must be whitelisted | `"Invalid source table: {table}"` |
| `columns` | Required if no expressionColumns | `"At least one column or expression must be selected"` |
| `columns[].column` | Alphanumeric + `_.` + space | `"Invalid column name: {name}"` |
| `columns[].aggregateFunction` | COUNT, SUM, AVG, MIN, MAX | `"Invalid aggregate function: {fn}"` |
| `filters[].operator` | =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL | `"Invalid operator: {op}"` |
| `limit` | Capped at 10,000 | - |

### Expression Column Validation

- Max length: 500 chars
- Blocked patterns: `;`, `--`, `/*`, UNION, SELECT, INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, EXEC, ATTACH, DETACH, PRAGMA
- Column references must exist in selected table
- Alias must match: `^[a-zA-Z_][a-zA-Z0-9_]*$`

Errors:
- `"Expression cannot be empty"`
- `"Expression columns must have an alias"`
- `"Invalid expression alias: {alias}. Use only letters, numbers, and underscores."`
- `"Invalid expression \"{alias}\": Expression contains blocked pattern: {pattern}"`
- `"Invalid expression \"{alias}\": Unknown column or function: {id}"`

### Regular Column Alias Validation

**Security:** All column aliases are sanitized to prevent SQL injection (see [Security Threat Model](security-threat-model.md#critical-sql-injection-in-query-builder)).

- Alias pattern: `^[a-zA-Z_][a-zA-Z0-9_]*$` (alphanumeric + underscore, must start with letter/underscore)
- Aggregate function aliases follow same validation

Errors:
- `"Invalid alias: {alias}. Use only letters, numbers, and underscores."`

### Whitelisted Tables

Referenda, Treasury, Child Bounties, Fellowship, Fellowship Salary Cycles, Fellowship Salary Claimants, categories, bounties, subtreasury, Fellowship Subtreasury, outstanding_claims, expired_claims, all_spending

---

## Advanced Table Query Parameters

All table endpoints (Referenda, Treasury, Child Bounties, Fellowship, etc.) support advanced filtering, sorting, and grouping via query parameters.

### Query Parameters

| Parameter | Type | Validation | Error |
|-----------|------|------------|-------|
| `filters` | JSON string | Must be valid AdvancedFilterGroup | `"Failed to parse filters: {error}"` |
| `sorts` | JSON string | Must be array of SortCondition | `"Failed to parse sorts: {error}"` |
| `groupBy` | string | Must be valid column name | `"Invalid column: {column}"` |
| `limit` | integer | 1-10,000 | `"Invalid limit value"` |
| `offset` | integer | >= 0 | `"Invalid offset value"` |

### Filter Validation

**AdvancedFilterGroup structure:**
```json
{
  "combinator": "AND" | "OR",
  "conditions": [/* AdvancedFilterCondition or nested AdvancedFilterGroup */]
}
```

**AdvancedFilterCondition structure:**
```json
{
  "column": "column_name",
  "operator": "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "NOT LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL" | "BETWEEN",
  "value": /* depends on operator */
}
```

**Filter Limits:**
- Max nesting depth: 10 levels
- Max conditions per group: 100
- All column names must exist in table schema

**Operator-specific validation:**
- `IN`, `NOT IN`: value must be non-empty array
- `BETWEEN`: value must be array with exactly 2 elements
- `LIKE`, `NOT LIKE`: value must be string
- `IS NULL`, `IS NOT NULL`: value ignored
- Comparison operators (`=`, `!=`, etc.): value must not be null/array

**Errors:**
- `"Filter nesting too deep (max 10 levels)"`
- `"Too many filter conditions (max 100)"`
- `"Invalid column: {column}. Column does not exist in table."`
- `"Invalid operator: {operator}"`
- `"IN operator requires an array value"`
- `"IN operator requires at least one value"`
- `"BETWEEN operator requires an array with exactly 2 values"`
- `"Operator {op} requires a non-null value. Use IS NULL instead."`

### Sort Validation

**SortCondition structure:**
```json
{ "column": "column_name", "direction": "ASC" | "DESC" }
```

**Validation:**
- All columns must exist in table schema
- Direction must be "ASC" or "DESC"

**Errors:**
- `"Invalid column: {column}. Column does not exist in table."`
- `"Invalid sort direction: {direction}"`

### Security

**Critical:** All filter compilation uses parameterized queries to prevent SQL injection.

**Column name validation:**
- Must match pattern: `^[a-zA-Z0-9_.\s]+$`
- Must exist in table schema (whitelist validation)

**Blocked in filter expressions:**
- Semicolons, SQL comments (`--`, `/**/`)
- SQL keywords: UNION, SELECT, INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, EXEC, ATTACH, DETACH, PRAGMA, VACUUM, REINDEX

**Example valid filter request:**
```
GET /api/referenda?filters=%7B%22combinator%22%3A%22AND%22%2C%22conditions%22%3A%5B%7B%22column%22%3A%22status%22%2C%22operator%22%3A%22%3D%22%2C%22value%22%3A%22Executed%22%7D%5D%7D
```

Decoded filters:
```json
{
  "combinator": "AND",
  "conditions": [
    { "column": "status", "operator": "=", "value": "Executed" }
  ]
}
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| DELETE non-existent ID | 200, success (no-op) |
| UPDATE non-existent ID | 200, success (no rows affected) |
| null description | Accepted, stored as null |
| Empty filter array | Valid, no WHERE clause |
| Limit > 10,000 | Capped to 10,000 |
| No query parameters | Returns all data (backward compatible) |
| Empty filter group conditions | Valid, no WHERE clause |
| Deeply nested filters (>10 levels) | 500, `"Filter nesting too deep"` |
