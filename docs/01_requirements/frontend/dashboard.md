# Dashboard System Specification

Requirements for flexible, grid-based data visualization dashboards.

## Purpose

Must provide composable dashboard system for combining multiple data visualizations (tables, charts, text) in customizable grid layouts.

## Grid Layout Requirements

- Must support drag-to-reposition components in edit mode
- Must support resize handles in edit mode
- Must support responsive grid layout with drag-and-drop positioning
- Must persist layout changes to database
- Must properly constrain component heights to enable internal scrolling
- Must prevent component content from expanding entire grid

## Component Type Requirements

Must support these component types:
- **Table**: Simple HTML table for displaying query results (read-only, no interactive features)
- **Pie Chart**: For showing proportional data with label and value columns
- **Bar Chart**: Stacked and grouped variants for comparing categories
- **Line Chart**: For showing trends over time with multiple series
- **Text**: For Markdown content and annotations

## Data Source Requirements

### Query Configuration
- Must accept query configuration specifying SQL queries
- Must support column selection with aliases
- Must support computed expression columns (aggregates, calculations)
- Must support JOIN operations across multiple tables
- Must support WHERE filters with AND/OR logic
- Must support GROUP BY for aggregations
- Must support ORDER BY with ASC/DESC
- Must limit dashboard queries to 1000 rows

### Query Validation
- Must validate queries against table allowlist
- Must sanitize all query inputs for security
- Must prevent SQL injection

## Visual Query Builder Requirements

### Table Selection
- Must provide table picker limited to allowlist
- Must support selecting source table and joined tables

### JOIN Support
- Must support LEFT, INNER, and RIGHT joins
- Must auto-detect foreign key relationships by naming patterns:
  - `{table}_id` columns → `{Table}.id`
  - `{table}Id` camelCase → `{Table}.id`
  - `{table}Index` → `{Table}.id`
  - Child Bounties special case: uses `identifier` not `id`
- Must auto-populate ON clause when FK detected
- Must support optional table aliases for shorter references
- Must allow manual ON clause specification when auto-detection fails

### Column Selection
- Must show available columns grouped by table
- Must include columns from all joined tables
- Must support column aliases for custom display names
- Must support expression columns for computed values (SUM, COUNT, AVG, MIN, MAX)

### Filter Builder
- Must support nested AND/OR filter groups
- Must support operators: =, !=, >, <, >=, <=, LIKE, IS NULL, IS NOT NULL
- Must allow adding/removing conditions dynamically
- Must support unlimited nesting depth for complex logic

### Live Preview
- Must execute query and show results before saving
- Must display generated SQL for debugging
- Must show query errors clearly

## Chart Configuration Requirements

- Must support custom color schemes
- Must allow specifying label and value columns for charts
- Must support legend toggle
- Must support tooltip toggle
- Must accept Markdown content for text components

## Column Formatting Requirements

- Must share column formatting logic with DataTable system
- Must support column mapping (map query result columns to format patterns)
- Must format currency (DOT, USD, USDC, USDT), numbers, dates, addresses
- Must apply formatting across all chart types (tables, bars, lines, pie tooltips)

## Dashboard Management Requirements

### CRUD Operations
- Must support creating new dashboards (authenticated users only)
- Must support viewing dashboards (public access)
- Must support editing dashboard metadata (authenticated users only)
- Must support deleting dashboards (authenticated users only)

### Component Operations
- Must support adding components to dashboard (authenticated users only)
- Must support editing component queries and configuration (authenticated users only)
- Must support updating component grid position and size
- Must support deleting components (authenticated users only)

## Page Requirements

Must provide three page types:
- **List Page**: Browse all dashboards with search and filters
- **View Page**: Display dashboard in read-only mode with proper scrolling
- **Edit Page**: Modify dashboard with component editor and grid repositioning

## Scrolling Requirements

- Must establish proper height chain from page → grid → component
- Must properly constrain component heights to enable internal scrolling
- Must support sticky table headers within scrollable areas

## Performance Requirements

- Must execute queries server-side
- Must enforce 1000-row limit on dashboard queries
- Must fetch component data in parallel where possible
- Must cache formatted column definitions

## See Also

- [Dashboard How-To Guide](../../howtos/dashboard.md)
- [Dashboard API Reference](../../reference/frontend/dashboard-api.md)
- [QueryBuilder Specification](./query-builder.md)
- [DataTable System](./data-table.md)
