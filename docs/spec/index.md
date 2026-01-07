# OpenGov Monitor - Application Specification

## Overview

OpenGov Monitor is a monorepo containing a data aggregation backend and interactive web dashboard for Polkadot/Kusama blockchain governance data.

### Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Backend** | Fetch governance data, enrich with prices, store | Python, Flask, SQLite |
| **Frontend** | Interactive data exploration dashboard | Next.js, React, TanStack Table |

## Related Documents

- [Data Models](data-models.md) - Entity schemas and data structures
- [API Reference](api-reference.md) - External API documentation (Subsquare, Statescan, price services)
- [Business Logic](business-logic.md) - Value extraction, conversions, status handling
- [SQLite Sink](sqlite-sink.md) - Local database storage implementation
- [Frontend Architecture](frontend.md) - Dashboard implementation details

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           External Services                              │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│  Subsquare API  │   Statescan ID  │    yfinance     │    CoinGecko      │
│  (governance)   │   (identities)  │  (historical)   │   (current price) │
└────────┬────────┴────────┬────────┴────────┬────────┴─────────┬─────────┘
         │                 │                 │                   │
         ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Python Backend                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ SubsquareProvider│  │ StatescanIdProv │  │  PriceService   │          │
│  │ (fetch + parse) │  │  (name resolve) │  │ (USD conversion)│          │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘          │
│           │                    │                    │                    │
│           └────────────────────┼────────────────────┘                    │
│                                ▼                                         │
│                    ┌─────────────────────┐                               │
│                    │      DataSink       │                               │
│                    │ (SQLite or Sheets)  │                               │
│                    └──────────┬──────────┘                               │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   SQLite Database   │
                    │   (data/polkadot.db)│
                    └──────────┬──────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │ Server Component│  │   DataTable     │  │   View State    │          │
│  │ (read SQLite)   │──│  (TanStack)     │──│ (localStorage)  │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backend Application Flow

### Execution Steps

1. **Initialization** - Load config, create provider/sink instances
2. **Price Loading** - Fetch historical prices (yfinance) and current price (CoinGecko)
3. **Data Fetching** - For each entity: fetch list, transform, enrich with USD values
4. **Data Persistence** - UPSERT to SQLite or Google Sheets

### Data Providers

```python
class DataProvider(ABC):
    @abstractmethod
    def fetch_referenda(self, num_referenda=10) -> pd.DataFrame:
        pass

    @abstractmethod
    def fetch_treasury_spends(self, num_proposals=10) -> pd.DataFrame:
        pass
```

Additional methods in `SubsquareProvider`:
- `fetch_child_bounties(child_bounties_to_update=10)`
- `fetch_fellowship_treasury_spends(items_to_update=10)`
- `fetch_fellowship_salary_cycles(start_cycle=1, end_cycle=None)`
- `fetch_fellowship_salary_claimants(name_mapping=None)`

### Data Sinks

```python
class DataSink(ABC):
    @abstractmethod
    def connect(self) -> None:
        pass

    @abstractmethod
    def update_table(self, name: str, df: pd.DataFrame) -> None:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
```

| Sink | Description | Configuration |
|------|-------------|---------------|
| `SQLiteSink` | Local SQLite database | `OPENGOV_MONITOR_SQLITE_PATH` |
| `SpreadsheetSink` | Google Sheets storage | `OPENGOV_MONITOR_CREDENTIALS` |

---

## Frontend Application Flow

### Architecture

The frontend uses Next.js 14+ with the App Router. Server Components read directly from SQLite using `better-sqlite3`, eliminating the need for an API layer.

### Request Flow

1. **Page Request** - User navigates to a table page (e.g., `/referenda`)
2. **Server Component** - `page.tsx` executes on server, calls `getReferenda()`
3. **Database Query** - `better-sqlite3` reads from `data/polkadot.db`
4. **Data Transfer** - Data serialized and sent to client
5. **Client Render** - `DataTable` component renders with TanStack Table

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataTable` | `components/data-table/` | Reusable table with sorting, filtering, pagination |
| `useViewState` | `hooks/use-view-state.ts` | Persist table state to localStorage/URL |
| Column Defs | `components/tables/` | Table-specific column configurations |

See [Frontend Architecture](frontend.md) for detailed implementation.

---

## Configuration

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `OPENGOV_MONITOR_SQLITE_PATH` | Backend | SQLite database path |
| `OPENGOV_MONITOR_SPREADSHEET_ID` | Backend | Google Spreadsheet ID |
| `OPENGOV_MONITOR_CREDENTIALS` | Backend | Google credentials JSON |
| `OPENGOV_MONITOR_LOG_DB` | Backend | Log database path |
| `DATABASE_PATH` | Frontend | SQLite path (default: `../data/polkadot.db`) |

### config.yaml (Backend)

```yaml
fetch_limits:
  referenda: 100
  treasury_spends: 100
  child_bounties: 100
  fellowship_treasury_spends: 100

block_time_projection:
  block_number: 25732485
  block_datetime: 2025-04-25T15:27:36
  block_time: 6.0
```

### Network Configuration

| Property | Polkadot | Kusama |
|----------|----------|--------|
| `digits` | 10 | 12 |
| `native_asset` | DOT | KSM |
| `treasury_address` | 13UVJyLnb... | F3opxRbN5... |

---

## Logging (Backend)

Structured logging with JSON extras:

```python
logger.info("Message", extra={"key": "value", "count": 42})
# Output: 2025-01-01 12:00:00 - module - INFO - Message | Extra: {"key": "value"}
```

### Log Storage

Logs are persisted to SQLite (`logs/app.db`) via `SQLiteHandler`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `timestamp` | TEXT | ISO 8601 timestamp |
| `source` | TEXT | Logger name |
| `log_level` | TEXT | DEBUG, INFO, WARNING, ERROR |
| `content` | TEXT | Log message |
| `extra` | TEXT | JSON string of extra fields |

Suppressed loggers: `yfinance`, `urllib3`, `peewee`, `google`

---

## Error Handling

| Scenario | Backend Behavior | Frontend Behavior |
|----------|------------------|-------------------|
| Database not found | Raise error | Show warning, prompt to run backend |
| API error | Log and raise `SystemExit` | N/A |
| Price conversion error | Return `NaN` | Display "-" |
| Empty table | Allow with flag | Show "No results" |

---

## Deployment

### Backend

```bash
# Local (SQLite)
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db

# Docker (Cloud Run)
docker build -t opengov-monitor .
docker run -p 8080:8080 opengov-monitor
```

### Frontend

```bash
# Development
cd frontend
npm run dev

# Production
npm run build
npm start
```

Cloud Run triggers the backend's `/` endpoint on a schedule. The frontend can be deployed to Vercel or any Node.js host.
