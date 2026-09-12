#!/usr/bin/env bash
# Uploads a backup file to S3-compatible storage (AWS S3, Cloudflare R2,
# Backblaze B2 — anything the `aws` CLI can talk to via --endpoint-url).
# Inert until BACKUP_S3_BUCKET etc. are set — backup_db.sh only calls this
# when BACKUP_S3_BUCKET is present.
#
# Required env vars: BACKUP_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
# Optional: BACKUP_S3_ENDPOINT (for R2/B2), BACKUP_S3_PREFIX
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 <path-to-dump.sql.gz>"
  exit 1
fi
FILE="$1"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET not set}"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not installed — skipping off-site upload. Install it (pip install awscli) to enable this." >&2
  exit 0
fi

PREFIX="${BACKUP_S3_PREFIX:-ischool-backups}"
DEST="s3://${BACKUP_S3_BUCKET}/${PREFIX}/$(basename "$FILE")"
ENDPOINT_ARG=()
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  ENDPOINT_ARG=(--endpoint-url "$BACKUP_S3_ENDPOINT")
fi

echo "Uploading $FILE to $DEST ..."
aws s3 cp "$FILE" "$DEST" "${ENDPOINT_ARG[@]}"
echo "Off-site upload complete."
