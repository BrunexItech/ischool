#!/usr/bin/env bash
# Run this FROM the ischool/ directory on the VPS, after the one-time setup
# in the runbook is done. Safe to re-run any time you push a new commit —
# migrations run automatically on backend startup (see docker-entrypoint.sh).
set -euo pipefail

git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "Deployed. Tailing backend logs (Ctrl+C to stop watching — containers keep running):"
docker compose -f docker-compose.prod.yml logs -f backend
