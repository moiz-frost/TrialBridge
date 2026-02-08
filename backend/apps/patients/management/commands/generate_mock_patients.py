import random

from django.core.management.base import BaseCommand

from apps.core.models import Organization
from apps.matching.services.engine import run_full_matching_cycle
from apps.patients.models import ContactChannel, PatientProfile
from apps.patients.services.profile import infer_structured_profile
from apps.trials.models import Trial


FIRST_NAMES = [
    "Aisha",
    "Fatima",
    "Sara",
    "Noor",
    "Amna",
    "Hina",
    "Rehana",
    "Zainab",
    "Ali",
    "Ahmed",
    "Bilal",
    "Hamza",
    "Usman",
    "Omar",
    "Khalid",
    "Sameer",
]

LAST_NAMES = [
    "Khan",
    "Hussain",
    "Malik",
    "Iqbal",
    "Siddiqui",
    "Ahmed",
    "Mirza",
    "Al-Mansouri",
    "Abdullah",
    "Rahman",
    "Qureshi",
]

CITY_COUNTRY = [
    ("Karachi", "Pakistan"),
    ("Lahore", "Pakistan"),
    ("Islamabad", "Pakistan"),
    ("Rawalpindi", "Pakistan"),
    ("Abu Dhabi", "UAE"),
    ("Dubai", "UAE"),
    ("Riyadh", "Saudi Arabia"),
    ("Jeddah", "Saudi Arabia"),
    ("Mumbai", "India"),
    ("Delhi", "India"),
]

LANGUAGES = ["english", "urdu", "arabic", "hindi"]
CONTACT_CHANNELS = [choice for choice, _ in ContactChannel.choices]
STAGE_HINTS = ["stage ii", "stage iii", "stage iv", "metastatic"]
MARKER_HINTS = ["HER2", "TNBC", "BRCA", "HR+"]


def _next_patient_code() -> str:
    n = PatientProfile.objects.count() + 1
    while True:
        code = f"PAT-{n:04d}"
        if not PatientProfile.objects.filter(patient_code=code).exists():
            return code
        n += 1


class Command(BaseCommand):
    help = "Generate synthetic patients for local matching demos."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=120)
        parser.add_argument("--organization-slug", type=str, default="aga-khan-demo")
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--run-matching", action="store_true")

    def handle(self, *args, **options):
        count = max(1, min(int(options["count"]), 1000))
        org_slug = options["organization_slug"]
        seed = options["seed"]
        run_matching = bool(options["run_matching"])
        random.seed(seed)

        organization, _ = Organization.objects.get_or_create(
            slug=org_slug,
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

        condition_pool: list[str] = []
        for trial in Trial.objects.all()[:500]:
            for condition in trial.conditions or []:
                if isinstance(condition, str) and condition.strip():
                    condition_pool.append(condition.strip())
        if not condition_pool:
            condition_pool = [
                "Breast Cancer",
                "HER2+ Breast Cancer",
                "Triple-Negative Breast Cancer",
                "Metastatic Breast Cancer",
            ]

        created = 0
        for _ in range(count):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"

            sex = random.choice(["female", "male"])
            age = random.randint(24, 76)
            city, country = random.choice(CITY_COUNTRY)
            language = random.choice(LANGUAGES)
            condition = random.choice(condition_pool)
            marker = random.choice(MARKER_HINTS)
            stage_hint = random.choice(STAGE_HINTS)
            ecog = random.choice([0, 1, 1, 2])

            story = (
                f"Patient diagnosed with {condition}. {marker} marker noted. "
                f"Disease currently {stage_hint}. Prior systemic treatment attempted with partial response, "
                f"then progression. ECOG {ecog}. Considering trial enrollment and willing to attend visits in {city}."
            )

            structured = infer_structured_profile(story)
            diagnosis = structured.get("diagnosis") or condition
            stage = structured.get("stage") or stage_hint.title()

            channel = random.choice(CONTACT_CHANNELS)
            if channel in {"sms", "phone", "whatsapp"}:
                contact_value = f"+92{random.randint(3000000000, 3499999999)}"
            else:
                contact_value = f"{first.lower()}.{last.lower()}{random.randint(10,99)}@example.com"

            profile = PatientProfile.objects.create(
                patient_code=_next_patient_code(),
                organization=organization,
                full_name=full_name,
                age=age,
                sex=sex,
                city=city,
                country=country,
                language=language,
                diagnosis=diagnosis,
                stage=stage,
                story=story,
                structured_profile=structured,
                contact_channel=channel,
                contact_value=contact_value,
                consent=True,
                profile_completeness=random.randint(86, 100),
            )
            created += 1

            # Keep run fast by not forcing embedding at generation time.
            if created % 100 == 0:
                self.stdout.write(self.style.NOTICE(f"Generated {created} patients... (latest: {profile.patient_code})"))

        self.stdout.write(self.style.SUCCESS(f"Generated synthetic patients: {created}"))

        if run_matching:
            run = run_full_matching_cycle(run_type="mock_generation")
            self.stdout.write(self.style.SUCCESS(f"Matching run {run.id} complete: {run.metadata}"))

