# OpenGov Monitor - Application Specification

## Overview

OpenGov Monitor is a monorepo containing a data aggregation backend, REST API, and interactive web dashboard for Polkadot/Kusama blockchain governance data.

### Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Backend** | Fetch governance data, enrich with prices, store | Python, Flask, SQLite |
| **API** | REST API serving data to frontend | Node.js, Express, better-sqlite3 |
| **Frontend** | Interactive data exploration dashboard | Vite, React, React Router, TanStack Table |

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
│                     Node.js Express API (:3001)                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │   better-sqlite3│  │  Route Handlers │  │  Query Builder  │          │
│  │   (read/write)  │──│  (14 routes)    │──│   (safe SQL)    │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼  fetch('/api/...')
┌─────────────────────────────────────────────────────────────────────────┐
│                       Vite + React Frontend (:3000)                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │  React Router   │  │   DataTable     │  │   View State    │          │
│  │  (pages)        │──│  (TanStack)     │──│ (localStorage)  │          │
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

## API Server

The Express API server (`api/`) provides REST endpoints for the frontend. It reads from SQLite using `better-sqlite3` and handles CRUD operations for manual tables.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/referenda` | GET | All referenda |
| `/api/treasury` | GET | Treasury spends |
| `/api/spending` | GET | Aggregated spending view |
| `/api/dashboards` | CRUD | Custom dashboard management |
| `/api/query/execute` | POST | Query builder execution |

See [API Reference](api-reference.md) for full endpoint documentation.

---

## Frontend Application Flow

### Architecture

The frontend uses Vite + React with React Router v7. All data is fetched from the API server using `fetch()`. Client-side interactivity is powered by TanStack Table.

### Request Flow

1. **Page Request** - User navigates to a table page (e.g., `/referenda`)
2. **React Router** - Loads the page component lazily
3. **API Fetch** - Component fetches data from `/api/referenda`
4. **Client Render** - `DataTable` component renders with TanStack Table

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataTable` | `components/data-table/` | Reusable table with sorting, filtering, pagination |
| `useViewState` | `hooks/use-view-state.ts` | Persist table state to localStorage/URL |
| Column Defs | `components/tables/` | Table-specific column configurations |
| API Client | `api/client.ts` | Fetch functions for all endpoints |

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
| `PORT` | API | API server port (default: 3001) |
| `DATABASE_PATH` | API | SQLite path (default: `../data/polkadot.db`) |

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

### Backend (Data Fetching)

```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### API + Frontend (Development)

```bash
# From root - starts both API and frontend
pnpm run dev

# Or individually
pnpm api:dev       # API server on :3001
pnpm frontend:dev  # Frontend on :3000
```

### Production Build

```bash
pnpm run build     # Builds both API and frontend
```

The frontend proxies `/api/*` requests to the API server. In production, configure reverse proxy or deploy frontend with API base URL environment variable.
