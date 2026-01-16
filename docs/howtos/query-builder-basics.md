# QueryBuilder Basics

Visual QueryBuilder for creating SQL queries without writing SQL code.

For advanced features (expressions, aggregates, complex filters), see [QueryBuilder Advanced](./query-builder-advanced.md).

## 1. Basic Query

### Selecting Data from a Single Table

Show all referenda with basic info.

1. **Select Source Table**: Choose "Referenda"
2. **Pick Columns**: Check `id`, `title`, `status`, `DOT_latest`, `proposal_time`
3. **Set Limit**: Enter `100`
4. **Click Preview**: See results

**Generated QueryConfig**:
```typescript
{
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "status" },
    { column: "DOT_latest" },
    { column: "proposal_time" }
  ],
  limit: 100
}
```

---

## 2. Adding JOINs

### Joining Related Tables

Show referenda with their category names.

1. **Source Table**: "Referenda"
2. **Add JOIN**:
   - Click "Add JOIN" button
   - Table: "Categories", Alias: "c"
   - ON clause: Auto-filled as `Referenda.category_id = c.id`
3. **Select Columns** from both tables:
   - `Referenda.id`, `Referenda.title`
   - `c.category` (alias "category")
   - `c.subcategory` (alias "subcategory")

**Generated QueryConfig**:
```typescript
{
  sourceTable: "Referenda",
  joins: [{
    type: "LEFT",
    table: "Categories",
    alias: "c",
    on: {
      left: "Referenda.category_id",
      right: "c.id"
    }
  }],
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "c.category", alias: "category" },
    { column: "c.subcategory", alias: "subcategory" }
  ]
}
```

---

## 3. Sorting Results

### Single Column Sort

Newest referenda first:

```typescript
orderBy: [
  { column: "id", direction: "DESC" }
]
```

### Multiple Column Sort

Sort by status (ASC), then DOT (DESC):

```typescript
orderBy: [
  { column: "status", direction: "ASC" },
  { column: "DOT_latest", direction: "DESC" }
]
```

### Sort by Computed Column

When using aggregates, sort by the alias:

```typescript
{
  expressionColumns: [
    { expression: "SUM(DOT_latest)", alias: "total_dot" }
  ],
  orderBy: [
    { column: "total_dot", direction: "DESC" }
  ]
}
```

---

## 4. Preview and Debug

### Using Preview

1. **Click "Preview"**: Executes query and shows results
2. **Review SQL**: Check generated SQL
3. **Check Results**: Verify data looks correct
4. **Iterate**: Adjust as needed

### Common Issues

**No results shown**: Check filters (too restrictive), verify JOIN conditions, confirm source table has data

**"Invalid column" error**: Column name misspelled, missing table qualifier (`table.column`), or column doesn't exist

**"Invalid join table" error**: Table must be in API allowlist, check spelling (case-sensitive)

**Aggregate without GROUP BY**: Add GROUP BY when using COUNT, SUM, AVG, MIN, MAX. Include all non-aggregated columns in GROUP BY.

---

## Tips

**Performance**: Always use LIMIT, add filters to reduce dataset, avoid joining unnecessary tables

**Column Aliases**: Use descriptive aliases for computed columns, alias joined columns to avoid conflicts, keep aliases short

**JOINs**: LEFT JOIN when related data might be missing, INNER JOIN for matching rows only, use table aliases (c, b, r) to shorten queries

**Debugging**: Start simple and add complexity gradually, use Preview frequently, check generated SQL, verify column names match database schema

---

## Next Steps

- For expressions, aggregates, and complex filters, see [QueryBuilder Advanced](./query-builder-advanced.md)
- For using QueryBuilder in dashboards, see [Dashboard How-To](./dashboard.md)
- For architecture details, see [QueryBuilder Specification](../01_requirements/frontend/query-builder.md)
