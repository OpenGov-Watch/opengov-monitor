# Data Directory Structure

## Folders

| Folder | Purpose | Retention |
|--------|---------|-----------|
| `local/` | Local development databases | Developer-managed |
| `defaults/` | Essential CSV configs (categories, netflows) | Permanent (tracked in git) |
| `backup/` | Production database backups | Keep last 5 |
| `tmp/` | Experiments, short-lived files | Delete anytime |

## Files

| Pattern | Purpose | Git Status |
|---------|---------|------------|
| `local/*.db` | SQLite databases (polkadot.db, sessions.db) | Gitignored |
| `local/*.db-wal` | SQLite WAL files | Gitignored |
| `local/*.db-shm` | SQLite shared memory files | Gitignored |
| `*.csv` (root) | Generated data exports | Gitignored |
| `defaults/*.csv` | Category taxonomies, default data | Tracked |

## Usage

- **Local development**: All databases go in `local/` folder
- **Experiments/Testing**: Use `tmp/` folder for non-database files
- **Production backups**: Use `backup/` folder (via `/db-backup-production`)
- **Default configs**: Use `defaults/` folder (committed to git)
- **Generated exports**: Root or `tmp/` (both gitignored)
