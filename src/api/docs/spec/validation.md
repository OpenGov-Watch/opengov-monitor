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

Referenda, Treasury, Child Bounties, Fellowship, Fellowship Salary Cycles, Fellowship Salary Claimants, Fellowship Salary Payments, Categories, Bounties, Subtreasury, Fellowship Subtreasury, Treasury Netflows, DataErrors, outstanding_claims, expired_claims, all_spending, treasury_netflows_view

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| DELETE non-existent ID | 200, success (no-op) |
| UPDATE non-existent ID | 200, success (no rows affected) |
| null description | Accepted, stored as null |
| Empty filter array | Valid, no WHERE clause |
| Limit > 10,000 | Capped to 10,000 |
