# Filtering Basics

Guide for using faceted filters and global search in DataTables.

For advanced QueryBuilder filters and complex patterns, see [Filtering Advanced](./filters-advanced.md).

## Faceted Filters (DataTable)

Multi-select dropdown filters that show all unique values with counts for a specific column.

### Enabling Faceted Filters

```typescript
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}
/>
```

### Using Faceted Filters

1. Click column header with dropdown icon
2. Search for specific values (optional)
3. Check boxes for values to include
4. Click "Apply" to filter table
5. Clear individual values or all at once

**Behavior**: Shows ALL unique values from dataset (not just current page), displays counts, updates when other filters applied, multiple values use OR logic.

### Example

Filter referenda by status: Click "Status" column dropdown, check "Executed" and "Ongoing", click "Apply". Table shows rows where status is "Executed" OR "Ongoing".

**Best for**: Columns with < 100 distinct values, frequently filtered columns, when users need to see value distribution.

---

## Global Search (DataTable)

Text input that searches across ALL visible columns simultaneously with case-insensitive substring matching.

**Location**: Top-left of DataTable toolbar, labeled "Search all columns..."

**Behavior**: Searches every visible column, updates as you type, persisted in view state, combines with faceted filters using AND logic.

**Example**: Search for "treasury" matches rows where ANY column contains "treasury" (title, description, track, notes, etc.).

**Best for**: Quick exploration, finding specific items, broad filtering when you don't know which column contains the value.

---

## Combining Filters

### Faceted + Global Search

Filters work together with AND logic.

**Example**: Faceted filter (status = "Executed" OR "Ongoing") + Global search ("treasury")

**Result**: Rows where (status is Executed OR Ongoing) AND (any column contains "treasury")

### Multiple Faceted Filters

Each faceted filter column uses AND logic between columns, OR within column.

**Example**: Status filter ("Executed" OR "Ongoing") + Track filter ("Root" OR "Whitelisted Caller")

**Result**: Rows where (status is Executed OR Ongoing) AND (track is Root OR Whitelisted Caller)

---

## Filter Strategy

**Use Faceted Filters**: Column has < 100 distinct values, need value distribution (counts), multi-select common, non-technical users

**Use Global Search**: Quick exploration, don't know which column has value, simple text matching sufficient

---

## Performance

**Faceted Filters**: Server-side fetching, use indexes on filtered columns

**Global Search**: Client-side (fast for current page), searches only visible columns, debounced

---

## Troubleshooting

**Faceted filter shows no values**: Check if column has data, verify column in QueryConfig, other filters too restrictive

**Global search not finding text**: Verify column visible, check spelling, text might be in hidden column

**Filter combinations too restrictive**: Remove filters one at a time to isolate issue, check if value exists in filtered dataset

---

## Next Steps

- For QueryBuilder advanced filters and complex patterns, see [Filtering Advanced](./filters-advanced.md)
- For DataTable filtering examples, see [DataTable How-To](./data-table.md)
- For architecture details, see [Filters Specification](../spec/frontend/filters.md)
