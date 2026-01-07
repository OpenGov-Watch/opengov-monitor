# Frontend CLAUDE.md

This file provides guidance for working with the Vite + React frontend.

## Architecture
- Vite 6 with React 19 and React Router v7
- Client-side data fetching from the API server (no direct database access)
- TanStack Table for data tables with sorting, filtering, pagination
- shadcn/ui + Tailwind CSS for styling

## Key Files
- **src/main.tsx** - React entry point
- **src/router.tsx** - React Router configuration with lazy-loaded routes
- **src/api/client.ts** - API client functions for data fetching
- **src/components/layout/** - Layout and sidebar components
- **src/components/data-table/** - Reusable DataTable component
- **src/components/dashboard/** - Dashboard grid and component renderer
- **src/components/charts/** - Chart components (pie, bar, line)
- **src/components/query-builder/** - Visual query builder UI
- **src/hooks/use-view-state.ts** - Table state persistence (localStorage + URL)
- **src/pages/** - Page components (lazy-loaded via router)

## Pages
| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/spending` | Aggregated spending view |
| `/referenda` | Governance referenda |
| `/treasury` | Treasury spends |
| `/child-bounties` | Child bounties |
| `/fellowship` | Fellowship treasury |
| `/fellowship-salary-cycles` | Salary cycles |
| `/fellowship-salary-claimants` | Salary claimants |
| `/outstanding-claims` | Approved claims not yet expired |
| `/expired-claims` | Expired unclaimed spends |
| `/dashboards` | Custom dashboard list |
| `/dashboards/new` | Create new dashboard |
| `/dashboards/:id` | View dashboard |
| `/dashboards/:id/edit` | Edit dashboard (add/remove components) |
| `/manage/categories` | CRUD for category/subcategory pairs |
| `/manage/bounties` | Assign categories to parent bounties |
| `/manage/subtreasury` | CRUD for manual spending entries |
| `/logs` | System logs |

## Commands
```bash
# Development (from root with pnpm workspaces)
pnpm frontend:dev

# Or from frontend directory
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Configuration
- **vite.config.ts** - Vite configuration with API proxy
- API proxy: `/api/*` requests are proxied to `http://localhost:3001`
- Dev server runs on port 3000

## Data Fetching Pattern
Pages use `useEffect` + `fetch` to load data from the API:

```tsx
import { useState, useEffect } from "react";

export default function ExamplePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/endpoint")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DataTableSkeleton />;
  return <DataTable data={data} columns={columns} />;
}
```

## Code Conventions
- TypeScript with strict mode
- All components are client components (no Server Components)
- React Router for navigation (Link, useNavigate, useLocation, useParams)
- Lazy loading for page components to reduce initial bundle

## Gotchas

### TanStack Table: Dot-notation column names
SQLite columns like `tally.ayes` contain dots. TanStack Table interprets dots as nested property access when using `accessorKey`. Use `accessorFn` instead:

```tsx
// WRONG - TanStack interprets as row.tally.ayes (nested)
{ accessorKey: "tally.ayes" }

// CORRECT - Use accessorFn for literal dot-notation keys
{
  id: "tally_ayes",
  accessorFn: (row) => row["tally.ayes"],
  cell: ({ row }) => row.original["tally.ayes"],
}
```

### React Router: useParams returns strings
Route parameters are always strings. Parse numeric IDs:

```tsx
const { id } = useParams();
const numericId = parseInt(id as string, 10);
```

### API Server Required
The frontend requires the API server running on port 3001. Start both with:
```bash
pnpm run dev  # From root - starts both API and frontend
```

### Salary tables may be disabled
Fellowship Salary tables can be disabled via `fellowship_salary_cycles: -1` in backend config.yaml. The API will return empty arrays and the frontend should handle this gracefully.

## Dependencies
- `react-router` - Client-side routing
- `@tanstack/react-table` - Data tables
- `@radix-ui/*` - UI primitives (via shadcn/ui)
- `lucide-react` - Icons
- `recharts` - Charts
- `react-grid-layout` - Dashboard grid
- `tailwindcss` - Styling

## References
- Full architecture: [docs/spec/frontend.md](../docs/spec/frontend.md)
- Data models: [docs/spec/data-models.md](../docs/spec/data-models.md)
- API documentation: [api/CLAUDE.md](../api/CLAUDE.md)
