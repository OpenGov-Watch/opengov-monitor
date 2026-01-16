# DataTable Guide

Guide for creating table pages using the DataTable component with auto-generated columns and formatting.

## Guides

### [DataTable Basics](./data-table-basics.md)
Getting started with DataTable. Covers:
- Simple read-only tables
- Tables with JOINs
- Faceted filters
- Custom column rendering
- Auto-formatting patterns
- Troubleshooting

Start here if you're new to DataTable.

### [DataTable Advanced](./data-table-advanced.md)
Advanced features and patterns. Covers:
- Inline editing (category selectors, text fields, checkboxes)
- Default views and saved states
- Complete real-world example
- Advanced patterns (dot-notation, virtual columns, category inheritance)
- Performance optimization

Use this guide for complex table implementations.

## Quick Reference

**Basic table structure:**
```typescript
const queryConfig: QueryConfig = {
  sourceTable: "TableName",
  columns: [{ column: "id" }, { column: "name" }],
  joins: [],
  filters: [],
  orderBy: [{ column: "id", direction: "DESC" }],
  limit: 1000
};

<DataTable
  mode="query"
  queryConfig={queryConfig}
  tableName="table-name"
/>
```

**Common props:**
- `facetedFilters` - Enable column filters
- `editConfig` - Enable inline editing
- `columnOverrides` - Custom cell rendering
- `defaultViews` - Pre-configured saved views

## Examples

- Simple: `frontend/src/pages/fellowship.tsx`
- With editing: `frontend/src/pages/referenda.tsx`
- With views: `frontend/src/pages/treasury.tsx`
- Advanced: `frontend/src/pages/child-bounties.tsx`

## See Also

- [DataTable Specification](../spec/frontend/data-table.md) - Requirements and architecture
- [Table Systems Reference](../reference/frontend/table-systems.md) - Implementation details
- [Filtering Guide](./filters.md) - Filter strategies
