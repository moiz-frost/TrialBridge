#!/usr/bin/env sh
set -eu

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUT_DIR="/backups"
mkdir -p "$OUT_DIR"

pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$OUT_DIR/trialbridge_${TIMESTAMP}.sql.gz"

echo "Backup written: $OUT_DIR/trialbridge_${TIMESTAMP}.sql.gz"
