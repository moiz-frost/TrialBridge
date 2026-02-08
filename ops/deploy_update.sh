#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.prod.yml)
DO_PULL="${DO_PULL:-1}"

wait_for_running_service() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if docker compose "${COMPOSE_ARGS[@]}" ps --status running --services | grep -qx "$service"; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "Timed out waiting for service '$service' to be running."
  docker compose "${COMPOSE_ARGS[@]}" logs --tail=120 "$service" || true
  return 1
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "Loading env from $ENV_FILE"
set -a
source "$ENV_FILE"
set +a

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_PASSWORD:-}" ]]; then
  echo "POSTGRES_USER and POSTGRES_PASSWORD must be set in $ENV_FILE"
  exit 1
fi

if [[ "$DO_PULL" == "1" ]]; then
  if [[ -d .git ]]; then
    echo "Pulling latest code"
    git pull --ff-only
  else
    echo "No .git directory found, skipping git pull"
  fi
fi

echo "Ensuring database/cache are running"
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis

echo "Syncing postgres role password with env file"
ESCAPED_DB_PASSWORD="${POSTGRES_PASSWORD//\'/\'\'}"
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE \"$POSTGRES_USER\" WITH PASSWORD '$ESCAPED_DB_PASSWORD';"

echo "Refreshing app services"
docker compose "${COMPOSE_ARGS[@]}" up -d --build api worker beat nginx frontend

echo "Waiting for API container to be running"
wait_for_running_service api

echo "Applying backend migrations/checks"
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py migrate --noinput
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py check

echo "Update complete."
