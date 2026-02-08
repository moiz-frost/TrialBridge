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

TRIAL_LIMIT="${TRIAL_LIMIT:-50}"
TRIAL_SOURCE="${TRIAL_SOURCE:-ctgov}"

echo "Starting required services (postgres, redis, api)..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis api

FIRST_COORD_ORG="$(
  docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py shell -c \
  "from apps.accounts.models import User; u = User.objects.filter(role='coordinator', organization__isnull=False).order_by('id').select_related('organization').first(); print(u.organization.slug if u and u.organization else '')"
)"

if [[ -z "$FIRST_COORD_ORG" ]]; then
  echo "No coordinator organization found. Run ./ops/seed_3_coordinators.sh first."
  exit 1
fi

echo "First coordinator org: $FIRST_COORD_ORG"
echo "Seeding up to $TRIAL_LIMIT trials from source '$TRIAL_SOURCE' (trials are global in current schema)."
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py ingest_trials --source "$TRIAL_SOURCE" --limit "$TRIAL_LIMIT"

TOTAL_TRIALS="$(
  docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py shell -c \
  "from apps.trials.models import Trial; print(Trial.objects.count())"
)"
echo "Total trials in DB: $TOTAL_TRIALS"
if [[ "$TOTAL_TRIALS" -lt "$TRIAL_LIMIT" ]]; then
  echo "Warning: total trials are below requested limit ($TRIAL_LIMIT)."
fi
echo "Done."
