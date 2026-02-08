from celery import shared_task

from .services.engine import MatchingRunAlreadyRunningError, run_full_matching_cycle


@shared_task
def run_daily_matching() -> dict:
    try:
        run = run_full_matching_cycle(run_type="scheduled")
    except MatchingRunAlreadyRunningError as exc:
        running_run = exc.running_run
        return {
            "skipped": True,
            "reason": "already_running",
            "running_run_id": running_run.id if running_run else None,
        }
    return {"run_id": run.id, **run.metadata}
