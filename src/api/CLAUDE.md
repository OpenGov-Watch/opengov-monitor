# API CLAUDE.md

Express REST API serving governance data to the frontend. Reads from SQLite, handles CRUD for manual tables.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server entry, middleware setup |
| `src/db/queries.ts` | All SQL query functions |
| `src/db/types.ts` | TypeScript types (re-exports from `@opengov-monitor/shared` + API-specific import types) |
| `src/db/index.ts` | Database connections (readonly + writable) |
| `src/routes/` | Route handlers by resource |
| `src/routes/query/` | Query builder module (see below) |

## Query Module (`src/routes/query/`)

Modular query builder for dynamic SQL generation with security validation.

| File | Purpose |
|------|---------|
| `index.ts` | Route handlers (`/schema`, `/execute`, `/facets`) |
| `authorization.ts` | Table/view allowlists |
| `security.ts` | SQL injection prevention, expression validation |
| `column-cache.ts` | Column metadata caching |
| `filter-builder.ts` | Filter → WHERE clause conversion |
| `sql-builder.ts` | SELECT/JOIN/ORDER BY clause generation |

## Commands

```bash
pnpm api:dev      # Development with hot reload
pnpm build        # Build for production
pnpm start        # Run production build
pnpm test:run     # Run tests
pnpm users        # User management (list/add/set-password/delete)
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port (auto-finds free port if taken) |
| `DATABASE_PATH` | `data/local/polkadot.db` | SQLite database path |
| `SESSION_SECRET` | (auto-generated) | 32+ char session encryption key (persists to `.session-secret`) |

## Key API Endpoints

### Query Endpoints (`/api/query`)
- `POST /api/query/execute` - Execute QueryConfig, returns data + totalCount (server-side pagination)
- `POST /api/query/facets` - Get facet values + counts for specified columns (full dataset)

### Manual Table CRUD
- Categories, Bounties, Subtreasury: Standard CRUD with auth

### Custom Tables (`/api/custom-tables`)
- `GET /` - List all custom tables
- `GET /:id` - Get table metadata + schema
- `POST /` - Create table with schema and optional data (auth)
- `DELETE /:id` - Delete table (auth)
- `GET /:id/data` - Get paginated rows
- `POST /:id/data` - Insert row (auth)
- `PUT /:id/data/:rowId` - Update row (auth)
- `DELETE /:id/data/:rowId` - Delete row (auth)
- `POST /:id/import` - Bulk import with optional wipe (auth)
- `POST /infer-schema` - Infer column types from CSV data

### Auth (`/api/auth`)
- `/me`, `/login`, `/logout` - Session management
- User management: `pnpm users` command (see Commands section)

### Backup (`/api/backup`)
- `GET /api/backup/info` - Get database file info (size, last write timestamp)
- `GET /api/backup/download` - Download checkpointed database backup (requires auth)

## Adding an Endpoint

1. Add query function in `src/db/queries.ts`
2. Create or update route handler in `src/routes/`
3. Register route in `src/index.ts` if new file
4. Add types to `src/db/types.ts` if needed

## Database Backups

Authenticated users can download database backups via:
- **UI:** Sync Settings page → Download Backup button
- **API:** `GET /api/backup/download` (requires authentication)
- **CLI:** See `.claude/commands/db-backup-production.md`

All backups are automatically checkpointed before download to ensure WAL consistency. The checkpoint runs `PRAGMA wal_checkpoint(TRUNCATE)` to merge all pending WAL writes into the main database file.

### WAL Checkpointing

The API performs WAL checkpoints at three points:
- **Periodic:** Every 60 seconds (only if writes occurred since last checkpoint)
- **On backup download:** Before serving backup files
- **On shutdown:** During graceful shutdown

### Last Write Tracking

The API tracks the timestamp of the last database write operation in-memory (resets on server restart). This is available via `GET /api/backup/info` and can be used to determine if recent writes occurred.

## References

- [Data models](../docs/02_specification/data-models.md) - Table schemas
