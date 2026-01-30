# Filtering Systems Requirements

Requirements for filtering mechanisms across the frontend.

## Overview

Must provide two distinct filtering systems:

1. **FacetedFilter** - Multi-select dropdown filters with counts (DataTable)
2. **FilterGroupBuilder** - Advanced filter builder with AND/OR logic (QueryBuilder/Dashboard)

## FacetedFilter Requirements

### Purpose
Multi-select dropdown filters for DataTable columns showing all unique values with counts.

### Features
- Must show multi-select checkboxes for all distinct values with counts
- Must provide Apply/Cancel buttons, searchable dropdown, alphabetical sort
- Must fetch data from server via API endpoint
- Must return ALL distinct values from full dataset (not just current page)
- Must fetch in parallel with table data, update when filters change
- Must use database indexes, gracefully fall back to client-side on failure

### UI Requirements
- Must show column name on trigger button with badge showing selected count
- Must provide search input, Clear/Cancel/Apply buttons within dropdown
- Must maintain pending selections until Apply, revert on Cancel

### State Management

**Unified State**: Must share filter state with FilterGroupBuilder using single source of truth. Must read from and write to shared state, merge with existing filters without overwriting. Must maintain backward compatibility with saved views.

**State Flow**: Read current values when opened → Store locally during changes → Commit to shared state on Apply → Revert on Cancel

**Integration**: Must ensure faceted and advanced filters work together without conflicts, preserving apply/cancel transaction pattern.

### Integration
- Must integrate via DataTable's `facetedFilters` prop listing column IDs
- Must work with TanStack Table's faceting system
- Must disable sorting on faceted filter columns

## FilterGroupBuilder Requirements

### Purpose
Advanced filter builder with nested AND/OR logic for complex queries.

### Data Structure
Must support hierarchical structure with filter groups (AND/OR operators), individual conditions (column, operator, value), and nested groups at arbitrary depth.

**Storage Format**: FilterGroup is canonical format. Legacy FilterCondition[] arrays automatically converted for backward compatibility.

### UI Requirements
- Must allow AND/OR toggle at group level, list conditions and sub-groups
- Must provide add condition/group buttons, column/operator/value selectors per condition
- Must filter operators by column type, show remove button per condition
- Must show visual indentation for nested groups

### Categorical Column Handling

Must detect categorical columns and provide multiselect dropdowns:

**Column Identification**: Detected by column type detection for status, track, type, category columns

**Available Operators**: Only `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL` (no equals/comparison/LIKE needed)

**UI Behavior**: Must show multiselect dropdown for IN/NOT IN, "No value needed" message for NULL operators, fetch facet data with counts, provide search, use Apply/Cancel pattern

**Data Fetching**: Must fetch facets via API, update on filter changes, handle failures gracefully

### Recursive Structure
- Must render nested groups recursively with unlimited depth
- Must prevent excessive nesting from degrading performance

### State Management
- Must provide onUpdate callback with complete structure
- Must use memoization to prevent re-renders
- Must preserve nested structure without flattening

### Integration
Must work in DataTable advanced filter dialogs, QueryBuilder WHERE clauses (with full nested support), Dashboard component editor

## Filter System Comparison

**Use FacetedFilter**: Column has < 100 distinct values, need value counts, multi-select common, frequently filtered, simple equality sufficient

**Use FilterGroupBuilder**: Complex AND/OR logic required, custom queries, advanced users, multiple operators needed, programmatic filtering

## State Persistence Requirements

### DataTable Filters
Must store in unified state shared with FilterGroupBuilder. Must persist to localStorage per table, support named views, support URL sharing via base64, use non-blocking updates, maintain backward compatibility.

### QueryBuilder Filters
Must store in query configuration, persist to database with dashboard component, execute server-side via API, share filter type definition with DataTable.

## Performance Requirements

### Faceted Filters
Must use database indexes on faceted columns, execute parallel fetches with table data, cache results until filters change.

### FilterGroupBuilder
Must use memoization to prevent re-render cascades, optimize condition row updates, handle deep nesting without degradation.

## See Also

- [Filter Types Specification](../../02_specification/frontend/filter-types.md) - Column types, operators, data structures
- [Filtering How-To Guide](../../howtos/filters.md)
- [DataTable Requirements](./data-table.md)
- [QueryBuilder Requirements](./query-builder.md)
