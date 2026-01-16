# Database Backup Strategy

## Backup Location

`data/backup/` (gitignored)

## When to Backup

- Before running migrations
- Before database cleanup
- Weekly (manual or cron)
- Before major deployments

## Backup Command

Use Claude command: `/db-backup-production`

Downloads production DB to `data/backup/polkadot_prod_backup_YYYYMMDD_HHMMSS.db`

## Retention

Keep last 5 backups, delete older:
```bash
cd data/backup && ls -t polkadot_prod_backup_*.db | tail -n +6 | xargs rm -f
```

## Restore

Copy backup to `data/polkadot.db`:
```bash
cp data/backup/polkadot_prod_backup_YYYYMMDD_HHMMSS.db data/polkadot.db
```
