from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.core.models import Organization
from apps.matching.services.engine import run_full_matching_cycle
from apps.patients.models import PatientProfile
from apps.patients.services.profile import infer_structured_profile
from apps.trials.services.ingestion import ingest_sample_trials


class Command(BaseCommand):
    help = "Seed demo data for TrialBridge"

    def handle(self, *args, **options):
        org, _ = Organization.objects.get_or_create(
            slug="aga-khan-demo",
            defaults={
                "name": "Aga Khan University Hospital",
                "country": "Pakistan",
                "score_weights": {
                    "eligibility": 0.45,
                    "feasibility": 0.30,
                    "urgency": 0.20,
                    "explainability": 0.05,
                },
            },
        )

        User = get_user_model()
        if not User.objects.filter(username="coordinator").exists():
            User.objects.create_user(
                username="coordinator",
                password="coordinator123",
                email="coordinator@trialbridge.local",
                role="coordinator",
                organization=org,
            )

        ingest_sample_trials()

        sample_patients = [
            {
                "code": "PAT-0001",
                "name": "Fatima Zahra",
                "age": 42,
                "sex": "Female",
                "city": "Karachi",
                "country": "Pakistan",
                "language": "Urdu",
                "story": "HER2-positive metastatic breast cancer. Progressed after trastuzumab. ECOG 1.",
                "channel": "whatsapp",
                "contact": "+923001234567",
            },
            {
                "code": "PAT-0002",
                "name": "Sara Al-Mansouri",
                "age": 38,
                "sex": "Female",
                "city": "Abu Dhabi",
                "country": "UAE",
                "language": "Arabic",
                "story": "HR+/HER2- metastatic disease with PIK3CA mutation and prior letrozole progression.",
                "channel": "whatsapp",
                "contact": "+971501234567",
            },
        ]

        for payload in sample_patients:
            structured = infer_structured_profile(payload["story"])
            PatientProfile.objects.get_or_create(
                patient_code=payload["code"],
                defaults={
                    "organization": org,
                    "full_name": payload["name"],
                    "age": payload["age"],
                    "sex": payload["sex"],
                    "city": payload["city"],
                    "country": payload["country"],
                    "language": payload["language"],
                    "diagnosis": structured.get("diagnosis", ""),
                    "stage": structured.get("stage", ""),
                    "story": payload["story"],
                    "structured_profile": structured,
                    "contact_channel": payload["channel"],
                    "contact_value": payload["contact"],
                    "consent": True,
                    "profile_completeness": 90,
                },
            )

        run = run_full_matching_cycle(run_type="seed")
        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Matching run={run.id}"))
