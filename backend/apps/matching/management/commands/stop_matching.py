from __future__ import annotations

import time

from django.core.management import BaseCommand
from django.db import connection
from django.utils import timezone

from apps.matching.models import MatchingRun
from apps.matching.services.engine import MATCHING_RUN_LOCK_KEY


class Command(BaseCommand):
    help = "Request stop for any running matching run."

    def add_arguments(self, parser):
        parser.add_argument(
            "--wait-seconds",
            type=int,
            default=20,
            help="How long to wait for running jobs to stop (default: 20).",
        )
        parser.add_argument(
            "--poll-interval",
            type=float,
            default=1.0,
            help="Polling interval in seconds while waiting (default: 1.0).",
        )

    @staticmethod
    def _matching_lock_is_free() -> bool:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s)", [MATCHING_RUN_LOCK_KEY])
            row = cursor.fetchone()
            lock_acquired = bool(row and row[0])
            if lock_acquired:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [MATCHING_RUN_LOCK_KEY])
            return lock_acquired

    @staticmethod
    def _mark_stale_runs_stopped(run_ids: list[int], reason: str) -> list[int]:
        now = timezone.now()
        stopped_ids: list[int] = []
        for run in MatchingRun.objects.filter(id__in=run_ids, status="running"):
            metadata = run.metadata if isinstance(run.metadata, dict) else {}
            run.status = "stopped"
            run.finished_at = now
            run.metadata = {**metadata, "stopped_reason": reason, "stopped_at": now.isoformat()}
            run.save(update_fields=["status", "finished_at", "metadata", "updated_at"])
            stopped_ids.append(run.id)
        return stopped_ids

    def handle(self, *args, **options):
        wait_seconds = max(0, int(options["wait_seconds"]))
        poll_interval = max(0.2, float(options["poll_interval"]))

        running_runs = list(MatchingRun.objects.filter(status="running").order_by("-started_at"))
        if not running_runs:
            self.stdout.write(self.style.SUCCESS("No running matching job found."))
            return

        now = timezone.now().isoformat()
        for run in running_runs:
            metadata = run.metadata if isinstance(run.metadata, dict) else {}
            metadata["stop_requested"] = True
            metadata["stop_requested_at"] = now
            run.metadata = metadata
            run.save(update_fields=["metadata", "updated_at"])

        run_ids = [run.id for run in running_runs]
        self.stdout.write(self.style.WARNING(f"Stop requested for run(s): {run_ids}"))

        if self._matching_lock_is_free():
            stopped_ids = self._mark_stale_runs_stopped(run_ids, reason="stop_requested_no_active_lock")
            if stopped_ids:
                self.stdout.write(self.style.SUCCESS(f"Marked stale run(s) as stopped: {stopped_ids}"))
            else:
                self.stdout.write(self.style.SUCCESS("Matching job stopped successfully."))
            return

        if wait_seconds == 0:
            return

        deadline = time.time() + wait_seconds
        while time.time() < deadline:
            still_running = MatchingRun.objects.filter(id__in=run_ids, status="running").count()
            if still_running == 0:
                self.stdout.write(self.style.SUCCESS("Matching job stopped successfully."))
                return
            time.sleep(poll_interval)

        remaining = list(MatchingRun.objects.filter(id__in=run_ids, status="running").values_list("id", flat=True))
        if remaining and self._matching_lock_is_free():
            stopped_ids = self._mark_stale_runs_stopped(remaining, reason="stop_requested_timeout_no_active_lock")
            if stopped_ids:
                self.stdout.write(self.style.SUCCESS(f"Marked stale run(s) as stopped: {stopped_ids}"))
                return
        if remaining:
            self.stdout.write(
                self.style.WARNING(
                    f"Stop requested, but run(s) still marked running: {remaining}. "
                    "Check worker/api logs and rerun if needed."
                )
            )
