# Review Database Data Errors

Check recent data validation errors logged in the DataErrors table.

1. Get error count first:
   ```bash
   sqlite3 data/polkadot.db "SELECT COUNT(*) as total FROM DataErrors"
   ```

2. View recent errors (only if count > 0):
   ```bash
   sqlite3 data/polkadot.db "SELECT id, table_name, record_id, error_type, error_message, timestamp FROM DataErrors ORDER BY timestamp DESC LIMIT 20"
   ```

See [docs/error-logging.md](../../docs/error-logging.md) for details.
