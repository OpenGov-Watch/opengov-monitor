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
  # Incremental mode: used when table already has data
  incremental:
    referenda: 100
    treasury_spends: 50
    child_bounties: 100
    fellowship_treasury_spends: 20
    fellowship_salary_cycles: 0  # 0 = fetch all

  # Backfill mode: used when table is empty or --backfill flag
  backfill:
    referenda: 0  # 0 = fetch ALL
    treasury_spends: 0
    child_bounties: 0
    fellowship_treasury_spends: 0
    fellowship_salary_cycles: 0

block_time_projection:
  block_number: 25732485
  block_datetime: 2025-04-25T15:27:36
  block_time: 6.0
```

### Fetch Modes

The backend supports **auto-detection** of fetch mode:

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Backfill** | Table is empty OR `--backfill` flag | Fetch ALL items (limit=0) |
| **Incremental** | Table has existing data | Fetch configured limit |

```bash
# Auto-detect: backfills empty tables, incremental for populated ones
python scripts/run_sqlite.py --db ../data/polkadot.db

# Force full backfill (re-fetch everything)
python scripts/run_sqlite.py --db ../data/polkadot.db --backfill
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

### Docker (Production)

The application is deployed as a single Docker container running nginx, Node.js API, and Python sync via supervisord.

```
┌─────────────────────────────────────────────────────────────┐
│              Single Docker Container (:80)                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    supervisord                           ││
│  │   ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  ││
│  │   │   nginx     │  │  node API   │  │   cron         │  ││
│  │   │  :80        │──│  :3001      │  │  (hourly sync) │  ││
│  │   └─────────────┘  └─────────────┘  └────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                    ┌─────────────────┐                       │
│                    │  /data volume   │                       │
│                    │  polkadot.db    │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

**Infrastructure:**

| Field | Value |
|-------|-------|
| Image | `ghcr.io/opengov-watch/opengov-monitor:prod` |
| Port | `80` |
| Domain | `polkadot-treasury-monitor.cypherpunk.agency` |
| Storage | `/data` (SQLite database) |

**Key files:**
- `Dockerfile` - Multi-stage build (frontend + API + backend)
- `deploy/supervisord.conf` - Process manager config
- `deploy/nginx-container.conf` - nginx config
- `.github/workflows/deploy.yml` - CI/CD pipeline

```bash
# Local development with Docker
docker compose up -d --build

# Initial data sync
docker compose exec opengov-monitor /app/backend/.venv/bin/python /app/backend/scripts/run_sqlite.py --db /data/polkadot.db
```

### Local Development (without Docker)

```bash
# From root - starts both API and frontend
pnpm run dev

# Or individually
pnpm api:dev       # API server on :3001
pnpm frontend:dev  # Frontend on :3000
```

### Backend (Data Fetching)

```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### Production Build

```bash
pnpm run build     # Builds both API and frontend
```

The frontend proxies `/api/*` requests to the API server.
