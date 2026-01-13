#!/bin/bash
# Wrapper script to run migrations before starting API
# This ensures migrations complete before API serves requests
# Prevents race condition where API starts while migrations are running

set -e  # Exit immediately on error

echo "=== Running database migrations ==="
cd /app/backend
python migrations/migration_runner.py --db /data/polkadot.db

if [ $? -eq 0 ]; then
    echo "=== Migrations completed successfully ==="
    echo "=== Starting API server ==="
    cd /app/api
    exec node dist/index.js
else
    echo "ERROR: Migrations failed. Not starting API."
    exit 1
fi
