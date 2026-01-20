# Table Views System

Architecture for saving, loading, and sharing table configurations.

## Overview

- `useViewState` hook manages state, localStorage, URL sync
- `ViewSelector` component provides UI (tabs desktop, dropdown mobile)
- Views store: sorting, filters, pagination, column visibility, filterGroup, groupBy

## Interfaces

### ViewState

| Property | Type | Description |
|----------|------|-------------|
| sorting | SortingState | TanStack Table sorting |
| columnFilters | ColumnFiltersState | Quick column filters |
| columnVisibility | VisibilityState | Column show/hide |
| pagination | PaginationState | Page index, page size |
| filterGroup | FilterGroup (optional) | Nested AND/OR filters |
| groupBy | string (optional) | Group by column |

### SavedView

| Property | Type | Description |
|----------|------|-------------|
| name | string | View name (unique per table) |
| state | ViewState | Full state snapshot |
| deletable | boolean (optional) | Default true; false protects view |

## Storage

- Key: `opengov-views-{tableName}`
- Format: JSON array of SavedView objects
- Encoding for URL: base64 via btoa/atob

## Initialization Flow

1. Check URL `?view=` param → decode and apply
2. Check localStorage → load saved views
3. If empty + defaultViews provided → initialize with defaults
4. Apply first view

## URL Synchronization

- 500ms debounce on state changes
- Updates URL with `?view={base64}`
- Uses `replace: true` to avoid history pollution
- Enables bookmarking and sharing

## Protected Views

Set `deletable: false` on default views:
- Delete button hidden in UI
- `deleteView()` silently returns

## Key Files

- `src/frontend/src/hooks/use-view-state.ts` - Hook implementation
- `src/frontend/src/components/data-table/view-selector.tsx` - UI component

## See Also

- [Working with Table Views](../../howtos/table-views.md) - How-to guide
- [DataTable API](./data-table-api.md) - DataTable component reference
