# Frontend CLAUDE.md

This file provides guidance for working with the Next.js frontend.

## Architecture
- Next.js 14+ with App Router and Server Components
- Server Components read directly from SQLite (better-sqlite3)
- TanStack Table for data tables with sorting, filtering, pagination
- shadcn/ui + Tailwind CSS for styling

## Key Files
- **src/lib/db/types.ts** - TypeScript types matching SQLite schemas
- **src/components/data-table/** - Reusable DataTable component
- **src/hooks/useViewState.ts** - Table state persistence (localStorage + URL)

## Commands
```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Code Conventions
- TypeScript with strict mode
- React Server Components for data fetching
- Client components for interactive table features

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

### Next.js 15: Native module configuration
The `experimental.serverComponentsExternalPackages` option was moved to top-level `serverExternalPackages` in Next.js 15:

```javascript
// next.config.js (Next.js 15+)
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],  // NOT experimental
};
```

### useSearchParams requires Suspense
Components using `useSearchParams()` must be wrapped in a Suspense boundary for static generation. The `DataTableWrapper` component handles this:

```tsx
// DataTableWrapper wraps DataTable in Suspense
<Suspense fallback={<DataTableSkeleton />}>
  <DataTable ... />
</Suspense>
```

### Salary tables may be disabled
Fellowship Salary tables can be disabled via `fellowship_salary_cycles: -1` in backend config.yaml. Frontend pages should check `tableExists()` before querying and show a helpful message if missing.

## References
- Full architecture: [docs/spec/frontend.md](../docs/spec/frontend.md)
- Data models: [docs/spec/data-models.md](../docs/spec/data-models.md)
