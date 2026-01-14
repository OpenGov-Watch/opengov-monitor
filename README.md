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

## Authentication

The manage section (`/manage/*` routes) requires authentication for administrative operations.

### Login
- Navigate to: http://localhost:3000/login
- Default credentials must be created via API or initial setup flow

### Creating the First User
On first run, if no users exist, you can create an admin user:

```bash
# Start the API
pnpm api:dev

# In another terminal, create first user via the API
# (Note: In production, use a secure registration flow)
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "secure-password"}'
```

### Session Management
- Sessions are stored in SQLite (`data/sessions.db`)
- Session duration: 24 hours (default) or 30 days (remember me checkbox)
- Sessions use HTTP-only cookies for security
- Configure `SESSION_SECRET` environment variable in production

### Environment Variables
- `SESSION_SECRET`: 32+ character random string (required in production)
- `NODE_ENV`: Set to "production" for secure HTTPS-only cookies
- `CROSS_ORIGIN_AUTH`: Set to "true" for cross-origin auth (development only)

## Documentation

| Topic | Location |
|-------|----------|
| System overview | [docs/architecture.md](docs/architecture.md) |
| Data models | [docs/spec/data-models.md](docs/spec/data-models.md) |
| Business rules | [docs/spec/business-rules.md](docs/spec/business-rules.md) |
| Troubleshooting | [docs/gotchas.md](docs/gotchas.md) |

## License

See [LICENSE](LICENSE) file.
