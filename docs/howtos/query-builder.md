# QueryBuilder Guide

Visual QueryBuilder for creating SQL queries without writing SQL code.

## Guides

### [QueryBuilder Basics](./query-builder-basics.md)
Getting started with QueryBuilder. Covers:
- Basic queries (selecting tables and columns)
- Adding JOINs
- Sorting results
- Preview and debugging
- Common issues and tips

Start here if you're new to QueryBuilder.

### [QueryBuilder Advanced](./query-builder-advanced.md)
Advanced features and patterns. Covers:
- Expressions and aggregates (COUNT, SUM, AVG, etc.)
- Complex filters (AND/OR logic, date ranges, NULL checks)
- Multiple JOINs
- Common query patterns
- Performance optimization

Use this guide for aggregations and complex queries.

## Quick Reference

**Basic query structure:**
```typescript
const queryConfig: QueryConfig = {
  sourceTable: "TableName",
  columns: [{ column: "id" }, { column: "name" }],
  joins: [],
  filters: [],
  orderBy: [{ column: "id", direction: "DESC" }],
  limit: 100
};
```

**Common operations:**
- **JOINs**: Link related tables (e.g., Categories, Bounties)
- **Filters**: WHERE clauses with AND/OR logic
- **Aggregates**: COUNT, SUM, AVG, MIN, MAX with GROUP BY
- **Sorting**: Single or multiple column ordering

## See Also

- [QueryBuilder Specification](../01_requirements/frontend/query-builder.md) - Architecture details
- [Dashboard How-To](./dashboard.md) - Using QueryBuilder in dashboards
- [Filtering How-To](./filters.md) - Advanced filtering patterns
