from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass

from django.core.management.base import BaseCommand

from apps.core.models import Organization
from apps.matching.services.engine import MatchingRunAlreadyRunningError, run_full_matching_cycle
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
MATCH_FRIENDLY_CITIES = [
    ("Karachi", "Pakistan"),
    ("Islamabad", "Pakistan"),
    ("Abu Dhabi", "UAE"),
]
DISTANT_CITIES = [
    ("Mumbai", "India"),
    ("Delhi", "India"),
    ("Riyadh", "Saudi Arabia"),
    ("Jeddah", "Saudi Arabia"),
]

LANGUAGES = ["english", "urdu", "arabic", "hindi"]
CONTACT_CHANNELS = [choice for choice, _ in ContactChannel.choices]
STAGE_HINTS = ["stage ii", "stage iii", "stage iv", "metastatic"]
MARKER_HINTS = ["HER2", "TNBC", "BRCA", "HR+"]

LIKELY_BREAST_CONDITIONS = [
    "HER2+ Metastatic Breast Cancer",
    "Triple-Negative Breast Cancer",
    "Metastatic Breast Cancer",
    "Locally Advanced Breast Cancer",
]
UNLIKELY_ONCOLOGY_CONDITIONS = [
    "Prostate Cancer",
    "Colorectal Cancer",
    "Liver Cancer",
    "Ovarian Cancer",
]
NON_MATCH_DIAGNOSES = [
    "Type 2 Diabetes",
    "Chronic Migraine",
    "Hypertension",
    "Asthma",
    "Hypothyroidism",
]
NO_MATCH_STORIES = [
    "lorem zyxw qwer asdf zxcv tyui ghjk",
    "abcde qqqqq plmokn ibhytg vfrcdex swswsw",
    "random words without useful medical meaning repeated text",
]

PROFILE_BUCKETS = (
    ("strong_match", 0.24),
    ("good_match", 0.24),
    ("borderline_match", 0.20),
    ("weak_match", 0.14),
    ("unlikely_match", 0.10),
    ("no_match", 0.08),
)


@dataclass
class SeedProfile:
    profile_name: str
    age: int
    sex: str
    city: str
    country: str
    diagnosis_hint: str
    stage_hint: str
    story: str
    completeness: int


def _next_patient_code() -> str:
    n = PatientProfile.objects.count() + 1
    while True:
        code = f"PAT-{n:04d}"
        if not PatientProfile.objects.filter(patient_code=code).exists():
            return code
        n += 1


def _weighted_profile_choice() -> str:
    names = [name for name, _ in PROFILE_BUCKETS]
    weights = [weight for _, weight in PROFILE_BUCKETS]
    return random.choices(names, weights=weights, k=1)[0]


def _build_seed_profile(mode: str, condition_pool: list[str]) -> SeedProfile:
    if mode == "random":
        condition = random.choice(condition_pool)
        marker = random.choice(MARKER_HINTS)
        stage_hint = random.choice(STAGE_HINTS)
        city, country = random.choice(CITY_COUNTRY)
        ecog = random.choice([0, 1, 1, 2])
        return SeedProfile(
            profile_name="random",
            age=random.randint(24, 76),
            sex=random.choice(["female", "male"]),
            city=city,
            country=country,
            diagnosis_hint=condition,
            stage_hint=stage_hint,
            story=(
                f"Patient diagnosed with {condition}. {marker} marker noted. "
                f"Disease currently {stage_hint}. Prior systemic treatment attempted with partial response, "
                f"then progression. ECOG {ecog}. Considering trial enrollment and willing to attend visits in {city}."
            ),
            completeness=random.randint(70, 100),
        )

    profile = _weighted_profile_choice()
    if profile == "strong_match":
        condition = random.choice(condition_pool)
        marker = random.choice(["HER2", "TNBC"])
        city, country = random.choice(MATCH_FRIENDLY_CITIES)
        ecog = random.choice([0, 1])
        age = random.randint(32, 64)
        story = (
            f"Diagnosed with {condition}. Biomarker: {marker}. Stage IV metastatic progression after prior anti-HER2/chemo treatment. "
            f"ECOG {ecog}. Recent CBC, bilirubin and creatinine labs are available and acceptable. "
            f"Patient can attend visits at {city} and is actively seeking clinical trial enrollment."
        )
        return SeedProfile(profile, age, "female", city, country, condition, "Stage IV", story, random.randint(92, 100))

    if profile == "good_match":
        condition = random.choice(condition_pool)
        marker = random.choice(MARKER_HINTS)
        city, country = random.choice(MATCH_FRIENDLY_CITIES)
        age = random.randint(28, 69)
        story = (
            f"History of {condition} with {marker} marker status noted. Disease is advanced with prior lines of therapy. "
            f"ECOG 1. Interested in enrollment and can travel to {city}. Lab updates are partially available."
        )
        return SeedProfile(profile, age, random.choice(["female", "male"]), city, country, condition, "Stage III", story, random.randint(80, 92))

    if profile == "borderline_match":
        condition = random.choice(condition_pool)
        city, country = random.choice(DISTANT_CITIES + MATCH_FRIENDLY_CITIES)
        age = random.randint(22, 74)
        story = (
            f"Possible {condition} with incomplete biomarker confirmation. Prior treatment history is partial and ECOG is not documented. "
            f"Patient currently in {city}. Interested in trial options but clinical records are incomplete."
        )
        return SeedProfile(profile, age, random.choice(["female", "male"]), city, country, condition, "Stage II", story, random.randint(62, 80))

    if profile == "weak_match":
        condition = random.choice(UNLIKELY_ONCOLOGY_CONDITIONS)
        city, country = random.choice(DISTANT_CITIES)
        age = random.randint(35, 78)
        story = (
            f"Diagnosed with {condition}. Multiple prior treatments, uncertain metastatic status, and missing ECOG/labs. "
            f"Patient is located in {city} with limited ability to travel frequently."
        )
        return SeedProfile(profile, age, random.choice(["female", "male"]), city, country, condition, "Unknown stage", story, random.randint(48, 68))

    if profile == "unlikely_match":
        diagnosis = random.choice(NON_MATCH_DIAGNOSES)
        city, country = random.choice(CITY_COUNTRY)
        age = random.randint(25, 80)
        story = (
            f"Primary issue is {diagnosis}. No documented cancer diagnosis, no biomarker data, and no oncology treatment history. "
            f"Patient asks whether any trial is relevant."
        )
        return SeedProfile(profile, age, random.choice(["female", "male"]), city, country, diagnosis, "", story, random.randint(35, 58))

    # no_match
    city, country = random.choice(CITY_COUNTRY)
    age = random.randint(21, 70)
    story = random.choice(NO_MATCH_STORIES)
    return SeedProfile(profile, age, random.choice(["female", "male"]), city, country, "", "", story, random.randint(20, 40))


