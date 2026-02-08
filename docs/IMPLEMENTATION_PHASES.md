# TrialBridge Implementation Phases (Implemented)

## Phase 0: Architecture Lock
- Frontend on Vercel (`frontend/`)
- Backend self-hosted with Docker Compose (`backend/` + `docker-compose.yml`)
- Internal Postgres (`pgvector`) and Redis

## Phase 1: DevOps Foundation
- Dockerized services: `api`, `worker`, `beat`, `postgres`, `redis`, `nginx`
- Postgres extension init: `ops/postgres/init/01_extensions.sql`
- Environment template: `.env.example`

## Phase 2: Backend Core
- Django project scaffolding: `backend/config/`
- Apps: `accounts`, `core`, `patients`, `trials`, `matching`, `outreach`
- DRF + JWT auth endpoints

## Phase 3: Trial + Patient Ingestion
- Trial ingestion service with sample + CT.gov adapter
- Patient intake endpoint with structured extraction + completeness

## Phase 4: Matching Engine
- Candidate retrieval using pgvector cosine similarity
- Rule-based eligibility/feasibility/urgency scoring
- Persistent `MatchEvaluation` records

## Phase 5: LLM Explanation Layer
- HF endpoint-backed explanation service
- Deterministic fallback if endpoint/token absent
- Prompt versioning and model tracking on each match

## Phase 6: Outreach + Daily Automation
- Twilio sender service for SMS/WhatsApp
- Outreach models and send endpoint
- Celery beat scheduled tasks for daily sync + matching

## Phase 7: Frontend Integration
- Live API layer: `frontend/lib/api.ts`
- Coordinator pages wired to backend (dashboard, matches, patients, trials)
- Added missing coordinator routes: `outreach`, `settings`
- Patient intake now posts to backend and stores patient ID for portal fetch

## Phase 8: Production Hardening
- Nginx reverse proxy config for API/static/media
- Backup and restore scripts (`ops/backup_postgres.sh`, `ops/restore_postgres.sh`)
- Persistent volumes configured in compose

## Phase 9: Demo Readiness
- Seed command for demo users/patients/trials: `python manage.py seed_demo`
- Manual run command for matching: `python manage.py run_matching --run-type manual`
