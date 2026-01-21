# Backend Architecture

Python data pipeline that fetches governance data from external APIs, enriches with USD prices, and stores to SQLite.

## Overview

```
External APIs                  Data Providers                    Storage
─────────────                  ──────────────                    ───────
Subsquare      ─────────────▶  SubsquareProvider  ──┐
Statescan ID   ─────────────▶  StatescanIdProvider ─┼──▶  SQLiteSink  ──▶  polkadot.db
yfinance       ─────────────▶  PriceService       ──┘
CoinGecko      ─────────────▶
```

## Entry Points

| Script | Purpose |
|--------|---------|
| `scripts/run_sqlite.py` | Main sync - fetches all governance data |
| `scripts/fetch_salaries.py` | Fellowship salary data only |
| `scripts/sanity_check.py` | Validates ID continuity in tables |

## Data Providers

**SubsquareProvider** (`data_providers/subsquare.py`): Fetches referenda, treasury, child bounties, fellowship from Subsquare API.

**PriceService** (`data_providers/price_service.py`): Converts DOT/KSM to USD via yfinance (historical) and CoinGecko (current). Caches in `dot_prices` table.

**StatescanIdProvider** (`data_providers/statescan_id_provider.py`): Resolves addresses to identities.

## Sync Modes

| Mode | When Used | Behavior |
|------|-----------|----------|
| Backfill | `--backfill` flag or empty table | Fetches ALL records |
| Incremental | Normal run on populated table | Fetches recent N records |

Configured in `config.yaml` via `fetch_limits`.

## Data Pipeline

```
run_sqlite.py
├── init_sink()           # Create tables if needed
├── fetch_referenda()     # Subsquare → referenda table
├── fetch_treasury()      # Subsquare → treasury_proposals, treasury_spends
├── fetch_child_bounties()# Subsquare → child_bounties
├── fetch_fellowship()    # Subsquare → fellowship_referenda
├── enrich_prices()       # PriceService → update USD columns
└── resolve_identities()  # StatescanId → update address names
```

## Proposal Detail Fetching

List endpoints return basic proposal info. For certain call types, individual detail fetches are required to inspect nested proposal data:

- `utility.batch`, `utility.batchAll`, `utility.dispatchAs` - batch calls containing multiple actions
- `treasury.spend` - treasury spends with asset metadata
- `xcmPallet.send` - cross-chain messages with embedded calls

See `needs_detail_call_indices` in `data_providers/subsquare.py:138` for the complete list.

## Configuration

`config.yaml` controls fetch behavior:

| Parameter | Description |
|-----------|-------------|
| `fetch_limits.incremental` | Record count per endpoint when table has data |
| `fetch_limits.backfill` | Record count when table is empty or `--backfill` flag. `0` = all, `-1` = skip |
| `block_time_projection` | Reference block + timestamp + block time (6s). Used to estimate future block times for treasury spend deadlines |

## Storage Layer

**SQLiteSink** (`data_sinks/sqlite/sink.py`): Upserts data, handles schema creation, manages transactions.

**Schema** (`data_sinks/sqlite/schema.py`): Table definitions. See [data-models.md](../../02_specification/data-models.md).

**Migrations** (`migrations/`): Version-controlled schema changes. See [migration-system-design.md](migration-system-design.md).

## Error Handling

Failed records logged to `data_errors` table. Partial failures don't abort sync. See [error-logging.md](../error-logging.md).

## Key Files

```
src/backend/
├── scripts/run_sqlite.py, fetch_salaries.py, sanity_check.py
├── data_providers/subsquare.py, price_service.py, statescan_id_provider.py
├── data_sinks/sqlite/sink.py, schema.py
├── migrations/versions/
└── config.yaml
```

## Related Docs

- [Data Models](../../02_specification/data-models.md) - [Migration System](migration-system-design.md) - [Business Rules](../../01_requirements/business-rules.md) - [Error Logging](../error-logging.md)
- **Subsquare API**: Full endpoint documentation in `data_providers/subsquare.py` module docstring
