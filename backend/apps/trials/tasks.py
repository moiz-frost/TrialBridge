from celery import shared_task

from .services.ingestion import fetch_ctgov_trials, ingest_sample_trials, upsert_trial


@shared_task
def sync_trial_sources() -> dict:
    ingested = 0
    try:
        for payload in fetch_ctgov_trials(limit=20):
            upsert_trial(payload)
            ingested += 1
    except Exception:
        # Network/source failures should not block demo.
        fallback = ingest_sample_trials()
        ingested += len(fallback)

    return {"ingested": ingested}
