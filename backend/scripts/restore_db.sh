#!/usr/bin/env bash
# Restores a database dump produced by backup_db.sh. DESTRUCTIVE — drops and
# recreates the target database's contents, so it asks for confirmation
# unless -f is passed. Reads DATABASE_URL from backend/.env unless overridden.
#
# Runs psql inside the Postgres container when it's running under
# docker-compose (DB_CONTAINER), matching backup_db.sh's approach.
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <path-to-dump.sql.gz> [-f]"
  exit 1
fi
DUMP_FILE="$1"
FORCE="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DB_CONTAINER="${DB_CONTAINER:-ischool-db-1}"

if [ -f "$BACKEND_DIR/.env" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -1 | cut -d= -f2-)
fi
: "${DATABASE_URL:?DATABASE_URL not set (checked backend/.env and environment)}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Dump file not found: $DUMP_FILE"
  exit 1
fi

if [ "$FORCE" != "-f" ]; then
  echo "This will ERASE all current data in the database and replace it with the dump."
  echo "Target: $DATABASE_URL"
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Restoring $DUMP_FILE ..."

if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  read -r DB_USER DB_PASS DB_NAME <<<"$(python3 -c "
import sys
from urllib.parse import urlparse
u = urlparse('$DATABASE_URL')
print(u.username, u.password, u.path.lstrip('/'))
")"
  gunzip -c "$DUMP_FILE" | docker exec -i -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" psql -U "$DB_USER" "$DB_NAME"
else
  gunzip -c "$DUMP_FILE" | psql "$DATABASE_URL"
fi

echo "Restore complete."
