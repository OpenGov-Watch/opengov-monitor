# API CLAUDE.md

Express REST API serving governance data to the frontend. Reads from SQLite, handles CRUD for manual tables.

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Express server entry, middleware setup |
| `src/db/queries.ts` | All SQL query functions |
| `src/db/types.ts` | TypeScript types matching SQLite schema |
| `src/db/index.ts` | Database connections (readonly + writable) |
| `src/routes/` | Route handlers by resource |

## Commands

```bash
pnpm api:dev      # Development with hot reload
pnpm build        # Build for production
pnpm start        # Run production build
pnpm test:run     # Run tests
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port (auto-finds free port if taken) |
| `DATABASE_PATH` | `../data/polkadot.db` | SQLite database path |
| `SESSION_SECRET` | (required in prod) | 32+ char session encryption key |

## Adding an Endpoint

1. Add query function in `src/db/queries.ts`
2. Create or update route handler in `src/routes/`
3. Register route in `src/index.ts` if new file
4. Add types to `src/db/types.ts` if needed

## References

- [Validation rules](docs/spec/validation.md) - API validation and error responses
- [Data models](../docs/spec/data-models.md) - Table schemas
