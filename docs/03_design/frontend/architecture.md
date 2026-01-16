# Frontend Architecture

Vite + React dashboard with TanStack Table, shadcn/ui, and react-grid-layout.

## Overview

```
Pages                     Components                    API
─────                     ──────────                    ───
Page defines  ──▶  DataTable  ──▶  QueryConfig  ──POST──▶  /api/query/execute
QueryConfig       Dashboard   ──▶  Components   ──POST──▶  /api/dashboards
                  QueryBuilder ──▶  SQL preview
```

## Core Concepts

### QueryConfig-Driven Tables
Pages define a `QueryConfig`, DataTable handles the rest:
1. Page specifies: table, columns, default filters, sort
2. DataTable: fetches data, generates columns, handles state
3. Server-side: pagination, sorting, filtering all via API

### View State Persistence
Table state persisted two ways:
- **localStorage**: Per-table saved views
- **URL**: `?view=` param for sharing

### Dashboard System
Grid-based dashboards with drag/drop:
- `react-grid-layout` for positioning
- Components: charts, tables, custom widgets
- Config stored in database

## Component Hierarchy

```
App
├── Layout (sidebar, header)
│   └── Page (route component)
│       ├── DataTable
│       │   ├── Toolbar (search, filters, export)
│       │   ├── Table/CardView
│       │   └── Pagination
│       └── Dashboard
│           ├── DashboardGrid
│           └── DashboardComponent[]
└── QueryBuilder (modal)
```

## Pages Pattern

Each table page follows:
```
1. Define queryConfig (table, columns, filters)
2. Define columnOverrides (custom rendering)
3. Define facetedFilters (filter columns)
4. Render DataTable with props
```

See pages in `src/frontend/src/pages/`.

## API Client

Centralized in `src/api/client.ts`:
- Typed fetch wrappers
- Error handling
- Base URL configuration

## Authentication

- `AuthContext` provides `isAuthenticated`, `user`
- `RequireAuth` component for protected routes
- Cell-level auth: conditional rendering (edit vs readonly)

## Data Fetching

### SWR Hooks
Shared data uses SWR for automatic deduplication:
- `useCategories()` - Categories across all pages
- `useDashboards()` - Dashboard list in sidebar

Located in `src/frontend/src/hooks/`.

### Page-Level Fetching
Pages fetch their own data via `fetch()` in useEffect. DataTable handles query execution internally via `/api/query/execute`.

## Performance Patterns

### Icon Imports
Use direct imports from lucide-react to avoid loading entire icon library:
```typescript
// ✅ Correct
import Check from "lucide-react/dist/esm/icons/check"

// ❌ Avoid (loads all icons)
import { Check } from "lucide-react"
```

Type imports use the barrel:
```typescript
import type { LucideIcon } from "lucide-react"
```

### Memoization
- Chart tooltips: `React.memo()` to prevent re-renders on hover
- Category lookups: `useMemo()` with Map for O(1) access
- Dashboard components: Custom `memo()` comparison functions

### CSS Performance
Table rows use `content-visibility: auto` for virtualization-like benefits without complexity. See `globals.css`.

## Key Files

```
src/frontend/src/
├── router.tsx                # Route definitions
├── api/client.ts             # API client
├── pages/                    # Page components
├── components/
│   ├── data-table/           # Unified table component
│   │   ├── data-table.tsx    # Main component
│   │   └── use-view-state.ts # State persistence
│   ├── dashboard/            # Dashboard system
│   │   ├── dashboard-grid.tsx
│   │   └── dashboard-component.tsx
│   ├── query-builder/        # SQL query builder
│   └── tables/               # Column definitions
├── hooks/
│   ├── use-auth.ts           # Auth state
│   ├── use-categories.ts     # SWR category hook
│   └── use-dashboards.ts     # SWR dashboard hook
└── lib/
    ├── auto-columns.ts       # Column generation
    └── column-renderer.ts    # Value formatting
```

## Related Docs

- [Table Systems](table-systems.md) - [Column Config](column-formatting.md) - [DataTable API](data-table-api.md) - [Dashboard API](dashboard-api.md) - [System Architecture](../architecture.md)
