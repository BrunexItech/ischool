#!/usr/bin/env bash
# Dumps the iSchool database to backend/backups/, keeping the last KEEP_DAYS
# days of dumps locally. Reads connection details from DATABASE_URL in
# backend/.env unless overridden via environment variables.
#
# Runs pg_dump inside the Postgres container when it's running under
# docker-compose (DB_CONTAINER) — the host's pg_dump version can otherwise
# mismatch the server's and refuse to run. Falls back to the host's pg_dump
# for a bare-metal Postgres install where versions already match.
#
# For real durability (surviving this machine dying, not just accidental
# deletes) copy the resulting file to off-site storage (S3/R2/B2) — see
# upload_backup_offsite.sh once BACKUP_S3_* credentials are configured.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$BACKEND_DIR/backups"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-ischool-db-1}"

if [ -f "$BACKEND_DIR/.env" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$BACKEND_DIR/.env" | head -1 | cut -d= -f2-)
fi
: "${DATABASE_URL:?DATABASE_URL not set (checked backend/.env and environment)}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/ischool_${TIMESTAMP}.sql.gz"

echo "Backing up to $OUT_FILE ..."

if docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  read -r DB_USER DB_PASS DB_NAME <<<"$(python3 -c "
import sys
from urllib.parse import urlparse
u = urlparse('$DATABASE_URL')
print(u.username, u.password, u.path.lstrip('/'))
")"
  docker exec -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$OUT_FILE"
else
  pg_dump "$DATABASE_URL" | gzip > "$OUT_FILE"
fi

echo "Backup complete: $(du -h "$OUT_FILE" | cut -f1)"

find "$BACKUP_DIR" -name 'ischool_*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "Pruned backups older than $KEEP_DAYS days."

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  "$SCRIPT_DIR/upload_backup_offsite.sh" "$OUT_FILE"
fi