def _build_contact(first: str, last: str, country: str) -> tuple[str, str]:
    channel = random.choice(CONTACT_CHANNELS)
    country_key = (country or "").strip().lower()
    if channel in {"sms", "phone", "whatsapp"}:
        if country_key == "uae":
            number = random.randint(500000000, 599999999)
            return channel, f"+971{number}"
        if country_key == "saudi arabia":
            number = random.randint(500000000, 599999999)
            return channel, f"+966{number}"
        number = random.randint(3000000000, 3499999999)
        return channel, f"+92{number}"
    email_local = f"{first.lower()}.{last.lower()}{random.randint(10, 99)}"
    return channel, f"{email_local}@example.com"


class Command(BaseCommand):
    help = "Generate synthetic patients for matching demos with optional spectrum coverage."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=120)
        parser.add_argument("--organization-slug", type=str, default="aga-khan-demo")
        parser.add_argument("--seed", type=int, default=42)
        parser.add_argument("--mode", choices=["random", "spectrum"], default="spectrum")
        parser.add_argument("--run-matching", action="store_true")

    def handle(self, *args, **options):
        count = max(1, min(int(options["count"]), 5000))
        org_slug = options["organization_slug"]
        seed = options["seed"]
        mode = options["mode"]
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
        for trial in Trial.objects.all()[:1000]:
            for condition in trial.conditions or []:
                if isinstance(condition, str) and condition.strip():
                    lowered = condition.strip().lower()
                    if "breast" in lowered or "her2" in lowered or "tnbc" in lowered:
                        condition_pool.append(condition.strip())
        if not condition_pool:
            condition_pool = LIKELY_BREAST_CONDITIONS[:]

        created = 0
        profile_counts: Counter[str] = Counter()
        for _ in range(count):
            first = random.choice(FIRST_NAMES)
            last = random.choice(LAST_NAMES)
            full_name = f"{first} {last}"
            seed_profile = _build_seed_profile(mode, condition_pool)

            structured = infer_structured_profile(seed_profile.story)
            diagnosis = structured.get("diagnosis") or seed_profile.diagnosis_hint
            stage = structured.get("stage") or seed_profile.stage_hint

            if seed_profile.profile_name == "no_match":
                # Intentionally keep this sparse so it remains non-matchable.
                diagnosis = ""
                stage = ""
                structured = {}

            if isinstance(structured, dict):
                structured["seed_profile"] = seed_profile.profile_name

            channel, contact_value = _build_contact(first, last, seed_profile.country)

            profile = PatientProfile.objects.create(
                patient_code=_next_patient_code(),
                organization=organization,
                full_name=full_name,
                age=seed_profile.age,
                sex=seed_profile.sex,
                city=seed_profile.city,
                country=seed_profile.country,
                language=random.choice(LANGUAGES),
                diagnosis=diagnosis,
                stage=stage,
                story=seed_profile.story,
                structured_profile=structured,
                contact_channel=channel,
                contact_value=contact_value,
                consent=True,
                profile_completeness=seed_profile.completeness,
            )
            created += 1
            profile_counts[seed_profile.profile_name] += 1

            if created % 100 == 0:
                self.stdout.write(self.style.NOTICE(f"Generated {created} patients... (latest: {profile.patient_code})"))

        self.stdout.write(self.style.SUCCESS(f"Generated synthetic patients: {created}"))
        if profile_counts:
            self.stdout.write("Profile distribution:")
            for key, value in sorted(profile_counts.items()):
                self.stdout.write(f"  - {key}: {value}")

        if run_matching:
            try:
                run = run_full_matching_cycle(run_type="mock_generation")
            except MatchingRunAlreadyRunningError:
                self.stdout.write(self.style.WARNING("Skipped matching run because another run is already in progress."))
            else:
                self.stdout.write(self.style.SUCCESS(f"Matching run {run.id} complete: {run.metadata}"))
