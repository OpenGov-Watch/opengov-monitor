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
   - Must support editable column aliases (click-to-edit)
   - Must support expression columns as first-class citizens (reorderable with regular columns)

4. **Unified Column Management**
   - Must treat expression columns and regular columns as one unified list
   - Must allow drag-and-drop reordering of mixed column types
   - Must preserve column order in SQL SELECT clause
   - Expression columns must be usable in filters, GROUP BY, and ORDER BY

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
   - Must limit rows for dashboards (see UI Constants)

## JOIN Requirements

### Foreign Key Auto-Detection
Must automatically detect foreign key relationships by naming patterns and auto-populate ON clauses.

**See Also:** [QueryBuilder Specification](../../02_specification/frontend/query-builder.md) for FK detection patterns

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
- Must allow click-to-edit aliases (shows alias + grayed column reference)
- Must show columns grouped by source table and joined tables
- Must support aggregate functions

### Expression Columns (First-Class)
- Must accept SQL expressions (calculations, aggregates)
- Must require alias for all expressions
- Must be reorderable with regular columns via drag-and-drop
- Must be available in filters, GROUP BY, and ORDER BY dropdowns

## Filter System Requirements

- Must support nested AND/OR filter groups with unlimited depth
- Must support adding/removing conditions and nested groups dynamically
- Must preserve filter structure when saving to database

### Operators
Must support operators appropriate for column types.

**See Also:** [Filters Specification](../../02_specification/frontend/filters.md) for operators by column type

## Aggregate Function Requirements

When using aggregates:
- Must require GROUP BY specification
- Must group by non-aggregated columns
- Must allow ordering by aggregate results

**See Also:** [QueryBuilder Specification](../../02_specification/frontend/query-builder.md) for supported functions

## Security Requirements

- Must be secure against SQL injection and malicious queries
- Must limit queries to allowlisted tables only

## Preview Requirements

- Must execute current query via API
- Must display results in simple table format
- Must show generated SQL for debugging
- Must enforce row limit
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
- [QueryBuilder API Reference](../../03_design/frontend/query-builder-api.md)
