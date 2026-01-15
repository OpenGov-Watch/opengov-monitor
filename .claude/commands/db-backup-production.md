# Backup Production Database

Downloads production database from GCP container to local backup folder.

## Usage

Ask Claude: "backup production database"

## What it does

Downloads `polkadot.db` from production container to `data/backup/polkadot_prod_backup_YYYYMMDD_HHMMSS.db`

## Command

```bash
# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

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
```
