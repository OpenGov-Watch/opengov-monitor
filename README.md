# OpenGov Monitor

Data collection backend, REST API, and web dashboard for Polkadot/Kusama governance data.

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.10+, pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Setup backend and fetch data
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/run_sqlite.py --db ../data/polkadot.db

# Run application (from root)
cd ..
pnpm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:3001

## Project Structure

```
backend/        Python data pipeline (fetches from Subsquare, enriches with prices)
api/            Express REST API (serves data to frontend)
frontend/       Vite + React dashboard (TanStack Table, shadcn/ui)
data/           SQLite database
docs/spec/      Technical specifications
deploy/         Docker deployment configuration
```

## Documentation

| Topic | Location |
|-------|----------|
| Full specification | [docs/spec/index.md](docs/spec/index.md) |
| Data models | [docs/spec/data-models.md](docs/spec/data-models.md) |
| API reference | [docs/spec/api-reference.md](docs/spec/api-reference.md) |
| Frontend architecture | [docs/spec/frontend.md](docs/spec/frontend.md) |

## Troubleshooting

**Database not found:** Run the backend data fetch first.

**Port conflicts (Windows):**
```bash
netstat -ano | findstr :3001
taskkill /F /PID <pid>
```

**better-sqlite3 build issues:** `pnpm rebuild better-sqlite3` (may need VS Build Tools on Windows)

## License

See [LICENSE](LICENSE) file.
