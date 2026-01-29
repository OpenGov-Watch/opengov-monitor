# Backup Production Database

Downloads production database with automatic WAL checkpointing.

## NEVER Use Regular Copy

**NEVER** use `cp`, `scp`, or `rsync` on a live SQLite database. This **WILL** corrupt it.

SQLite WAL mode requires the `.db`, `.db-wal`, and `.db-shm` files to be atomically consistent. Regular file copy captures them at different points in time, corrupting B-tree indexes.

## Safe Backup Methods

### 1. API Endpoint (Recommended)

```bash
# Login required - use browser or curl with session
curl -o backup.db https://monitor.opengov.watch/api/backup/download
```

### 2. sqlite3 .backup Command

From inside the container:
```bash
sqlite3 /data/polkadot.db ".backup /data/backup_$(date +%Y%m%d_%H%M%S).db"
```

### 3. Checkpoint Then Copy

Only if you must use file copy:
```bash
# 1. Checkpoint WAL (merges pending writes into main file)
sqlite3 /data/polkadot.db 'PRAGMA wal_checkpoint(TRUNCATE);'

# 2. Now safe to copy (WAL is empty)
cp /data/polkadot.db /path/to/backup.db
```

## Production Backup via SSH

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SERVICE=opengov-monitor-prod  # or opengov-monitor-staging

# Use sqlite3 .backup for safe atomic copy
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec $SERVICE sqlite3 /data/polkadot.db '.backup /data/backup.db' && sudo docker exec $SERVICE cat /data/backup.db" \
  > data/backup/polkadot_prod_backup_$TIMESTAMP.db

# Verify integrity
sqlite3 data/backup/polkadot_prod_backup_$TIMESTAMP.db "PRAGMA integrity_check;"
```

## Verification

```bash
# Check file exists and has reasonable size
ls -lh data/backup/polkadot_prod_backup_*.db

# Verify database integrity (should return "ok")
sqlite3 data/backup/polkadot_prod_backup_*.db "PRAGMA integrity_check;"

# Check record counts
sqlite3 data/backup/polkadot_prod_backup_*.db "SELECT COUNT(*) FROM Referenda;"
```
