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

### Filter Operators by Column Type

The available operators depend on the column type selected:

#### Categorical Columns
**Columns:** `status`, `status_type`, `track`, `type`, `category`, `subcategory`

| Operator | Use For | Example |
|----------|---------|---------|
| `IN` | Value in list | status IN ("Executed", "Ongoing") |
| `NOT IN` | Value not in list | status NOT IN ("Rejected", "Cancelled") |
| `IS NULL` | Check for NULL | status IS NULL |
| `IS NOT NULL` | Check not NULL | status IS NOT NULL |

**Enhanced UI:** Multiselect dropdown with search and facet counts

#### Numeric Columns
**Columns:** Amounts (DOT, USD), counts, IDs

| Operator | Use For | Example |
|----------|---------|---------|
| `=` | Exact match | DOT_latest = 1000 |
| `!=` | Not equal | DOT_latest != 0 |
| `>` | Greater than | DOT_latest > 1000 |
| `<` | Less than | DOT_latest < 10000 |
| `>=` | Greater or equal | USD_latest >= 5000 |
| `<=` | Less or equal | USD_latest <= 50000 |
| `IS NULL` | Check for NULL | amount IS NULL |
| `IS NOT NULL` | Check not NULL | amount IS NOT NULL |

#### Text Columns
**Columns:** `title`, `description`, `notes`, addresses

| Operator | Use For | Example |
|----------|---------|---------|
| `=` | Exact match | title = "Treasury Proposal" |
| `!=` | Not equal | title != "" |
| `LIKE` | Pattern match | title LIKE "%treasury%" |
| `IS NULL` | Check for NULL | notes IS NULL |
| `IS NOT NULL` | Check not NULL | notes IS NOT NULL |

#### Date Columns
**Columns:** Ending in `_time`, `_at`, or containing `date`

| Operator | Use For | Example |
|----------|---------|---------|
| `=` | Exact date | proposal_time = "2025-01-01" |
| `!=` | Not equal | proposal_time != "2025-01-01" |
| `>` | After date | proposal_time > "2025-01-01" |
| `<` | Before date | proposal_time < "2025-12-31" |
| `>=` | On or after | proposal_time >= "2025-01-01" |
| `<=` | On or before | proposal_time <= "2025-12-31" |
| `IS NULL` | Check for NULL | proposal_time IS NULL |
| `IS NOT NULL` | Check not NULL | proposal_time IS NOT NULL |

### Categorical Column Multiselect

For categorical columns, the filter builder provides an enhanced multiselect dropdown when using `IN` or `NOT IN` operators:

**Features:**
- Dropdown shows all available values with counts
- Search functionality to quickly find values
- Select multiple values easily
- Apply/Cancel pattern prevents accidental changes
- Only shows relevant operators (IN, NOT IN, IS NULL, IS NOT NULL)

**Example - Filter by Multiple Statuses:**
1. Add condition
2. Column: `status` (only shows categorical operators)
3. Operator: `in list`
4. Click the multiselect dropdown (replaces text input)
5. Check "Executed", "Ongoing", "Confirmed"
6. Click "Apply"

**Result:** Shows rows where status is any of the selected values (OR logic).

**Example - Exclude Statuses:**
1. Add condition
2. Column: `status`
3. Operator: `not in list`
4. Select "Rejected", "Cancelled", "TimedOut"
5. Click "Apply"

**Result:** Shows rows where status is NOT any of the selected values.

**Why No Equals/Comparison?**
- Use `IN` with single value instead of `=`
- Comparison operators (`>`, `<`) don't apply to categorical data
- Pattern matching (`LIKE`) is replaced by dropdown search

### Simple Filter

**Goal:** Show only executed proposals.

1. Add filter condition
2. Column: `status`
3. Operator: `in list`
4. Select: `Executed` from dropdown

**Result:**
```typescript
filters: [
  { column: "status", operator: "IN", value: ["Executed"] }
]
```

### AND Logic (Default)

**Goal:** Executed proposals with DOT > 1000.

1. Add condition: `status in list ["Executed"]`
2. Add condition: `DOT_latest > 1000`
3. Both in same group (default AND)

**Result:** Shows rows where BOTH conditions are true.

### OR Logic

**Goal:** Root track OR Whitelisted Caller track.

1. Change group operator to "OR"
2. Add condition: `track in list ["Root"]`
3. Add condition: `track in list ["Whitelisted Caller"]`

**Alternative:** Use single `IN` condition with both values selected in multiselect dropdown.

**Result:** Shows rows matching EITHER condition.

### Nested AND/OR

**Goal:** Executed proposals in Root OR Whitelisted Caller tracks.

1. Top group: AND (default)
2. Add condition: `status in list ["Executed"]`
3. Add condition: `track in list ["Root", "Whitelisted Caller"]` (use multiselect)

**Alternative with sub-group:**
1. Top group: AND (default)
2. Add condition: `status in list ["Executed"]`
3. Add OR sub-group:
   - `track in list ["Root"]`
   - `track in list ["Whitelisted Caller"]`

**Result:**
```typescript
{
  operator: "AND",
  conditions: [
    { column: "status", operator: "IN", value: ["Executed"] },
    { column: "track", operator: "IN", value: ["Root", "Whitelisted Caller"] }
  ]
}
```

**SQL equivalent:**
```sql
WHERE status IN ('Executed')
  AND track IN ('Root', 'Whitelisted Caller')
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

**Multiple exclusions (categorical):**
```typescript
filters: [
  { column: "status", operator: "NOT IN", value: ["Rejected", "Cancelled"] }
]
```

### Working with Nested Filters in Dashboards

Dashboard filters now support the same nested AND/OR logic as shown above, with full persistence to the database.

#### Creating Complex Filter Logic

1. Click "Add Condition" to add a simple filter
2. Click "Add Group" to create a nested group
3. Toggle between AND/OR at each group level
4. Build complex queries like: `(status = 'Active' AND amount > 1000) OR (priority = 'High')`

#### Technical Details

**Data Structure**: All dashboard filters are stored as `FilterGroup` objects in the database `query_config` JSON field.

**Backward Compatibility**: Old dashboards with flat filter arrays are automatically converted when edited. No manual migration needed.

**Performance**: Uses WeakMap caching to prevent creating duplicate objects on every render.

#### Example: Complex Multi-Level Filter

```typescript
const filters: FilterGroup = {
  operator: 'AND',
  conditions: [
    { column: 'status', operator: 'IN', value: ['Active'] },
    {
      operator: 'OR',
      conditions: [
        { column: 'amount', operator: '>', value: 1000 },
        { column: 'priority', operator: 'IN', value: ['High'] }
      ]
    }
  ]
};
```

**Generates SQL:**
```sql
WHERE status IN ('Active') AND (amount > 1000 OR priority IN ('High'))
```

This structure:
- Preserves nested groups through save/load cycles
- Supports unlimited nesting depth
- Renders with proper visual indentation in the UI
- Executes correctly on the backend with proper SQL parentheses

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
    { column: "status", operator: "NOT IN", value: ["Rejected"] },
    { column: "track", operator: "IN", value: ["Root", "Treasurer"] }
  ]
}
```

**SQL:**
```sql
WHERE DOT_latest > 10000
  AND status NOT IN ('Rejected')
  AND track IN ('Root', 'Treasurer')
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
