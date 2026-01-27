# System Architecture

Overview of how the three main components work together.

## Diagram

```
                   React Frontend (:3000)
                              ▲
                              │ REST
                    Express API (:3001)
                              ▲
                              │ reads
                          SQLite
                              ▲
                              │ writes
                   Python Backend (cron)
                              ▲
                              │ fetches
    External APIs (Subsquare, Statescan, yfinance, CoinGecko)
```

## Component Responsibilities

| Component | Role | Key Files |
|-----------|------|-----------|
| Shared | TypeScript types shared between API and Frontend | `src/shared/types.ts` |
| Backend | Fetch governance data, enrich with USD prices, store to SQLite | `src/backend/scripts/run_sqlite.py` |
| API | Serve REST endpoints, handle auth, CRUD for manual tables | `src/api/src/index.ts` |
| Frontend | Render data tables, dashboards, query builder | `src/frontend/src/router.tsx` |

## Data Flow

1. **Backend** (hourly cron): Fetches from Subsquare/Statescan, enriches with prices, writes to SQLite
2. **API** (always running): Reads SQLite, serves data via REST, handles authentication
3. **Frontend** (browser): Fetches from API, renders with TanStack Table, persists view state

## Key Integration Points

### Backend → Database
- Backend writes via `SQLiteSink` class
- Schema defined in `data_sinks/sqlite/schema.py`
- Migrations managed via `migrations/` folder

### Database → API
- API uses `better-sqlite3` for sync reads
- Two connections: readonly (queries), writable (CRUD)
- WAL mode for concurrent access

### API → Frontend
- **QueryConfig system**: Frontend sends query configs, API generates SQL
- **Faceted filters**: Parallel queries for filter values + counts
- **Server-side pagination**: Only fetched page transferred

## Databases

| Database | Purpose |
|----------|---------|
| `polkadot.db` | Main data (governance, spending, prices) |
| `sessions.db` | Express sessions (auth) |

## Authentication

Session-based (`express-session`), cookies with 24h/30d expiry. Protected routes require auth. Users created via CLI (`pnpm users add`).

## Deployment

Single Docker container with supervisord:
- nginx: reverse proxy + static frontend
- Node API: Express server
- cron: hourly backend sync

See [deployment docs](deployment/pre-deployment-checklist.md).

## Component Architecture

- [Backend Architecture](backend/architecture.md) - Data pipeline design
- [API Architecture](api/architecture.md) - Express API structure
- [Frontend Architecture](frontend/architecture.md) - React app structure
