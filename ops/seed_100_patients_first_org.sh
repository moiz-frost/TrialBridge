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

PATIENT_COUNT="${PATIENT_COUNT:-100}"
PATIENT_MODE="${PATIENT_MODE:-spectrum}"
PATIENT_SEED="${PATIENT_SEED:-42}"

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
echo "Seeding $PATIENT_COUNT patients in '$PATIENT_MODE' mode (no matching run)..."
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py generate_mock_patients \
  --count "$PATIENT_COUNT" \
  --organization-slug "$FIRST_COORD_ORG" \
  --mode "$PATIENT_MODE" \
  --seed "$PATIENT_SEED"

TOTAL_PATIENTS="$(
  docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py shell -c \
  "from apps.patients.models import PatientProfile; print(PatientProfile.objects.count())"
)"
echo "Total patients in DB: $TOTAL_PATIENTS"
echo "Done."
