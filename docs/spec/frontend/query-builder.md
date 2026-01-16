# QueryBuilder Specification

Requirements for visual SQL query builder interface.

## Purpose

Must provide visual interface for constructing SQL queries without writing SQL code, primarily for creating dashboard components.

## Query Configuration Output Requirements

Must produce query configuration object specifying:
- Source table selection
- Column selections with optional aliases
- Computed expression columns
- JOIN configurations
- Filter conditions with AND/OR logic
- GROUP BY clauses
- ORDER BY specifications
- Row limits

## Workflow Requirements

Must follow logical workflow order:

1. **Table Selection**
   - Must choose source table from allowlist
   - Must validate against API's allowed sources

2. **JOIN Configuration** (optional)
   - Must support LEFT, INNER, and RIGHT join types
   - Must auto-populate ON conditions from foreign key patterns
   - Must support optional table aliases

3. **Column Selection**
   - Must pick columns from source and joined tables
   - Must group columns by table name
   - Must support column aliases
   - Must support expression columns for computed values

4. **Expression Columns** (optional)
   - Must define computed columns using SQL expressions
   - Must support aggregate functions: COUNT, SUM, AVG, MIN, MAX
   - Must work with GROUP BY for aggregations

5. **Filters** (optional)
   - Must build WHERE clause conditions
   - Must support AND/OR logic nesting
   - Must support multiple operators

6. **ORDER BY** (optional)
   - Must sort by one or more columns
   - Must support ASC and DESC directions

7. **Preview**
   - Must execute query and display results
   - Must show generated SQL
   - Must limit to 1000 rows for dashboards

## JOIN Requirements

### Foreign Key Auto-Detection
Must automatically detect foreign key relationships by these naming patterns:
- `{table}_id` columns → joins to `{Table}.id`
- `{table}Id` camelCase → joins to `{Table}.id`
- `{table}Index` → joins to `{Table}.id`
- Special case: Child Bounties uses `identifier` not `id`

### JOIN Configuration
Must specify for each join:
- Join type (LEFT, INNER, or RIGHT)
- Target table name
- Optional table alias
- ON clause with left and right column references

### Fallback Behavior
- Must leave ON clause empty when no FK pattern detected
- Must allow manual column selection for ON clause

## Column Selection Requirements

### Standard Columns
- Must support fully qualified names (table.column) or simple names
- Must allow optional aliases for display customization
- Must show columns grouped by source table and joined tables

### Expression Columns
- Must accept SQL expressions (calculations, aggregates)
- Must require alias for all expressions
- Must validate expression syntax

## Filter System Requirements

Must use `FilterGroupBuilder` component with full nested group support.

### Data Format
- Must store filters as `FilterGroup` (not flat array)
- Must support nested AND/OR groups at arbitrary depth
- Must preserve nested structure through save/load cycles
- Must automatically convert legacy `FilterCondition[]` to `FilterGroup`

### Integration
- Must use memoized `ensureFilterGroup()` helper for backward compatibility
- Must use stable `onUpdate` callback to prevent unnecessary re-renders
- Must NOT flatten nested groups on update

### Filter Group Structure
- Must support AND and OR operators at group level
- Must allow unlimited nesting depth
- Must support adding/removing conditions dynamically
- Must support adding/removing nested groups
- Must preserve filter structure when saving to database

### Operators
Must support:
- Equality: =, !=
- Comparison: >, <, >=, <=
- Pattern: LIKE
- Null checks: IS NULL, IS NOT NULL

## Aggregate Function Requirements

When using aggregates (COUNT, SUM, AVG, MIN, MAX):
- Must require GROUP BY specification
- Must group by non-aggregated columns
- Must allow ordering by aggregate results

## Security Requirements

- Must limit queries to allowlisted tables only
- Must validate all query inputs
- Must sanitize expressions and values
- Must prevent SQL injection
- Must prevent subqueries
- Must prevent UNION operations

## Preview Requirements

- Must execute current query via API
- Must display results in simple table format
- Must show generated SQL for debugging
- Must enforce 1000-row limit
- Must display errors clearly
- Must help validate queries before saving

## Integration Requirements

Must be usable in:
- Dashboard component editor (primary use case)
- Any custom query interface
- Must output standardized query configuration format

## See Also

- [QueryBuilder How-To Guide](../../howtos/query-builder.md)
- [Dashboard System](./dashboard.md)
- [Filtering Systems](./filters.md)
- [QueryBuilder API Reference](../../reference/frontend/query-builder-api.md)
