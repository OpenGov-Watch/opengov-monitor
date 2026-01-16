# Filtering Systems Specification

Requirements for filtering mechanisms across the frontend.

## Overview

Must provide three distinct filtering systems for different use cases:

1. **FacetedFilter** - Multi-select dropdown filters with counts (DataTable)
2. **FilterGroupBuilder** - Advanced filter builder with AND/OR logic (QueryBuilder/Dashboard)
3. **Global Search** - Full-text search across columns (DataTable)

## FacetedFilter Requirements

### Purpose
Must provide multi-select dropdown filters for DataTable columns showing all unique values with counts.

### Features
- Must show multi-select checkboxes for all distinct values
- Must display count next to each value
- Must provide Apply/Cancel buttons for confirmation
- Must support searchable dropdown
- Must sort values alphabetically
- Must fetch data from server

### Server-Side Behavior
- Must fetch facet data via API endpoint accepting facet query configuration
- Must return ALL distinct values with counts from full dataset (not just current page)
- Must fetch facet data in parallel with table data
- Must update facet values when other filters change
- Must use database indexes for performance
- Must gracefully fall back to client-side if server fails

### UI Requirements
- Must show column name on trigger button
- Must display badge with number of selected values when filters applied
- Must provide search input within dropdown
- Must show Clear, Cancel, and Apply buttons
- Must maintain pending selections until Apply clicked
- Must revert to previous state on Cancel
- Must remove all selections on Clear

### State Management
- Must store pending selections locally before applying
- Must commit filters to table state on Apply
- Must maintain filter state in view persistence

### Integration
- Must integrate with DataTable via `facetedFilters` prop listing column IDs
- Must work with TanStack Table's faceting system
- Must disable sorting on faceted filter columns

## FilterGroupBuilder Requirements

### Purpose
Must provide advanced filter builder with nested AND/OR logic for complex queries.

### Data Structure
Must support hierarchical filter structure with:
- Filter groups with AND or OR operators
- Individual filter conditions with column, operator, and value
- Nested groups at arbitrary depth

### Operators
Must support these operators:
- Equality: =, !=
- Comparison: >, <, >=, <=
- Pattern: LIKE
- List: IN
- Null checks: IS NULL, IS NOT NULL

### UI Requirements
- Must allow toggling between AND/OR at group level
- Must list all conditions and sub-groups within group
- Must provide buttons to add condition or add nested group
- Must show column selector, operator selector, and value input per condition
- Must provide remove button per condition
- Must show visual indentation for nested groups
- Must track nesting level

### Recursive Structure
- Must render nested groups recursively
- Must support unlimited nesting depth
- Must prevent excessive nesting from degrading performance

### State Management
- Must provide onUpdate callback with complete filter structure
- Must use memoization to prevent unnecessary re-renders
- Must optimize individual condition row updates

### Integration
Must be usable in:
- QueryBuilder for building WHERE clauses
- Advanced filter dialogs (potential future feature)
- Any interface requiring complex query logic

## Global Search Requirements

### Purpose
Must provide full-text search across all visible table columns.

### Features
- Must search all visible columns simultaneously
- Must use case-insensitive substring matching
- Must filter in real-time as user types
- Must persist search state with view

### Behavior
- Must filter rows where ANY visible column contains search text
- Must use substring matching (not exact match)
- Must update faceted filter counts to reflect only matching rows
- Must save search state to localStorage
- Must include search state in URL sharing

### UI Requirements
- Must provide text input in DataTable toolbar
- Must show placeholder "Search all columns..."
- Must respond to every keystroke
- Must be part of view state persistence

## Filter System Comparison

### Use Case Guidelines

**Use FacetedFilter when:**
- Column has limited distinct values (< 100)
- Users need to see value counts
- Multi-select is common use case
- Column is frequently filtered
- Simple equality filtering sufficient

**Use FilterGroupBuilder when:**
- Complex AND/OR logic required
- Building custom queries
- Advanced users creating dashboards
- Multiple operators needed
- Programmatic filtering required

**Use Global Search when:**
- Quick data exploration needed
- Unknown which column contains value
- Simple text matching sufficient
- No need for counts or complex logic
- Fastest way to find data

## State Persistence Requirements

### DataTable Filters
- Must store column filters in TanStack Table state
- Must persist to localStorage per table
- Must support saving in named views
- Must support URL sharing via base64 encoding

### QueryBuilder Filters
- Must store in query configuration filter structure
- Must persist to database with dashboard component
- Must execute server-side via API

### Global Search
- Must store in TanStack Table global filter state
- Must persist to localStorage with view state
- Must include in URL-shared views

## API Integration Requirements

### Faceted Filters API
Must POST to facets endpoint with:
- Source table specification
- List of columns to facet
- Current active filters

Must return:
- Object mapping column names to value/count pairs
- All distinct values with full dataset counts
- Filtered results based on other active filters

### FilterGroupBuilder API
Must POST to query execute endpoint with:
- Query configuration including filter structure
- Filters translated to SQL WHERE clauses
- Proper operator handling and value escaping

Must execute:
- Server-side SQL queries with WHERE conditions
- Proper precedence for AND/OR nesting
- Secure parameter binding

## Performance Requirements

### Faceted Filters
- Must use database indexes on faceted columns
- Must execute parallel fetches with table data
- Must cache facet results until filters change

### FilterGroupBuilder
- Must use memoization to prevent re-render cascades
- Must optimize condition row updates
- Must handle deep nesting without performance degradation

### Global Search
- Must perform client-side filtering efficiently
- Must avoid blocking UI during typing
- Must update facet counts efficiently

## See Also

- [Filtering How-To Guide](../../howtos/filters.md)
- [DataTable Specification](./data-table.md)
- [QueryBuilder Specification](./query-builder.md)
