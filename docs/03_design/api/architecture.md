# API Architecture

Express REST API serving governance data to the frontend. Reads from SQLite, handles auth, CRUD for manual tables.

## Overview

```
Frontend                       API                              Database
────────                       ───                              ────────
QueryConfig  ───POST───▶  /api/query/execute  ──▶  SQL Builder  ──▶  polkadot.db
FacetConfig  ───POST───▶  /api/query/facets   ──▶  Parallel queries
CRUD         ───REST───▶  /api/categories     ──▶  Write ops
Auth         ───────────▶  /api/auth/*         ──▶  sessions.db
```

## Core Concepts

**QueryConfig System**: Frontend sends a `QueryConfig` object, API generates SQL dynamically (columns, filters, sorting, pagination, JOIN detection).

**Faceted Filters**: Parallel queries for filter dropdowns - fetch distinct values with counts against full dataset.

**Security**: Rate limiting (100 req/15min per IP), parameterized queries, session-based auth.

## Routes

| Category | Endpoints | Purpose |
|----------|-----------|---------|
| Query | `POST /api/query/execute`, `/facets` | Execute QueryConfig, get facets |
| Data | `GET /api/referenda`, `/treasury`, `/spending/*`, `/child-bounties`, `/fellowship/*` | Read governance data |
| CRUD (auth) | `/api/categories`, `/bounties`, `/subtreasury` | Manual table management |
| Dashboard | `/api/dashboards`, `/dashboards/:id`, `/dashboards/:id/components` | Dashboard CRUD |
| Auth | `/api/auth/me`, `/login`, `/logout` | Session management |
| Utility | `/api/backup/download`, `/sync/status`, `/data-errors` | System operations |

## Database Access

**Connections** (`src/db/index.ts`): Two handles - readonly (queries) and writable (CRUD).

**WAL Mode**: SQLite runs in WAL mode for concurrent read/write access.

**Queries** (`src/db/queries.ts`): All SQL in one file. Query functions return typed results.

## Key Files

```
src/api/src/
├── index.ts              # Express setup, middleware
├── db/index.ts, queries.ts, types.ts
├── routes/query.ts, auth.ts, dashboards.ts, categories.ts, ...
└── middleware/auth.ts    # requireAuth middleware
```

## Related Docs

- [Data Models](../../02_specification/data-models.md) - [System Architecture](../architecture.md)
