# OpenGov Monitor

A monorepo containing a data collection backend, REST API, and web dashboard for Polkadot/Kusama governance data.

## Components

| Component | Description | Tech Stack |
|-----------|-------------|------------|
| **Backend** | Data pipeline fetching from Subsquare | Python, Flask, SQLite |
| **API** | REST API serving data to frontend | Node.js, Express, better-sqlite3 |
| **Frontend** | Interactive dashboard for data exploration | Vite, React, React Router, TanStack Table |

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- pnpm (`npm install -g pnpm`)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Backend & Fetch Data

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Fetch Polkadot governance data
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### 3. Run Application

```bash
# From root directory - starts both API and frontend
pnpm run dev
```

- API server: http://localhost:3001
- Frontend: http://localhost:3000

---

## Project Structure

```
opengov-monitor/
├── backend/                 # Python data pipeline
│   ├── data_providers/      # Fetch from Subsquare, prices
│   ├── data_sinks/          # SQLite and Google Sheets storage
│   ├── scripts/             # CLI utilities
│   ├── utils/               # Logging, helpers
│   ├── tests/               # Test suite
│   ├── main.py              # Flask app (Google Sheets mode)
│   └── config.yaml          # Fetch limits
│
├── api/                     # Node.js REST API
│   └── src/
│       ├── index.ts         # Express server
│       ├── db/              # Database access
│       └── routes/          # API route handlers
│
├── frontend/                # Vite + React dashboard
│   └── src/
│       ├── pages/           # Page components
│       ├── components/
│       │   ├── ui/          # shadcn/ui components
│       │   ├── data-table/  # Reusable table components
│       │   ├── tables/      # Column definitions
│       │   ├── dashboard/   # Dashboard builder
│       │   └── layout/      # Sidebar navigation
│       ├── api/             # API client
│       ├── lib/             # Types, utilities
│       └── hooks/           # View state management
│
├── data/                    # Shared SQLite database
│   └── polkadot.db
│
├── docs/                    # Documentation
│   └── spec/                # Technical specifications
│
├── pnpm-workspace.yaml      # Workspace configuration
└── CLAUDE.md                # AI assistant instructions
```

---

## Commands

### Development

```bash
# Install all dependencies
pnpm install

# Run all services (API + frontend)
pnpm run dev

# Run individual services
pnpm api:dev       # API server on :3001
pnpm frontend:dev  # Frontend on :3000

# Build for production
pnpm run build
```

### Backend

```bash
cd backend
source .venv/bin/activate

# Fetch Polkadot governance data
python scripts/run_sqlite.py --db ../data/polkadot.db

# Fetch Kusama data
python scripts/run_sqlite.py --network kusama --db ../data/kusama.db

# Fetch fellowship salaries
python scripts/fetch_salaries.py --cycle 17
python scripts/fetch_salaries.py --claimants-only

# Dump data to CSV/JSON
python scripts/dump_provider.py --network polkadot --out ../data_dump
```

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
                        │  Express API     │◀─────────────┘
                        │  (:3001)         │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Vite Frontend   │
                        │  (:3000)         │
                        └──────────────────┘
```

---

## Frontend Features

### Data Tables

| Table | Description |
|-------|-------------|
| Referenda | Governance proposals with voting data |
| Treasury Spends | Treasury allocation requests |
| Child Bounties | Sub-bounties for work completion |
| Fellowship Treasury | Fellowship-specific treasury spends |
| Salary Cycles | Fellowship salary payment cycles |
| Salary Claimants | Individual fellowship members |
| Spending | Aggregated view of all spending |
| Outstanding Claims | Approved spends not yet expired |
| Expired Claims | Approved spends past expiration |

### Table Features

- **Sorting** - Click column headers
- **Global Search** - Search across all columns
- **Column Filters** - Filter by specific values
- **Pagination** - Navigate large datasets
- **Column Visibility** - Show/hide columns
- **Export** - Download as CSV or JSON
- **View State** - Save/load table configuration (localStorage + URL)

### Custom Dashboards

- Create custom dashboards with multiple components
- Query builder for aggregating data
- Chart types: Table, Pie, Bar (stacked/grouped), Line
- Drag-and-drop grid layout

---

## API Endpoints

### Read-Only Data
| Endpoint | Description |
|----------|-------------|
| `GET /api/referenda` | All referenda |
| `GET /api/treasury` | Treasury spends |
| `GET /api/child-bounties` | Child bounties |
| `GET /api/fellowship` | Fellowship treasury |
| `GET /api/fellowship-salary/cycles` | Salary cycles |
| `GET /api/fellowship-salary/claimants` | Salary claimants |
| `GET /api/spending` | Aggregated spending |
| `GET /api/claims/outstanding` | Outstanding claims |
| `GET /api/claims/expired` | Expired claims |
| `GET /api/stats` | Table row counts |
| `GET /api/health` | Health check |

### CRUD Endpoints
| Resource | Methods |
|----------|---------|
| `/api/categories` | GET, POST, PUT, DELETE |
| `/api/bounties` | GET, POST, PUT, DELETE |
| `/api/subtreasury` | GET, POST, PUT, DELETE |
| `/api/dashboards` | GET, POST, PUT, DELETE |
| `/api/dashboards/components` | GET, POST, PUT, DELETE |

### Query Builder
| Endpoint | Description |
|----------|-------------|
| `GET /api/query/schema` | Get table schemas |
| `POST /api/query/execute` | Execute custom query |

---

## Configuration

### config.yaml (Backend)

```yaml
fetch_limits:
  referenda: 100
  treasury_spends: 100
  child_bounties: 100
  fellowship_treasury_spends: 100

fellowship_salary_cycles: 0  # 0=fetch all, -1=skip
```

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `PORT` | API | API server port (default: 3001) |
| `DATABASE_PATH` | API | SQLite path (default: ../data/polkadot.db) |
| `OPENGOV_MONITOR_SQLITE_PATH` | Backend | SQLite database path |
| `OPENGOV_MONITOR_SPREADSHEET_ID` | Backend | Google Spreadsheet ID |
| `OPENGOV_MONITOR_CREDENTIALS` | Backend | Google credentials JSON |

---

## Documentation

- [docs/spec/index.md](docs/spec/index.md) - Application overview
- [docs/spec/data-models.md](docs/spec/data-models.md) - Entity schemas
- [docs/spec/api-reference.md](docs/spec/api-reference.md) - External API docs
- [backend/CLAUDE.md](backend/CLAUDE.md) - Backend specifics
- [api/CLAUDE.md](api/CLAUDE.md) - API server specifics
- [frontend/CLAUDE.md](frontend/CLAUDE.md) - Frontend specifics

---

## Troubleshooting

### Database Not Found

```bash
cd backend
python scripts/run_sqlite.py --db ../data/polkadot.db
```

### API Connection Issues (Windows)

If you see `EADDRINUSE` errors, kill existing processes:

```bash
netstat -ano | findstr :3001
taskkill /F /PID <pid>
```

### Native Module Issues

If `better-sqlite3` fails to build:

```bash
pnpm rebuild better-sqlite3
```

On Windows, you may need Visual Studio Build Tools installed.

---

## License

See [LICENSE](LICENSE) file.
