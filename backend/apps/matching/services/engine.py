from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Set, Tuple

from django.conf import settings
from django.db import connection
from django.db.models import QuerySet
from django.utils import timezone
from pgvector.django import CosineDistance

from apps.matching.models import MatchEvaluation, MatchOverallStatus, MatchingRun, UrgencyFlag
from apps.matching.services.explanation import generate_explanation
from apps.patients.models import PatientProfile
from apps.patients.services.profile import generate_patient_embedding
from apps.trials.models import Trial

TOKEN_PATTERN = re.compile(r"[a-z0-9\+\-]{3,}")
AGE_RANGE_PATTERN = re.compile(r"(\d{1,3})\s*(?:-|to)\s*(\d{1,3})\s*(?:years|year|yrs|yr|yo|y/o)")
MIN_AGE_PATTERN = re.compile(r"(?:minimum age|min age)\s*[:\-]?\s*(\d{1,3})")
MAX_AGE_PATTERN = re.compile(r"(?:maximum age|max age)\s*[:\-]?\s*(\d{1,3})")
REPEATED_CHAR_PATTERN = re.compile(r"(.)\1{5,}")
MEDICAL_SIGNAL_PATTERN = re.compile(
    r"\b(cancer|tumou?r|metasta\w+|stage|ecog|her2|brca|chemo\w*|radiation|biopsy|diagnos\w+|treatment|"
    r"surgery|hormone|receptor|trial|oncolog\w+|carcinoma|lymphoma|leukemia|platelet|bilirubin|"
    r"creatinine|cbc|lft|lab|blood|symptom|pain|mri|ct|scan)\b",
    re.IGNORECASE,
)

STOP_WORDS = {
    "with",
    "from",
    "have",
    "been",
    "that",
    "this",
    "were",
    "which",
    "will",
    "patient",
    "patients",
    "trial",
    "study",
    "disease",
    "cancer",
    "treatment",
    "prior",
    "after",
    "before",
    "under",
    "over",
    "into",
    "and",
    "the",
    "for",
    "are",
}

MATCHING_RUN_LOCK_KEY = 8432671934


class MatchingRunAlreadyRunningError(RuntimeError):
    def __init__(self, running_run: MatchingRun | None = None):
        super().__init__("A matching run is already in progress.")
        self.running_run = running_run


@dataclass
class Candidate:
    trial: Trial
    similarity: float


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _tokenize(text: str) -> Set[str]:
    if not text:
        return set()
    return {t for t in TOKEN_PATTERN.findall(text.lower()) if t not in STOP_WORDS}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a.intersection(b)) / len(a.union(b))


