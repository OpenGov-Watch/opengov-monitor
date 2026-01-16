# Frontend

React 19 + Vite dashboard for Polkadot OpenGov monitoring. Server-side data operations, responsive tables with TanStack Table, customizable views, and drag-and-drop dashboards.

## Quick Start

```bash
# Development
pnpm frontend:dev     # Starts on :3000, proxies to API

# Testing & Build
pnpm test             # Unit tests with Vitest
pnpm build            # Type check + production build
```

## Architecture

**Stack:** React 19, TypeScript 5.7, Vite 6, Tailwind CSS 3.4, TanStack Table 8

**Key Concepts:**
- **DataTable** - Unified table component with server-side pagination/sorting/filtering
- **QueryConfig** - Declarative data fetching (columns, filters, orderBy)
- **View State** - Persisted table states (sorting, filters, pagination) to localStorage + URL
- **Column Configuration** - Pattern-based auto-formatting (e.g., `DOT_*` → currency)
- **Dashboard Builder** - Drag-and-drop grid with charts and tables

## Project Structure

```
src/
├── pages/              Page components (lazy-loaded)
├── components/
│   ├── data-table/    Core table component & utilities
│   ├── dashboard/     Dashboard builder
│   ├── charts/        Bar, line, pie charts (recharts)
│   ├── ui/            shadcn/ui components (17 components)
│   └── query-builder/ Visual SQL query builder
├── hooks/             Custom hooks (use-view-state, use-auth)
├── contexts/          Auth & API contexts
├── lib/               Utilities
│   ├── auto-columns.tsx        Dynamic column generation
│   ├── column-renderer.ts      Column formatting registry
│   └── query-config-utils.ts   Query state conversion
└── api/               API client (client.ts)
```

## Data Fetching Pattern

```tsx
// 1. Define what data to fetch
const queryConfig: QueryConfig = {
  sourceTable: "Referenda",
  columns: [
    { column: "id" },
    { column: "title" },
    { column: "DOT_latest" }, // Auto-formats as currency
  ],
  filters: [{ column: "status", operator: "=", value: "Active" }],
  orderBy: [{ column: "id", direction: "DESC" }],
  limit: 100,
};

// 2. Pass to DataTable (handles fetching, rendering, state)
<DataTable
  queryConfig={queryConfig}
  tableName="referenda"
  columnOverrides={{ /* custom rendering */ }}
  facetedFilters={["status", "track"]}
/>
```

## Column Configuration

Columns are auto-formatted based on naming patterns in `public/config/column-config.yaml`.

**Pattern Types:**
- `prefix` - Matches column start (e.g., `DOT_*` → currency with 0 decimals)
- `suffix` - Matches column end (e.g., `*.ayes` → green number)
- `exact` - Exact match (e.g., `status` → badge)
- `substring` - Contains pattern (e.g., `*_time*` → date)

**Built-in Patterns:**
| Pattern | Matches | Rendering |
|---------|---------|-----------|
| `DOT_` | DOT_latest, DOT_proposal_time | Currency (DOT, 0 decimals) |
| `USD_` | USD_latest | Currency (USD, 0 decimals) |
| `USDC_`, `USDT_` | USDC_component | Currency (2 decimals) |
| `.ayes`, `.nays` | tally.ayes | Number (green/red) |
| `_time`, `_date` | proposal_time | Date |
| `status` | status | Badge with variants |
| `beneficiary`, `address`, `who` | beneficiary | Truncated address |

**Add New Patterns:** Edit `public/config/column-config.yaml`

```yaml
patterns:
  - match: prefix
    pattern: "ETH_"
    config:
      render: currency
      currency: ETH
      decimals: 4
```

**Override Patterns:** Add explicit config

```yaml
columns:
  DOT_special:
    displayName: "Special Column"
    render: currency
    currency: DOT
    decimals: 2  # Overrides pattern's 0 decimals
```

**Precedence:** Table-specific → Global columns → Patterns → Default (text)

See [Column Configuration System](../docs/reference/frontend/table-systems.md#column-configuration) for details.

## API Context

Dynamic API server selection at runtime:

```typescript
// URL params: ?api=local, ?api=3002, ?api=https://api.example.com
// localStorage key: api-server
// Config file: public/config/config.json

// Access anywhere in code
import { getApiBase } from "@/contexts/api-context";
const base = getApiBase(); // e.g., "http://localhost:3001"
```

## Testing

```bash
pnpm test          # Watch mode
pnpm test:run      # Single run
```

**Test files:** `src/**/*.test.{ts,tsx}`

**Setup:** jsdom environment, mocked window APIs (matchMedia, ResizeObserver)

**Libraries:** Vitest 4, @testing-library/react 16

## Responsive Design

- **Breakpoint:** 768px (Tailwind `md`)
- **Mobile:** Card view, drawer navigation, touch-optimized
- **Desktop:** Table view, sidebar navigation, keyboard shortcuts

## Key Files

| Task | File |
|------|------|
| Add page | `src/router.tsx`, `src/pages/` |
| Modify table | `src/components/data-table/data-table.tsx` |
| Add API endpoint | `src/api/client.ts` |
| Configure columns | `public/config/column-config.yaml` |
| Update types | `src/lib/db/types.ts` |

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Agent navigation guide
- [Table Systems](../docs/reference/frontend/table-systems.md) - DataTable architecture reference
- [Project Root](../README.md) - Full system overview
- [Architecture](../docs/architecture.md) - System design

## Tech Stack

**Core:**
- React 19, TypeScript 5.7, Vite 6, React Router 7
- Tailwind CSS 3.4 (dark mode support)

**UI:**
- TanStack Table 8 - Headless tables
- shadcn/ui + Radix UI - Accessible components
- recharts 3 - Charts
- react-grid-layout - Dashboard grid
- @dnd-kit - Drag and drop
- lucide-react - Icons

**Testing:**
- Vitest 4, @testing-library/react 16, jsdom

**Other:**
- yaml 2.8 - Config parsing
- react-markdown 10 - Markdown rendering
