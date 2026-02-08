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

set -a
source "$ENV_FILE"
set +a

POSTGRES_DB="${POSTGRES_DB:-trialbridge}"
POSTGRES_USER="${POSTGRES_USER:-trialbridge}"

echo "Starting required services (postgres, redis, api)..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis api

echo "Resetting database schema (drop + recreate public)..."
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION "$POSTGRES_USER";
GRANT ALL ON SCHEMA public TO "$POSTGRES_USER";
GRANT ALL ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS vector;
SQL

echo "Re-running migrations..."
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py migrate --noinput

echo "Done. All DB data has been removed."
