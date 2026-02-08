#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "Starting required services (postgres, redis, api)..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis api

echo "Dropping all application data via Django flush..."
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py flush --noinput

echo "Done. All DB data has been removed."
