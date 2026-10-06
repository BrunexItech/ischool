#!/usr/bin/env bash
set -euo pipefail

echo "Running database migrations..."
alembic upgrade head

echo "Starting uvicorn..."
# Defaults to 1 worker: the login rate-limiter is in-memory per-process, so
# multiple workers would each keep their own counters and weaken it. Raise
# UVICORN_WORKERS once that's made distributed (e.g. Redis-backed).
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers "${UVICORN_WORKERS:-1}"