def _normalized_weights(weights: Dict[str, float] | None) -> Dict[str, float]:
    defaults = {"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05}
    if not isinstance(weights, dict):
        return defaults

    merged = {}
    total = 0.0
    for key, default_value in defaults.items():
        value = weights.get(key, default_value)
        try:
            parsed = float(value)
        except Exception:
            parsed = default_value
        parsed = max(0.0, parsed)
        merged[key] = parsed
        total += parsed

    if total <= 0:
        return defaults
    return {k: v / total for k, v in merged.items()}


def _trial_text(trial: Trial) -> str:
    return " ".join(
        [
            trial.title or "",
            trial.summary or "",
            trial.eligibility_summary or "",
            trial.inclusion_text or "",
            trial.exclusion_text or "",
            " ".join(trial.conditions or []),
            " ".join(trial.interventions or []),
        ]
    ).lower()


def _condition_overlap_score(patient: PatientProfile, trial: Trial) -> float:
    patient_tokens = _tokenize(f"{patient.diagnosis} {patient.story} {patient.stage}")
    trial_tokens = _tokenize(" ".join(trial.conditions or []))
    return _jaccard(patient_tokens, trial_tokens)


def _extract_markers(patient: PatientProfile) -> Set[str]:
    markers = set()
    structured = patient.structured_profile if isinstance(patient.structured_profile, dict) else {}
    for marker in structured.get("markers", []):
        if isinstance(marker, str):
            markers.add(marker.lower())

    raw_story = (patient.story or "").lower()
    for marker in ("her2", "brca", "pik3ca", "ecog", "metastatic", "stage iv", "pd-l1"):
        if marker in raw_story:
            markers.add(marker)
    return markers


def _marker_overlap_score(patient: PatientProfile, trial: Trial) -> Tuple[float, List[str]]:
    markers = _extract_markers(patient)
    if not markers:
        return 0.0, []
    text = _trial_text(trial)
    matched = [m for m in markers if m in text]
    return len(matched) / max(1, len(markers)), matched


def _extract_age_limits(text: str) -> Tuple[int | None, int | None]:
    min_age: int | None = None
    max_age: int | None = None

    range_match = AGE_RANGE_PATTERN.search(text)
    if range_match:
        min_age = int(range_match.group(1))
        max_age = int(range_match.group(2))

    min_match = MIN_AGE_PATTERN.search(text)
    if min_match:
        parsed = int(min_match.group(1))
        min_age = parsed if min_age is None else max(min_age, parsed)

    max_match = MAX_AGE_PATTERN.search(text)
    if max_match:
        parsed = int(max_match.group(1))
        max_age = parsed if max_age is None else min(max_age, parsed)

    return min_age, max_age


def _sex_constraint(text: str, sex: str) -> Tuple[bool | None, str]:
    lowered = text.lower()
    patient_sex = (sex or "").lower()

    female_only = "female" in lowered or "women" in lowered
    male_only = "male only" in lowered or "men only" in lowered

    if female_only and patient_sex and patient_sex != "female":
        return False, "Trial appears restricted to female participants"
    if male_only and patient_sex and patient_sex != "male":
        return False, "Trial appears restricted to male participants"
    if female_only or male_only:
        return True, "Patient sex aligns with trial sex requirements"
    return None, ""


def _location_feasibility(patient: PatientProfile, trial: Trial) -> Tuple[float, str]:
    patient_city = (patient.city or "").lower()
    patient_country = (patient.country or "").lower()

    for site in trial.sites.all():
        if patient_city and patient_city in (site.city or "").lower() and patient_country in (site.country or "").lower():
            return 1.0, "Patient city and country align with a recruiting site"

    for site in trial.sites.all():
        if patient_country and patient_country in (site.country or "").lower():
            return 0.8, "Patient country aligns with a recruiting site"

    if patient_country and any(patient_country in c.lower() for c in trial.countries or []):
        return 0.7, "Patient country aligns with trial country availability"

    if not trial.sites.exists():
        return 0.6, "Trial site data is limited; coordinator should confirm logistics"

    return 0.45, "Travel feasibility requires coordinator confirmation"


def _derive_urgency(patient: PatientProfile) -> tuple[int, str]:
    text = f"{patient.stage} {patient.story}".lower()
    if "stage iv" in text or "metastatic" in text or "progress" in text:
        return 88, UrgencyFlag.HIGH
    if "stage iii" in text or "advanced" in text:
        return 64, UrgencyFlag.MEDIUM
    return 38, UrgencyFlag.LOW


def _has_meaningful_clinical_context(patient: PatientProfile) -> bool:
    story = (patient.story or "").strip()
    diagnosis = (patient.diagnosis or "").strip()
    stage = (patient.stage or "").strip()
    structured = patient.structured_profile if isinstance(patient.structured_profile, dict) else {}
    markers = [marker for marker in structured.get("markers", []) if isinstance(marker, str) and marker.strip()]

    combined_text = " ".join(filter(None, [diagnosis, stage, story, " ".join(markers)]))
    if not combined_text:
        return False

    if REPEATED_CHAR_PATTERN.search(combined_text.lower()):
        return False

    raw_tokens = [token for token in TOKEN_PATTERN.findall(combined_text.lower()) if token not in STOP_WORDS]
    if len(raw_tokens) < 5 and not (diagnosis or stage or markers):
        return False

    if len(raw_tokens) >= 8:
        unique_ratio = len(set(raw_tokens)) / max(1, len(raw_tokens))
        if unique_ratio < 0.4:
            return False

    non_space_chars = [char for char in combined_text if not char.isspace()]
    if len(non_space_chars) >= 16:
        letter_chars = [char for char in non_space_chars if char.isalpha()]
        if letter_chars and (len(letter_chars) / len(non_space_chars)) < 0.45:
            return False

    has_structured_signal = bool(diagnosis or stage or markers)
    has_medical_signal = bool(MEDICAL_SIGNAL_PATTERN.search(combined_text))
    return has_structured_signal or has_medical_signal


def _evaluate_rules(patient: PatientProfile, trial: Trial, similarity: float) -> Dict[str, object]:
    reasons_matched: List[str] = []
    reasons_failed: List[str] = []
    missing_info: List[str] = []
    doctor_checklist: List[str] = []

    trial_text = _trial_text(trial)
    condition_overlap = _condition_overlap_score(patient, trial)
    marker_overlap, matched_markers = _marker_overlap_score(patient, trial)

    if condition_overlap >= 0.08:
        reasons_matched.append("Diagnosis profile overlaps with trial condition focus")
    else:
        reasons_failed.append("Diagnosis alignment with trial conditions is weak")

    if matched_markers:
        reasons_matched.append(f"Biomarker alignment noted ({', '.join(matched_markers[:3])})")
    else:
        missing_info.append("Biomarker alignment unclear from provided records")

    min_age, max_age = _extract_age_limits(trial_text)
    age_penalty = 0
    if min_age is not None and patient.age < min_age:
        reasons_failed.append(f"Patient age {patient.age} is below trial minimum age {min_age}")
        age_penalty += 35
    elif max_age is not None and patient.age > max_age:
        reasons_failed.append(f"Patient age {patient.age} is above trial maximum age {max_age}")
        age_penalty += 35
    elif min_age is not None or max_age is not None:
        reasons_matched.append("Patient age falls within trial age window")
    else:
        missing_info.append("Age criteria could not be extracted from trial eligibility text")

    sex_ok, sex_reason = _sex_constraint(trial_text, patient.sex)
    if sex_ok is False:
        reasons_failed.append(sex_reason)
    elif sex_ok is True and sex_reason:
        reasons_matched.append(sex_reason)
    else:
        missing_info.append("Sex-specific eligibility constraints are not explicit")

    if trial.status in {"RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"}:
        reasons_matched.append(f"Trial status is {trial.status}")
    else:
        reasons_failed.append("Trial is not currently available for matching")

    location_score, location_reason = _location_feasibility(patient, trial)
    if location_score >= 0.8:
        reasons_matched.append(location_reason)
    else:
        missing_info.append(location_reason)

    story = (patient.story or "").lower()
    if "ecog" not in story:
        missing_info.append("ECOG/performance status missing")
    if "bilirubin" not in story and "cbc" not in story and "creatinine" not in story:
        missing_info.append("Recent labs are missing (CBC/LFTs/renal)")

    doctor_checklist.extend(
        [
            "Order CBC with differential",
            "Order hepatic and renal function panel",
            "Confirm ECOG performance status",
            "Review inclusion/exclusion criteria with treating oncologist",
        ]
    )

    eligibility = 32 + int(condition_overlap * 34) + int(marker_overlap * 18) + int(similarity * 16)
    if trial.status not in {"RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"}:
        eligibility -= 25
    eligibility -= age_penalty
    eligibility -= len(reasons_failed) * 7
    eligibility_score = int(_clamp(eligibility, 0, 100))

    feasibility = 40 + int(location_score * 45) + int(min(15, patient.profile_completeness / 10))
    feasibility -= 6 if "Travel feasibility" in " ".join(missing_info) else 0
    feasibility_score = int(_clamp(feasibility, 0, 100))

    urgency_score, urgency_flag = _derive_urgency(patient)
    explainability = 96 - (len(missing_info) * 10) - (len(reasons_failed) * 8)
    explainability_score = int(_clamp(explainability, 30, 99))

    weights = _normalized_weights(
        patient.organization.score_weights if patient.organization and patient.organization.score_weights else None
    )
    weighted_score = (
        eligibility_score * weights["eligibility"]
        + feasibility_score * weights["feasibility"]
        + urgency_score * weights["urgency"]
        + explainability_score * weights["explainability"]
    )

    if weighted_score >= 78 and not reasons_failed:
        overall_status = MatchOverallStatus.ELIGIBLE
    elif weighted_score >= 55:
        overall_status = MatchOverallStatus.POSSIBLY_ELIGIBLE
    else:
        overall_status = MatchOverallStatus.UNLIKELY

    confidence = 0.34 + (weighted_score / 100.0) * 0.44 + (similarity * 0.14) - (len(missing_info) * 0.02)
    confidence = round(_clamp(confidence, 0.2, 0.97), 2)

    return {
        "eligibility_score": eligibility_score,
        "feasibility_score": feasibility_score,
        "urgency_score": urgency_score,
        "urgency_flag": urgency_flag,
        "explainability_score": explainability_score,
        "weighted_score": round(weighted_score, 2),
        "overall_status": overall_status,
        "reasons_matched": reasons_matched,
        "reasons_failed": reasons_failed,
        "missing_info": missing_info,
        "doctor_checklist": doctor_checklist,
        "confidence": confidence,
    }


def _candidate_trials(patient: PatientProfile) -> List[Candidate]:
    allowed_statuses = ["RECRUITING", "NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING"]
    queryset: QuerySet[Trial] = Trial.objects.filter(status__in=allowed_statuses).prefetch_related("sites")

    if patient.embedding_vector is not None:
        try:
            ranked = (
                queryset.exclude(embedding_vector=None)
                .annotate(distance=CosineDistance("embedding_vector", patient.embedding_vector))
                .order_by("distance")[: settings.MATCH_TOP_K * 2]
            )
            combined = []
            for trial in ranked:
                vector_similarity = _clamp(1.0 - float(trial.distance), 0.0, 1.0)
                lexical_similarity = _condition_overlap_score(patient, trial)
                similarity = _clamp((vector_similarity * 0.85) + (lexical_similarity * 0.15), 0.0, 1.0)
                combined.append(Candidate(trial=trial, similarity=similarity))

            if combined:
                combined.sort(key=lambda c: c.similarity, reverse=True)
                return combined[: settings.MATCH_TOP_K]
        except Exception:
            pass

    fallback = queryset[: settings.MATCH_TOP_K * 2]
    candidates = []
    for trial in fallback:
        lexical_similarity = _condition_overlap_score(patient, trial)
        candidates.append(Candidate(trial=trial, similarity=_clamp(0.45 + lexical_similarity * 0.45, 0.0, 1.0)))
    candidates.sort(key=lambda c: c.similarity, reverse=True)
    return candidates[: settings.MATCH_TOP_K]


def _build_patient_payload(patient: PatientProfile) -> Dict[str, object]:
    return {
        "patient_code": patient.patient_code,
        "name": patient.full_name,
        "age": patient.age,
        "sex": patient.sex,
        "city": patient.city,
        "country": patient.country,
        "diagnosis": patient.diagnosis,
        "stage": patient.stage,
        "story": patient.story,
        "structured_profile": patient.structured_profile,
    }


def _build_trial_payload(trial: Trial) -> Dict[str, object]:
    return {
        "trial_id": trial.trial_id,
        "title": trial.title,
        "phase": trial.phase,
        "status": trial.status,
        "conditions": trial.conditions,
        "interventions": trial.interventions,
        "eligibility_summary": trial.eligibility_summary,
        "inclusion_text": trial.inclusion_text,
        "exclusion_text": trial.exclusion_text,
        "sites": [{"facility": s.facility, "city": s.city, "country": s.country} for s in trial.sites.all()],
    }


def ensure_patient_embedding(patient: PatientProfile) -> None:
    if patient.embedding_vector is not None:
        return
    vector = generate_patient_embedding(
        {
            "name": patient.full_name,
            "age": patient.age,
            "sex": patient.sex,
            "city": patient.city,
            "country": patient.country,
            "story": patient.story,
        },
        patient.structured_profile,
    )
    patient.embedding_vector = vector
    patient.save(update_fields=["embedding_vector", "updated_at"])


def evaluate_patient_against_trials(patient: PatientProfile, run: MatchingRun | None = None) -> int:
    if not _has_meaningful_clinical_context(patient):
        MatchEvaluation.objects.filter(patient=patient).delete()
        return 0

    ensure_patient_embedding(patient)
    candidates = _candidate_trials(patient)[: settings.MATCH_EVALUATE_TOP_N]

    updates = 0
    for candidate in candidates:
        trial = candidate.trial
        rule_result = _evaluate_rules(patient, trial, candidate.similarity)
        explanation = generate_explanation(
            _build_patient_payload(patient),
            _build_trial_payload(trial),
            rule_result,
        )

        existed_before = MatchEvaluation.objects.filter(patient=patient, trial=trial).exists()
        match, created = MatchEvaluation.objects.update_or_create(
            patient=patient,
            trial=trial,
            defaults={
                "organization": patient.organization,
                "matching_run": run,
                "eligibility_score": rule_result["eligibility_score"],
                "feasibility_score": rule_result["feasibility_score"],
                "urgency_score": rule_result["urgency_score"],
                "explainability_score": rule_result["explainability_score"],
                "urgency_flag": rule_result["urgency_flag"],
                "overall_status": explanation.get("overall_status", rule_result["overall_status"]),
                "reasons_matched": explanation.get("reasons_matched", rule_result["reasons_matched"]),
                "reasons_failed": explanation.get("reasons_failed", rule_result["reasons_failed"]),
                "missing_info": explanation.get("missing_info", rule_result["missing_info"]),
                "doctor_checklist": explanation.get("doctor_checklist", rule_result["doctor_checklist"]),
                "explanation_summary": explanation.get("plain_language_summary", ""),
                "explanation_language": patient.language[:2].lower() if patient.language else "en",
                "explanation_model": explanation.get("model", "deterministic-fallback"),
                "prompt_version": settings.LLM_PROMPT_VERSION,
                "confidence": float(explanation.get("confidence", rule_result["confidence"])),
                "vector_similarity": candidate.similarity,
                "is_new": not existed_before,
            },
        )
        # Keep previous outreach state for existing matches.
        if not created:
            match.is_new = False
            match.save(update_fields=["is_new", "updated_at"])
        updates += 1

    return updates


def run_full_matching_cycle(run_type: str = "scheduled") -> MatchingRun:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", [MATCHING_RUN_LOCK_KEY])
        lock_row = cursor.fetchone()
    lock_acquired = bool(lock_row and lock_row[0])

    if not lock_acquired:
        running_run = MatchingRun.objects.filter(status="running").order_by("-started_at").first()
        raise MatchingRunAlreadyRunningError(running_run=running_run)

    run: MatchingRun | None = None
    try:
        run = MatchingRun.objects.create(run_type=run_type, status="running")
        total_updates = 0
        patients = PatientProfile.objects.select_related("organization").all()

        for patient in patients:
            total_updates += evaluate_patient_against_trials(patient, run=run)

        run.status = "completed"
        run.metadata = {"patients": patients.count(), "updates": total_updates}
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "metadata", "finished_at", "updated_at"])
        return run
    except Exception as exc:
        if run is not None:
            run.status = "failed"
            run.finished_at = timezone.now()
            run.metadata = {
                **(run.metadata or {}),
                "error": str(exc),
            }
            run.save(update_fields=["status", "metadata", "finished_at", "updated_at"])
        raise
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(%s)", [MATCHING_RUN_LOCK_KEY])
