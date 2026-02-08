#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.prod.yml)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

DEMO_PASSWORD="${DEMO_PASSWORD:-TrialBridge@2026}"
PATIENTS_PER_ORG="${PATIENTS_PER_ORG:-12}"
TOTAL_PATIENTS="${TOTAL_PATIENTS:-0}"
PATIENT_MODE="${PATIENT_MODE:-spectrum}"
CTGOV_LIMIT="${CTGOV_LIMIT:-80}"
RESET_PASSWORDS="${RESET_PASSWORDS:-1}"
SKIP_CTGOV="${SKIP_CTGOV:-0}"
SKIP_MATCHING="${SKIP_MATCHING:-0}"

EXTRA_ARGS=()
if [[ "$RESET_PASSWORDS" == "1" ]]; then
  EXTRA_ARGS+=(--reset-passwords)
fi
if [[ "$SKIP_CTGOV" == "1" ]]; then
  EXTRA_ARGS+=(--skip-ctgov)
fi
if [[ "$SKIP_MATCHING" == "1" ]]; then
  EXTRA_ARGS+=(--skip-matching)
fi

echo "Seeding demo data with:"
echo "  password:         $DEMO_PASSWORD"
echo "  patients/org:     $PATIENTS_PER_ORG"
echo "  total patients:   $TOTAL_PATIENTS"
echo "  patient mode:     $PATIENT_MODE"
echo "  ctgov limit:      $CTGOV_LIMIT"
echo "  reset passwords:  $RESET_PASSWORDS"
echo "  skip ctgov:       $SKIP_CTGOV"
echo "  skip matching:    $SKIP_MATCHING"

docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis api
docker compose "${COMPOSE_ARGS[@]}" exec -T api python manage.py seed_hackathon_demo \
  --password "$DEMO_PASSWORD" \
  --patients-per-org "$PATIENTS_PER_ORG" \
  --total-patients "$TOTAL_PATIENTS" \
  --patient-mode "$PATIENT_MODE" \
  --ctgov-limit "$CTGOV_LIMIT" \
  "${EXTRA_ARGS[@]}"

echo "Done."
