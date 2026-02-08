from __future__ import annotations

from typing import Dict, List

from apps.core.services.embedding import generate_embedding


KEYWORDS_TO_DIAGNOSIS = {
    "her2": "HER2+ Breast Cancer",
    "triple-negative": "Triple-Negative Breast Cancer",
    "tnbc": "Triple-Negative Breast Cancer",
    "brca": "BRCA-Mutated Breast Cancer",
    "hr+": "HR+/HER2- Breast Cancer",
}


def infer_structured_profile(story: str) -> Dict[str, object]:
    lowered = (story or "").lower()
    inferred_diagnosis = ""
    for keyword, diagnosis in KEYWORDS_TO_DIAGNOSIS.items():
        if keyword in lowered:
            inferred_diagnosis = diagnosis
            break

    markers: List[str] = []
    for marker in ["her2", "brca", "pik3ca", "ecog", "metastatic", "stage iv", "pd-l1"]:
        if marker in lowered:
            markers.append(marker)

    stage = ""
    if "stage iv" in lowered or "metastatic" in lowered:
        stage = "Stage IV (Metastatic)"
    elif "stage iii" in lowered:
        stage = "Stage III"

    return {
        "diagnosis": inferred_diagnosis,
        "stage": stage,
        "markers": markers,
        "raw_story": story,
    }


def compute_completeness(payload: Dict[str, object]) -> int:
    fields = [
        bool(payload.get("name")),
        bool(payload.get("age")),
        bool(payload.get("sex")),
        bool(payload.get("city")),
        bool(payload.get("country")),
        bool(payload.get("language")),
        bool(payload.get("contactChannel")),
        bool(payload.get("contactInfo")),
        bool(payload.get("story")),
        bool(payload.get("consent")),
    ]
    return round((sum(fields) / len(fields)) * 100)


def patient_embedding_text(payload: Dict[str, object], structured: Dict[str, object]) -> str:
    return (
        f"Patient summary. Name: {payload.get('name')}. Age: {payload.get('age')}. "
        f"Sex: {payload.get('sex')}. Location: {payload.get('city')}, {payload.get('country')}. "
        f"Diagnosis: {structured.get('diagnosis')}. Stage: {structured.get('stage')}. "
        f"Markers: {', '.join(structured.get('markers', []))}. "
        f"Story: {payload.get('story', '')}"
    )


def generate_patient_embedding(payload: Dict[str, object], structured: Dict[str, object]) -> List[float]:
    return generate_embedding(patient_embedding_text(payload, structured))
