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

DEMO_PASSWORD="${DEMO_PASSWORD:-TrialBridge@2026}"
RESET_PASSWORDS="${RESET_PASSWORDS:-1}"
EXTRA_ARGS=()
if [[ "$RESET_PASSWORDS" == "1" ]]; then
  EXTRA_ARGS+=(--reset-passwords)
fi

echo "Starting required services (postgres, redis, api)..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis api

echo "Seeding 3 coordinators..."
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py seed_coordinators \
  --password "$DEMO_PASSWORD" \
  "${EXTRA_ARGS[@]}"

echo ""
echo "Coordinator credentials:"
cat <<EOF
  - coord_aga   / ${DEMO_PASSWORD}   (Aga Khan University Hospital)
  - coord_abu   / ${DEMO_PASSWORD}   (Cleveland Clinic Abu Dhabi)
  - coord_dubai / ${DEMO_PASSWORD}   (Saudi German Hospital Dubai)
EOF

echo "Done."
