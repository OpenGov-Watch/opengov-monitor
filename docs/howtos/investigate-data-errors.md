# Investigating Data Errors

How to investigate validation errors logged in the DataErrors table.

## Quick Reference

```bash
# Query errors from DB
sqlite3 data/local/polkadot.db "SELECT * FROM DataErrors WHERE table_name='Referenda' ORDER BY timestamp DESC LIMIT 10"

# Fetch current data from Subsquare API
curl "https://polkadot-api.subsquare.io/gov2/referendums/1784.json" | jq .

# Check record in our DB
sqlite3 data/local/polkadot.db "SELECT id, title, status, track, DOT_proposal_time, USD_proposal_time FROM Referenda WHERE id=1784"
```

## Error Categories

### Expected Errors (Not Bugs)

NULL values are **expected** when referendum status is:
- `TimedOut` - proposal never reached execution
- `Rejected` - proposal was voted down
- `Cancelled` - proposal was cancelled
- `Killed` - proposal was killed

These referenda have no spending data because they never executed.

### Unexpected Errors (Investigate Further)

NULL values need investigation when:
- Status is `Executed` or `Approved` - spending should have happened
- Status is `Confirming` or `Deciding` - may have partial data

## Investigation Workflow

### 1. Get Error Details

```sql
SELECT
    id, table_name, record_id, error_type, error_message,
    json_extract(metadata, '$.status') as status,
    json_extract(metadata, '$.track') as track,
    json_extract(metadata, '$.title') as title,
    json_extract(metadata, '$.null_columns') as null_columns
FROM DataErrors
WHERE table_name = 'Referenda'
ORDER BY timestamp DESC;
```

### 2. Check if Error is Expected

```sql
-- Count errors by status
SELECT
    json_extract(metadata, '$.status') as status,
    COUNT(*) as count
FROM DataErrors
WHERE table_name = 'Referenda'
GROUP BY status;
```

If most errors are `TimedOut`/`Rejected`, they're expected.

### 3. For Unexpected Errors, Check Source API

```bash
# Fetch referendum from Subsquare
curl "https://polkadot-api.subsquare.io/gov2/referendums/{ID}.json" | jq .

# Check these fields:
# - .state.name (current status)
# - .allSpends (should have spending breakdown)
# - .onchainData.proposal.call (what action was proposed)
```

### 4. Compare with Our Data

```sql
-- Check what we stored
SELECT * FROM Referenda WHERE id = {ID};

-- Check the spending values
SELECT
    id, title, status, track,
    DOT_proposal_time, USD_proposal_time,
    DOT_component, USDC_component, USDT_component
FROM Referenda WHERE id = {ID};
```

## Common Causes of NULL Values

| Cause | How to Identify | Resolution |
|-------|-----------------|------------|
| Non-executed referendum | status in (TimedOut, Rejected, Cancelled, Killed) | Expected - no action needed |
| API missing data | Subsquare API returns null/empty for `allSpends` | Upstream issue - report to Subsquare |
| Unsupported asset type | Check `allSpends[].assetKind` for unknown assets | Add support in `_build_bag_from_all_spends()` |
| XCM parsing failure | Check logs for "Unknown asset" warnings | Add asset mapping in `AssetKind` |
| Price service failure | Check logs for price fetch errors | Check CoinGecko/yfinance availability |

## Files for Debugging

| File | Purpose |
|------|---------|
| `backend/data_providers/subsquare.py:_transform_referenda()` | Value extraction logic |
| `backend/data_providers/subsquare.py:_build_bag_from_all_spends()` | Asset parsing from `allSpends` |
| `backend/data_providers/subsquare.py:_validate_and_log_spender_referenda()` | Validation logic |
| `backend/data_providers/price_service.py` | USD conversion |

## Bulk Analysis

```sql
-- Find executed referenda with missing values (these need investigation)
SELECT r.id, r.title, r.status, r.track, e.error_message
FROM Referenda r
JOIN DataErrors e ON e.table_name = 'Referenda' AND e.record_id = CAST(r.id AS TEXT)
WHERE r.status = 'Executed'
AND r.track IN ('SmallSpender', 'MediumSpender', 'BigSpender', 'SmallTipper', 'BigTipper', 'Treasurer');
```
