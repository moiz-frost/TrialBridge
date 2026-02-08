#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup.sql.gz>"
  exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
  echo "Backup file not found: $FILE"
  exit 1
fi

gunzip -c "$FILE" | psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "Restore complete from $FILE"
