from __future__ import annotations

import json
import re
from typing import Dict, List

import requests
from django.conf import settings

from apps.core.services.embedding import generate_embedding


KEYWORDS_TO_DIAGNOSIS = {
    "her2": "HER2+ Breast Cancer",
    "triple-negative": "Triple-Negative Breast Cancer",
    "tnbc": "Triple-Negative Breast Cancer",
    "brca": "BRCA-Mutated Breast Cancer",
    "hr+": "HR+/HER2- Breast Cancer",
}

STORY_PARSE_PROMPT_TEMPLATE = """
You are a clinical intake normalizer.
Given a patient free-text story, extract medically relevant details and remove non-medical chatter.

Return STRICT JSON with this exact schema:
{{
  "ai_summary": "string",
  "diagnosis": "string",
  "stage": "string",
  "markers": ["string"],
  "symptoms": ["string"],
  "treatments": ["string"]
}}

Rules:
- Keep only clinical facts from the story.
- If unknown, use empty string or empty array.
- Do not invent medical facts.
- Return JSON only.

Patient story:
{story}
""".strip()

KNOWN_MARKERS = {"her2", "brca", "pik3ca", "ecog", "metastatic", "stage iv", "pd-l1"}


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _normalize_markers(values: object) -> List[str]:
    if not isinstance(values, list):
        return []
    normalized: List[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        marker = value.strip().lower()
        if not marker:
            continue
        if marker in KNOWN_MARKERS and marker not in seen:
            seen.add(marker)
            normalized.append(marker)
    return normalized


def _extract_json_object(text: str) -> Dict[str, object]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("no_json_object")

    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("json_not_object")
    return parsed


def _extract_gemini_text(payload: object) -> str:
    if not isinstance(payload, dict):
        return ""
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return ""

    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        content = candidate.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue

        chunks: List[str] = []
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                chunks.append(text)
        if chunks:
            return "\n".join(chunks)
    return ""


def _gemini_story_parse(story: str) -> Dict[str, object] | None:
    if not settings.GEMINI_API_KEY:
        return None
    llm_mode = str(getattr(settings, "LLM_MODE", "auto")).lower()
    if llm_mode not in {"auto", "gemini"}:
        return None

    model = settings.GEMINI_MODEL or "gemini-2.0-flash"
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    prompt = STORY_PARSE_PROMPT_TEMPLATE.format(story=story)

    try:
        response = requests.post(
            endpoint,
            headers={
                "Content-Type": "application/json",
                "X-goog-api-key": settings.GEMINI_API_KEY,
            },
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 600,
                    "responseMimeType": "application/json",
                },
            },
            timeout=25,
        )
        response.raise_for_status()
        payload = response.json()
        text = _extract_gemini_text(payload).strip()
        if not text:
            return None

        try:
            parsed = _extract_json_object(text)
        except Exception:
            # Gemini occasionally returns plain text even when JSON is requested.
            fallback_summary = _normalize_text(text)
            if not fallback_summary:
                return None
            return {
                "ai_summary": fallback_summary,
                "diagnosis": "",
                "stage": "",
                "markers": [],
                "symptoms": [],
                "treatments": [],
                "parser": f"gemini:{model}:text",
            }

        return {
            "ai_summary": _normalize_text(str(parsed.get("ai_summary", ""))),
            "diagnosis": _normalize_text(str(parsed.get("diagnosis", ""))),
            "stage": _normalize_text(str(parsed.get("stage", ""))),
            "markers": _normalize_markers(parsed.get("markers")),
            "symptoms": [
                _normalize_text(str(item))
                for item in (parsed.get("symptoms") if isinstance(parsed.get("symptoms"), list) else [])
                if isinstance(item, str) and _normalize_text(item)
            ],
            "treatments": [
                _normalize_text(str(item))
                for item in (parsed.get("treatments") if isinstance(parsed.get("treatments"), list) else [])
                if isinstance(item, str) and _normalize_text(item)
            ],
            "parser": f"gemini:{model}",
        }
    except Exception:
        return None


def infer_structured_profile(story: str) -> Dict[str, object]:
    raw_story = _normalize_text(story or "")
    lowered = raw_story.lower()
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

    deterministic_summary = raw_story
    llm_result = _gemini_story_parse(raw_story) if raw_story else None

    diagnosis = inferred_diagnosis
    if llm_result and llm_result.get("diagnosis"):
        diagnosis = str(llm_result["diagnosis"])

    derived_stage = stage
    if llm_result and llm_result.get("stage"):
        derived_stage = str(llm_result["stage"])

    llm_markers = llm_result.get("markers", []) if llm_result else []
    all_markers: List[str] = []
    seen_markers: set[str] = set()
    for marker in [*markers, *llm_markers]:
        if not isinstance(marker, str):
            continue
        cleaned = marker.strip().lower()
        if not cleaned or cleaned in seen_markers:
            continue
        seen_markers.add(cleaned)
        all_markers.append(cleaned)

    ai_summary = deterministic_summary
    if llm_result and llm_result.get("ai_summary"):
        ai_summary = str(llm_result["ai_summary"])

    return {
        "diagnosis": diagnosis,
        "stage": derived_stage,
        "markers": all_markers,
        "raw_story": raw_story,
        "clean_story": ai_summary,
        "ai_summary": ai_summary,
        "symptoms": list(llm_result.get("symptoms", [])) if llm_result else [],
        "treatments": list(llm_result.get("treatments", [])) if llm_result else [],
        "parser": (llm_result.get("parser") if llm_result else "deterministic"),
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
    story_for_embedding = (
        str(structured.get("clean_story") or "")
        or str(structured.get("ai_summary") or "")
        or str(payload.get("story") or "")
    )
    return (
        f"Patient summary. Name: {payload.get('name')}. Age: {payload.get('age')}. "
        f"Sex: {payload.get('sex')}. Location: {payload.get('city')}, {payload.get('country')}. "
        f"Diagnosis: {structured.get('diagnosis')}. Stage: {structured.get('stage')}. "
        f"Markers: {', '.join(structured.get('markers', []))}. "
        f"Story: {story_for_embedding}"
    )


def generate_patient_embedding(payload: Dict[str, object], structured: Dict[str, object]) -> List[float]:
    return generate_embedding(patient_embedding_text(payload, structured))
