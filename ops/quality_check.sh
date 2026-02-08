#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/4] Frontend typecheck"
(
  cd "$ROOT_DIR/frontend"
  npm run typecheck
)

echo "[2/4] Frontend lint (strict)"
(
  cd "$ROOT_DIR/frontend"
  npm run lint:strict
)

echo "[3/4] Backend lint (ruff via docker api service)"
(
  cd "$ROOT_DIR"
  docker compose run --rm api sh -lc "pip install -q ruff==0.8.6 >/dev/null && ruff check /app"
)

echo "[4/4] Backend tests (targeted)"
(
  cd "$ROOT_DIR"
  docker compose run --rm api python manage.py test --keepdb apps.matching.tests.test_engine apps.patients.tests.test_patient_upload
)

echo "Quality checks passed."
