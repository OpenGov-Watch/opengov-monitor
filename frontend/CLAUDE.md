# Frontend CLAUDE.md

Vite + React dashboard with TanStack Table and shadcn/ui. Client-side data fetching from API.

## Key Files

| File | Purpose |
|------|---------|
| `src/router.tsx` | React Router config, all routes defined here |
| `src/api/client.ts` | API client functions |
| `src/components/data-table/` | Reusable DataTable component |
| `src/components/tables/*-columns.tsx` | Column definitions per table |
| `src/hooks/use-view-state.ts` | Table state persistence (localStorage + URL) |
| `src/components/dashboard/` | Dashboard builder components |
| `src/components/query-builder/` | Visual query builder |

## Commands

```bash
pnpm frontend:dev   # Development
pnpm build          # Production build
pnpm test:run       # Run tests
```

## Data Fetching Pattern

```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch("/api/endpoint")
    .then((res) => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);
```

## Gotchas

### Dot-notation columns
SQLite columns like `tally.ayes` need `accessorFn`, not `accessorKey`:
```tsx
// WRONG: { accessorKey: "tally.ayes" }
// RIGHT:
{ id: "tally_ayes", accessorFn: (row) => row["tally.ayes"] }
```

### useParams returns strings
```tsx
const { id } = useParams();
const numericId = parseInt(id as string, 10);
```

### API server required
Start both with `pnpm run dev` from root, or API won't be available.

## Adding a Page

1. Create page component in `src/pages/`
2. Add route in `src/router.tsx` (lazy load with `React.lazy`)
3. Add sidebar link in `src/components/layout/sidebar.tsx`
4. Create columns file in `src/components/tables/` if table page

## References

- [Data models](../docs/spec/data-models.md) - Table schemas, views
- [Table systems](../docs/spec/frontend/tables.md) - DataTable & Dashboard table architecture
- [Gotchas](../docs/reference/gotchas.md) - Project-specific quirks
