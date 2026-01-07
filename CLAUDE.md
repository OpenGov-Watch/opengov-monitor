# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview
Monorepo with two components:
1. **Backend (Python)**: Fetches Polkadot/Kusama governance data from Subsquare, stores in SQLite
2. **Frontend (Next.js)**: Dashboard for viewing and analyzing governance data

## Shared Database
- Path: `data/polkadot.db`
- Backend populates -> Frontend reads
- Schema defined in backend, types mirrored in frontend

## Documentation
| Topic | Location |
|-------|----------|
| Setup & commands | [README.md](README.md) |
| System architecture | [docs/spec/index.md](docs/spec/index.md) |
| Data models | [docs/spec/data-models.md](docs/spec/data-models.md) |
| API reference | [docs/spec/api-reference.md](docs/spec/api-reference.md) |
| Backend specifics | [backend/CLAUDE.md](backend/CLAUDE.md) |
| Frontend specifics | [frontend/CLAUDE.md](frontend/CLAUDE.md) |

## Configuration
- **backend/config.yaml**: Fetch limits, block time projection, salary toggle
- **Environment vars**: `OPENGOV_MONITOR_SPREADSHEET_ID`, `OPENGOV_MONITOR_CREDENTIALS`
