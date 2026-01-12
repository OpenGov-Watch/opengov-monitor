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
| System overview | [docs/architecture.md](docs/architecture.md) |
| Data models | [docs/spec/data-models.md](docs/spec/data-models.md) |
| Business rules | [docs/spec/business-rules.md](docs/spec/business-rules.md) |
| Troubleshooting | [docs/gotchas.md](docs/gotchas.md) |

## License

See [LICENSE](LICENSE) file.
