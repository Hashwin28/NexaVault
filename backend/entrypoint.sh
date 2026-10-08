#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting NexaVault backend..."
if [ $# -eq 0 ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
else
    exec "$@"
fi
