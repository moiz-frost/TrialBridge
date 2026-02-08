from celery import shared_task

from .services.engine import run_full_matching_cycle


@shared_task
def run_daily_matching() -> dict:
    run = run_full_matching_cycle(run_type="scheduled")
    return {"run_id": run.id, **run.metadata}
