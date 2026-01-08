# Backend CLAUDE.md

This file provides guidance for working with the Python backend.

## Architecture
- **main.py**: Flask app orchestrating the data pipeline
- **data_providers/**: Fetch from Subsquare, Statescan, price services
- **data_sinks/**: Store to SQLite or Google Sheets

### Data Flow
1. main.py orchestrates as Flask app with single route `/`
2. SubsquareProvider fetches governance data (referenda, treasury, child bounties, fellowship)
3. StatescanIdProvider resolves addresses to human-readable names
4. PriceService enriches data with USD values using yfinance
5. SQLiteSink or SpreadsheetSink stores the data

## Key Files
- **main.py:24** - Network setting (polkadot/kusama)
- **config.yaml** - Fetch limits and block time settings
- **data_sinks/sqlite/schema.py** - Database table schemas
- **data_providers/subsquare.py** - Subsquare API endpoint documentation

## Commands
```bash
# Run Flask server
python main.py

# Run with SQLite sink (auto-detects backfill vs incremental)
python scripts/run_sqlite.py --db ../data/polkadot.db

# Force full backfill (re-fetch everything)
python scripts/run_sqlite.py --db ../data/polkadot.db --backfill

# Dump provider data for debugging
python scripts/dump_provider.py --network polkadot --out ../data_dump

# Fetch fellowship salary data
python scripts/fetch_salaries.py --cycle 17
python scripts/fetch_salaries.py --claimants-only

# Run tests
pytest
pytest --cov=data_sinks --cov-report=term-missing
```

## Code Conventions
- pandas DataFrames for data manipulation
- Abstract base classes define provider/sink interfaces

## Database Tables
| Table | Always Present |
|-------|----------------|
| Referenda | Yes |
| Treasury | Yes |
| Child Bounties | Yes |
| Fellowship | Yes |
| Fellowship Salary Cycles | Unless disabled |
| Fellowship Salary Claimants | Unless disabled |
| Fellowship Salary Payments | Unless disabled |
| Categories | Yes (manual) |
| Bounties | Yes (manual) |
| Subtreasury | Yes (manual) |
| Fellowship Subtreasury | Yes |
| Dashboards | Yes (manual) |
| Dashboard Components | Yes (manual) |

## Fetch Modes

The backend supports two fetch modes configured in `config.yaml`:

```yaml
fetch_limits:
  incremental:    # Used when table has existing data
    referenda: 100
    treasury_spends: 50
  backfill:       # Used when table is empty or --backfill flag
    referenda: 0  # 0 = fetch ALL
    treasury_spends: 0
```

- **Incremental mode**: Fetches configured limit (catches new + recent updates)
- **Backfill mode**: Fetches all items (0 = unlimited)
- Auto-detection: empty table → backfill, populated → incremental
- `--backfill` flag forces full backfill

config.yaml `fellowship_salary_cycles`: `0` = fetch all, `-1` = skip

## Database Views
| View | Description |
|------|-------------|
| outstanding_claims | Approved treasury spends not yet expired |
| expired_claims | Approved treasury spends past expiration |
| all_spending | Aggregated spending from all sources |

## Fellowship Salary API Notes
- Cycles: `/fellowship/salary/cycles/{cycle}` - aggregate data per cycle
- Claimants: `/fellowship/salary/claimants` - current snapshot with claim status
- Payments: `/fellowship/salary/cycles/{cycle}/feeds` - individual payment events
  - **blockTime uses milliseconds** (not seconds like other endpoints)
  - Filter for `event: "Paid"` to get payment records
- Use StatescanIdProvider for batch address resolution

## References
- Full API docs: [docs/spec/api-reference.md](../docs/spec/api-reference.md)
- Business logic: [docs/spec/business-logic.md](../docs/spec/business-logic.md)
- Data models: [docs/spec/data-models.md](../docs/spec/data-models.md)
