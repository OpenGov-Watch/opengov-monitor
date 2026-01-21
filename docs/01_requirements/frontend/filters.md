# Filtering Systems Specification

Requirements for filtering mechanisms across the frontend.

## Overview

Must provide three distinct filtering systems:

1. **FacetedFilter** - Multi-select dropdown filters with counts (DataTable)
2. **FilterGroupBuilder** - Advanced filter builder with AND/OR logic (QueryBuilder/Dashboard)
3. **Global Search** - Full-text search across columns (DataTable)

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

### Column Type System

Must identify column types and restrict operators:

**Column Types**: Categorical (status, track, type, category), Numeric (DOT, USD, IDs), Text (title, description, notes), Date (*_time, *_at, *date*)

**Operator Availability**:
- **Categorical**: `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL`
- **Numeric**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS NULL`, `IS NOT NULL`
- **Text**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IS NULL`, `IS NOT NULL`
- **Date**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS NULL`, `IS NOT NULL`

### UI Requirements
- Must allow AND/OR toggle at group level, list conditions and sub-groups
- Must provide add condition/group buttons, column/operator/value selectors per condition
- Must filter operators by column type, show remove button per condition
- Must show visual indentation for nested groups

### Categorical Column Handling

Must detect categorical columns and provide multiselect dropdowns:

**Column Identification**: Detected by `isCategoricalColumn()` / `getColumnType()` for status, track, type, category columns

**Available Operators**: Only `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL` (no equals/comparison/LIKE needed)

**UI Behavior**: Must show multiselect dropdown for IN/NOT IN, "No value needed" message for NULL operators, fetch facet data with counts, provide search, use Apply/Cancel pattern

**Data Fetching**: Must fetch facets via `/api/query/facets`, update on filter changes, handle failures gracefully

### Recursive Structure
- Must render nested groups recursively with unlimited depth
- Must prevent excessive nesting from degrading performance

### State Management
- Must provide onUpdate callback with complete structure
- Must use WeakMap caching for memoization to prevent re-renders
- Must preserve nested structure without flattening

### Integration
Must work in DataTable advanced filter dialogs, QueryBuilder WHERE clauses (with full nested support), Dashboard component editor

## Global Search Requirements

### Purpose
Full-text search across all visible table columns.

### Features
- Must search all visible columns simultaneously with case-insensitive substring matching
- Must filter in real-time as typed, persist with view state
- Must filter where ANY visible column contains text, update facet counts
- Must save to localStorage, include in URL sharing

### UI Requirements
- Must provide text input in DataTable toolbar with "Search all columns..." placeholder
- Must respond to every keystroke, be part of view state persistence

## Filter System Comparison

**Use FacetedFilter**: Column has < 100 distinct values, need value counts, multi-select common, frequently filtered, simple equality sufficient

**Use FilterGroupBuilder**: Complex AND/OR logic required, custom queries, advanced users, multiple operators needed, programmatic filtering

**Use Global Search**: Quick exploration, unknown column, simple text matching, no counts/complex logic needed, fastest data finding

## Data Model Unification

### FilterGroup as Canonical Format

Both systems use `FilterGroup`:
```typescript
interface FilterGroup {
  operator: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}
```

### Backward Compatibility

Legacy `FilterCondition[]` format auto-converted to FilterGroup on first edit. Conversion uses memoized helper with WeakMap caching. No data migration required - happens transparently in UI.

### Performance Optimizations

**WeakMap Caching**: Legacy arrays cached to prevent duplicate FilterGroup objects, improving React performance.

**Stable Callbacks**: Filter update callbacks use `useCallback` for referential equality, preventing unnecessary FilterGroupBuilder re-renders.

## State Persistence Requirements

### DataTable Filters
Must store in unified state shared with FilterGroupBuilder. Must persist to localStorage per table, support named views, support URL sharing via base64, use non-blocking updates, maintain backward compatibility.

### QueryBuilder Filters
Must store in query configuration, persist to database with dashboard component, execute server-side via API, share filter type definition with DataTable.

### Global Search
Must store in TanStack Table global filter state, persist to localStorage with view, include in URL-shared views.

## API Integration Requirements

### Faceted Filters API
**POST to facets endpoint** with source table, columns to facet, active filters. **Returns** object mapping columns to value/count pairs, all distinct values with full dataset counts, filtered based on other active filters.

### FilterGroupBuilder API
**POST to query execute endpoint** with query configuration including filter structure, filters translated to SQL WHERE clauses, proper operator handling and value escaping. **Executes** server-side SQL with WHERE conditions, proper AND/OR precedence, secure parameter binding.

## Performance Requirements

### Faceted Filters
Must use database indexes on faceted columns, execute parallel fetches with table data, cache results until filters change.

### FilterGroupBuilder
Must use memoization to prevent re-render cascades, optimize condition row updates, handle deep nesting without degradation.

### Global Search
Must perform client-side filtering efficiently, avoid blocking UI during typing, update facet counts efficiently.

## See Also

- [Filtering How-To Guide](../../howtos/filters.md)
- [DataTable Specification](./data-table.md)
- [QueryBuilder Specification](./query-builder.md)
