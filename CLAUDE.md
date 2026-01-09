# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview
pnpm monorepo with three components:
1. **Backend (Python)**: Fetches Polkadot/Kusama governance data from Subsquare, stores in SQLite
2. **API (Node.js/Express)**: REST API serving data to frontend, handles CRUD operations
3. **Frontend (Vite/React)**: Dashboard for viewing and analyzing governance data

## Architecture
```
Backend (Python)        API (Express)           Frontend (Vite)
[Subsquare API] ---->   [SQLite DB] <----       [React + Tailwind]
                             ^                         |
                             |                         v
                        [REST API] <-----------> [fetch()]
                        :3001                    :3000
```

## Repository Structure
```
opengov-monitor/
├── backend/              # Python data pipeline
│   ├── data_providers/   # Subsquare, price, identity fetching
│   ├── data_sinks/       # SQLite and Google Sheets storage
│   ├── scripts/          # CLI utilities (run_sqlite.py, fetch_salaries.py)
│   └── config.yaml       # Fetch limits, salary toggle
├── api/                  # Node.js REST API
│   └── src/
│       ├── index.ts      # Express server entry
│       ├── db/           # Database connections and queries
│       └── routes/       # Route handlers (14 files)
├── frontend/             # Vite + React
│   └── src/
│       ├── pages/        # Page components
│       ├── components/   # UI, tables, charts, dashboard
│       ├── api/          # API client (client.ts)
│       ├── lib/db/       # TypeScript types
│       └── hooks/        # View state management
├── data/                 # SQLite database (polkadot.db)
└── docs/                 # Specifications
```

## Shared Database
- Path: `data/polkadot.db`
- Backend populates -> API reads/writes -> Frontend consumes via REST

### Tables
| Table | Source |
|-------|--------|
| Referenda, Treasury, Child Bounties, Fellowship | Subsquare API |
| Fellowship Salary Cycles/Claimants/Payments | Subsquare API |
| Categories, Bounties, Subtreasury | Manual (frontend UI via API) |
| Dashboards, Dashboard Components | Manual (frontend UI via API) |
| Users | Manual (CLI via `pnpm users`) |

### Views
| View | Description |
|------|-------------|
| outstanding_claims | Approved treasury spends not yet expired |
| expired_claims | Approved spends past expiration |
| all_spending | Aggregated spending from all sources |

## Commands
```bash
# Install all dependencies
pnpm install

# Run all services in parallel
pnpm run dev

# Run individual services
pnpm api:dev       # API server on :3001
pnpm frontend:dev  # Frontend on :3000

# Build for production
pnpm run build

# Backend data fetching
cd backend
source .venv/bin/activate
python scripts/run_sqlite.py --db ../data/polkadot.db
```

## Important Files
| File | Purpose |
|------|---------|
| `api/src/db/queries.ts` | All SQL query functions |
| `api/src/db/types.ts` | TypeScript types + table name constants |
| `api/src/routes/*.ts` | API endpoint handlers |
| `frontend/src/api/client.ts` | API client for frontend |
| `frontend/src/router.tsx` | React Router configuration |
| `frontend/src/lib/db/types.ts` | Frontend TypeScript types |
| `frontend/src/components/data-table/` | Reusable table components |
| `backend/config.yaml` | Fetch limits, salary toggle |

## Gotchas

### TanStack Table: Dot-notation columns
SQLite columns like `tally.ayes` need `accessorFn`:
```tsx
// WRONG: { accessorKey: "tally.ayes" }
// RIGHT:
{ id: "tally_ayes", accessorFn: (row) => row["tally.ayes"] }
```

### Windows: IPv4/IPv6 dual-stack
API server binds to `127.0.0.1` explicitly to avoid port conflicts. Vite proxy uses same address.

### all_spending view
The database view has a schema issue (references non-existent columns). The API uses a custom query instead.

### better-sqlite3 builds
Requires `pnpm.onlyBuiltDependencies` in root package.json to allow native builds.

## Documentation
| Topic | Location |
|-------|----------|
| System architecture | [docs/spec/index.md](docs/spec/index.md) |
| Data models | [docs/spec/data-models.md](docs/spec/data-models.md) |
| API reference | [docs/spec/api-reference.md](docs/spec/api-reference.md) |
| Backend specifics | [backend/CLAUDE.md](backend/CLAUDE.md) |
| API specifics | [api/CLAUDE.md](api/CLAUDE.md) |
| Frontend specifics | [frontend/CLAUDE.md](frontend/CLAUDE.md) |
| Deployment & container | [deploy/CLAUDE.md](deploy/CLAUDE.md) |

## Authentication

The application uses server-side session authentication for write operations.

### User Management
```bash
# From the api directory
pnpm users add <username>    # Create user (prompts for password)
pnpm users list              # List all users
pnpm users delete <username> # Delete user
```

### Protected Routes
All mutating API endpoints require authentication:
- `PATCH /api/referenda/:id`, `POST /api/referenda/import`
- `PATCH /api/child-bounties/:identifier`, `POST /api/child-bounties/import`
- All POST/PUT/DELETE on `/api/categories`, `/api/bounties`, `/api/subtreasury`, `/api/dashboards`

### Session Configuration
- Sessions stored in `data/sessions.db` (SQLite)
- Default session: 24 hours, "Remember me": 30 days
- Cookies: httpOnly, sameSite=lax, secure in production

### Frontend Auth
- Login page: `/login`
- "Manage" section hidden for unauthenticated users
- Protected pages redirect to login with return URL

### Environment Variables
- `SESSION_SECRET`: Required for production (32+ character random string)
  - Generate with: `openssl rand -base64 32`

### Migration
Run before first use or after updates:
```bash
cd api
npx tsx scripts/migrate-auth.ts
pnpm users add admin
```

## Configuration
- **backend/config.yaml**: Fetch limits, block time projection, salary toggle (`-1` to skip)
- **Environment vars**: `PORT`, `DATABASE_PATH`, `SESSION_SECRET`, `OPENGOV_MONITOR_SPREADSHEET_ID`, `OPENGOV_MONITOR_CREDENTIALS`

# Tool usage:
- Bash: never command multiple commands via `&&`. Instead, use them one after the other.
