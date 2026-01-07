# API CLAUDE.md

This file provides guidance for working with the Node.js API server.

## Overview
Express REST API serving governance data to the frontend. Handles:
- Read-only data endpoints (referenda, treasury, etc.)
- CRUD for manual tables (categories, bounties, subtreasury)
- Dashboard and query builder endpoints

## Key Files
- **src/index.ts** - Express server entry point
- **src/db/index.ts** - Database connections (readonly + writable)
- **src/db/queries.ts** - All SQL query functions
- **src/db/types.ts** - TypeScript types matching SQLite schema
- **src/routes/** - Route handlers organized by resource

## API Endpoints

### Read-Only Data
| Endpoint | Description |
|----------|-------------|
| `GET /api/referenda` | All referenda |
| `GET /api/treasury` | Treasury spends |
| `GET /api/child-bounties` | Child bounties |
| `GET /api/fellowship` | Fellowship treasury |
| `GET /api/fellowship-salary/cycles` | Salary cycles |
| `GET /api/fellowship-salary/claimants` | Salary claimants |
| `GET /api/spending` | Aggregated spending view |
| `GET /api/claims/outstanding` | Outstanding claims |
| `GET /api/claims/expired` | Expired claims |
| `GET /api/logs` | System logs |
| `GET /api/stats` | Table row counts |
| `GET /api/health` | Health check |

### CRUD Endpoints
| Resource | Endpoints |
|----------|-----------|
| Categories | `GET/POST/PUT/DELETE /api/categories` |
| Bounties | `GET/POST/PUT/DELETE /api/bounties` |
| Subtreasury | `GET/POST/PUT/DELETE /api/subtreasury` |
| Dashboards | `GET/POST/PUT/DELETE /api/dashboards` |
| Components | `GET/POST/PUT/DELETE /api/dashboards/components` |

### Query Builder
| Endpoint | Description |
|----------|-------------|
| `GET /api/query/schema` | Get whitelisted table schemas |
| `POST /api/query/execute` | Execute query from QueryConfig |

## Commands
```bash
# Development (from root)
pnpm api:dev

# Build
cd api && pnpm build

# Start production
cd api && pnpm start
```

## Configuration
- **PORT**: Server port (default: 3001)
- **DATABASE_PATH**: Path to SQLite database (default: ../data/polkadot.db)
- **LOG_DATABASE_PATH**: Path to log database (default: ../logs/app.db)

## Dependencies
- `express` - HTTP server
- `better-sqlite3` - SQLite database access
- `cors` - Cross-origin requests
- `tsx` - TypeScript execution for development
