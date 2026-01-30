# QueryBuilder Specification

Technical details for the visual query builder component.

## Foreign Key Auto-Detection

Naming patterns used to auto-detect JOIN relationships:

| Pattern | Example Column | Joins To |
|---------|----------------|----------|
| `{table}_id` | `referendum_id` | `Referenda.id` |
| `{table}Id` | `referendumId` | `Referenda.id` |
| `{table}Index` | `referendumIndex` | `Referenda.id` |

**Special Cases:**
- Child Bounties use `identifier` as primary key (not `id`)

## Aggregate Functions

| Function | Description |
|----------|-------------|
| COUNT | Count of rows |
| SUM | Sum of numeric values |
| AVG | Average of numeric values |
| MIN | Minimum value |
| MAX | Maximum value |

## JOIN Types

| Type | Behavior |
|------|----------|
| LEFT | All rows from left table, matching rows from right |
| INNER | Only matching rows from both tables |
| RIGHT | All rows from right table, matching rows from left |

## Row Limits

| Context | Limit |
|---------|-------|
| Dashboard components | 1,000 |
| Query preview | 1,000 |

## See Also

- [QueryBuilder Requirements](../../01_requirements/frontend/query-builder.md)
- [Filters Specification](filters.md) - Operators by column type
- [UI Constants](ui-constants.md) - Row limits, page sizes
