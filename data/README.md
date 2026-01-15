# Data Directory Structure

## Folders

| Folder | Purpose | Retention |
|--------|---------|-----------|
| `defaults/` | Essential CSV configs (categories, netflows) | Permanent (tracked in git) |
| `backup/` | Production database backups | Keep last 5 |
| `tmp/` | Experiments, short-lived files | Delete anytime |
| Root | Core databases (.db files) | Permanent |

## Files

| Pattern | Purpose | Git Status |
|---------|---------|------------|
| `*.db` | SQLite databases (polkadot.db, sessions.db, etc.) | Gitignored |
| `*.csv` (root) | Generated data exports | Gitignored |
| `defaults/*.csv` | Category taxonomies, default data | Tracked |

## Usage

- **Experiments/Testing**: Use `tmp/` folder
- **Production backups**: Use `backup/` folder (via `/db-backup-production`)
- **Default configs**: Use `defaults/` folder (committed to git)
- **Generated exports**: Root or `tmp/` (both gitignored)
