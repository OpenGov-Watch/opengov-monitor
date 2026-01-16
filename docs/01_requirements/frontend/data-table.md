# DataTable System Specification

Requirements for full-page data exploration and analysis tables.

## Purpose

Must provide unified table interface for viewing, filtering, and analyzing database query results across all main application pages (referenda, treasury, child bounties, fellowship, spending, claims, logs).

## Data Requirements

### Query Configuration
- Must accept query configuration specifying source table, columns, filters, sort order, and row limits
- Must auto-generate table columns from query configuration
- Must support custom column rendering and formatting overrides
- Must handle dot-notation column names (SQLite nested columns)

### Column Formatting
- Must automatically format columns by name pattern (currency prefixes, date suffixes, status columns)
- Must support pattern types: exact match, prefix, suffix, substring
- Must allow case-insensitive pattern matching
- Must support cascading priority: table-specific config → global config → pattern detection → default
- Must render currency (DOT, USD, USDC, USDT), numbers, dates, addresses, and status badges
- Must support editable cells with authentication gating

## Filtering Requirements

### Server-Side Faceted Filters
- Must provide multi-select dropdown filters showing all distinct values with counts
- Must fetch facet data from server in parallel with table data
- Must show counts from full dataset, not just current page
- Must update facet values when other filters change
- Must gracefully fall back to client-side if server fails
- Must support Apply/Cancel confirmation pattern

### Global Search
- Must search across all visible columns simultaneously
- Must use case-insensitive substring matching
- Must filter in real-time as user types

### Advanced Filtering
- Must support custom filter functions for complex logic
- Must handle "uncategorized" values and special cases

## Sorting Requirements

- Must support column header click to cycle: none → ascending → descending → none
- Must execute sorting server-side via database query
- Must allow disabling sort on specific columns
- Must show visual indicators (arrows, chevrons)

## Pagination Requirements

- Must fetch only current page from server (server-side pagination)
- Must support page sizes: 10, 20, 30, 50, 100
- Must default to 100 rows per page
- Must provide navigation: First, Previous, Next, Last
- Must display total count from separate COUNT query

## View State Requirements

### Persistence
- Must save view state (sorting, filters, column visibility, search, pagination) to localStorage per table
- Must support multiple named views per table
- Must allow setting default view
- Must support URL sharing via base64-encoded query parameter
- Must provide save, load, delete, and set-default operations

### View Selector
- Must display views as tabs on desktop
- Must display views as dropdown on mobile

## Column Visibility Requirements

- Must allow hiding/showing individual columns
- Must require columns to have accessor functions to be hideable
- Must display column IDs with underscores/dots converted to spaces
- Must hide visibility controls on mobile

## Authentication Requirements

### Cell Editing
- Must show editable cells only when user is authenticated
- Must show read-only versions for unauthenticated users
- Must support category selection, text notes, and boolean toggles
- Must save changes immediately on blur or toggle

## Responsive Requirements

### Breakpoint Behavior
- Must use 768px (md) as mobile/desktop breakpoint
- Must remember view mode choice (table vs card) per table in localStorage

### Mobile View (< 768px)
- Must switch to card layout showing data vertically
- Must show first 3 columns always visible
- Must provide expandable "Show details" for remaining columns
- Must use full-width search input
- Must paginate by columns in expanded view

### Desktop View (≥ 768px)
- Must use traditional table layout
- Must constrain search input width
- Must paginate by rows

## Export Requirements

- Must export to CSV with proper quote escaping
- Must export to JSON
- Must export only filtered rows
- Must export only visible columns
- Must provide format selection dropdown in toolbar

## Performance Requirements

- Must execute all filtering, sorting, and pagination server-side
- Must transfer only current page data (not entire dataset)
- Must cache auto-generated columns
- Must limit default queries to 10,000 rows maximum

## Compact Mode Requirements

- Must support compact mode for potential dashboard integration
- Must reduce toolbar and pagination sizing in compact mode
- Must hide "Reset View" button and view mode toggle in compact mode

## See Also

- [DataTable How-To Guide](../../howtos/data-table.md)
- [DataTable API Reference](../../03_design/frontend/data-table-api.md)
- [Dashboard System](./dashboard.md)
- [Filtering Systems](./filters.md)
