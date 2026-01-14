# CLAUDE.md

pnpm monorepo: Python backend (data fetching) → SQLite → Express API → React frontend.

## When planning changes
- Planning Phase
  - Review the specification. If it is not mentioned in the spec, discuss updating the spec with the user
  - Database schema changes must consider `docs/spec/migrations.md`
- Specification
  - Update Spec
  - Prospectively update unit tests to match spec
- Coding
  - prefer removing code over marking it as deprecated
- Update documentation where relevant. See the Documentation section below for where to document different topics
- Testing
  - Update unit tests, then run full test suite
  - Use Chrome DevTools to verify frontend changes

## Tool usage
- Use `pnpm`, not `npm`
- Use Chrome DevTools to verify frontend changes yourself first
- Use the `gh` CLI for interacting with Github

## Navigation

```
backend/           Python data pipeline (see backend/CLAUDE.md)
├── data_providers/   Subsquare, price, identity fetching
├── data_sinks/       SQLite storage
├── migrations/       Database migration system
├── scripts/          run_sqlite.py, fetch_salaries.py
└── config.yaml       Fetch limits, salary toggle

api/               Express REST API (see api/CLAUDE.md)
└── src/
    ├── index.ts      Server entry
    ├── db/           queries.ts, types.ts
    └── routes/       Endpoint handlers

frontend/          Vite + React (see frontend/CLAUDE.md)
└── src/
    ├── pages/        Page components
    ├── components/   data-table/, tables/, charts/, dashboard/
    ├── api/          client.ts
    └── hooks/        use-view-state.ts

data/              SQLite database (polkadot.db, sessions.db)
docs/spec/         Detailed specifications
```

## Key Entry Points

| Task | Start here |
|------|------------|
| Add/modify API endpoint | `api/src/routes/`, `api/src/db/queries.ts` |
| Add new page | `frontend/src/router.tsx`, `frontend/src/pages/` |
| Modify data fetching | `backend/data_providers/subsquare.py` |
| Modifying database schema | `docs/spec/migrations.md` |

## Commands

```bash
pnpm run dev          # Start API + frontend (dynamic ports)
pnpm api:dev          # API only (:3001)
pnpm frontend:dev     # Frontend only (:3000)
pnpm run build        # Build all packages (API + frontend)
pnpm test             # Run all tests (API + frontend)

# Backend data sync
cd backend && source .venv/bin/activate
python scripts/run_sqlite.py --db ../data/polkadot.db

# Database migrations
pnpm migrate              # Run pending migrations
pnpm migrate:create --name add_field --type sql  # Create new migration
pnpm migrate:baseline --version N  # Mark migrations up to N as applied (for existing DBs)
# Note: Windows users change .venv/bin/python to .venv/Scripts/python.exe in package.json
```

## Gotchas

- **Dot-notation columns**: Use `accessorFn` not `accessorKey` for columns like `tally.ayes`
- **Windows dual-stack**: API binds to `127.0.0.1` explicitly

## Documentation

| Topic | Location |
|-------|----------|
| System overview | [docs/architecture.md](docs/architecture.md) |
| Project-specific quirks | [docs/gotchas.md](docs/gotchas.md) |
| Data schemas (shared) | [docs/spec/data-models.md](docs/spec/data-models.md) |
| Frontend table system | [docs/spec/frontend/tables.md](docs/spec/frontend/tables.md) |
| Backend business rules | [backend/docs/spec/business-rules.md](backend/docs/spec/business-rules.md) |
| API validation | [api/docs/spec/validation.md](api/docs/spec/validation.md) |
| Database migrations | [docs/spec/migrations.md](docs/spec/migrations.md), [backend/migrations/README.md](backend/migrations/README.md) |
| Deployment & Docker | [deploy/CLAUDE.md](deploy/CLAUDE.md) |

## Tool Usage
- Bash: Don't chain commands with `&&`. Run them sequentially instead.

## Before Committing
Always run these commands and ensure they pass before committing:
- Build: `pnpm run build`
- Test: `pnpm test`

If either fails, fix the issues before committing.

## Before Deploying
If your changes affect Docker, supervisord, or startup scripts:
- Test: `docker compose up --build`
- Verify: `curl http://localhost/api/health`
- Check: `docker compose exec opengov-monitor supervisorctl status`

See [deploy/CLAUDE.md](deploy/CLAUDE.md) for full pre-deployment checklist.