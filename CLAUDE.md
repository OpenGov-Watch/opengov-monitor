# CLAUDE.md

pnpm monorepo: Python backend (data fetching) → SQLite → Express API → React frontend.

## Navigation

```
backend/           Python data pipeline (see backend/CLAUDE.md)
├── data_providers/   Subsquare, price, identity fetching
├── data_sinks/       SQLite storage
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
| Add/modify table columns | `frontend/src/components/tables/*-columns.tsx` |
| Add new page | `frontend/src/router.tsx`, `frontend/src/pages/` |
| Modify data fetching | `backend/data_providers/subsquare.py` |
| Database schema | `backend/data_sinks/sqlite/schema.py`, `api/src/db/types.ts` |

## Commands

```bash
pnpm run dev          # Start API + frontend (dynamic ports)
pnpm api:dev          # API only (:3001)
pnpm frontend:dev     # Frontend only (:3000)

# Backend data sync
cd backend && source .venv/bin/activate
python scripts/run_sqlite.py --db ../data/polkadot.db
```

## Gotchas

- **Dot-notation columns**: Use `accessorFn` not `accessorKey` for columns like `tally.ayes`
- **Windows dual-stack**: API binds to `127.0.0.1` explicitly
- **all_spending view**: Has schema issues; API uses custom query instead

## Documentation

| Topic | Location |
|-------|----------|
| Architecture, config, deployment | [docs/spec/index.md](docs/spec/index.md) |
| Data models, tables, views | [docs/spec/data-models.md](docs/spec/data-models.md) |
| API endpoints | [docs/spec/api-reference.md](docs/spec/api-reference.md) |
| Frontend details | [docs/spec/frontend.md](docs/spec/frontend.md) |
| Subsquare parsing | [docs/spec/subsquare-parsing.md](docs/spec/subsquare-parsing.md) |

## Tool Usage

- Bash: Don't chain commands with `&&`. Run them sequentially instead.
