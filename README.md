# TrialBridge

TrialBridge is an AI-assisted clinical trial matching platform for trial coordinators and patients.

## Stack

- Frontend: Next.js (deployed to Vercel)
- Backend: Django + DRF + Celery
- Database: Self-hosted PostgreSQL with `pgvector`
- Queue: Redis
- Messaging: Twilio (SMS/WhatsApp)
- AI: Hugging Face endpoint (with deterministic fallback)
- Runtime: Docker Compose

## Services (Docker)

- `postgres` (pgvector enabled)
- `redis`
- `api` (Django + gunicorn)
- `worker` (Celery worker)
- `beat` (Celery scheduler)
- `nginx` (reverse proxy)

## Quick start

1. Copy environment:

```bash
cp .env.example .env
```

2. Start backend stack:

```bash
docker compose up --build
```

3. Health check:

- API: `http://localhost:8000/api/v1/health/`
- Nginx proxy: `http://localhost/api/v1/health/`

4. Default seeded coordinator credentials:

- username: `coordinator`
- password: `coordinator123`

## Key endpoints

- `POST /api/v1/auth/login/`
- `GET /api/v1/auth/me/`
- `GET /api/v1/coordinator/dashboard/`
- `GET /api/v1/coordinator/matches/`
- `GET /api/v1/coordinator/matches/{id}/`
- `GET /api/v1/coordinator/patients/`
- `GET /api/v1/coordinator/trials/`
- `GET /api/v1/coordinator/outreach/`
- `POST /api/v1/coordinator/outreach/send/`
- `GET|PATCH /api/v1/coordinator/settings/`
- `POST /api/v1/coordinator/matching/run/`
- `POST /api/v1/patient/intake/`
- `GET /api/v1/patient/{patient_id}/matches/`

## Data pipeline

1. Trial ingestion (`ingest_trials`, scheduled sync task)
2. Patient intake (free-text + structured extraction)
3. Embedding generation (HF endpoint or deterministic fallback)
4. Candidate retrieval (`pgvector` cosine similarity)
5. Rule evaluation (eligibility/feasibility/urgency)
6. LLM explanation JSON generation
7. Coordinator review and outreach workflow

## Commands

```bash
# One-off sample trial ingest
docker compose exec api python manage.py ingest_trials --source sample

# Optional CT.gov ingest
docker compose exec api python manage.py ingest_trials --source ctgov --limit 20

# Manual matching run
docker compose exec api python manage.py run_matching --run-type manual
```

## Backups (self-hosted Postgres)

Use scripts under `ops/`:

- `ops/backup_postgres.sh`
- `ops/restore_postgres.sh`

Run them from a container/host with `psql` and `pg_dump` available.

## Deployment recommendation

- Deploy `frontend/` to Vercel.
- Deploy backend Docker stack to VPS (or container host).
- Keep Postgres and Redis private (not public internet).
- Configure `api.yourdomain.com` to reverse proxy into Django.

