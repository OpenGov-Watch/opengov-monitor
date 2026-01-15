# OpenGov Monitor

Data collection backend, REST API, and web dashboard for Polkadot/Kusama governance data.

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.10+, pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Setup backend and fetch data
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/run_sqlite.py --db ../data/local/polkadot.db

# Run application (from root)
cd ..
pnpm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

## Architecture

pnpm monorepo: Python backend (data fetching) → SQLite → Express API → React frontend.

## Project Structure & Navigation

```
src/
├── backend/           Python data pipeline (see src/backend/CLAUDE.md)
│   ├── data_providers/   Subsquare, price, identity fetching
│   ├── data_sinks/       SQLite storage
│   ├── migrations/       Database migration system
│   ├── scripts/          run_sqlite.py, fetch_salaries.py, sanity_check.py
│   └── config.yaml       Fetch limits, salary toggle
│
├── api/               Express REST API (see src/api/CLAUDE.md)
│   └── src/
│       ├── index.ts      Server entry
│       ├── db/           queries.ts, types.ts
│       └── routes/       Endpoint handlers
│
├── frontend/          Vite + React (see src/frontend/CLAUDE.md)
│   └── src/
│       ├── pages/        Page components
│       ├── components/   data-table/, tables/, charts/, dashboard/
│       ├── api/          client.ts
│       └── hooks/        use-view-state.ts
│
├── deploy/            Docker deployment configuration
└── scripts/           Development orchestration (dev.mjs)

data/
├── local/         Local development databases (polkadot.db, sessions.db)
├── defaults/      Default CSV configs (tracked in git)
└── backup/        Production database backups
docs/spec/         Detailed specifications
```

## Key Entry Points

| Task | Start here |
|------|------------|
| Add/modify API endpoint | `src/api/src/routes/`, `src/api/src/db/queries.ts` |
| Add new page | `src/frontend/src/router.tsx`, `src/frontend/src/pages/` |
| Modify data fetching | `src/backend/data_providers/subsquare.py` |
| Modifying database schema | `docs/spec/backend/migrations.md` |

## Available Commands

### Development
```bash
pnpm run dev          # Start API + frontend (dynamic ports)
pnpm api:dev          # API only (port 3001)
pnpm frontend:dev     # Frontend only (port 3000)
pnpm run build        # Build all packages
pnpm test             # Run all tests
```

### Backend Data Sync
```bash
cd backend
source .venv/bin/activate    # Windows: .venv\Scripts\activate
python scripts/run_sqlite.py --db ../data/local/polkadot.db
```

**Existing developers:** If you have databases in `data/`, move them to `data/local/`:
```bash
mkdir -p data/local
mv data/polkadot.db* data/local/
mv data/sessions.db* data/local/
```

### Database Migrations
```bash
pnpm migrate                              # Run pending migrations
pnpm migrate:create --name add_field --type sql  # Create new migration
pnpm migrate:baseline --version N         # Mark migrations up to N as applied
```

**Note**: Windows users need to change `.venv/bin/python` to `.venv/Scripts/python.exe` in package.json scripts.

### Database Sanity Checks
```bash
pnpm sanity:check         # Check ID continuity in all tables
pnpm sanity:check:verbose # Show detailed gap information
```

Verifies that ID sequences in key tables are continuous with no gaps. See [docs/howtos/sanity-checks.md](docs/howtos/sanity-checks.md) for detailed usage and options.

## Gotchas

- **Dot-notation columns**: Use `accessorFn` not `accessorKey` for columns like `tally.ayes`
- **Windows dual-stack**: API binds to `127.0.0.1` explicitly

## Documentation

| Topic | Location |
|-------|----------|
| System overview | [docs/architecture.md](docs/architecture.md) |
| Project-specific quirks | [docs/reference/gotchas.md](docs/reference/gotchas.md) |
| Data schemas (shared) | [docs/spec/data-models.md](docs/spec/data-models.md) |
| Error logging & validation | [docs/reference/error-logging.md](docs/reference/error-logging.md) |
| Frontend table system | [docs/spec/frontend/tables.md](docs/spec/frontend/tables.md) |
| Backend business rules | [src/backend/docs/spec/business-rules.md](src/backend/docs/spec/business-rules.md) |
| API validation | [src/api/docs/spec/validation.md](src/api/docs/spec/validation.md) |
| Database migrations | [docs/spec/backend/migrations.md](docs/spec/backend/migrations.md), [src/backend/migrations/README.md](src/backend/migrations/README.md) |
| Database sanity checks | [docs/howtos/sanity-checks.md](docs/howtos/sanity-checks.md) |
| Deployment & Docker | [src/deploy/CLAUDE.md](src/deploy/CLAUDE.md) |

## Authentication

The manage section (`/manage/*` routes) requires authentication for administrative operations.

### Login
- Navigate to: http://localhost:3000/login
- Default credentials must be created via API or initial setup flow

### Creating the First User
On first run, if no users exist, you can create an admin user:

```bash
# Start the API
pnpm api:dev

# In another terminal, create first user via the API
# (Note: In production, use a secure registration flow)
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "secure-password"}'
```

### Session Management
- Sessions are stored in SQLite (`data/sessions.db`)
- Session duration: 24 hours (default) or 30 days (remember me checkbox)
- Sessions use HTTP-only cookies for security
- Configure `SESSION_SECRET` environment variable in production

### Environment Variables
- `SESSION_SECRET`: 32+ character random string (required in production)
- `NODE_ENV`: Set to "production" for secure HTTPS-only cookies
- `CROSS_ORIGIN_AUTH`: Set to "true" for cross-origin auth (development only)

## License

See [LICENSE](LICENSE) file.
