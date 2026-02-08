from django.core.management.base import BaseCommand

from apps.trials.services.ingestion import fetch_ctgov_trials, ingest_sample_trials, upsert_trial


class Command(BaseCommand):
    help = "Ingest trial data from sample set and optionally ClinicalTrials.gov"

    def add_arguments(self, parser):
        parser.add_argument("--source", choices=["sample", "ctgov"], default="sample")
        parser.add_argument("--limit", type=int, default=20)

    def handle(self, *args, **options):
        source = options["source"]
        limit = options["limit"]

        if source == "sample":
            trials = ingest_sample_trials()
            self.stdout.write(self.style.SUCCESS(f"Ingested sample trials: {len(trials)}"))
            return

        ingested = 0
        for payload in fetch_ctgov_trials(limit=limit):
            upsert_trial(payload)
            ingested += 1
        self.stdout.write(self.style.SUCCESS(f"Ingested CT.gov trials: {ingested}"))
