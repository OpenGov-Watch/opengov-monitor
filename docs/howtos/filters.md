# How to Use Filtering Systems

This guide covers the different filtering methods available in the application.

## Table of Contents
1. [Faceted Filters (DataTable)](#1-faceted-filters-datatable)
2. [Global Search (DataTable)](#2-global-search-datatable)
3. [Advanced Filters (QueryBuilder)](#3-advanced-filters-querybuilder)
4. [Combining Filters](#4-combining-filters)

---

## 1. Faceted Filters (DataTable)

### What are Faceted Filters?

Multi-select dropdown filters that show all unique values with counts for a specific column.

### Enabling Faceted Filters

In your DataTable page component:

```typescript
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  facetedFilters={["status", "track"]}  // Enable on these columns
/>
```

### Using Faceted Filters

**In the UI:**
1. Click column header with dropdown icon
2. Search for specific values (optional)
3. Check boxes for values to include
4. Click "Apply" to filter table
5. Clear individual values or all at once

**Behavior:**
- Shows ALL unique values from dataset (not just current page)
- Displays count next to each value
- Counts update when other filters are applied
- Multiple values = OR logic (show rows matching ANY selected value)

### Example

**Filter referenda by status:**
1. Click "Status" column dropdown
2. Check "Executed" and "Ongoing"
3. Click "Apply"
4. Table shows only rows where status is "Executed" OR "Ongoing"

**Result**: If you had 2000 total rows, and 1200 are Executed + 150 are Ongoing, you'll see 1350 rows.

### Best For
- Columns with limited distinct values (< 100)
- Frequently filtered columns (status, category, type)
- When users need to see value distribution

---

## 2. Global Search (DataTable)

### What is Global Search?

Text input that searches across ALL visible columns simultaneously.

### Location

Top-left of DataTable toolbar, labeled "Search all columns..."

### Behavior
- Case-insensitive substring matching
- Searches every visible column
- Updates as you type
- Persisted in view state

### Example

**Search for "treasury":**
- Matches rows where ANY column contains "treasury"
- Could match in: title, description, track, notes, etc.
- Combines with faceted filters (AND logic)

### Use Cases
- Quick exploration: "What contains the word 'runtime'?"
- Finding specific items: Search for proposal number "123"
- Broad filtering: "polkadot" matches many columns

### Best For
- Don't know which column contains the value
- Quick ad-hoc searches
- Exploring unfamiliar data

---

## 3. Advanced Filters (QueryBuilder)

### What are Advanced Filters?

Complex filter builder with AND/OR logic for custom queries in dashboards.

### Location

QueryBuilder component in Dashboard ComponentEditor.

### Filter Operators

| Operator | Use For | Example |
|----------|---------|---------|
| `=` | Exact match | status = "Executed" |
| `!=` | Not equal | status != "Rejected" |
| `>` | Greater than | DOT_latest > 1000 |
| `<` | Less than | DOT_latest < 10000 |
| `>=` | Greater or equal | USD_latest >= 5000 |
| `<=` | Less or equal | USD_latest <= 50000 |
| `LIKE` | Pattern match | title LIKE "%treasury%" |
| `IN` | Value in list | status IN ("Executed", "Ongoing") |
| `IS NULL` | Check for NULL | notes IS NULL |
| `IS NOT NULL` | Check not NULL | category_id IS NOT NULL |

### Simple Filter

**Goal:** Show only executed proposals.

1. Add filter condition
2. Column: `status`
3. Operator: `=`
4. Value: `Executed`

**Result:**
```typescript
filters: [
  { column: "status", operator: "=", value: "Executed" }
]
```

### AND Logic (Default)

**Goal:** Executed proposals with DOT > 1000.

1. Add condition: `status = "Executed"`
2. Add condition: `DOT_latest > 1000`
3. Both in same group (default AND)

**Result:** Shows rows where BOTH conditions are true.

### OR Logic

**Goal:** Root track OR Whitelisted Caller track.

1. Change group operator to "OR"
2. Add condition: `track = "Root"`
3. Add condition: `track = "Whitelisted Caller"`

**Result:** Shows rows matching EITHER condition.

### Nested AND/OR

**Goal:** Executed proposals in Root OR Whitelisted Caller tracks.

1. Top group: AND (default)
2. Add condition: `status = "Executed"`
3. Add OR sub-group:
   - `track = "Root"`
   - `track = "Whitelisted Caller"`

**Result:**
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "=", value: "Executed" },
    {
      operator: "OR",
      conditions: [
        { column: "track", operator: "=", value: "Root" },
        { column: "track", operator: "=", value: "Whitelisted Caller" }
      ]
    }
  ]
}
```

**SQL equivalent:**
```sql
WHERE status = 'Executed'
  AND (track = 'Root' OR track = 'Whitelisted Caller')
```

### Common Patterns

**Date range:**
```typescript
filters: [
  { column: "proposal_time", operator: ">=", value: "2025-01-01" },
  { column: "proposal_time", operator: "<=", value: "2025-12-31" }
]
```

**Numeric range:**
```typescript
filters: [
  { column: "DOT_latest", operator: ">=", value: "1000" },
  { column: "DOT_latest", operator: "<=", value: "10000" }
]
```

**Text pattern:**
```typescript
filters: [
  { column: "title", operator: "LIKE", value: "%treasury%" }
]
```

**Exclude nulls:**
```typescript
filters: [
  { column: "category_id", operator: "IS NOT NULL" }
]
```

**Multiple exclusions:**
```typescript
filters: [
  { column: "status", operator: "!=", value: "Rejected" },
  { column: "status", operator: "!=", value: "Cancelled" }
]
```

---

## 4. Combining Filters

### DataTable: Faceted + Global Search

Filters work together with AND logic.

**Example:**
1. Faceted filter: status = "Executed" OR "Ongoing"
2. Global search: "treasury"

**Result:** Rows where:
- (status is Executed OR Ongoing) AND
- (any column contains "treasury")

### DataTable: Multiple Faceted Filters

Each faceted filter column uses AND logic between columns, OR within column.

**Example:**
1. Status filter: "Executed" OR "Ongoing"
2. Track filter: "Root" OR "Whitelisted Caller"

**Result:** Rows where:
- (status is Executed OR Ongoing) AND
- (track is Root OR Whitelisted Caller)

### Dashboard: QueryBuilder Filters

Fully customizable AND/OR logic.

**Example:** High-value proposals in specific tracks, excluding rejected.
```typescript
{
  operator: "AND",
  conditions: [
    { column: "DOT_latest", operator: ">", value: "10000" },
    { column: "status", operator: "!=", value: "Rejected" },
    {
      operator: "OR",
      conditions: [
        { column: "track", operator: "=", value: "Root" },
        { column: "track", operator: "=", value: "Treasurer" }
      ]
    }
  ]
}
```

**SQL:**
```sql
WHERE DOT_latest > 10000
  AND status != 'Rejected'
  AND (track = 'Root' OR track = 'Treasurer')
```

---

## Filter Strategy Guide

### Use Faceted Filters When:
- Column has < 100 distinct values
- Need to see value distribution (counts)
- Multi-select is common use case
- Column is frequently filtered
- Users are non-technical

### Use Global Search When:
- Quick ad-hoc exploration
- Don't know which column has the value
- Simple text matching is sufficient
- No need for exact logic control

### Use Advanced Filters When:
- Need complex AND/OR logic
- Building saved queries (dashboards)
- Multiple conditions on same column
- Numeric ranges and comparisons
- Pattern matching (LIKE)
- NULL checks

### Combine Approaches When:
- Start with faceted filters for common categories
- Add global search for quick text lookup
- Build advanced filters for complex saved views

---

## Performance Tips

### Faceted Filters
- Limited to columns with reasonable distinct value counts
- Server-side fetching keeps UI responsive
- Indexes on filtered columns improve speed

### Global Search
- Client-side, so fast for current page
- Searches only visible columns (hide unused columns)
- Debounced to avoid excessive re-renders

### Advanced Filters
- Server-side execution (fast for any dataset size)
- Use indexes on filtered columns
- Avoid excessive nesting (< 3 levels deep)

---

## Troubleshooting

**Faceted filter shows no values:**
- Check if column has data
- Verify column is included in QueryConfig
- Check if other filters are too restrictive

**Global search not finding text:**
- Verify column is visible (not hidden)
- Check for exact spelling
- Text might be in hidden column

**Advanced filter returns no results:**
- Check operator (= vs LIKE for text)
- Verify value format (dates, numbers)
- Preview query to see generated SQL
- Check if AND should be OR (or vice versa)

**Filter combinations too restrictive:**
- Remove filters one at a time to isolate issue
- Check if value exists in filtered dataset
- Verify AND/OR logic is correct

---

## See Also

- [Filters Specification](../spec/frontend/filters.md) - Technical details
- [DataTable How-To](./data-table.md) - DataTable filtering examples
- [QueryBuilder How-To](./query-builder.md) - Building complex queries
