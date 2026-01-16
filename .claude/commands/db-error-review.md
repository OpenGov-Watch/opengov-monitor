# Review Database Data Errors

Check recent data validation errors logged in the DataErrors table.

## Local Database

```bash
sqlite3 data/local/polkadot.db "SELECT COUNT(*) FROM DataErrors"
sqlite3 data/local/polkadot.db "SELECT id, table_name, record_id, error_type, error_message, timestamp FROM DataErrors ORDER BY timestamp DESC LIMIT 20"
```

## Production Container

Requires authentication first (see [container.md](container.md#authentication)).

```bash
# Get error count
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor sqlite3 /data/polkadot.db 'SELECT COUNT(*) FROM DataErrors'"

# View recent errors
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor sqlite3 /data/polkadot.db 'SELECT id, table_name, record_id, error_type, error_message, timestamp FROM DataErrors ORDER BY timestamp DESC LIMIT 20'"

# Clear all errors
gcloud compute ssh web-server --zone=us-central1-a --tunnel-through-iap \
  --command="sudo docker exec opengov-monitor sqlite3 /data/polkadot.db 'DELETE FROM DataErrors'"
```

See [docs/03_design/error-logging.md](../../docs/03_design/error-logging.md) for details.
