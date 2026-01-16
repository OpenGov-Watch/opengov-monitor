# Backup Production Database

Downloads production database from server with automatic WAL checkpointing to ensure data consistency.

## Usage

Ask Claude: "backup production database"

## What it does

- Connect to the production server via gcloud SSH
- Triggers WAL checkpoint to merge pending writes
- Downloads `polkadot.db` to `data/backup/polkadot_prod_backup_YYYYMMDD_HHMMSS.db`
- Ensures backup contains all committed data


## Alternative: Direct Container Access

For cases where API access is unavailable:

```bash
# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Checkpoint WAL first
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor sqlite3 /data/polkadot.db 'PRAGMA wal_checkpoint(TRUNCATE);'"

# Download from container
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor cat /data/polkadot.db" \
  > data/backup/polkadot_prod_backup_$TIMESTAMP.db

echo "✓ Backup saved to: data/backup/polkadot_prod_backup_$TIMESTAMP.db"
```

## Verification

```bash
# Check backup exists and has data
ls -lh data/backup/polkadot_prod_backup_*.db

# Optional: Verify database integrity
sqlite3 data/backup/polkadot_prod_backup_$TIMESTAMP.db "PRAGMA integrity_check;"
```
