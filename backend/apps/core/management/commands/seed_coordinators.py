from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.management import BaseCommand

from apps.core.models import Organization


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
    help = "Seed the 3 default coordinator accounts and organizations."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default="TrialBridge@2026",
            help="Password to set for coordinator demo accounts (default: TrialBridge@2026)",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset password for existing seeded coordinator users.",
        )

    def handle(self, *args, **options):
        password = str(options["password"])
        reset_passwords = bool(options["reset_passwords"])
        user_model = get_user_model()

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

        self.stdout.write(self.style.SUCCESS("Coordinator accounts ready:"))
        for seed in COORDINATOR_SEEDS:
            self.stdout.write(f"  - {seed.username} / {password}  ({seed.org_name})")
