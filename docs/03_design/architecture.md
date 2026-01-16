# Architecture

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
│     SubsquareProvider → PriceService → SQLiteSink                       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   SQLite Database   │
                    │(data/local/polkadot.│
                    │         db)         │
                    └──────────┬──────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Node.js Express API (:3001)                          │
│         better-sqlite3 → Route Handlers → Query Builder                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Vite + React Frontend (:3000)                      │
│           React Router → TanStack Table → View State                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Backend** fetches governance data from Subsquare, enriches with USD prices, stores to SQLite
2. **API** serves data via REST endpoints, handles auth and CRUD for manual tables
3. **Frontend** fetches from API, renders with TanStack Table, persists view state to localStorage

## Authentication

Session-based (`express-session`), stored in `data/local/sessions.db`. Users created via CLI (`pnpm users add`). All mutating endpoints require auth.

## Deployment

Single Docker container with supervisord running nginx, Node API, and hourly cron sync. See `Dockerfile` and `deploy/`.
