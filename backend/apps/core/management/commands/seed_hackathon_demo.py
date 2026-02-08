from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand, call_command

from apps.core.models import Organization
from apps.matching.services.engine import MatchingRunAlreadyRunningError, run_full_matching_cycle
from apps.patients.models import PatientProfile


@dataclass(frozen=True)
class CoordinatorSeed:
    org_slug: str
    org_name: str
    country: str
    username: str
    email: str


COORDINATOR_SEEDS: tuple[CoordinatorSeed, ...] = (
    CoordinatorSeed(
        org_slug="aga-khan-university-hospital",
        org_name="Aga Khan University Hospital",
        country="Pakistan",
        username="coord_aga",
        email="coord.aga@trialbridge.local",
    ),
    CoordinatorSeed(
        org_slug="cleveland-clinic-abu-dhabi",
        org_name="Cleveland Clinic Abu Dhabi",
        country="UAE",
        username="coord_abu",
        email="coord.abu@trialbridge.local",
    ),
    CoordinatorSeed(
        org_slug="saudi-german-hospital-dubai",
        org_name="Saudi German Hospital Dubai",
        country="UAE",
        username="coord_dubai",
        email="coord.dubai@trialbridge.local",
    ),
)


class Command(BaseCommand):
    help = "Seed hackathon-ready demo data: coordinator logins, trials, mock patients, and matching results."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="TrialBridge@2026",
            help="Password to set for coordinator demo accounts (default: TrialBridge@2026)",
        )
        parser.add_argument(
            "--patients-per-org",
            type=int,
            default=12,
            help="Number of synthetic patients to generate per seeded organization (default: 12)",
        )
        parser.add_argument(
            "--total-patients",
            type=int,
            default=0,
            help="Total synthetic patients to generate across all seeded organizations. Overrides --patients-per-org when > 0.",
        )
        parser.add_argument(
            "--patient-mode",
            choices=["random", "spectrum"],
            default="spectrum",
            help="Synthetic patient generation mode (default: spectrum).",
        )
        parser.add_argument(
            "--ctgov-limit",
            type=int,
            default=80,
            help="Number of CT.gov trials to ingest (default: 80)",
        )
        parser.add_argument(
            "--skip-ctgov",
            action="store_true",
            help="Skip CT.gov ingestion and only use sample trials.",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset password for existing seeded coordinator users.",
        )
        parser.add_argument(
            "--skip-patients",
            action="store_true",
            help="Skip synthetic patient generation.",
        )
        parser.add_argument(
            "--skip-matching",
            action="store_true",
            help="Skip final matching run.",
        )

    def handle(self, *args, **options):
        password = str(options["password"])
        patients_per_org = max(0, int(options["patients_per_org"]))
        total_patients = max(0, int(options["total_patients"]))
        patient_mode = str(options["patient_mode"])
        ctgov_limit = max(0, int(options["ctgov_limit"]))
        skip_ctgov = bool(options["skip_ctgov"])
        reset_passwords = bool(options["reset_passwords"])
        skip_patients = bool(options["skip_patients"])
        skip_matching = bool(options["skip_matching"])

        user_model = get_user_model()
        seeded_usernames: list[str] = []

        self.stdout.write(self.style.NOTICE("Seeding organizations + coordinator accounts..."))
        for seed in COORDINATOR_SEEDS:
            organization, _ = Organization.objects.get_or_create(
                slug=seed.org_slug,
                defaults={
                    "name": seed.org_name,
                    "country": seed.country,
                    "score_weights": {
                        "eligibility": 0.50,
                        "feasibility": 0.25,
                        "urgency": 0.20,
                        "explainability": 0.05,
                    },
                },
            )
            if organization.name != seed.org_name or organization.country != seed.country:
                organization.name = seed.org_name
                organization.country = seed.country
                organization.save(update_fields=["name", "country", "updated_at"])

            user, created = user_model.objects.get_or_create(
                username=seed.username,
                defaults={
                    "email": seed.email,
                    "role": "coordinator",
                    "organization": organization,
                },
            )
            user.email = seed.email
            user.role = "coordinator"
            user.organization = organization
            if created or reset_passwords:
                user.set_password(password)
            user.save()
            seeded_usernames.append(seed.username)

        self.stdout.write(self.style.SUCCESS("Coordinator accounts ready."))

        self.stdout.write(self.style.NOTICE("Ingesting sample trials..."))
        call_command("ingest_trials", source="sample")

        if not skip_ctgov and ctgov_limit > 0:
            self.stdout.write(self.style.NOTICE(f"Ingesting CT.gov trials (limit={ctgov_limit})..."))
            try:
                call_command("ingest_trials", source="ctgov", limit=ctgov_limit)
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"CT.gov ingestion failed, continuing with sample trials only: {exc}"))

        if not skip_patients:
            self.stdout.write(self.style.NOTICE("Generating synthetic patients..."))
            if total_patients > 0:
                org_count = len(COORDINATOR_SEEDS)
                base = total_patients // org_count
                remainder = total_patients % org_count
                desired_totals = [base + (1 if idx < remainder else 0) for idx in range(org_count)]
                targets = []
                for idx, seed in enumerate(COORDINATOR_SEEDS):
                    existing = PatientProfile.objects.filter(organization__slug=seed.org_slug).count()
                    targets.append(max(0, desired_totals[idx] - existing))
            else:
                targets = [patients_per_org for _ in COORDINATOR_SEEDS]

            for idx, seed in enumerate(COORDINATOR_SEEDS):
                target_count = max(0, targets[idx])
                if target_count == 0:
                    continue
                # Slightly different seeds for variety per organization.
                random_seed = 42 + (idx * 11)
                call_command(
                    "generate_mock_patients",
                    count=target_count,
                    organization_slug=seed.org_slug,
                    seed=random_seed,
                    mode=patient_mode,
                )

        if not skip_matching:
            self.stdout.write(self.style.NOTICE("Running matching cycle..."))
            try:
                run = run_full_matching_cycle(run_type="hackathon_seed")
            except MatchingRunAlreadyRunningError:
                self.stdout.write(self.style.WARNING("Skipped matching run: another run is already in progress."))
            else:
                self.stdout.write(self.style.SUCCESS(f"Matching run complete (run_id={run.id})."))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Demo seed finished. Coordinator logins:"))
        for seed in COORDINATOR_SEEDS:
            self.stdout.write(f"  - {seed.username} / {password}  ({seed.org_name})")

        self.stdout.write("")
        self.stdout.write(
            self.style.NOTICE(
                f"Seeded usernames: {', '.join(seeded_usernames)}"
            )
        )
