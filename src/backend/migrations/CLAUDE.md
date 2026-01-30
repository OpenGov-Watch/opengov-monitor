# Migrations CLAUDE.md

Database migration system for schema versioning. Supports SQL and Python migrations.

## Key Files

| File | Purpose |
|------|---------|
| `migration_runner.py` | Main orchestrator, runs pending migrations |
| `create_migration.py` | Helper to generate new migration files |
| `generate_baseline.py` | Dumps schema from migrated DB |
| `baseline_schema.sql` | Fresh database schema template |
| `versions/` | Numbered migration files (001-019) |

## Critical Rules

- **NEVER drop tables** - we need to preserve existing data
- **NEVER modify applied migrations** - create new ones instead
- Always update `schema.py` after migration to match new schema
- Regenerate `baseline_schema.sql` after testing locally

## Commands

```bash
pnpm migrate                                    # Run pending migrations
pnpm migrate:create --name X --type sql         # Create SQL migration
pnpm migrate:create --name X --type py          # Create Python migration
pnpm migrate:baseline --version N               # Mark 1-N as applied (existing DBs)
```

## References

- [README.md](README.md) - Full migration workflow and examples
- [Patterns](../../../docs/03_design/migrations/patterns.md) - Common migration patterns
- [Troubleshooting](../../../docs/03_design/migrations/troubleshooting.md) - Issues and fixes
- [Specification](../../../docs/02_specification/backend/migrations.md) - Requirements
