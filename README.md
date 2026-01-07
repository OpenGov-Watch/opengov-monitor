# OpenGov Monitor

A monorepo containing a data collection backend and web dashboard for Polkadot/Kusama governance data.

## Components

| Component | Description | Tech Stack |
|-----------|-------------|------------|
| **Backend** | Data pipeline fetching from Subsquare | Python, Flask, SQLite |
| **Frontend** | Interactive dashboard for data exploration | Next.js, React, TanStack Table |

## Quick Start

### 1. Setup Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Fetch Data

```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### 3. Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 to view the dashboard.

---

## Project Structure

```
opengov-monitor/
├── backend/                 # Python data pipeline
│   ├── data_providers/      # Fetch from Subsquare, prices
│   ├── data_sinks/          # SQLite and Google Sheets storage
│   │   ├── sqlite/          # Local database sink
│   │   └── google/          # Google Sheets sink
│   ├── scripts/             # CLI utilities
│   ├── utils/               # Logging, helpers
│   ├── tests/               # Test suite
│   ├── main.py              # Flask app (Google Sheets mode)
│   └── config.yaml          # Fetch limits
│
├── frontend/                # Next.js dashboard
│   └── src/
│       ├── app/             # Page routes (6 tables + dashboard)
│       ├── components/
│       │   ├── ui/          # shadcn/ui components
│       │   ├── data-table/  # Reusable table components
│       │   ├── tables/      # Column definitions
│       │   └── layout/      # Sidebar navigation
│       ├── lib/
│       │   ├── db/          # SQLite queries (server-side)
│       │   └── export.ts    # CSV/JSON export
│       └── hooks/           # View state management
│
├── data/                    # Shared SQLite database
│   └── polkadot.db
│
├── docs/                    # Documentation
│   └── spec/                # Technical specifications
│
└── CLAUDE.md                # AI assistant instructions
```

---

## Backend Usage

### Run with SQLite (Recommended)

```bash
cd backend

# Fetch Polkadot governance data
python scripts/run_sqlite.py --db ../data/polkadot.db

# Fetch Kusama data
python scripts/run_sqlite.py --network kusama --db ../data/kusama.db
```

### Run with Google Sheets

```bash
cd backend

# Set credentials
export OPENGOV_MONITOR_CREDENTIALS='{"type": "service_account", ...}'
export OPENGOV_MONITOR_SPREADSHEET_ID='your-spreadsheet-id'

# Run pipeline
python main.py run
```

### Helper Scripts

```bash
cd backend

# Dump data to CSV/JSON
python scripts/dump_provider.py --network polkadot --out ../data_dump

# Fetch fellowship salaries
python scripts/fetch_salaries.py --cycle 17
python scripts/fetch_salaries.py --claimants-only
```

---

## Frontend Features

### Data Tables

The dashboard displays up to 6 governance data types:

| Table | Description | Populated By |
|-------|-------------|--------------|
| Referenda | Governance proposals with voting data | `run_sqlite.py` |
| Treasury Spends | Treasury allocation requests | `run_sqlite.py` |
| Child Bounties | Sub-bounties for work completion | `run_sqlite.py` |
| Fellowship Treasury | Fellowship-specific treasury spends | `run_sqlite.py` |
| Salary Cycles | Fellowship salary payment cycles | `fetch_salaries.py` |
| Salary Claimants | Individual fellowship members | `fetch_salaries.py` |

> **Note**: Salary tables require running `fetch_salaries.py` separately. The frontend shows a helpful message if these tables don't exist.

### Table Features

- **Sorting** - Click column headers to sort ascending/descending
- **Global Search** - Search across all columns
- **Pagination** - Navigate large datasets (10-100 rows per page)
- **Column Visibility** - Show/hide columns via dropdown
- **Export** - Download filtered data as CSV or JSON
- **View State** - Save/load/reset table configuration
  - Persisted to localStorage
  - Shareable via URL parameters

### Frontend Development

```bash
cd frontend

# Development server (hot reload)
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint
```

---

## Configuration

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

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `OPENGOV_MONITOR_SQLITE_PATH` | Backend | SQLite database path |
| `OPENGOV_MONITOR_SPREADSHEET_ID` | Backend | Google Spreadsheet ID |
| `OPENGOV_MONITOR_CREDENTIALS` | Backend | Google credentials JSON |
| `DATABASE_PATH` | Frontend | SQLite path (default: `../data/polkadot.db`) |

---

## Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Subsquare API  │────▶│  Python Backend  │────▶│  SQLite Database│
│  (governance    │     │  (fetch, enrich  │     │  (data/polkadot │
│   data)         │     │   with prices)   │     │   .db)          │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │
                        │  Next.js Frontend │◀────────────┘
                        │  (Server Components
                        │   read directly)  │
                        └──────────────────┘
```

The frontend uses Next.js Server Components to read directly from SQLite via `better-sqlite3`. No API layer is needed.

---

## Data Entities

| Entity | Primary Key | Key Fields |
|--------|-------------|------------|
| Referenda | `id` | title, status, track, DOT/USD values, tally |
| Treasury | `id` | referendumIndex, description, DOT/USD values |
| Child Bounties | `identifier` | parentBountyId, beneficiary, DOT value |
| Fellowship | `id` | description, DOT/USD values |
| Salary Cycles | `cycle` | budget_dot, registered/paid counts |
| Salary Claimants | `address` | display_name, rank, status_type |

See [docs/spec/data-models.md](docs/spec/data-models.md) for complete field documentation.

---

## Testing

```bash
cd backend
pytest
pytest --cov=data_sinks --cov-report=term-missing
```

---

## Documentation

- [docs/spec/index.md](docs/spec/index.md) - Application overview
- [docs/spec/data-models.md](docs/spec/data-models.md) - Entity schemas
- [docs/spec/api-reference.md](docs/spec/api-reference.md) - External API docs
- [docs/spec/business-logic.md](docs/spec/business-logic.md) - Value extraction
- [docs/spec/sqlite-sink.md](docs/spec/sqlite-sink.md) - SQLite implementation
- [docs/spec/frontend.md](docs/spec/frontend.md) - Frontend architecture

---

## Cloud Deployment

### Backend (Cloud Run)

```bash
cd backend
docker build -t opengov-monitor .
docker run -p 8080:8080 opengov-monitor
```

Use Cloud Scheduler to trigger the `/` endpoint periodically.

### Frontend (Vercel/Node)

```bash
cd frontend
npm run build
npm start
```

Or deploy to Vercel with the Next.js preset.

---

## Troubleshooting

### Database Not Found

If the frontend shows "Database Not Found":

```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### Native Module Issues (Frontend)

If `better-sqlite3` fails to build:

```bash
cd frontend
npm rebuild better-sqlite3
```

On Windows, you may need Visual Studio Build Tools installed.

---

## License

See [LICENSE](LICENSE) file.
