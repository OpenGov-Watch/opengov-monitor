# Backend CLAUDE.md

Python data pipeline: fetches governance data from Subsquare, enriches with USD prices, stores to SQLite.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/run_sqlite.py` | Main entry point for data sync |
| `data_providers/subsquare.py` | Subsquare API fetching + parsing |
| `data_providers/price_service.py` | USD price conversion (yfinance + CoinGecko) |
| `data_sinks/sqlite/sink.py` | SQLite storage |
| `data_sinks/sqlite/schema.py` | Table schemas |
| `config.yaml` | Fetch limits, block time settings |

## Commands

```bash
source .venv/bin/activate

# Auto-detect mode (backfill empty tables, incremental for populated)
python scripts/run_sqlite.py --db ../data/polkadot.db

# Force full backfill
python scripts/run_sqlite.py --db ../data/polkadot.db --backfill

# Fetch fellowship salary data
python scripts/fetch_salaries.py --cycle 17
python scripts/fetch_salaries.py --claimants-only

# Dump data for debugging
python scripts/dump_provider.py --network polkadot --out ../data_dump

# Run tests
pytest
```

## Fetch Modes

Configured in `config.yaml`:

```yaml
fetch_limits:
  incremental:    # Used when table has data
    referenda: 100
  backfill:       # Used when table empty or --backfill
    referenda: 0  # 0 = fetch ALL
```

`fellowship_salary_cycles`: `0` = fetch all, `-1` = skip entirely

## Fellowship Salary API

- Cycles: `/fellowship/salary/cycles/{cycle}` - aggregate per cycle
- Claimants: `/fellowship/salary/claimants` - current snapshot
- Payments: `/fellowship/salary/cycles/{cycle}/feeds` - filter for `event: "Paid"`

## References

- [Data models](../docs/spec/data-models.md) - Table schemas, views
- [Business rules](../docs/spec/business-rules.md) - Value extraction, XCM parsing
- [Gotchas](../docs/gotchas.md) - External API quirks (timestamp units, etc.)
