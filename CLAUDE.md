# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Python service that monitors Polkadot/Kusama governance data by fetching information from Subsquare and writing it to Google Spreadsheets. It runs as a Flask web service and can be deployed locally or on Google Cloud Run with scheduled execution.

## Development Setup
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Core Architecture

### Data Flow
1. **main.py** orchestrates the entire process as Flask app with single route `/`
2. **SubsquareProvider** fetches governance data (referenda, treasury spends, child bounties, fellowship salary cycles/claimants)
3. **PriceService** enriches data with USD values using yfinance
4. **SpreadsheetSink** compares and updates Google Sheets data

### Key Components
- **data_providers/**: Abstract `DataProvider` base class, `SubsquareProvider` implementation, `StatescanIdProvider` for address name resolution, `PriceService` for token prices, `NetworkInfo` for network configs
- **data_sinks/google/**: Google Sheets integration with auth, spreadsheet operations, and utilities
- **utils/custom_logging.py**: Configurable logging system with file rotation and JSON extras
- **config.yaml**: Fetch limits and block time projection settings

### Configuration
- Environment variables: `OPENGOV_MONITOR_SPREADSHEET_ID`, `OPENGOV_MONITOR_CREDENTIALS`
- **config.yaml**: Controls fetch limits and block time projection
- Logging configured via `config.yaml` with file rotation support

## Common Commands

### Running the Application
```bash
# Single execution (runs main function directly)
python main.py run

# Start Flask development server
flask run
# or
python main.py

# Docker deployment
docker build -t opengov-monitor .
docker run -p 8080:8080 opengov-monitor
```

### Testing
```bash
# Run all tests
pytest

# Run with coverage (configured in pytest.ini)
pytest --cov=data_sinks --cov-report=term-missing

# Run specific test markers
pytest -m integration  # integration tests
pytest -m slow        # slow tests
```

### Data Dumping
```bash
# Dump provider data locally without updating spreadsheet
python scripts/dump_provider.py --network polkadot --out ./data_dump

# Fetch fellowship salary cycles and individual claimants with ranks
python scripts/fetch_salaries.py --cycle 17                    # Specific cycle
python scripts/fetch_salaries.py --start-cycle 15 --end-cycle 17  # Range
python scripts/fetch_salaries.py --claimants-only              # Individual claimants with names and ranks
python scripts/fetch_salaries.py --include-claimants           # Both cycles and claimants
python scripts/fetch_salaries.py --claimants-only --no-name-resolution  # Skip name resolution
```

## Code Conventions
- Uses pandas DataFrames for data manipulation
- Abstract base classes define provider interfaces
- Google Sheets operations handle column validation and data comparison
- Comprehensive logging with structured JSON extras
- Error handling with proper logging and graceful failures
- Flask app returns simple "ok" or "error" responses

## Important Files
- **main.py:24**: Network setting (polkadot/kusama)
- **config.yaml**: Fetch limits and block time settings
- **data_providers/data_provider.py**: Abstract interface for data providers
- **data_providers/subsquare.py**: Comprehensive API documentation for all Subsquare endpoints
- **data_providers/statescan_id.py**: Address name resolution using Statescan ID service
- **data_sinks/google/spreadsheet.py**: Core spreadsheet update logic
- **utils/custom_logging.py**: Logging configuration system
- **scripts/fetch_salaries.py**: Fellowship salary cycles and individual claimants fetcher