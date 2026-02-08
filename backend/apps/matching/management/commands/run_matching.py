from django.core.management.base import BaseCommand

from apps.matching.services.engine import run_full_matching_cycle


class Command(BaseCommand):
    help = "Run full patient-trial matching cycle"

    def add_arguments(self, parser):
        parser.add_argument("--run-type", default="manual")

    def handle(self, *args, **options):
        run = run_full_matching_cycle(run_type=options["run_type"])
        self.stdout.write(self.style.SUCCESS(f"Matching run {run.id} complete: {run.metadata}"))
